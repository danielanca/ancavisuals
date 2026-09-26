import { beforeEach, expect, test, vi } from "vitest";

beforeEach(() => { vi.resetModules(); });
async function setup() {
  let saved: any = {};
  const ref = { set: vi.fn(async data => { saved = data; }), get: vi.fn(async () => ({ data: () => saved })) };
  const transaction = { get: ref.get, set: (_ref: unknown, data: unknown) => { saved = data; } };
  vi.doMock("src/server/firestore", () => ({ firestore: () => ({ collection: () => ({ doc: () => ref }), runTransaction: (fn: any) => fn(transaction) }) }));
  return { ...(await import("src/server/services/emailDelivery.service")), ref };
}
test("alert survives module reload and an older acknowledgement cannot dismiss a new failure", async () => {
  let service = await setup();
  await service.raiseEmailAlert({ id: "first", error: "AUTH", subject: "Test", to: "a@example.com" });
  vi.resetModules();
  const restored = await import("src/server/services/emailDelivery.service");
  expect((await restored.getEmailAlert())?.id).toBe("first");
  await restored.raiseEmailAlert({ id: "second", error: "SMTP", subject: "Test", to: "a@example.com" });
  await restored.acknowledgeEmailAlert("first");
  expect((await restored.getEmailAlert())?.id).toBe("second");
  await restored.acknowledgeEmailAlert("second");
  expect(await restored.getEmailAlert()).toBeNull();
});
test("keeps the alert in memory when persistence fails", async () => {
  const service = await setup();
  service.ref.set.mockRejectedValue(new Error("offline"));
  service.ref.get.mockRejectedValue(new Error("offline"));
  await service.raiseEmailAlert({ id: "first", error: "AUTH", subject: "Test", to: "a@example.com" });
  expect((await service.getEmailAlert())?.id).toBe("first");
});
test("diagnostics retain stack and SMTP codes but scrub credentials", async () => {
  const { emailErrorDiagnostic } = await setup();
  vi.stubEnv("SMTP_APP_PASSWORD", "secret-pass-123");
  try {
    const text = emailErrorDiagnostic({ code: "EAUTH", responseCode: 535, command: "AUTH PLAIN base64secret", message: "Invalid login secret-pass-123", stack: "Error: secret-pass-123\n at sendMail (/server/mailer.js:1:1)" });
    expect(text).toContain("535"); expect(text).toContain("at sendMail");
    expect(text).not.toContain("secret-pass-123"); expect(text).not.toContain("base64secret");
  } finally { vi.unstubAllEnvs(); }
});
