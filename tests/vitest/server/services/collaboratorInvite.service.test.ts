/*
 * Purpose: verifies ID/URL building helpers and the upsert + mark-completed
 * state transitions without touching Firestore.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

async function loadService() {
  const nowTs = { _seconds: 1748390400, toDate: () => new Date("2026-05-28T00:00:00Z") };
  const futureTs = { _seconds: 1748476800, toDate: () => new Date("2026-05-29T00:00:00Z") };

  const setMock = vi.fn().mockResolvedValue(undefined);
  const getMock = vi.fn();
  const docMock = vi.fn(() => ({ get: getMock, set: setMock }));
  const collectionMock = vi.fn(() => ({ doc: docMock }));

  vi.doMock("src/server/firestore", () => ({
    firestore: () => ({ collection: collectionMock }),
  }));

  vi.doMock("firebase-admin/firestore", () => ({
    Timestamp: {
      now: () => nowTs,
      fromMillis: (_ms: number) => futureTs,
    },
  }));

  const module = await import("src/server/services/collaboratorInvite.service");

  return { ...module, setMock, getMock, docMock, collectionMock, nowTs, futureTs };
}

describe("collaboratorInvite.service — pure helpers", () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  test("buildCollaboratorInviteId lowercases and URL-encodes email", async () => {
    const { buildCollaboratorInviteId } = await loadService();
    expect(buildCollaboratorInviteId("User@Test.RO", "nunta-cluj")).toBe(
      "user%40test.ro__nunta-cluj",
    );
  });

  test("buildCollaboratorInviteId trims whitespace", async () => {
    const { buildCollaboratorInviteId } = await loadService();
    expect(buildCollaboratorInviteId("  ion@test.ro  ", "  album-123  ")).toBe(
      "ion%40test.ro__album-123",
    );
  });

  test("buildCollaboratorAlbumUrl encodes the slug", async () => {
    const { buildCollaboratorAlbumUrl } = await loadService();
    expect(buildCollaboratorAlbumUrl("nunta-ion-si-maria")).toBe("/media/nunta-ion-si-maria");
  });

  test("getReminderScheduleMs returns array starting at 24h", async () => {
    const { getReminderScheduleMs } = await loadService();
    const schedule = getReminderScheduleMs();
    expect(schedule[0]).toBe(24 * 60 * 60 * 1000);
    expect(schedule.length).toBe(5);
  });
});

describe("upsertCollaboratorInvite", () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  test("creates a new invite with status active when doc does not exist", async () => {
    const { upsertCollaboratorInvite, setMock, getMock, nowTs, futureTs } = await loadService();
    getMock.mockResolvedValue({ exists: false });

    const result = await upsertCollaboratorInvite({
      email: "ion@test.ro",
      albumSlug: "nunta-2026",
      inviteInstagram: true,
      inviteModeration: false,
      createdByEmail: "admin@test.ro",
    });

    expect(result.status).toBe("active");
    expect(result.id).toBe("ion%40test.ro__nunta-2026");
    expect(result.albumUrl).toBe("/media/nunta-2026");
    expect(result.createdAt).toBe(nowTs);
    expect(result.nextReminderAt).toBe(futureTs);
    expect(result.reminderCount).toBe(0);
    expect(setMock).toHaveBeenCalledOnce();
  });

  test("resets reminderStage to 0 and preserves createdAt on upsert", async () => {
    const { upsertCollaboratorInvite, getMock, nowTs } = await loadService();
    const existingCreatedAt = { _seconds: 1000000 };
    getMock.mockResolvedValue({
      exists: true,
      data: () => ({ createdAt: existingCreatedAt, reminderCount: 3 }),
    });

    const result = await upsertCollaboratorInvite({
      email: "ion@test.ro",
      albumSlug: "nunta-2026",
      inviteInstagram: false,
      inviteModeration: true,
      createdByEmail: "admin@test.ro",
    });

    expect(result.createdAt).toBe(existingCreatedAt);
    expect(result.reminderCount).toBe(3);
    expect(result.reminderStage).toBe(0);
    expect(result.updatedAt).toBe(nowTs);
  });
});

describe("markCollaboratorInviteCompleted", () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  test("sets status to completed with correct fields", async () => {
    const { markCollaboratorInviteCompleted, setMock, getMock } = await loadService();
    getMock.mockResolvedValue({
      exists: true,
      data: () => ({ status: "active" }),
    });

    await markCollaboratorInviteCompleted({
      email: "ion@test.ro",
      albumSlug: "nunta-2026",
      actionType: "instagram",
    });

    expect(setMock).toHaveBeenCalledOnce();
    const saved = setMock.mock.calls[0][0];
    expect(saved.status).toBe("completed");
    expect(saved.completedActionType).toBe("instagram");
    expect(saved.completedByEmail).toBe("ion@test.ro");
    expect(saved.nextReminderAt).toBeNull();
  });

  test("does nothing when doc does not exist", async () => {
    const { markCollaboratorInviteCompleted, setMock, getMock } = await loadService();
    getMock.mockResolvedValue({ exists: false });

    await markCollaboratorInviteCompleted({ email: "x@test.ro", albumSlug: "abc", actionType: "moderation" });

    expect(setMock).not.toHaveBeenCalled();
  });

  test("does nothing when invite is already completed", async () => {
    const { markCollaboratorInviteCompleted, setMock, getMock } = await loadService();
    getMock.mockResolvedValue({ exists: true, data: () => ({ status: "completed" }) });

    await markCollaboratorInviteCompleted({ email: "x@test.ro", albumSlug: "abc", actionType: "moderation" });

    expect(setMock).not.toHaveBeenCalled();
  });
});
