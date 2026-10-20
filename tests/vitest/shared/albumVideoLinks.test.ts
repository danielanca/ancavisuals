import { describe, expect, test } from "vitest";
import { isVerticalVideoLink, normalizeVideoLink, videoEmbedUrl } from "src/shared/albumVideoLinks";

describe("normalizeVideoLink", () => {
  test("empty clears the link", () => {
    expect(normalizeVideoLink("  ")).toBe("");
    expect(normalizeVideoLink(undefined)).toBe("");
  });
  test.each(["http://youtube.com/watch?v=abc", "javascript:alert(1)", "not a url"])("rejects %s", (value) => {
    expect(normalizeVideoLink(value)).toBeNull();
  });
  test("keeps https links", () => {
    expect(normalizeVideoLink(" https://youtu.be/dQw4w9WgXcQ ")).toBe("https://youtu.be/dQw4w9WgXcQ");
  });
});

describe("videoEmbedUrl", () => {
  test.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://vimeo.com/123456", "https://player.vimeo.com/video/123456"],
    ["https://vimeo.com/123456/abc123", "https://player.vimeo.com/video/123456?h=abc123"],
    ["https://drive.google.com/file/d/1AbC_d-E/view?usp=sharing", "https://drive.google.com/file/d/1AbC_d-E/preview"],
  ])("%s", (link, embed) => {
    expect(videoEmbedUrl(link)).toBe(embed);
  });
  test("other hosts are shown as a link", () => {
    expect(videoEmbedUrl("https://www.swisstransfer.com/d/abc")).toBeNull();
  });
  test("shorts are vertical", () => {
    expect(isVerticalVideoLink("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe(true);
    expect(isVerticalVideoLink("https://youtu.be/dQw4w9WgXcQ")).toBe(false);
  });
});
