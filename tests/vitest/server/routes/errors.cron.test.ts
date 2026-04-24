/*
 * Purpose: verifies the 3-day error digest cron — skips email when all errors
 * are seen, sends a summary email when unseen errors exist.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Timestamp } from "firebase-admin/firestore";

async function loadErrorsCron() {
  const sendEmailMock = vi.fn().mockResolvedValue(undefined);
  const whereMock = vi.fn();

  vi.doMock("src/server/notifications/mailer", () => ({
    sendEmail: sendEmailMock,
  }));

  vi.doMock("src/server/monitoring/serverMonitor", () => ({
    ERRORS_COLLECTION: "serverErrors",
    captureClientError: vi.fn(),
    startServerMonitor: vi.fn(),
    stopServerMonitor: vi.fn(),
  }));

  vi.doMock("src/server/firestore", () => ({
    firestore: () => ({
      collection: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              get: whereMock,
            })),
          })),
        })),
      })),
    }),
  }));

  vi.doMock("firebase-admin/firestore", () => ({
    Timestamp: {
      fromDate: (d: Date) => ({ toDate: () => d }),
    },
  }));

  vi.doMock("node-cron", () => ({
    default: { schedule: vi.fn() },
  }));

  const { sendErrorsDigest } = await import("src/server/cron/errors.cron");

  return { sendEmailMock, whereMock, sendErrorsDigest };
}

describe("errors.cron — sendErrorsDigest", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  test("skips email when there are no unseen errors", async () => {
    const { sendErrorsDigest, sendEmailMock, whereMock } = await loadErrorsCron();

    whereMock.mockResolvedValue({ empty: true, docs: [] });

    await sendErrorsDigest();

    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  test("sends digest email when unseen errors exist", async () => {
    const { sendErrorsDigest, sendEmailMock, whereMock } = await loadErrorsCron();
    const capturedAt = Timestamp.fromDate(new Date("2026-04-21T08:00:00.000Z"));

    whereMock.mockResolvedValue({
      empty: false,
      size: 2,
      docs: [
        {
          id: "err-1",
          data: () => ({
            message: "TypeError: Cannot read properties of undefined",
            source: "client",
            severity: "error",
            page: "/gallery",
            capturedAt,
          }),
        },
        {
          id: "err-2",
          data: () => ({
            message: "[express error] ReferenceError: db is not defined",
            source: "server",
            severity: "error",
            page: "",
            capturedAt,
          }),
        },
      ],
    });

    await sendErrorsDigest();

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const { subject, html } = sendEmailMock.mock.calls[0][0];
    expect(subject).toContain("2 erori nevăzute");
    expect(html).toContain("TypeError: Cannot read properties");
    expect(html).toContain("[express error]");
  });

  test("email subject uses warning icon when only warnings exist", async () => {
    const { sendErrorsDigest, sendEmailMock, whereMock } = await loadErrorsCron();
    const capturedAt = Timestamp.fromDate(new Date("2026-04-21T08:00:00.000Z"));

    whereMock.mockResolvedValue({
      empty: false,
      size: 1,
      docs: [
        {
          id: "warn-1",
          data: () => ({
            message: "Deprecated API used",
            source: "server",
            severity: "warn",
            page: "",
            capturedAt,
          }),
        },
      ],
    });

    await sendErrorsDigest();

    const { subject } = sendEmailMock.mock.calls[0][0];
    expect(subject).toContain("🟡");
    expect(subject).not.toContain("🔴");
  });

  test("email subject uses red icon when at least one error exists", async () => {
    const { sendErrorsDigest, sendEmailMock, whereMock } = await loadErrorsCron();
    const capturedAt = Timestamp.fromDate(new Date("2026-04-21T08:00:00.000Z"));

    whereMock.mockResolvedValue({
      empty: false,
      size: 1,
      docs: [
        {
          id: "err-1",
          data: () => ({
            message: "Server crashed",
            source: "server",
            severity: "error",
            page: "",
            capturedAt,
          }),
        },
      ],
    });

    await sendErrorsDigest();

    const { subject } = sendEmailMock.mock.calls[0][0];
    expect(subject).toContain("🔴");
  });
});
