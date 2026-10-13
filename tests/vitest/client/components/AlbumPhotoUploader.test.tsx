import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AlbumPhotoUploader from "src/client/features/admin/components/AlbumPhotoUploader";
import { createAlbumPreview } from "src/client/features/admin/components/createAlbumPreview";

vi.mock("src/client/features/admin/components/createAlbumPreview", () => ({ createAlbumPreview: vi.fn() }));
vi.mock("src/client/features/admin/providers/loadFirebaseAuth", () => ({
  loadFirebaseAuth: async () => ({ auth: { currentUser: { getIdToken: async () => "fresh-token" } } }),
}));
const fetchMock = vi.fn();
const sessionFetchMock = vi.fn();
const pick = (container: HTMLElement, files: File[]) => fireEvent.change(container.querySelector("input")!, { target: { files } });
const photo = (name = "DSC 001.jpg") => new File(["original"], name, { type: "image/jpeg" });
beforeEach(() => {
  sessionFetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ sessionId: "11111111-1111-1111-1111-111111111111" }) });
  vi.stubGlobal("fetch", (url: string, options: unknown) => url.includes("upload-session") ? sessionFetchMock(url, options) : fetchMock(url, options));
  fetchMock.mockReset().mockImplementation(async (url: string) => ({ ok: true, json: async () => ({ name: url.includes("preview") ? "DSC_001.webp" : "DSC_001.jpg" }) }));
  vi.mocked(createAlbumPreview).mockReset().mockResolvedValue(new Blob(["webp"], { type: "image/webp" }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("local album preview uploads", () => {
  test("keeps original bytes and uploads a locally encoded WebP using the canonical name", async () => {
    const done = vi.fn();
    const { container } = render(<AlbumPhotoUploader eventId="e1" albumSlug="album" accessToken="old" onComplete={done} />);
    const original = photo();
    pick(container, [original]);
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    expect(sessionFetchMock.mock.calls[0][0]).toContain("/upload-session");
    expect(JSON.parse(sessionFetchMock.mock.calls[0][1].body).files).toEqual([original.name]);
    expect(fetchMock.mock.calls[0][1].headers["X-Album-Upload-Session"]).toBe("11111111-1111-1111-1111-111111111111");
    expect(JSON.parse(sessionFetchMock.mock.calls[1][1].body).action).toBe("finish");
    expect(fetchMock.mock.calls[0][1].body).toBe(original);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer fresh-token");
    expect(createAlbumPreview).toHaveBeenCalledWith(original, expect.any(AbortSignal));
    expect(fetchMock.mock.calls[1][0]).toContain("upload-photo-preview?name=DSC_001.jpg");
    expect(fetchMock.mock.calls[1][1].body.type).toBe("image/webp");
  });
  test("lets the existing server processing repair a local encoding failure", async () => {
    vi.mocked(createAlbumPreview).mockRejectedValue(new Error("unsupported"));
    const done = vi.fn();
    const { container } = render(<AlbumPhotoUploader eventId="e1" albumSlug="album" accessToken="old" onComplete={done} />);
    pick(container, [photo()]);
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/1 previzualizări vor fi generate pe server/)).toBeTruthy();
  });
  test("falls back when preview upload is rejected", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ name: "DSC_001.jpg" }) })
      .mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: false });
    const done = vi.fn();
    const { container } = render(<AlbumPhotoUploader eventId="e1" albumSlug="album" accessToken="old" onComplete={done} />);
    pick(container, [photo()]);
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    expect(screen.getByText(/1 previzualizări vor fi generate pe server/)).toBeTruthy();
  });
  test("keeps failed originals available for retry before completing", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: false });
    const done = vi.fn();
    const { container } = render(<AlbumPhotoUploader eventId="e1" albumSlug="album" accessToken="old" onComplete={done} />);
    pick(container, [photo()]);
    await screen.findByText("Reîncearcă 1 eșuate");
    expect(done).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("list", { name: "Poze neîncărcate" }).textContent).toContain("DSC 001.jpg");
    expect(createAlbumPreview).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Reîncearcă 1 eșuate"));
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
  });
  test("retries network failures only after every other upload and preview has finished", async () => {
    const attempts = new Map<string, number>();
    let releaseSlow!: (value: unknown) => void;
    fetchMock.mockImplementation(async (url: string, options) => {
      if (url.includes("upload-photo-preview")) return { ok: true };
      const name = options.body.name;
      attempts.set(name, (attempts.get(name) ?? 0) + 1);
      if (name === "first.jpg" && attempts.get(name) === 1) throw new TypeError("Failed to fetch");
      if (name === "slow.jpg") return new Promise(resolve => { releaseSlow = resolve; });
      return { ok: true, json: async () => ({ name }) };
    });
    const done = vi.fn();
    const { container } = render(<AlbumPhotoUploader eventId="e1" albumSlug="album" accessToken="old" onComplete={done} />);
    pick(container, [photo("first.jpg"), photo("slow.jpg"), photo("last.jpg")]);
    await waitFor(() => expect(attempts.get("last.jpg")).toBe(1));
    expect(attempts.get("first.jpg")).toBe(1);
    expect(done).not.toHaveBeenCalled();
    await act(async () => { releaseSlow({ ok: true, json: async () => ({ name: "slow.jpg" }) }); });
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    expect(attempts.get("first.jpg")).toBe(2);
    expect(attempts.get("slow.jpg")).toBe(1);
    expect(attempts.get("last.jpg")).toBe(1);
  });
  test("retries only the preview when its upload fails, preserving the uploaded original", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ name: "DSC_001.jpg" }) })
      .mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce({ ok: true });
    const done = vi.fn();
    const { container } = render(<AlbumPhotoUploader eventId="e1" albumSlug="album" accessToken="old" onComplete={done} />);
    pick(container, [photo()]);
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls.map(([url]) => url.includes("upload-photo-preview"))).toEqual([false, true, true]);
    expect(screen.queryByText(/previzualizări vor fi generate pe server/)).toBeNull();
  });
  test("keeps files and blocks unmonitored uploads if session registration fails", async () => {
    sessionFetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const done = vi.fn();
    const { container } = render(<AlbumPhotoUploader eventId="e1" albumSlug="album" accessToken="old" onComplete={done} />);
    pick(container, [photo()]);
    await screen.findByText(/Uploadul nu a pornit/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(done).not.toHaveBeenCalled();
    expect(screen.getByText("Reîncearcă 1 eșuate")).toBeTruthy();
  });
  test("retains failed files if the final report cannot reach the server", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    sessionFetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ sessionId: "11111111-1111-1111-1111-111111111111" }) })
      .mockRejectedValueOnce(new TypeError("offline"));
    const done = vi.fn();
    const { container } = render(<AlbumPhotoUploader eventId="e1" albumSlug="album" accessToken="old" onComplete={done} />);
    pick(container, [photo()]);
    await screen.findByText("Reîncearcă 1 eșuate");
    expect(sessionFetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/după 15 minute fără activitate/)).toBeTruthy();
    expect(done).not.toHaveBeenCalled();
  });
  test("rejects names that would overwrite the same preview", async () => {
    const { container } = render(<AlbumPhotoUploader eventId="e1" albumSlug="album" accessToken="old" />);
    pick(container, [photo("same.jpg"), photo("same.png")]);
    expect(screen.getByText(/Redenumește fișierele duplicate/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  test("processes 1900 files with at most two local encoders active", async () => {
    let active = 0;
    let maximum = 0;
    vi.mocked(createAlbumPreview).mockImplementation(async () => {
      maximum = Math.max(maximum, ++active);
      await Promise.resolve();
      active--;
      return new Blob(["webp"], { type: "image/webp" });
    });
    const done = vi.fn();
    const { container } = render(<AlbumPhotoUploader eventId="e1" albumSlug="album" accessToken="old" onComplete={done} />);
    pick(container, Array.from({ length: 1900 }, (_, index) => photo(`photo-${index}.jpg`)));
    await waitFor(() => expect(done).toHaveBeenCalledOnce(), { timeout: 10000 });
    expect(createAlbumPreview).toHaveBeenCalledTimes(1900);
    expect(fetchMock).toHaveBeenCalledTimes(3800);
    expect(maximum).toBeLessThanOrEqual(2);
  });
  test("aborts active work when the uploader is removed", async () => {
    fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("aborted")))));
    const done = vi.fn();
    const { container, unmount } = render(<AlbumPhotoUploader eventId="e1" albumSlug="album" accessToken="old" onComplete={done} />);
    pick(container, [photo()]);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const signal = fetchMock.mock.calls[0][1].signal;
    unmount();
    expect(signal.aborted).toBe(true);
    expect(done).not.toHaveBeenCalled();
  });
});
