// @vitest-environment node
/*
 * Purpose: the family calendar for Estera — which events she sees (confirmed only, with the
 * contract's location), the secret link check and what her email says.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const store: Record<string, Record<string, any>> = {};
const sendEmail = vi.fn();

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
vi.mock("src/server/middleware/requireFirebaseAuth", () => ({ ESTERA_EMAIL: "estera@example.com" }));
vi.mock("src/server/constants/domain", () => ({ APP_BASE_URL: "https://ancavisuals.ro" }));

const service = await import("src/server/services/familyCalendar.service");

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  sendEmail.mockReset();
  store.adminEvents = {
    wedding: { status: "confirmat", type: "Nuntă", eventDate: "2026-10-31T00:00:00.000Z", client: { fullName: "Ana & Ion" }, pricing: { total: 2500 }, contractId: "c1" },
    baptism: { status: "finalizat", type: "Botez", eventDate: "2026-12-05T00:00:00.000Z", client: { fullName: "Maria" }, pricing: { total: 0 } },
    lead: { status: "lead", type: "Nuntă", eventDate: "2026-11-07T00:00:00.000Z", client: { fullName: "Lead" } },
    old: { status: "confirmat", type: "Nuntă", eventDate: "2025-01-10T00:00:00.000Z", client: { fullName: "Vechi" } },
  };
  store.contracts = { c1: { eventLocation: "Castelul X, Turda" } };
});

describe("family calendar service", () => {
  test("only confirmed events from the last 90 days on, with the contract location and price", async () => {
    const events = await service.loadFamilyCalendarEvents("2026-10-28");
    expect(events.map((e) => e.id)).toEqual(["wedding", "baptism"]);
    expect(events[0]).toMatchObject({ dates: ["2026-10-31"], clientName: "Ana & Ion", location: "Castelul X, Turda", total: 2500 });
    expect(events[1]).toMatchObject({ total: null, location: "" });
  });

  test("the secret link is made once, checked exactly, and replaced on rotate", async () => {
    const { token, recipientEmail } = await service.getFamilyCalendarSettings();
    expect(recipientEmail).toBe("estera@example.com");
    expect((await service.getFamilyCalendarSettings()).token).toBe(token);
    expect(await service.isFamilyCalendarToken(token)).toBe(true);
    expect(await service.isFamilyCalendarToken(`${token}x`)).toBe(false);
    const fresh = await service.rotateFamilyCalendarToken();
    expect(await service.isFamilyCalendarToken(token)).toBe(false);
    expect(await service.isFamilyCalendarToken(fresh)).toBe(true);
  });

  test("email: the login page (no secret links), how to sign in, this week's and upcoming events with prices, escaped", async () => {
    const events = await service.loadFamilyCalendarEvents("2026-10-28");
    events[0].clientName = "Ana <b>";
    const { subject, html } = service.familyCalendarEmail({ email: "estera@example.com", events, today: "2026-10-28", weekly: false });
    expect(subject).toBe("Calendarul cu evenimentele mele");
    expect(html).toContain("https://ancavisuals.ro/zile-ocupate");
    expect(html).toContain("estera@example.com");
    expect(html).not.toContain("calendar.ics");
    expect(html).toContain("Ana &lt;b&gt;");
    expect(html).toMatch(/2\.?500\s(€|EUR)/);
    const [thisWeek, upcoming] = html.split("Urmează");
    expect(thisWeek).toContain("Ana &lt;b&gt;");
    expect(upcoming).toContain("Maria");
  });

  test("weekly email goes once a week and only when turned on", async () => {
    expect(await service.sendWeeklyFamilyCalendarEmail()).toBe(false);
    await service.updateFamilyCalendarSettings({ weeklyEmail: true });
    expect(await service.sendWeeklyFamilyCalendarEmail()).toBe(true);
    expect(await service.sendWeeklyFamilyCalendarEmail()).toBe(false);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ to: "estera@example.com", source: "family-calendar-weekly" });
  });
});
