import { beforeEach, describe, expect, test, vi } from "vitest";
const state = vi.hoisted(() => ({ docs: new Map<string, any>(), send: vi.fn() }));
vi.mock("src/server/notifications/mailer", () => ({ sendEmail: state.send }));
vi.mock("src/server/constants/credentials", () => ({ adminUser: { email: "owner@example.com" } }));
vi.mock("src/server/firestore", () => {
  // Keys are "<collection>/<id>": sessions and the per-event progress live in different collections.
  const ref = (collection: string, id: string) => ({ id, key: `${collection}/${id}`,
    set: async (value: any) => { state.docs.set(`${collection}/${id}`, value); },
    update: async (value: any) => { state.docs.set(`${collection}/${id}`, { ...state.docs.get(`${collection}/${id}`), ...value }); },
    delete: async () => { state.docs.delete(`${collection}/${id}`); },
    get: async () => ({ exists: state.docs.has(`${collection}/${id}`), data: () => structuredClone(state.docs.get(`${collection}/${id}`)) }),
  });
  return { firestore: () => ({
    collection: (name: string) => ({
      doc: (id: string) => ref(name, id),
      get: async () => ({ docs: [...state.docs.keys()].filter((key) => key.startsWith(`${name}/`)).map((key) => ({ id: key.slice(name.length + 1) })) }),
    }),
    runTransaction: async (fn: any) => fn({
      get: async (doc: any) => ({ exists: state.docs.has(doc.key), data: () => structuredClone(state.docs.get(doc.key)) }),
      set: (doc: any, value: any) => { state.docs.set(doc.key, value); },
      create: (doc: any, value: any) => { state.docs.set(doc.key, value); },
      update: (doc: any, value: any) => { state.docs.set(doc.key, { ...state.docs.get(doc.key), ...value }); },
      delete: (doc: any) => { state.docs.delete(doc.key); },
    }),
  }) };
});
const session = (id: string) => state.docs.get(`albumUploadSessions/${id}`);
const sessionCount = () => [...state.docs.keys()].filter((key) => key.startsWith("albumUploadSessions/")).length;
import { beginAlbumUpload, clearAlbumUploadProgress, getAlbumUploadProgress, recordAlbumUploadSuccess, touchAlbumUpload, notifyIncompleteAlbumUpload, checkIncompleteAlbumUploads } from "src/server/services/albumUploadNotifications";
beforeEach(() => { state.docs.clear(); state.send.mockReset().mockResolvedValue(undefined); });
describe("durable incomplete album upload email", () => {
  test("sends only pending names to the configured owner after finish", async () => {
    const id = await beginAlbumUpload("event", "album", ["one.jpg", "two.jpg"]);
    await recordAlbumUploadSuccess(id, "event", "one.jpg");
    await touchAlbumUpload(id, "event", true);
    expect(await notifyIncompleteAlbumUpload(id)).toBe(true);
    expect(state.send).toHaveBeenCalledOnce();
    const email = state.send.mock.calls[0][0];
    expect(email.to).toBe("owner@example.com");
    expect(email.subject).toContain("1/2");
    expect(email.html).toContain("two.jpg");
    expect(email.html).not.toContain("one.jpg");
    expect(sessionCount()).toBe(0);
    await notifyIncompleteAlbumUpload(id);
    expect(state.send).toHaveBeenCalledOnce();
  });
  test("does not email for a fully successful upload", async () => {
    const id = await beginAlbumUpload("event", "album", ["one.jpg"]);
    await recordAlbumUploadSuccess(id, "event", "one.jpg");
    await touchAlbumUpload(id, "event", true);
    await notifyIncompleteAlbumUpload(id);
    expect(state.send).not.toHaveBeenCalled();
    expect(sessionCount()).toBe(0);
  });
  test("alerts after 15 minutes of silence even without any browser finish request", async () => {
    const id = await beginAlbumUpload("event", "album", ["one.jpg"]);
    const last = session(id).lastActivityAt;
    await checkIncompleteAlbumUploads(last + 15 * 60_000 - 1);
    expect(state.send).not.toHaveBeenCalled();
    await checkIncompleteAlbumUploads(last + 15 * 60_000);
    expect(state.send).toHaveBeenCalledOnce();
  });
  test("heartbeat keeps a long-running upload active", async () => {
    const id = await beginAlbumUpload("event", "album", ["one.jpg"]);
    session(id).lastActivityAt -= 60 * 60_000;
    await touchAlbumUpload(id, "event", false);
    await checkIncompleteAlbumUploads();
    expect(state.send).not.toHaveBeenCalled();
  });
  test("persists SMTP failures for retry after restart", async () => {
    const id = await beginAlbumUpload("event", "album", ["one.jpg"]);
    await touchAlbumUpload(id, "event", true);
    state.send.mockRejectedValueOnce(new Error("SMTP unavailable"));
    await expect(notifyIncompleteAlbumUpload(id)).rejects.toThrow("SMTP unavailable");
    expect(session(id).leaseUntil).toBe(0);
    await checkIncompleteAlbumUploads();
    expect(state.send).toHaveBeenCalledTimes(2);
    expect(sessionCount()).toBe(0);
  });
  test("does not duplicate an email while another sender holds the lease", async () => {
    const id = await beginAlbumUpload("event", "album", ["one.jpg"]);
    await touchAlbumUpload(id, "event", true);
    session(id).leaseUntil = Date.now() + 60_000;
    await notifyIncompleteAlbumUpload(id);
    expect(state.send).not.toHaveBeenCalled();
  });
  test("escapes filename HTML and rejects another event's session", async () => {
    const id = await beginAlbumUpload("event", "<album>", ["<photo>.jpg"]);
    await expect(recordAlbumUploadSuccess(id, "other", "<photo>.jpg")).rejects.toThrow("mismatch");
    await expect(touchAlbumUpload(id, "other", true)).rejects.toThrow("mismatch");
    await touchAlbumUpload(id, "event", true);
    await notifyIncompleteAlbumUpload(id);
    expect(state.send.mock.calls[0][0].html).toContain("&lt;photo&gt;.jpg");
    expect(state.send.mock.calls[0][0].html).not.toContain("<album>");
  });
});

