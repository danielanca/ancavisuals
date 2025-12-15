import axios from "axios";
import dotenv from "dotenv";

// Load .env file
dotenv.config();

export const storageZone = process.env.BUNNY_STORAGE_ZONE!;
const apiKey = process.env.BUNNY_STORAGE_KEY!;

if (!storageZone || !apiKey) {
  console.error("❌ Missing Bunny Storage ENV variables!");
  console.error("Make sure .env contains:");
  console.error("BUNNY_STORAGE_ZONE=xxxxx");
  console.error("BUNNY_STORAGE_KEY=xxxxx");
  process.exit(1);
}

const storageClient = axios.create({
  baseURL: `https://storage.bunnycdn.com`,
  headers: {
    AccessKey: apiKey,
  },
});

console.log("=====================================");
console.log("🔵 Bunny Storage Client Initialized");
console.log("📦 Storage Zone:", storageZone);
console.log("🔐 API KEY starts with:", apiKey.substring(0, 4) + "********");
console.log("=====================================\n");

export async function listFiles(path: string) {
  const cleanPath = path.replace(/^\/+/, "").replace(/\/+$/, "");
  const fullPath = `/${storageZone}/${cleanPath}/`;

  const res = await storageClient.get(fullPath);
  return Array.isArray(res.data) ? res.data : res.data?.Objects ?? [];
}

// export async function listFiles(path: string) {
//   const cleanPath = path.replace(/^\/+/, "");
//   const fullPath = `/${storageZone}/${cleanPath}/`;

//   console.log("\n---------------------------");
//   console.log("📁 Listing folder:", cleanPath);
//   console.log("🌍 Full API URL:", storageClient.defaults.baseURL + fullPath);
//   console.log("---------------------------");

//   try {
//     const res = await storageClient.get(fullPath);

//     // 🔥 AICI PRINTĂM ÎNTREGUL RĂSPUNS
//     console.log("📦 FULL RESPONSE FROM BUNNY:");
//     console.dir(res.data, { depth: 10 });

//     // 🔥 Dacă răspunsul are obiecte, le logăm frumos
//     const items = res.data?.Objects || [];
//     console.log("📸 Extracted items:", items.length);
//     console.log(
//       items.map((i: any) => ({
//         file: i.ObjectName,
//         dir: i.IsDirectory,
//       }))
//     );

//     return res.data;
//   } catch (err: any) {
//     console.log("\n❌ ERROR calling Bunny Storage API");

//     if (err.response) {
//       console.log("Status:", err.response.status);
//       console.log("Data:", err.response.data);
//     } else {
//       console.log(err);
//     }

//     console.log("---------------------------\n");
//     throw err;
//   }
// }
