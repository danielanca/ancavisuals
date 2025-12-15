import { promises as fs } from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const DIST_ROOT = path.resolve(__dirname, 'dist');

const EXT_NODE_OK = /\.(mjs|cjs|js|json|node|wasm)$/i;

const normalizeSpec = (spec) => {
  if (!spec.startsWith('./') && !spec.startsWith('../')) return spec;
  if (spec.endsWith('/')) return spec;
  if (EXT_NODE_OK.test(spec)) return spec;
  return `${spec}.js`;
};

const patchStaticImports = (code) => {
  code = code.replace(
    /(from\s*['"])(\.{1,2}\/[^'"]+)(['"])/g,
    (_m, p1, spec, p3) => `${p1}${normalizeSpec(spec)}${p3}`
  );

  code = code.replace(
    /(^\s*import\s*['"])(\.{1,2}\/[^'"]+)(['"]\s*;?)/gm,
    (_m, p1, spec, p3) => `${p1}${normalizeSpec(spec)}${p3}`
  );

  return code;
};

const patchDynamicImports = (code) => {
  return code.replace(
    /(import\(\s*['"])(\.{1,2}\/[^'"]+)(['"]\s*\))/g,
    (_m, p1, spec, p3) => `${p1}${normalizeSpec(spec)}${p3}`
  );
};

const patchFile = async (filePath) => {
  const before = await fs.readFile(filePath, 'utf8');
  let after = before;

  after = patchStaticImports(after);
  after = patchDynamicImports(after);

  if (after !== before) {
    await fs.writeFile(filePath, after, 'utf8');
    return true;
  }

  return false;
};

const walk = async (dir, acc = []) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, acc);
      continue;
    }
    if (entry.isFile() && full.endsWith('.js')) {
      acc.push(full);
    }
  }
  return acc;
};

const main = async () => {
  try {
    await fs.access(DIST_ROOT);

    const jsFiles = await walk(DIST_ROOT);

    let changed = 0;
    for (const file of jsFiles) {
      const ok = await patchFile(file);
      if (ok) {
        changed += 1;
        console.log(`Fixed imports in ${file}`);
      }
    }

    console.log(`Done. Patched ${changed}/${jsFiles.length} files.`);
  } catch (err) {
    console.error('fix-extensions failed:', err);
    process.exit(1);
  }
};

await main();
