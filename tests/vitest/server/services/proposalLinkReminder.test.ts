/*
 * Purpose: when the automatic „continue choosing photos” reminder goes out — personal links only,
 * not finished, quiet for 4 hours, at most once a day and 3 times — and what it says.
 */
import { describe, expect, test, vi } from "vitest";

vi.mock("src/server/firestore", () => ({ firestore: () => ({}) }));
vi.mock("src/server/notifications/emailFunnel", () => ({ sendViaFunnel: vi.fn() }));

const { autoReminderDue, linkProgress, reminderMessage } = await import("src/server/services/proposalLinkReminder");
const { PHOTO_REVIEWERS } = await import("src/shared/media/proposalConsensus");

const HOUR = 3_600_000;
const NOW = Date.parse("2026-10-30T12:00:00Z");
const at = (ms: number) => ({ toDate: () => new Date(ms) }) as any;
const link = (extra: Record<string, unknown> = {}) => ({
  token: "tok", albumSlug: "08august2026", reviewerId: "estera", active: true, totalPhotos: 1279,
  createdAt: at(NOW - 48 * HOUR),
  visitors: { v1: { name: "Estera", viewedCount: 141, lastSeenAt: at(NOW - 5 * HOUR) } },
  ...extra,
});

describe("proposal link reminders", () => {
  test("due: personal link, not finished, quiet for 4 hours", () => {
    expect(autoReminderDue(link(), NOW, PHOTO_REVIEWERS)).toBe(true);
  });

  test("not due: still active recently, finished, generic link, inactive, or capped", () => {
    expect(autoReminderDue(link({ visitors: { v1: { name: "Estera", viewedCount: 141, lastSeenAt: at(NOW - 2 * HOUR) } } }), NOW, PHOTO_REVIEWERS)).toBe(false);
    expect(autoReminderDue(link({ visitors: { v1: { name: "Estera", viewedCount: 1279, lastSeenAt: at(NOW - 5 * HOUR) } } }), NOW, PHOTO_REVIEWERS)).toBe(false);
    expect(autoReminderDue(link({ visitors: { v1: { name: "Estera", viewedCount: 500, lastSeenAt: at(NOW - 5 * HOUR), completedAt: at(NOW - 5 * HOUR) } } }), NOW, PHOTO_REVIEWERS)).toBe(false);
    expect(autoReminderDue(link({ reviewerId: undefined }), NOW, PHOTO_REVIEWERS)).toBe(false);
    expect(autoReminderDue(link({ active: false }), NOW, PHOTO_REVIEWERS)).toBe(false);
    expect(autoReminderDue(link({ autoReminderCount: 3 }), NOW, PHOTO_REVIEWERS)).toBe(false);
  });

  test("links made before reminders existed get no automatic ones", () => {
    expect(autoReminderDue(link({ createdAt: at(Date.parse("2026-10-20T10:00:00Z")) }), NOW, PHOTO_REVIEWERS)).toBe(false);
  });

  test("at most one a day", () => {
    expect(autoReminderDue(link({ lastReminderAt: at(NOW - 10 * HOUR) }), NOW, PHOTO_REVIEWERS)).toBe(false);
    expect(autoReminderDue(link({ lastReminderAt: at(NOW - 21 * HOUR) }), NOW, PHOTO_REVIEWERS)).toBe(true);
  });

  test("never opened: reminded 4 hours after the link was made", () => {
    expect(autoReminderDue(link({ visitors: {}, createdAt: at(NOW - 3 * HOUR) }), NOW, PHOTO_REVIEWERS)).toBe(false);
    expect(autoReminderDue(link({ visitors: {}, createdAt: at(NOW - 5 * HOUR) }), NOW, PHOTO_REVIEWERS)).toBe(true);
  });

  test("someone else on the link (with their own profile name) doesn't count as this person's progress", () => {
    const shared = link({ visitors: {
      v1: { name: "Estera", viewedCount: 141, lastSeenAt: at(NOW - 5 * HOUR) },
      v2: { name: "Salomeea", viewedCount: 1279, lastSeenAt: at(NOW - 1 * HOUR), completedAt: at(NOW - HOUR) },
    } });
    expect(linkProgress(shared, PHOTO_REVIEWERS)).toMatchObject({ viewed: 141, finished: false });
    expect(autoReminderDue(shared, NOW, PHOTO_REVIEWERS)).toBe(true);
  });

  test("the message says where they left off and links back", () => {
    const estera = PHOTO_REVIEWERS[1];
    expect(reminderMessage(link(), estera).text).toBe(
      "Salut, Estera! Ai ajuns la poza 141 din 1279 din albumul din 8 august 2026. Continuă de unde ai rămas: https://ancavisuals.ro/propune/tok");
    expect(reminderMessage(link({ visitors: {} }), estera).text).toContain("Te așteaptă 1279 de poze de ales");
  });
});
