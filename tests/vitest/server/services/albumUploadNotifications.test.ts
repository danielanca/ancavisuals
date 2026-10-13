import { beforeEach, describe, expect, test, vi } from "vitest";
const state = vi.hoisted(() => ({ docs: new Map<string, any>(), send: vi.fn() }));
vi.mock("src/server/notifications/mailer", () => ({ sendEmail: state.send }));
vi.mock("src/server/constants/credentials", () => ({ adminUser: { email: "owner@example.com" } }));
vi.mock("src/server/firestore", () => {
  const ref = (id: string) => ({ id,
    set: async (value: any) => { state.docs.set(id, value); },
    update: async (value: any) => { state.docs.set(id, { ...state.docs.get(id), ...value }); },
    delete: async () => { state.docs.delete(id); },
  });
  return { firestore: () => ({
    collection: () => ({ doc: ref, get: async () => ({ docs: [...state.docs.keys()].map(id => ({ id })) }) }),
    runTransaction: async (fn: any) => fn({
      get: async (doc: any) => ({ exists: state.docs.has(doc.id), data: () => structuredClone(state.docs.get(doc.id)) }),
      update: (doc: any, value: any) => { state.docs.set(doc.id, { ...state.docs.get(doc.id), ...value }); },
      delete: (doc: any) => { state.docs.delete(doc.id); },
    }),
  }) };
});
import { beginAlbumUpload, recordAlbumUploadSuccess, touchAlbumUpload, notifyIncompleteAlbumUpload, checkIncompleteAlbumUploads } from "src/server/services/albumUploadNotifications";
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
    expect(state.docs.size).toBe(0);
    await notifyIncompleteAlbumUpload(id);
    expect(state.send).toHaveBeenCalledOnce();
  });
  test("does not email for a fully successful upload", async () => {
    const id = await beginAlbumUpload("event", "album", ["one.jpg"]);
    await recordAlbumUploadSuccess(id, "event", "one.jpg");
    await touchAlbumUpload(id, "event", true);
    await notifyIncompleteAlbumUpload(id);
    expect(state.send).not.toHaveBeenCalled();
    expect(state.docs.size).toBe(0);
  });
  test("alerts after 15 minutes of silence even without any browser finish request", async () => {
    const id = await beginAlbumUpload("event", "album", ["one.jpg"]);
    const last = state.docs.get(id).lastActivityAt;
    await checkIncompleteAlbumUploads(last + 15 * 60_000 - 1);
    expect(state.send).not.toHaveBeenCalled();
    await checkIncompleteAlbumUploads(last + 15 * 60_000);
    expect(state.send).toHaveBeenCalledOnce();
  });
  test("heartbeat keeps a long-running upload active", async () => {
    const id = await beginAlbumUpload("event", "album", ["one.jpg"]);
    state.docs.get(id).lastActivityAt -= 60 * 60_000;
    await touchAlbumUpload(id, "event", false);
    await checkIncompleteAlbumUploads();
    expect(state.send).not.toHaveBeenCalled();
  });
  test("persists SMTP failures for retry after restart", async () => {
    const id = await beginAlbumUpload("event", "album", ["one.jpg"]);
    await touchAlbumUpload(id, "event", true);
    state.send.mockRejectedValueOnce(new Error("SMTP unavailable"));
    await expect(notifyIncompleteAlbumUpload(id)).rejects.toThrow("SMTP unavailable");
    expect(state.docs.get(id).leaseUntil).toBe(0);
    await checkIncompleteAlbumUploads();
    expect(state.send).toHaveBeenCalledTimes(2);
    expect(state.docs.size).toBe(0);
  });
  test("does not duplicate an email while another sender holds the lease", async () => {
    const id = await beginAlbumUpload("event", "album", ["one.jpg"]);
    await touchAlbumUpload(id, "event", true);
    state.docs.get(id).leaseUntil = Date.now() + 60_000;
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
