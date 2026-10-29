import { afterEach, describe, expect, test, vi } from "vitest";
import { deletePhotoCopies } from "src/server/services/albumPhotoCopies.service";

const listing = (preview: string[] = [], photos: string[] = [], featured: string[] = []) => ({
  photos_preview: preview,
  photos,
  featured,
});

describe("albumPhotoCopies deletion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("a WebP proposal deletes the matching JPG original too", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal("fetch", fetchMock);

    await deletePhotoCopies(
      "demo",
      ["Picture-0002.webp"],
      listing(["Picture-0002.webp"], ["Picture-0002.jpg"]),
    );

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls).toContain("https://storage.bunnycdn.com/ancavisuals-ro/demo/photos_preview/Picture-0002.webp");
    expect(urls).toContain("https://storage.bunnycdn.com/ancavisuals-ro/demo/photos/Picture-0002.jpg");
  });

  test("still tries the JPG when Bunny listing contains only the selected WebP", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal("fetch", fetchMock);

    await deletePhotoCopies("demo", ["Picture-0002.webp"], listing(["Picture-0002.webp"]));

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls).toContain("https://storage.bunnycdn.com/ancavisuals-ro/demo/photos/Picture-0002.jpg");
  });

  test("a JPG proposal also deletes the matching WebP preview when it exists", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal("fetch", fetchMock);

    await deletePhotoCopies(
      "demo",
      ["Picture-0002.jpg"],
      listing(["Picture-0002.webp"], ["Picture-0002.jpg"]),
    );

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls).toContain("https://storage.bunnycdn.com/ancavisuals-ro/demo/photos_preview/Picture-0002.webp");
    expect(urls).toContain("https://storage.bunnycdn.com/ancavisuals-ro/demo/photos/Picture-0002.jpg");
  });
});
