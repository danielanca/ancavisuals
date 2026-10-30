// @vitest-environment node
/*
 * Purpose: Estera's login to /zile-ocupate — only her email and the owner's get a code; the code and the email's
 * login link work once, expire after 10 minutes and lock after 5 wrong tries; sessions last 90 days.
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
      get: async () => {
        const docs = Object.keys(store[name] ?? {}).map((id) => ({ id, ref: docRef(name, id), data: () => store[name][id] }));
        return { docs, size: docs.length };
      },
    }),
  };
}

vi.mock("src/server/firestore", () => ({ firestore: () => fakeDb() }));
vi.mock("src/server/notifications/mailer", () => ({ sendEmail }));
const sendSms = vi.fn();
vi.mock("src/server/notifications/sms", async (importOriginal) => ({ ...(await importOriginal<object>()), sendSms, isSmsConfigured: () => true }));
vi.mock("src/server/middleware/requireFirebaseAuth", () => ({ ESTERA_EMAIL: "estera@example.com" }));
vi.mock("src/server/constants/domain", () => ({ APP_BASE_URL: "https://ancavisuals.ro" }));

const auth = await import("src/server/services/familyCalendarAuth.service");
const NOW = Date.parse("2026-10-28T10:00:00Z");

const sentCode = () => String(sendEmail.mock.calls.at(-1)![0].subject).slice(0, 6);
const sentMagic = () => String(sendEmail.mock.calls.at(-1)![0].html).match(/intra=([\w-]+)/)![1];

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  sendEmail.mockReset();
  sendSms.mockReset();
});

describe("family calendar login", () => {
  test("only the calendar's email gets a code (case and spaces don't matter)", async () => {
    expect(await auth.requestFamilyLoginCode("altcineva@example.com", NOW)).toEqual({ ok: false, reason: "wrong-email" });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(await auth.requestFamilyLoginCode("  Estera@Example.com ", NOW)).toEqual({ ok: true, channel: "email" });
    const mail = sendEmail.mock.calls[0][0];
    expect(mail.to).toBe("estera@example.com");
    expect(mail.subject).toMatch(/^\d{6} e codul pentru calendar$/);
    expect(mail.html).toContain(`>${sentCode()}<`);
    expect(mail.html).toContain("https://ancavisuals.ro/zile-ocupate?intra=");
    expect(JSON.stringify(store.settings.familyCalendarLogin)).not.toContain(sentCode());
  });

  test("the code signs in once and gives a 90-day session", async () => {
    await auth.requestFamilyLoginCode("estera@example.com", NOW);
    const code = sentCode();
    const result = await auth.verifyFamilyLogin({ email: "estera@example.com", code }, NOW + 60_000);
    expect(result.ok).toBe(true);
    const session = (result as { session: string }).session;
    expect(await auth.familySessionViewer(session, NOW + 89 * 86_400_000)).toBe("family");
    expect(await auth.familySessionViewer(session, NOW + 91 * 86_400_000)).toBe(null);
    expect((await auth.verifyFamilyLogin({ email: "estera@example.com", code }, NOW + 61_000)).ok).toBe(false);
    await auth.endFamilySession(session);
    expect(await auth.familySessionViewer(session, NOW + 120_000)).toBe(null);
  });

  test("the email's button signs in without typing the code", async () => {
    await auth.requestFamilyLoginCode("estera@example.com", NOW);
    expect((await auth.verifyFamilyLogin({ magic: sentMagic() }, NOW + 1000)).ok).toBe(true);
  });

  test("expired after 10 minutes; locked after 5 wrong codes; resend waits and is capped", async () => {
    await auth.requestFamilyLoginCode("estera@example.com", NOW);
    expect(await auth.verifyFamilyLogin({ email: "estera@example.com", code: sentCode() }, NOW + 11 * 60_000)).toEqual({ ok: false, reason: "expired" });

    expect((await auth.requestFamilyLoginCode("estera@example.com", NOW + 10_000)) as unknown).toMatchObject({ ok: false, reason: "too-soon" });
    await auth.requestFamilyLoginCode("estera@example.com", NOW + 60_000);
    const code = sentCode();
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) await auth.verifyFamilyLogin({ email: "estera@example.com", code: wrong }, NOW + 61_000);
    expect(await auth.verifyFamilyLogin({ email: "estera@example.com", code }, NOW + 62_000)).toEqual({ ok: false, reason: "too-many" });

    for (let i = 2; i < 6; i++) await auth.requestFamilyLoginCode("estera@example.com", NOW + i * 60_000);
    expect(await auth.requestFamilyLoginCode("estera@example.com", NOW + 10 * 60_000)).toEqual({ ok: false, reason: "too-many" });
  });

  test("the owner signs in with their own email; each email keeps its own code", async () => {
    await auth.requestFamilyLoginCode("estera@example.com", NOW);
    const esteraCode = sentCode();
    expect(await auth.requestFamilyLoginCode("AncaDaniel1994@gmail.com", NOW + 1000)).toEqual({ ok: true, channel: "email" });
    expect(sendEmail.mock.calls.at(-1)![0].to).toBe("ancadaniel1994@gmail.com");
    const ownerCode = sentCode();
    const ownerMagic = sentMagic();
    if (ownerCode !== esteraCode) {
      expect((await auth.verifyFamilyLogin({ email: "ancadaniel1994@gmail.com", code: esteraCode }, NOW + 2000)).ok).toBe(false);
    }
    expect((await auth.verifyFamilyLogin({ email: "estera@example.com", code: esteraCode }, NOW + 3000)).ok).toBe(true);
    expect((await auth.verifyFamilyLogin({ magic: ownerMagic }, NOW + 4000)).ok).toBe(true);
    expect((await auth.verifyFamilyLogin({ magic: ownerMagic }, NOW + 5000)).ok).toBe(false);
  });

  test("Salomeea signs in as the helper; Estera and the owner as family", async () => {
    expect(await auth.requestFamilyLoginCode("salomeeamitre602@gmail.com", NOW)).toEqual({ ok: true, channel: "email" });
    const helper = await auth.verifyFamilyLogin({ email: "salomeeamitre602@gmail.com", code: sentCode() }, NOW + 1000);
    expect(helper).toMatchObject({ ok: true, viewer: "helper" });
    expect(await auth.familySessionViewer((helper as { session: string }).session, NOW + 2000)).toBe("helper");
    await auth.requestFamilyLoginCode("ancadaniel1994@gmail.com", NOW);
    expect(await auth.verifyFamilyLogin({ magic: sentMagic() }, NOW + 1000)).toMatchObject({ ok: true, viewer: "family" });
  });

  test("a saved phone number gets the code by SMS and signs in with it", async () => {
    store.settings = { familyCalendar: { token: "t", helperToken: "h", helperPhone: "+40722123456" } };
    expect(await auth.requestFamilyLoginCode("0722 123 456", NOW)).toEqual({ ok: true, channel: "sms" });
    expect(sendEmail).not.toHaveBeenCalled();
    const { to, body } = sendSms.mock.calls[0][0];
    expect(to).toBe("+40722123456");
    const code = String(body).match(/\d{6}/)![0];
    expect(await auth.verifyFamilyLogin({ email: "+40 722 123 456", code }, NOW + 1000)).toMatchObject({ ok: true, viewer: "helper" });
    expect(await auth.requestFamilyLoginCode("0799 999 999", NOW)).toEqual({ ok: false, reason: "wrong-email" });
  });

  test("signing out everywhere ends every session; cookies are httpOnly", async () => {
    await auth.requestFamilyLoginCode("estera@example.com", NOW);
    const { session } = (await auth.verifyFamilyLogin({ magic: sentMagic() }, NOW)) as { session: string };
    expect(await auth.endAllFamilySessions()).toBe(1);
    expect(await auth.familySessionViewer(session, NOW)).toBe(null);
    expect(auth.sessionCookie("abc", true)).toMatch(/^fc_session=abc; Path=\/api\/family-calendar; HttpOnly; SameSite=Lax; Secure; Max-Age=7776000$/);
    expect(auth.readCookie("a=1; fc_session=xyz; b=2", "fc_session")).toBe("xyz");
  });
});
