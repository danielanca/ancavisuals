import { describe, expect, it } from "vitest";
import { isShortVideoObject, sanitizeShortVideoName, shortVideoContentType } from "../../../src/shared/albumShortVideo";

describe("sanitizeShortVideoName", () => {
  it("keeps supported videos with a Bunny-safe name", () => {
    expect(sanitizeShortVideoName("Video Nuntă 2026.MOV")).toBe("Video-Nunta-2026.mov");
    expect(sanitizeShortVideoName("C:\\clips\\teaser.mp4")).toBe("teaser.mp4");
    expect(sanitizeShortVideoName("../../ăîș.webm")).toBe("ais.webm");
    expect(sanitizeShortVideoName("!!!.m4v")).toBe("video-scurt.m4v");
  });

  it("rejects non-video files", () => {
    expect(sanitizeShortVideoName("poza.jpg")).toBeNull();
    expect(sanitizeShortVideoName("fara-extensie")).toBeNull();
    expect(sanitizeShortVideoName("")).toBeNull();
  });
});

describe("shortVideoContentType", () => {
  it("maps extensions to video types", () => {
    expect(shortVideoContentType("a.mov")).toBe("video/quicktime");
    expect(shortVideoContentType("a.m4v")).toBe("video/mp4");
  });
});

describe("isShortVideoObject", () => {
  it("skips the .keep placeholder and folders", () => {
    expect(isShortVideoObject({ ObjectName: ".keep" })).toBe(false);
    expect(isShortVideoObject({ ObjectName: "x", IsDirectory: true })).toBe(false);
    expect(isShortVideoObject({ ObjectName: "teaser.mp4", IsDirectory: false })).toBe(true);
  });
});
