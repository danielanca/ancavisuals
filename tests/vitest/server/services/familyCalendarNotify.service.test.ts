// @vitest-environment node
/*
 * Purpose: messages from the family calendar — Salomeea hears when she's assigned (email + SMS, no
 * prices), reminders a week and a day before go once to each person, and the owner's own message.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const store: Record<string, Record<string, any>> = {};
const sendEmail = vi.fn();
const sendSms = vi.fn();

function fakeDb() {
  const docRef = (collection: string, id: string) => ({
    id,
    get: async () => ({ id, exists: Boolean(store[collection]?.[id]), data: () => store[collection]?.[id] }),
    set: async (value: Record<string, unknown>) => { store[collection] ??= {}; store[collection][id] = { ...store[collection][id], ...value }; },
  });
  return {
    collection: (name: string) => ({
      doc: (id: string) => docRef(name, id),
      get: async () => ({ docs: Object.entries(store[name] ?? {}).map(([id, data]) => ({ id, data: () => data })) }),
    }),
    getAll: async (...refs: { get: () => Promise<unknown> }[]) => Promise.all(refs.map((ref) => ref.get())),
  };
}

vi.mock("src/server/firestore", () => ({ firestore: () => fakeDb() }));
vi.mock("src/server/notifications/mailer", () => ({ sendEmail }));
vi.mock("src/server/notifications/sms", () => ({ sendSms, isSmsConfigured: () => true }));
vi.mock("src/server/middleware/requireFirebaseAuth", () => ({ ESTERA_EMAIL: "estera@example.com" }));
vi.mock("src/server/constants/domain", () => ({ APP_BASE_URL: "https://ancavisuals.ro" }));

const notify = await import("src/server/services/familyCalendarNotify.service");

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  sendEmail.mockReset();
  sendSms.mockReset();
  store.adminEvents = {
    wedding: { status: "confirmat", type: "Nuntă", eventDate: "2026-11-07T00:00:00.000Z", client: { fullName: "Ana & Ion" }, pricing: { total: 2500 }, contractId: "c1" },
    baptism: { status: "confirmat", type: "Botez", eventDate: "2026-11-01T00:00:00.000Z", client: { fullName: "Maria" }, pricing: { total: 900 } },
    past: { status: "finalizat", type: "Nuntă", eventDate: "2026-10-01T00:00:00.000Z", client: { fullName: "Trecut" } },
  };
  store.contracts = { c1: { eventLocation: "Castelul X" } };
  store.settings = { familyCalendar: { token: "t", helperToken: "h", recipientPhone: "", helperPhone: "+40722123456", helperEventIds: ["wedding"] } };
});

describe("family calendar notifications", () => {
  test("assigned: Salomeea gets email + SMS for coming events only, without prices", async () => {
    expect(await notify.notifyHelperAssigned(["wedding", "past"], "2026-10-31")).toEqual({ email: true, sms: true, events: 1 });
    const mail = sendEmail.mock.calls[0][0];
    expect(mail.to).toBe("salomeeamitre602@gmail.com");
    expect(mail.subject).toContain("Nuntă · Ana & Ion");
    expect(mail.html).toContain("Castelul X");
    expect(mail.html).not.toMatch(/€|EUR|2\.?500/);
    expect(sendSms.mock.calls[0][0]).toMatchObject({ to: "+40722123456" });
    expect(sendSms.mock.calls[0][0].body).toContain("ancavisuals.ro/zile-ocupate");
    expect(await notify.notifyHelperAssigned(["past"], "2026-10-31")).toEqual({ email: false, sms: false, events: 0 });
  });

  test("reminders: a week before (Estera with price, Salomeea without) and the day before, each sent once", async () => {
    expect(await notify.processFamilyCalendarReminders("2026-10-31")).toBe(3);
    // week: wedding on 11-07 → Estera + Salomeea; day: baptism on 11-01 → Estera only.
    const mails = sendEmail.mock.calls.map(([mail]) => mail);
    const estera = mails.find((mail) => mail.to === "estera@example.com" && mail.subject.startsWith("Peste o săptămână"));
    const salomeea = mails.find((mail) => mail.to === "salomeeamitre602@gmail.com");
    expect(estera.html).toMatch(/2\.?500/);
    expect(salomeea.html).not.toMatch(/€|EUR|2\.?500/);
    expect(mails.find((mail) => mail.subject === "Mâine: Botez · Maria")?.to).toBe("estera@example.com");
    expect(sendSms).toHaveBeenCalledTimes(1); // only Salomeea has a phone
    expect(await notify.processFamilyCalendarReminders("2026-10-31")).toBe(0);
  });

  test("reminders turned off: nothing goes out", async () => {
    store.settings.familyCalendar.reminders = false;
    expect(await notify.processFamilyCalendarReminders("2026-10-31")).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test("the owner's message: chosen people and channels; no phone means no SMS", async () => {
    const results = await notify.sendFamilyCalendarMessage({ to: ["family", "helper"], text: "Plecăm la <9>.", email: false, sms: true });
    expect(results).toEqual([{ name: "Estera", email: false, sms: false }, { name: "Salomeea", email: false, sms: true }]);
    expect(sendSms.mock.calls[0][0].body).toBe("Anca Visuals: Plecăm la <9>.");
    expect(sendEmail).not.toHaveBeenCalled();
    await notify.sendFamilyCalendarMessage({ to: ["family"], text: "Plecăm la <9>.", email: true, sms: false });
    expect(sendEmail.mock.calls[0][0].html).toContain("Plecăm la &lt;9&gt;.");
  });
});
