// fix-extensions.js  (rulează după build)
// Node ESM (package.json "type":"module").

// 🔧 Setări
import { promises as fs } from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const SERVER_DIST = path.resolve(__dirname, 'dist', 'src', 'server');

// EXTENSII pe care NU vrem să le atingem (au deja extensie sau nu sunt JS)
const EXT_OK = /\.(mjs|cjs|js|json|node|wasm|css|map)$/i;

// Adaugă .js doar la spec-urile relative fără extensie
function normalizeSpec(spec) {
  if (!spec.startsWith('./') && !spec.startsWith('../')) return spec; // doar relative
  if (EXT_OK.test(spec)) return spec; // are deja extensie
  if (spec.endsWith('/')) return spec; // import folder → lăsăm în pace
  return `${spec}.js`;
}

// Patch pentru import/export statice:  import … from '…';   export … from '…';
function patchStaticImports(code) {
  // … from '...'
  code = code.replace(
    /(from\s*['"])(\.{1,2}\/[^'"]+)(['"])/g,
    (_m, p1, spec, p3) => `${p1}${normalizeSpec(spec)}${p3}`
  );

  // import '...'; (bare side-effect importuri relative)
  code = code.replace(
    /(^\s*import\s*['"])(\.{1,2}\/[^'"]+)(['"]\s*;?)/gm,
    (_m, p1, spec, p3) => `${p1}${normalizeSpec(spec)}${p3}`
  );

  return code;
}

// Patch pentru import-uri dinamice: import('…')
function patchDynamicImports(code) {
  return code.replace(
    /(import\(\s*['"])(\.{1,2}\/[^'"]+)(['"]\s*\))/g,
    (_m, p1, spec, p3) => `${p1}${normalizeSpec(spec)}${p3}`
  );
}

async function patchFile(filePath) {
  let code = await fs.readFile(filePath, 'utf8');
  const before = code;
  code = patchStaticImports(code);
  code = patchDynamicImports(code);
  if (code !== before) {
    await fs.writeFile(filePath, code, 'utf8');
    return true;
  }
  return false;
}

async function walk(dir, acc = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      await walk(full, acc);
    } else if (e.isFile() && full.endsWith('.js')) {
      acc.push(full);
    }
  }
  return acc;
}

async function main() {
  try {
    const jsFiles = await walk(SERVER_DIST);
    let changed = 0;
    for (const f of jsFiles) {
      const ok = await patchFile(f);
      if (ok) {
        changed++;
        console.log(`Fixed imports in ${f}`);
      }
    }
    console.log(`Done. Patched ${changed}/${jsFiles.length} server files.`);
  } catch (err) {
    console.error('fix-extensions failed:', err);
    process.exit(1);
  }
}

await main();
