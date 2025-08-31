import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// Convert __filename and __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define source and target directories
const targetDir = path.resolve(__dirname, "dist/src/server");
const serviceKeySourcePath = path.resolve(__dirname, "src/server/diniubire_servicekey.json");
const serviceKeyTargetPath = path.resolve(targetDir, "diniubire_servicekey.json");

// Function to add .js extensions to local imports
async function addJsExtensions(dir) {
  try {
    const files = await fs.readdir(dir, { withFileTypes: true });
    for (const file of files) {
      if (file.isDirectory()) {
        await addJsExtensions(path.join(dir, file.name));
      } else if (file.name.endsWith(".js")) {
        const filePath = path.join(dir, file.name);
        await fixFileImports(filePath);
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err);
  }
}

// Function to fix import statements in .js files
async function fixFileImports(filePath) {
  try {
    const data = await fs.readFile(filePath, "utf8");
    const fixedData = data.replace(/(import\s+.*?from\s+['"])(\.\/|\.\.\/)([^'"]+)(['"])/g, (match, p1, p2, p3, p4) => {
      // Only modify local file imports
      if (!p3.endsWith(".js")) {
        return `${p1}${p2}${p3}.js${p4}`;
      }
      return match;
    });
    await fs.writeFile(filePath, fixedData, "utf8");
    console.log(`Fixed imports in ${filePath}`);
  } catch (err) {
    console.error(`Error reading file ${filePath}:`, err);
  }
}

// Function to copy the JSON file to the target directory
async function copyServiceKey() {
  try {
    await fs.copyFile(serviceKeySourcePath, serviceKeyTargetPath);
    console.log(`Copied ${serviceKeySourcePath} to ${serviceKeyTargetPath}`);
  } catch (err) {
    console.error(`Error copying file: ${serviceKeySourcePath}`, err);
  }
}

// Main function to perform all operations
async function main() {
  await copyServiceKey(); // Copy the service key file
  await addJsExtensions(targetDir); // Fix .js extensions in the specified directory
}

main().catch(err => console.error(err));

// import fs from "fs/promises";
// import path from "path";
// import { fileURLToPath } from "url";

// // Convert __filename and __dirname for ES modules
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// const targetDir = path.resolve(__dirname, "dist/src/server");

// async function addJsExtensions(dir) {
//   try {
//     const files = await fs.readdir(dir, { withFileTypes: true });
//     for (const file of files) {
//       if (file.isDirectory()) {
//         await addJsExtensions(path.join(dir, file.name));
//       } else if (file.name.endsWith(".js")) {
//         const filePath = path.join(dir, file.name);
//         await fixFileImports(filePath);
//       }
//     }
//   } catch (err) {
//     console.error(`Error reading directory ${dir}:`, err);
//   }
// }

// async function fixFileImports(filePath) {
//   try {
//     const data = await fs.readFile(filePath, "utf8");
//     const fixedData = data.replace(/(import\s+.*?from\s+['"])(\.\/|\.\.\/)([^'"]+)(['"])/g, (match, p1, p2, p3, p4) => {
//       // Only modify local file imports
//       if (!p3.endsWith(".js")) {
//         return `${p1}${p2}${p3}.js${p4}`;
//       }
//       return match;
//     });
//     await fs.writeFile(filePath, fixedData, "utf8");
//     console.log(`Fixed imports in ${filePath}`);
//   } catch (err) {
//     console.error(`Error reading file ${filePath}:`, err);
//   }
// }

// addJsExtensions(targetDir);
