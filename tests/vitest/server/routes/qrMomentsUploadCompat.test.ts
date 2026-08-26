import { describe, expect, test } from "vitest";
import { convertHeicIfNeeded, detectMediaType, resolveQrAlbumSlug, resolveUploadNotificationEmail } from "src/server/routes/qrMoments.routes";

describe("qrMoments upload compatibility helpers", () => {
  describe("resolveQrAlbumSlug", () => {
    test("uses the QR slug for events created without an admin event", async () => {
      await expect(resolveQrAlbumSlug({ adminEventId: null }, "26august2026")).resolves.toBe("26august2026");
    });

    test("prefers a stored standalone album slug", async () => {
      await expect(resolveQrAlbumSlug({ adminEventId: null, albumSlug: "  qr-album " }, "26august2026")).resolves.toBe("qr-album");
    });
  });

  describe("resolveUploadNotificationEmail", () => {
    test("prefers the event email and falls back to the configured admin email", () => {
      expect(resolveUploadNotificationEmail(" Owner@Example.COM ")).toBe("owner@example.com");
      expect(resolveUploadNotificationEmail(" ")).toBe("ancadaniel1994@gmail.com");
    });
  });

  describe("detectMediaType", () => {
    test("classifies common iPhone/Samsung photo formats as photo", () => {
      expect(detectMediaType("image/jpeg", "IMG_1234.jpg")).toBe("photo");
      expect(detectMediaType("image/heic", "IMG_1234.HEIC")).toBe("photo");
      expect(detectMediaType("image/heif", "IMG_1234.heif")).toBe("photo");
      expect(detectMediaType("image/webp", "photo.webp")).toBe("photo");
      // Some Android browsers report a generic/blank mimeType for camera uploads.
      expect(detectMediaType("application/octet-stream", "IMG_1234.jpg")).toBe("photo");
    });

    test("classifies common iPhone/Samsung video formats as video", () => {
      expect(detectMediaType("video/quicktime", "IMG_5678.MOV")).toBe("video");
      expect(detectMediaType("video/mp4", "video.mp4")).toBe("video");
      expect(detectMediaType("video/mp4", "video.hevc")).toBe("video");
      expect(detectMediaType("application/octet-stream", "clip.3gp")).toBe("video");
      expect(detectMediaType("application/octet-stream", "clip.mov")).toBe("video");
    });

    test("falls back to audio for recorded voice messages", () => {
      expect(detectMediaType("audio/mp4", "voice-123.m4a")).toBe("audio");
      expect(detectMediaType("audio/webm", "voice-123.webm")).toBe("audio");
      expect(detectMediaType("audio/mp4;codecs=mp4a.40.2", "voice-123.m4a")).toBe("audio");
    });
  });

  describe("convertHeicIfNeeded", () => {
    test("leaves non-HEIC files untouched", async () => {
      const buffer = Buffer.from("fake-jpeg-bytes");
      const result = await convertHeicIfNeeded(buffer, "image/jpeg", "poza.jpg");
      expect(result.buffer).toBe(buffer);
      expect(result.mimeType).toBe("image/jpeg");
      expect(result.originalName).toBe("poza.jpg");
    });

    test("detects HEIC by extension even when mimeType is generic", async () => {
      const buffer = Buffer.from("not-a-real-heic-file");
      const result = await convertHeicIfNeeded(buffer, "application/octet-stream", "IMG_1886.HEIC");
      // Conversion of garbage bytes fails in both heic-convert and sharp — the
      // function must fall back to the original bytes instead of throwing, so a
      // guest's upload never gets lost just because conversion failed.
      expect(result.buffer).toBe(buffer);
      expect(result.originalName).toBe("IMG_1886.HEIC");
    });

    test("never throws even when the HEIC bytes are invalid", async () => {
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      await expect(convertHeicIfNeeded(buffer, "image/heic", "broken.heic")).resolves.toBeTruthy();
    });
  });
});
