/*
 * Purpose: promises written to clients in album updates ("gata în jurul datei de…") are tracked;
 * the owner is emailed 4 days before the date and once more if it passes, never twice per stage.
 */
import { beforeEach, expect, test, vi } from "vitest";

type Doc = { id: string; data: Record<string, unknown> };
let updates: Doc[] = [];
let events: Doc[] = [];
const sendEmail = vi.fn().mockResolvedValue(undefined);

vi.mock("src/server/notifications/mailer", () => ({ sendEmail }));
vi.mock("src/server/constants/credentials", () => ({ adminUser: { email: "admin@test.ro" } }));
vi.mock("src/server/constants/domain", () => ({ APP_BASE_URL: "https://ancavisuals.ro" }));
vi.mock("src/server/firestore", () => ({
  firestore: () => ({
    collection: (name: string) => ({
      get: async () => ({ docs: (name === "adminEvents" ? events : updates).map((d) => ({ id: d.id, data: () => d.data })) }),
      doc: (id: string) => ({
        get: async () => { const d = updates.find((u) => u.id === id); return { exists: Boolean(d), data: () => d?.data }; },
        update: async (patch: Record<string, unknown>) => { const d = updates.find((u) => u.id === id)!; Object.assign(d.data, patch); },
      }),
    }),
  }),
}));

const { listOpenPromises, markPromiseDone, processPromiseReminders, daysBetween } = await import("src/server/services/albumPromises");

const NOW = new Date("2026-11-10T08:00:00Z");
const created = (iso: string) => iso;

beforeEach(() => {
  sendEmail.mockClear();
  events = [{ id: "e1", data: { albumSlug: "nunta-ana", client: { fullName: "Ana & Ion" } } }];
  updates = [
    { id: "old", data: { albumSlug: "nunta-ana", kind: "estimate", text: "Gata pe 5.", estimateDate: "2026-11-05", createdAt: created("2026-10-01T10:00:00Z") } },
    { id: "delay", data: { albumSlug: "nunta-ana", kind: "delay", text: "Mai durează 10 zile.", estimateDate: "2026-11-13", createdAt: created("2026-11-01T10:00:00Z") } },
    { id: "late", data: { albumSlug: "botez-maria", kind: "estimate", text: "Gata pe 8.", estimateDate: "2026-11-08", createdAt: created("2026-10-20T10:00:00Z") } },
    { id: "far", data: { albumSlug: "nunta-dan", kind: "estimate", text: "Gata în decembrie.", estimateDate: "2026-12-20", createdAt: created("2026-11-02T10:00:00Z") } },
    { id: "nodate", data: { albumSlug: "nunta-dan", kind: "photos", text: "Poze noi.", estimateDate: null, createdAt: created("2026-11-03T10:00:00Z") } },
  ];
});

test("days are counted in calendar days", () => {
  expect(daysBetween("2026-11-10", "2026-11-13")).toBe(3);
  expect(daysBetween("2026-11-10", "2026-11-08")).toBe(-2);
});

test("the newest dated update of each album is its open promise (a delay replaces the old estimate)", async () => {
  const promises = await listOpenPromises(NOW);
  expect(promises.map((p) => [p.albumSlug, p.id, p.status, p.daysLeft])).toEqual([
    ["botez-maria", "late", "overdue", -2],
    ["nunta-ana", "delay", "soon", 3],
    ["nunta-dan", "far", "later", 40],
  ]);
  expect(promises[1].clients).toEqual(["Ana & Ion"]);
});

test("one email for promises due within 4 days or overdue, and never the same stage twice", async () => {
  expect(await processPromiseReminders(NOW)).toBe(2);
  expect(sendEmail).toHaveBeenCalledOnce();
  const mail = sendEmail.mock.calls[0][0];
  expect(mail.to).toBe("admin@test.ro");
  expect(mail.subject).toContain("Ai promis ceva");
  expect(mail.html).toContain("Hei, vezi că ai promis ceva într-o notificare");
  expect(mail.html).toContain("Ana &amp; Ion");
  expect(mail.html).toContain("Mai durează 10 zile.");
  expect(mail.html).toContain("peste 3 zile");
  expect(mail.html).toContain("a trecut acum 2 zile");
  expect(mail.html).not.toContain("Gata în decembrie.");

  sendEmail.mockClear();
  expect(await processPromiseReminders(NOW)).toBe(0);
  expect(sendEmail).not.toHaveBeenCalled();
});

test("a promise marked done disappears from the list and gets no reminder", async () => {
  expect(await markPromiseDone("delay")).toBe(true);
  expect(await markPromiseDone("nodate")).toBe(false);
  const promises = await listOpenPromises(NOW);
  expect(promises.map((p) => p.albumSlug)).not.toContain("nunta-ana");
});
