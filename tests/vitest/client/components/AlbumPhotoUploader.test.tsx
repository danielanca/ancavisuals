import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AlbumPhotoUploader from "src/client/features/admin/components/AlbumPhotoUploader";
import { createAlbumPreview } from "src/client/features/admin/components/createAlbumPreview";
import { buildAlbumZip, uploadAlbumZip } from "src/client/features/admin/components/albumZip";
import { UPLOAD_ORIGIN } from "src/client/utils/address";

vi.mock("src/client/features/admin/components/createAlbumPreview", () => ({ createAlbumPreview: vi.fn() }));
vi.mock("src/client/features/admin/components/albumZip", () => ({
  buildAlbumZip: vi.fn(), uploadAlbumZip: vi.fn(), albumZipManifestHash: vi.fn(async () => "a".repeat(64)),
}));
vi.mock("src/client/features/admin/providers/loadFirebaseAuth", () => ({
  loadFirebaseAuth: async () => ({ auth: { currentUser: { getIdToken: async () => "fresh-token" } } }),
}));
const fetchMock = vi.fn();
const sessionFetchMock = vi.fn();
const zipCheckMock = vi.fn();
const progressMock = vi.fn();
const existingMock = vi.fn();
const pick = (container: HTMLElement, files: File[]) => fireEvent.change(container.querySelector("input")!, { target: { files } });
const photo = (name = "DSC 001.jpg") => new File(["original"], name, { type: "image/jpeg" });
beforeEach(() => {
  sessionFetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ sessionId: "11111111-1111-1111-1111-111111111111" }) });
  zipCheckMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ ok: true, complete: true }) });
  progressMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ progress: null }) });
  existingMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ uploaded: [], withPreview: [] }) });
  vi.stubGlobal("fetch", (url: string, options: unknown) => url.includes("upload-progress") ? progressMock(url, options)
    : url.includes("upload-session") ? sessionFetchMock(url, options)
    : url.includes("album-photos/existing") ? existingMock(url, options)
    : url.includes("album-zip/check") ? zipCheckMock(url, options) : fetchMock(url, options));
  vi.mocked(buildAlbumZip).mockReset().mockResolvedValue(new Blob(["zip"], { type: "application/zip" }));
  vi.mocked(uploadAlbumZip).mockReset().mockResolvedValue({ ok: true, status: 200 });
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
  test("when no preview works locally it stops within the first few photos and says why", async () => {
    vi.mocked(createAlbumPreview).mockRejectedValue(new Error("browserul nu a putut porni generatorul de WebP"));
    const done = vi.fn();
    const { container } = render(<AlbumPhotoUploader eventId="e1" albumSlug="album" accessToken="old" onComplete={done} />);
    pick(container, Array.from({ length: 30 }, (_, i) => photo(`p${i}.jpg`)));
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    // 2 encoders in parallel: it gives up after 4 failures, at most one more already started.
    expect(vi.mocked(createAlbumPreview).mock.calls.length).toBeLessThanOrEqual(5);
    expect(screen.getByRole("alert")).toHaveTextContent("Previzualizările WebP nu se pot face pe calculatorul tău (browserul nu a putut porni generatorul de WebP). Le face serverul");
  });
  test("step 2 shows the server's progress once its preview job is ahead", async () => {
    const done = vi.fn();
    const { container, rerender } = render(<AlbumPhotoUploader eventId="e1" albumSlug="album" accessToken="old" onComplete={done} />);
    pick(container, [photo()]);
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    rerender(<AlbumPhotoUploader eventId="e1" albumSlug="album" accessToken="old" onComplete={done} serverPreviews={{ done: 10, total: 1598 }} />);
    expect(screen.getByText(/serverul generează: 10\/1598 în photos_preview\//)).toBeTruthy();
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
  test("retries network failures only after every other original has finished", async () => {
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
    expect(uploadAlbumZip).toHaveBeenCalledOnce();
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

  test("uploads every original before any preview, then builds and uploads photos.zip locally", async () => {
    const order: string[] = [];
    fetchMock.mockImplementation(async (url: string, options) => {
      order.push(url.includes("preview") ? "preview" : "original");
      return { ok: true, json: async () => ({ name: options.body.name }) };
    });
    vi.mocked(uploadAlbumZip).mockImplementation(async () => { order.push("zip"); return { ok: true, status: 200 }; });
    const done = vi.fn();
    const { container } = render(<AlbumPhotoUploader eventId="e1" albumSlug="album" accessToken="old" onComplete={done} />);
    const files = [photo("a.jpg"), photo("b.jpg"), photo("c.jpg")];
    pick(container, files);
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    expect(order).toEqual(["original", "original", "original", "preview", "preview", "preview", "zip"]);
    expect(JSON.parse(zipCheckMock.mock.calls[0][1].body).files).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
    expect(vi.mocked(buildAlbumZip).mock.calls[0][0]).toEqual(files.map((file) => ({ name: file.name, file })));
    const [url, , headers] = vi.mocked(uploadAlbumZip).mock.calls[0];
    // Through upload.ancavisuals.ro (UPLOAD_ORIGIN; localhost in tests): Cloudflare caps the main domain at 100 MB.
    expect(url).toBe(`${UPLOAD_ORIGIN}/api/admin/events/e1/upload-album-zip`);
    expect(headers["X-Album-Zip-Manifest"]).toBe("a".repeat(64));
    expect(headers.Authorization).toBe("Bearer fresh-token");
    expect(screen.getByText(/photos.zip urcat și verificat/)).toBeTruthy();
  });
  test("leaves the ZIP to the server when Bunny holds originals outside this selection", async () => {
    zipCheckMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, complete: false, missingCount: 40 }) });
    const done = vi.fn();
    const { container } = render(<AlbumPhotoUploader eventId="e1" albumSlug="album" accessToken="old" onComplete={done} />);
    pick(container, [photo()]);
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    expect(buildAlbumZip).not.toHaveBeenCalled();
    expect(screen.getByText(/alte 40 originale/)).toBeTruthy();
  });
  test("keeps the album open for a manual ZIP retry instead of falling back to the server", async () => {
    vi.mocked(uploadAlbumZip).mockResolvedValueOnce({ ok: false, status: 413 });
    const done = vi.fn();
    const { container } = render(<AlbumPhotoUploader eventId="e1" albumSlug="album" accessToken="old" onComplete={done} />);
    pick(container, [photo()]);
    await screen.findByText("Reîncearcă photos.zip");
    expect(screen.getByText(/client_max_body_size/)).toBeTruthy();
    expect(done).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Reîncearcă photos.zip"));
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    expect(uploadAlbumZip).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.filter(([url]) => !url.includes("preview"))).toHaveLength(1);
  });
  test("can hand a failed ZIP over to the server", async () => {
    vi.mocked(buildAlbumZip).mockRejectedValueOnce(new Error("disk read failed"));
    const done = vi.fn();
    const serverProcessing = vi.fn();
    fetchMock.mockImplementation(async (url: string) => url.includes("/process-album")
      ? { ok: true, json: async () => ({ ok: true, slug: "album", status: "started" }) }
      : { ok: true, json: async () => ({ name: url.includes("preview") ? "DSC_001.webp" : "DSC_001.jpg" }) });
    const { container } = render(<AlbumPhotoUploader eventId="e1" albumSlug="album" accessToken="old" onComplete={done} onServerProcessing={serverProcessing} />);
    pick(container, [photo()]);
    fireEvent.click(await screen.findByText("Continuă pe server și refă ZIP-ul"));
    await waitFor(() => expect(serverProcessing).toHaveBeenCalledOnce());
    expect(done).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([url]) => url.includes("/process-album"))).toBe(true);
  });
});

