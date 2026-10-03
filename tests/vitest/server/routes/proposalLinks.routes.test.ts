/*
 * Purpose: verifies public proposal links — admin creates a link (+ task), a
 * visitor proposes photos under their name, progress/completion move the task.
 * Uses a small in-memory Firestore fake; no network or Bunny access.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

type Handler = (req: any, res: any) => Promise<void> | void;
type Doc = Record<string, any>;

const INCREMENT = Symbol("increment");

function deepMerge(target: Doc, patch: Doc): Doc {
  const out: Doc = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === "object" && value[INCREMENT] !== undefined) {
      out[key] = (Number(out[key]) || 0) + value[INCREMENT];
    } else if (value && typeof value === "object" && !Array.isArray(value) && !value.toDate) {
      out[key] = deepMerge(out[key] ?? {}, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function createFakeFirestore() {
  const store = new Map<string, Map<string, Doc>>();
  let autoId = 0;
  const col = (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  };

  const docRef = (collection: string, id: string) => ({
    id,
    get: async () => ({ exists: col(collection).has(id), id, data: () => col(collection).get(id), ref: docRef(collection, id) }),
    set: async (data: Doc, options?: { merge?: boolean }) => {
      col(collection).set(id, options?.merge ? deepMerge(col(collection).get(id) ?? {}, data) : deepMerge({}, data));
    },
    update: async (data: Doc) => { col(collection).set(id, deepMerge(col(collection).get(id) ?? {}, data)); },
  });

  const query = (collection: string, filters: [string, unknown][]) => ({
    where: (field: string, _op: string, value: unknown) => query(collection, [...filters, [field, value]]),
    get: async () => {
      const docs = Array.from(col(collection).entries())
        .filter(([, data]) => filters.every(([field, value]) => data[field] === value))
        .map(([id, data]) => ({ id, data: () => data, ref: docRef(collection, id) }));
      return { docs, empty: docs.length === 0, size: docs.length };
    },
  });

  const db = {
    collection: (name: string) => ({
      doc: (id?: string) => docRef(name, id ?? `auto-${++autoId}`),
      add: async (data: Doc) => {
        const id = `auto-${++autoId}`;
        col(name).set(id, deepMerge({}, data));
        return { id };
      },
      where: (field: string, op: string, value: unknown) => query(name, []).where(field, op, value),
    }),
    batch: () => {
      const ops: (() => Promise<void>)[] = [];
      return {
        set: (ref: any, data: Doc, options?: { merge?: boolean }) => { ops.push(() => ref.set(data, options)); },
        update: (ref: any, data: Doc) => { ops.push(() => ref.update(data)); },
        commit: async () => { for (const op of ops) await op(); },
      };
    },
  };
  return { db, col };
}

const ALBUM = {
  slug: "8august2026",
  title: "8august2026",
  featured: [],
  photos: [
    "https://cdn.test/8august2026/photos_preview/IMG_1.webp?token=a",
    "https://cdn.test/8august2026/photos_preview/IMG_2.webp?token=b",
  ],
  originalPhoto: [
    "https://cdn.test/8august2026/photos/IMG_1.jpg?token=c",
    "https://cdn.test/8august2026/photos/IMG_2.jpg?token=d",
  ],
};

function createMockResponse() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

async function loadRouter() {
  vi.resetModules();
  const fake = createFakeFirestore();

  vi.doMock("src/server/firestore", () => ({ firestore: () => fake.db }));
  vi.doMock("src/server/middleware/requireFirebaseAuth", () => ({
    requireFirebaseAuth: (req: any, _res: any, next: any) => {
      req.firebaseUid = "admin-uid";
      req.firebaseEmail = "admin@test.com";
      next();
    },
    requireSupremeAdmin: (_req: any, _res: any, next: any) => next(),
  }));
  vi.doMock("src/server/services/album.service", () => ({
    loadAlbum: vi.fn(async (slug: string) => (slug === ALBUM.slug ? ALBUM : null)),
    resolveAlbumSlug: vi.fn(async (slug: string) => slug.replace(/^0/, "")),
  }));
  const sendViaFunnel = vi.fn(async () => {});
  vi.doMock("src/server/notifications/emailFunnel", () => ({ sendViaFunnel }));
  vi.doMock("src/server/constants/credentials", () => ({ adminUser: { email: "owner@test.com" } }));
  vi.doMock("firebase-admin/firestore", () => ({
    Timestamp: { now: () => ({ toDate: () => new Date("2026-10-02T10:00:00.000Z") }) },
    FieldValue: { increment: (n: number) => ({ [INCREMENT]: n }) },
  }));

  const router = (await import("src/server/routes/proposalLinks.routes")).default as any;
  const handler = (method: string, path: string): Handler => {
    const layer = router.stack.find((entry: any) => entry.route?.path === path && entry.route.methods?.[method]);
    if (!layer) throw new Error(`Missing ${method} ${path}`);
    return layer.route.stack[layer.route.stack.length - 1].handle;
  };

  const createLink = async (label = "Soția") => {
    const res = createMockResponse();
    await handler("post", "/admin")({ body: { albumSlug: "08august2026", label }, firebaseEmail: "admin@test.com" }, res);
    return res.json.mock.calls[0][0].link as { token: string; url: string; taskId: string };
  };

  return { fake, handler, createLink, sendViaFunnel };
}

describe("proposal links", () => {
  beforeEach(() => vi.clearAllMocks());

  test("admin creates a link on the canonical album slug with a todo task", async () => {
    const { fake, createLink } = await loadRouter();
    const link = await createLink();

    expect(link.url).toBe(`/propune/${link.token}`);
    expect(link.token).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    const stored = fake.col("proposalLinks").get(link.token)!;
    expect(stored).toMatchObject({ albumSlug: "8august2026", label: "Soția", active: true, mediaAssetServiceIds: ["photo"] });
    const task = fake.col("clientTasks").get(link.taskId)!;
    expect(task).toMatchObject({ status: "todo", clientName: "Soția", proposalLinkToken: link.token });
    expect(task.title).toContain("8august2026");
  });

  test("visitor proposes photos under their name; unknown files are skipped and the task moves to doing", async () => {
    const { fake, handler, createLink } = await loadRouter();
    const link = await createLink();
    const res = createMockResponse();

    await handler("post", "/:token/proposals")({
      params: { token: link.token },
      body: { name: "  Ana  Maria ", visitorId: "visitor-123", fileNames: ["IMG_1.webp", "IMG_9.webp"], destinations: ["instagram", "media_assets"] },
    }, res);

    expect(res.json).toHaveBeenCalledWith({ ok: true, added: 1, updated: 0 });
    const proposals = Array.from(fake.col("instagramProposals").values());
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({
      albumSlug: "8august2026",
      photoUrl: ALBUM.originalPhoto[0],
      fileName: "IMG_1.jpg",
      proposedBy: "Ana Maria",
      proposedByUid: `link:${link.token}:visitor-123`,
      status: "pending",
      destinations: ["instagram", "media_assets"],
      mediaAssetServiceIds: ["photo"],
    });
    expect(fake.col("proposalLinks").get(link.token)!.visitors["visitor-123"].proposedCount).toBe(1);
    expect(fake.col("clientTasks").get(link.taskId)!.status).toBe("doing");
  });

  test("re-proposing the same photo updates instead of duplicating", async () => {
    const { fake, handler, createLink } = await loadRouter();
    const link = await createLink();
    const propose = (destinations: string[]) => handler("post", "/:token/proposals")({
      params: { token: link.token },
      body: { name: "Ana", visitorId: "visitor-123", fileNames: ["IMG_2.jpg"], destinations },
    }, createMockResponse());

    await propose(["instagram"]);
    await propose(["media_assets"]);

    const proposals = Array.from(fake.col("instagramProposals").values());
    expect(proposals).toHaveLength(1);
    expect(proposals[0].destinations).toEqual(["instagram", "media_assets"]);
  });

  test("rejects a submission without a name", async () => {
    const { handler, createLink } = await loadRouter();
    const link = await createLink();
    const res = createMockResponse();

    await handler("post", "/:token/proposals")({
      params: { token: link.token },
      body: { name: "  ", visitorId: "visitor-123", fileNames: ["IMG_1.jpg"], destinations: ["instagram"] },
    }, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("a deactivated link is not found by visitors", async () => {
    const { handler, createLink } = await loadRouter();
    const link = await createLink();
    await handler("patch", "/admin/:token")({ params: { token: link.token }, body: { active: false } }, createMockResponse());

    const res = createMockResponse();
    await handler("get", "/:token")({ params: { token: link.token } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("progress keeps the furthest photo seen and completion marks link + task done", async () => {
    const { fake, handler, createLink, sendViaFunnel } = await loadRouter();
    const link = await createLink();
    const progress = (viewedCount: number) => handler("post", "/:token/progress")({
      params: { token: link.token },
      body: { name: "Ana", visitorId: "visitor-123", viewedCount },
    }, createMockResponse());

    await progress(40);
    await progress(12);
    expect(fake.col("proposalLinks").get(link.token)!.visitors["visitor-123"].viewedCount).toBe(40);

    await handler("post", "/:token/complete")({ params: { token: link.token }, body: { name: "Ana", visitorId: "visitor-123" } }, createMockResponse());
    expect(fake.col("proposalLinks").get(link.token)!.completedAt).toBeTruthy();
    expect(fake.col("clientTasks").get(link.taskId)!.status).toBe("done");
    // The owner is told by email who finished and how far they got.
    expect(sendViaFunnel).toHaveBeenCalledTimes(1);
    expect(sendViaFunnel).toHaveBeenCalledWith(expect.objectContaining({
      kind: "notification",
      to: "owner@test.com",
      source: "proposal-link:complete",
      subject: expect.stringContaining("Ana a terminat"),
      html: expect.stringContaining("40"),
    }));

    // Later activity never reopens a finished task.
    await progress(60);
    expect(fake.col("clientTasks").get(link.taskId)!.status).toBe("done");
  });

  test("admin listing reports progress and the photos picked through each link", async () => {
    const { handler, createLink } = await loadRouter();
    const link = await createLink();
    await handler("post", "/:token/proposals")({
      params: { token: link.token },
      body: { name: "Ana", visitorId: "visitor-123", fileNames: ["IMG_1.jpg"], destinations: ["instagram"] },
    }, createMockResponse());

    const res = createMockResponse();
    await handler("get", "/admin")({ query: { albumSlug: "8august2026" } }, res);

    const [listed] = res.json.mock.calls[0][0].links;
    expect(listed.status).toBe("in_progress");
    expect(listed.visitors[0]).toMatchObject({ name: "Ana", proposedCount: 1 });
    expect(listed.photos).toEqual([{ fileName: "IMG_1.jpg", previewUrl: ALBUM.photos[0], proposedBy: "Ana" }]);
  });
});
