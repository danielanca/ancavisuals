// @vitest-environment node
/*
 * Purpose: Estera's "timp pentru familie" requests — checked dates, an email to the owner, approve /
 * decline with an email back, and approved days counted as booked.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const store: Record<string, Record<string, any>> = {};
const sendEmail = vi.fn();

function fakeDb() {
  const docRef = (collection: string, id: string) => ({
    id,
    get: async () => ({ id, exists: Boolean(store[collection]?.[id]), data: () => store[collection]?.[id] }),
    set: async (value: Record<string, unknown>, options?: { merge?: boolean }) => {
      store[collection] ??= {};
      store[collection][id] = options?.merge ? { ...store[collection][id], ...value } : { ...value };
    },
    delete: async () => { delete store[collection]?.[id]; },
  });
  return {
    collection: (name: string) => ({
      doc: (id: string) => docRef(name, id),
      get: async () => ({ docs: Object.keys(store[name] ?? {}).map((id) => ({ id, data: () => store[name][id] })) }),
    }),
  };
}

vi.mock("src/server/firestore", () => ({ firestore: () => fakeDb() }));
vi.mock("src/server/notifications/mailer", () => ({ sendEmail }));
vi.mock("src/server/middleware/requireFirebaseAuth", () => ({ ESTERA_EMAIL: "estera@example.com" }));
vi.mock("src/server/constants/domain", () => ({ APP_BASE_URL: "https://ancavisuals.ro" }));

const familyTime = await import("src/server/services/familyTime.service");
const TODAY = "2026-10-28";

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  sendEmail.mockReset();
});

describe("family time requests", () => {
  test("rejects bad ranges", async () => {
    expect(await familyTime.createFamilyTimeRequest({}, TODAY)).toMatchObject({ ok: false });
    expect(await familyTime.createFamilyTimeRequest({ startDate: "2026-11-05", endDate: "2026-11-01" }, TODAY)).toMatchObject({ ok: false });
    expect(await familyTime.createFamilyTimeRequest({ startDate: "2026-10-01" }, TODAY)).toMatchObject({ ok: false });
    expect(await familyTime.createFamilyTimeRequest({ startDate: "2026-02-30" }, TODAY)).toMatchObject({ ok: false });
    expect(await familyTime.createFamilyTimeRequest({ startDate: "2026-11-01", endDate: "2027-03-01" }, TODAY)).toMatchObject({ ok: false });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test("a range is saved as pending and the owner gets an email with the note", async () => {
    const result = await familyTime.createFamilyTimeRequest({ startDate: "2026-12-27", endDate: "2026-12-30", note: "Munte <3" }, TODAY);
    expect(result).toMatchObject({ ok: true, request: { startDate: "2026-12-27", endDate: "2026-12-30", status: "pending", note: "Munte <3" } });
    const mail = sendEmail.mock.calls[0][0];
    expect(mail.to).toBe("ancadaniel1994@gmail.com");
    expect(mail.subject).toContain("Estera a cerut timp pentru familie");
    expect(mail.html).toContain("Munte &lt;3");
    expect(mail.html).toContain("https://ancavisuals.ro/admin/calendar-familie");
  });

  test("one day: the end defaults to the start", async () => {
    const result = await familyTime.createFamilyTimeRequest({ startDate: "2026-11-11" }, TODAY);
    expect(result).toMatchObject({ ok: true, request: { startDate: "2026-11-11", endDate: "2026-11-11" } });
  });

  test("approving books the days and emails Estera; pending ones can be withdrawn, decided ones not", async () => {
    const created = await familyTime.createFamilyTimeRequest({ startDate: "2026-12-30", endDate: "2027-01-01" }, TODAY);
    const other = await familyTime.createFamilyTimeRequest({ startDate: "2026-11-20" }, TODAY);
    const id = (created as { request: { id: string } }).request.id;
    expect(await familyTime.approvedFamilyDays()).toEqual([]);

    sendEmail.mockReset();
    const decided = await familyTime.decideFamilyTimeRequest(id, "approved", "Sigur!");
    expect(decided).toMatchObject({ status: "approved", reply: "Sigur!" });
    expect(await familyTime.approvedFamilyDays()).toEqual(["2026-12-30", "2026-12-31", "2027-01-01"]);
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ to: "estera@example.com" });
    expect(sendEmail.mock.calls[0][0].subject).toContain("Aprobat");

    expect(await familyTime.cancelFamilyTimeRequest(id)).toBe(false);
    expect(await familyTime.cancelFamilyTimeRequest((other as { request: { id: string } }).request.id)).toBe(true);
    expect((await familyTime.listFamilyTimeRequests()).map((r) => r.id)).toEqual([id]);
  });
});
