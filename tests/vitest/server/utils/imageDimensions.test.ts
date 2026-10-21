/*
 * Purpose: pixel width/height read from the first bytes of WebP, PNG and JPEG files — what the
 * server saves on each offer photo for the masonry layout.
 */
import { describe, expect, test } from "vitest";
import { imageDimensions } from "src/server/utils/remoteFileSize";

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

describe("imageDimensions", () => {
  test("WebP (VP8X), PNG and JPEG (after an APP1 block)", () => {
    const webp = new Uint8Array(30);
    webp.set(ascii("RIFF"), 0); webp.set(ascii("WEBP"), 8); webp.set(ascii("VP8X"), 12);
    webp.set([1399 & 0xff, 1399 >> 8, 0], 24); webp.set([932 & 0xff, 932 >> 8, 0], 27);
    expect(imageDimensions(webp)).toEqual({ width: 1400, height: 933 });

    const png = new Uint8Array(24);
    png.set([0x89, ...ascii("PNG")], 0);
    new DataView(png.buffer).setUint32(16, 1067);
    new DataView(png.buffer).setUint32(20, 1600);
    expect(imageDimensions(png)).toEqual({ width: 1067, height: 1600 });

    const jpeg = new Uint8Array(40);
    jpeg.set([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x08, 0, 0, 0, 0, 0, 0], 0); // SOI + APP1 (8 bytes)
    jpeg.set([0xff, 0xc0, 0x00, 0x11, 0x08, 1920 >> 8, 1920 & 0xff, 1080 >> 8, 1080 & 0xff], 12);
    // SOF0 stores height first: here 1920 high, 1080 wide.
    expect(imageDimensions(jpeg)).toEqual({ width: 1080, height: 1920 });

    expect(imageDimensions(new Uint8Array([1, 2, 3]))).toBeUndefined();
  });
});
