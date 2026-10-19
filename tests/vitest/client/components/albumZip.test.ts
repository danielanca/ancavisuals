// @vitest-environment node
import { describe, expect, test } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { albumZipManifestHash, buildAlbumZip } from "src/client/features/admin/components/albumZip";
import { albumZipManifest } from "src/shared/albumZipManifest";
import { createHash } from "node:crypto";

const entries = () => [
  { name: "DSC_0001.jpg", file: new Blob([new Uint8Array(5000).map((_, i) => i % 251)]) },
  { name: "Mireasă_ș.png", file: new Blob(["png bytes"]) },
  { name: "empty.jpg", file: new Blob([]) },
];

async function pythonCheck(zip: Blob): Promise<string> {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "album-zip-")), "photos.zip");
  fs.writeFileSync(file, Buffer.from(await zip.arrayBuffer()));
  return execFileSync("python3", ["-I", "-c",
    "import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(','.join(f'{i.filename}:{i.file_size}' for i in z.infolist()))",
    file]).toString().trim();
}

describe("browser-built album ZIP", () => {
  test("stores every original byte-for-byte with UTF-8 names", async () => {
    const progress: number[] = [];
    const zip = await buildAlbumZip(entries(), new AbortController().signal, (read) => progress.push(read));
    const parsed = await JSZip.loadAsync(await zip.arrayBuffer());
    expect(Object.keys(parsed.files)).toEqual(["DSC_0001.jpg", "Mireasă_ș.png", "empty.jpg"]);
    const first = await parsed.file("DSC_0001.jpg")!.async("uint8array");
    expect(Buffer.from(first)).toEqual(Buffer.from(await entries()[0].file.arrayBuffer()));
    expect(progress.at(-1)).toBe(5009);
    expect(await pythonCheck(zip)).toBe("DSC_0001.jpg:5000,Mireasă_ș.png:9,empty.jpg:0");
  });

  test("writes valid ZIP64 records once offsets pass the 4 GB limit", async () => {
    const zip = await buildAlbumZip(entries(), new AbortController().signal, () => {}, 100);
    expect(await pythonCheck(zip)).toBe("DSC_0001.jpg:5000,Mireasă_ș.png:9,empty.jpg:0");
  });

  test("hashes the same manifest the server computes", async () => {
    const names = ["b.jpg", "a.JPG", "Ș.png"];
    expect(await albumZipManifestHash(names)).toBe(createHash("sha256").update(albumZipManifest(names)).digest("hex"));
  });

  test("stops reading when cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(buildAlbumZip(entries(), controller.signal, () => {})).rejects.toThrow("ZIP anulat");
  });
});
