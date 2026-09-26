import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  save: vi.fn(),
  send: vi.fn(),
}));
vi.mock("firebase-admin/auth", () => ({ getAuth: () => ({
  getUserByEmail: mocks.getUser,
  generatePasswordResetLink: vi.fn().mockResolvedValue(null),
}) }));
vi.mock("src/server/firestore", () => ({ firestore: vi.fn() }));
vi.mock("src/server/services/collaboratorInvite.service", () => ({ upsertCollaboratorInvite: mocks.save }));
vi.mock("src/server/notifications/mailer", () => ({ sendEmail: mocks.send }));
vi.mock("src/server/middleware/requireFirebaseAuth", () => ({
  requireFirebaseAuth: vi.fn(), requireSupremeAdmin: vi.fn(),
}));
import router from "src/server/routes/accounts.routes";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ displayName: "Estera" });
  mocks.save.mockResolvedValue({ albumUrl: "/media/23august2026", inviteInstagram: true });
  mocks.send.mockResolvedValue(undefined);
});

test.each([
  ["user", "Firebase Auth"],
  ["storage", "Firestore"],
  ["email", "SMTP"],
])("identifies the %s failure without exposing internal errors", async (stage, message) => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const failing = stage === "user" ? mocks.getUser : stage === "storage" ? mocks.save : mocks.send;
  failing.mockRejectedValue(new Error("private diagnostic"));
  const handler = router.stack.find(layer => layer.route?.path === "/account-invitations" && layer.route.methods.post)!.route.stack[0].handle;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  await handler({ firebaseEmail: "admin@example.com", body: {
    email: "estera@example.com", albumSlug: "23august2026", inviteInstagram: true,
  } }, res);
  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.json).toHaveBeenCalledWith({ error: expect.stringContaining(message) });
  expect(JSON.stringify(res.json.mock.calls)).not.toContain("private diagnostic");
  if (stage !== "email") expect(mocks.send).not.toHaveBeenCalled();
  log.mockRestore();
});
