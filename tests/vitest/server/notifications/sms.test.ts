// @vitest-environment node
/*
 * Purpose: SMS provider choice (SMSAPI when its token is set, Twilio otherwise), SMSAPI's
 * "200 with an error body" failures, and the GSM-only text that keeps SMS cheap.
 */
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const ENV_KEYS = ["SMSAPI_TOKEN", "SMSAPI_SENDER", "SMSAPI_BASE_URL", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"];

async function loadSms(env: Record<string, string>) {
  vi.resetModules();
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, env);
  return import("src/server/notifications/sms");
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of ENV_KEYS) delete process.env[key];
});

test("sends through SMSAPI with token, sender and number without +", async () => {
  const sms = await loadSms({ SMSAPI_TOKEN: "tok", SMSAPI_SENDER: "AncaVisual", TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "x", TWILIO_FROM_NUMBER: "+1" });
  fetchMock.mockResolvedValue({ ok: true, text: async () => JSON.stringify({ count: 1, list: [{ id: "1" }] }) });
  expect(sms.isSmsConfigured()).toBe(true);

  await sms.sendSms({ to: "+40745123456", body: "🤖 Mesaj automat — pozele sunt gata în jurul datei de 23 noiembrie." });

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("https://api.smsapi.ro/sms.do");
  expect(init.headers.Authorization).toBe("Bearer tok");
  const body = new URLSearchParams(init.body);
  expect(body.get("to")).toBe("40745123456");
  expect(body.get("from")).toBe("AncaVisual");
  expect(body.get("message")).toBe("Mesaj automat - pozele sunt gata in jurul datei de 23 noiembrie.");
});

test("SMSAPI error inside a 200 response is a failure", async () => {
  const sms = await loadSms({ SMSAPI_TOKEN: "tok" });
  fetchMock.mockResolvedValue({ ok: true, text: async () => JSON.stringify({ error: 103, message: "Not enough points" }) });
  await expect(sms.sendSms({ to: "+40745123456", body: "x" })).rejects.toThrow(/SMSAPI 103.*Not enough points/);
});

test("falls back to Twilio without an SMSAPI token, and is off with neither", async () => {
  const twilio = await loadSms({ TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "x", TWILIO_FROM_NUMBER: "+1555" });
  fetchMock.mockResolvedValue({ ok: true, text: async () => "{}" });
  await twilio.sendSms({ to: "+40745123456", body: "Salut" });
  expect(fetchMock.mock.calls[0][0]).toContain("api.twilio.com");

  const none = await loadSms({});
  expect(none.isSmsConfigured()).toBe(false);
  await expect(none.sendSms({ to: "+40745123456", body: "x" })).rejects.toThrow(/nu este configurat/);
});

test("toSmsText keeps line breaks and strips what forces Unicode", async () => {
  const { toSmsText } = await loadSms({});
  expect(toSmsText("📅 Estimare (15 noiembrie):  Ți-am trimis „albumul”…\n\nAlbumul: https://x.ro/media/a"))
    .toBe('Estimare (15 noiembrie): Ti-am trimis "albumul"...\n\nAlbumul: https://x.ro/media/a');
});