describe("upload progress after a closed page", () => {
  const progress = (pending: string[], expected = 3, lastActivityAt = Date.now() - 60 * 60_000) => ({
    ok: true,
    json: async () => ({ progress: { slug: "album", expected, uploaded: expected - pending.length, pending, startedAt: lastActivityAt - 60_000, lastActivityAt, finishedAt: null } }),
  });

  test("warns how many photos arrived out of how many, and which are missing", async () => {
    progressMock.mockResolvedValue(progress(["c.jpg", "d.jpg"], 5));
    render(<AlbumPhotoUploader eventId="e1" albumSlug="album" accessToken="old" />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Upload neterminat: 3 din 5 poze încărcate. Mai trebuie încărcate 2.");
    expect(alert.textContent).toContain("selectează din nou toate cele 5 de poze");
    expect(alert.textContent).toContain("d.jpg");
    expect(progressMock.mock.calls[0][0]).toBe("/api/admin/events/e1/upload-progress");
  });

  test("picking the same photos again uploads only the missing ones and keeps the total", async () => {
    progressMock.mockResolvedValue(progress(["c.jpg"]));
    existingMock.mockResolvedValue({ ok: true, json: async () => ({ uploaded: ["a.jpg", "b.jpg"], withPreview: [] }) });
    fetchMock.mockImplementation(async (url: string) => ({ ok: true, json: async () => ({ name: decodeURIComponent(url.split("name=")[1]) }) }));
    const done = vi.fn();
    const { container } = render(<AlbumPhotoUploader eventId="e1" albumSlug="album" accessToken="old" onComplete={done} />);
    await screen.findByRole("alert");
    pick(container, [photo("a.jpg"), photo("b.jpg"), photo("c.jpg")]);
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    expect(JSON.parse(sessionFetchMock.mock.calls[0][1].body)).toEqual({ files: ["c.jpg"], resume: true });
    const originals = fetchMock.mock.calls.map(([url]) => url as string).filter((url) => url.includes("/upload-photo?"));
    expect(originals).toHaveLength(1);
    expect(originals[0]).toContain("name=c.jpg");
    expect(screen.getByText(/2 poze sunt deja în Bunny și sunt sărite; se încarcă restul de 1/)).toBeTruthy();
    expect(vi.mocked(buildAlbumZip).mock.calls[0][0].map((entry: { name: string }) => entry.name)).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
  });

  test("photos already in Bunny (same name and size) are skipped, and so are their existing previews", async () => {
    existingMock.mockResolvedValue({ ok: true, json: async () => ({ uploaded: ["a.jpg", "b.jpg"], withPreview: ["a.jpg"] }) });
    fetchMock.mockImplementation(async (url: string) => ({ ok: true, json: async () => ({ name: decodeURIComponent(url.split("name=")[1]) }) }));
    const done = vi.fn();
    const { container } = render(<AlbumPhotoUploader eventId="e1" albumSlug="album" accessToken="old" onComplete={done} />);
    pick(container, [photo("a.jpg"), photo("b.jpg"), photo("c.jpg")]);
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    expect(JSON.parse(existingMock.mock.calls[0][1].body)).toEqual({ files: [{ name: "a.jpg", size: 8 }, { name: "b.jpg", size: 8 }, { name: "c.jpg", size: 8 }] });
    const urls = fetchMock.mock.calls.map(([url]) => url as string);
    expect(urls.filter((url) => url.includes("/upload-photo?")).map((url) => url.split("name=")[1])).toEqual(["c.jpg"]);
    expect(urls.filter((url) => url.includes("upload-photo-preview")).map((url) => url.split("name=")[1]).sort()).toEqual(["b.jpg", "c.jpg"]);
    expect(screen.getByText(/2 poze sunt deja în Bunny și sunt sărite \(1 au și preview\)/)).toBeTruthy();
  });

  test("everything already uploaded: no originals step, straight to previews and photos.zip", async () => {
    existingMock.mockResolvedValue({ ok: true, json: async () => ({ uploaded: ["a.jpg"], withPreview: ["a.jpg"] }) });
    const done = vi.fn();
    const { container } = render(<AlbumPhotoUploader eventId="e1" albumSlug="album" accessToken="old" onComplete={done} />);
    pick(container, [photo("a.jpg")]);
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    expect(sessionFetchMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(uploadAlbumZip).toHaveBeenCalledOnce();
  });

  test("a different selection starts a new batch", async () => {
    progressMock.mockResolvedValue(progress(["c.jpg"]));
    const { container } = render(<AlbumPhotoUploader eventId="e1" albumSlug="album" accessToken="old" />);
    await screen.findByRole("alert");
    pick(container, [photo("x.jpg")]);
    await waitFor(() => expect(sessionFetchMock).toHaveBeenCalled());
    expect(JSON.parse(sessionFetchMock.mock.calls[0][1].body)).toEqual({ files: ["x.jpg"], resume: false });
  });
});