describe("upload progress that survives a closed page", () => {
  const files = Array.from({ length: 5 }, (_, i) => `p${i}.jpg`);

  test("remembers how many photos were meant to be uploaded and which are missing, even after the alert", async () => {
    const id = await beginAlbumUpload("event", "album", files);
    await recordAlbumUploadSuccess(id, "event", "p0.jpg");
    await recordAlbumUploadSuccess(id, "event", "p1.jpg");
    await touchAlbumUpload(id, "event", true);
    await notifyIncompleteAlbumUpload(id);
    expect(sessionCount()).toBe(0);
    expect(await getAlbumUploadProgress("event")).toMatchObject({ slug: "album", expected: 5, pending: ["p2.jpg", "p3.jpg", "p4.jpg"], finishedAt: null });
  });

  test("resuming keeps the original total; the last photo marks it finished", async () => {
    const first = await beginAlbumUpload("event", "album", files);
    await recordAlbumUploadSuccess(first, "event", "p0.jpg");
    const startedAt = (await getAlbumUploadProgress("event"))!.startedAt;
    const second = await beginAlbumUpload("event", "album", files.slice(1), true);
    expect(await getAlbumUploadProgress("event")).toMatchObject({ expected: 5, pending: files.slice(1), startedAt });
    for (const name of files.slice(1)) await recordAlbumUploadSuccess(second, "event", name);
    const done = await getAlbumUploadProgress("event");
    expect(done?.pending).toEqual([]);
    expect(done?.finishedAt).toEqual(expect.any(Number));
  });

  test("a new (non-resume) batch starts over; the owner can dismiss it", async () => {
    await beginAlbumUpload("event", "album", files);
    await beginAlbumUpload("event", "album", ["new.jpg"]);
    expect(await getAlbumUploadProgress("event")).toMatchObject({ expected: 1, pending: ["new.jpg"] });
    await clearAlbumUploadProgress("event");
    expect(await getAlbumUploadProgress("event")).toBeNull();
  });
});
