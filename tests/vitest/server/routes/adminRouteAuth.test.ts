// @vitest-environment node
/*
 * Purpose: regression guard for the 2026-10-15 fix — admin routes that exposed client
 * data (events, contracts with ID/IBAN, handovers, settings…) without any login must keep
 * the Firebase + supreme-admin middleware. Client-facing token links must stay public.
 */
import { afterEach, describe, expect, test, vi } from "vitest";

const requireFirebaseAuth = vi.fn();
const requireSupremeAdmin = vi.fn();

vi.mock("src/server/middleware/requireFirebaseAuth", () => ({
  requireFirebaseAuth,
  requireSupremeAdmin,
  requireEsteraOrAdmin: vi.fn(),
  requireCoupleAuth: vi.fn(),
}));

type Layer = { route?: { path: string; methods: Record<string, boolean>; stack: { handle: unknown }[] } };

async function middlewaresOf(modulePath: string, method: string, path: string, exportName = "default") {
  const mod = await import(/* @vite-ignore */ modulePath);
  const router = mod[exportName] as { stack: Layer[] };
  const layer = router.stack.find((l) => l.route?.path === path && l.route.methods[method]);
  if (!layer?.route) throw new Error(`${method.toUpperCase()} ${path} not found in ${modulePath}`);
  return layer.route.stack.map((s) => s.handle);
}

afterEach(() => { vi.clearAllMocks(); });

const ADMIN_ONLY: [string, string, string, string?][] = [
  ["src/server/routes/adminEvents.routes", "get", "/events"],
  ["src/server/routes/adminEvents.routes", "post", "/events"],
  ["src/server/routes/adminEvents.routes", "get", "/events/:id"],
  ["src/server/routes/adminEvents.routes", "patch", "/events/:id"],
  ["src/server/routes/adminEvents.routes", "delete", "/events/:id"],
  ["src/server/routes/adminEvents.routes", "post", "/events/:id/post-event-backup/confirm-admin"],
  ["src/server/routes/adminEvents.routes", "get", "/settings"],
  ["src/server/routes/adminEvents.routes", "put", "/settings"],
  ["src/server/routes/adminEvents.routes", "get", "/exchange-rates"],
  ["src/server/routes/adminEvents.routes", "get", "/ui-state"],
  ["src/server/routes/adminEvents.routes", "put", "/ui-state"],
  ["src/server/routes/adminEvents.routes", "post", "/events/:id/create-album"],
  ["src/server/routes/adminEvents.routes", "post", "/events/:id/detect-album"],
  ["src/server/routes/adminEvents.routes", "patch", "/events/:id/album"],
  ["src/server/routes/adminEvents.routes", "post", "/events/:id/process-album"],
  ["src/server/routes/adminEvents.routes", "get", "/media-activity"],
  ["src/server/routes/adminEvents.routes", "get", "/events/:id/upload-progress"],
  ["src/server/routes/adminEvents.routes", "delete", "/events/:id/upload-progress"],
  ["src/server/routes/adminEvents.routes", "delete", "/media-activity/:id"],
  ["src/server/routes/adminCalendar.routes", "get", "/booked-dates"],
  // AI articles published to the blog.
  ["src/server/routes/seoAutoPosts.routes", "get", "/"],
  ["src/server/routes/seoAutoPosts.routes", "post", "/run"],
  ["src/server/routes/seoAutoPosts.routes", "post", "/keyword"],
  ["src/server/routes/seoLandingPages.routes", "get", "/", "adminSeoPagesRouter"],
  ["src/server/routes/seoLandingPages.routes", "get", "/context", "adminSeoPagesRouter"],
  ["src/server/routes/seoLandingPages.routes", "post", "/plan", "adminSeoPagesRouter"],
  ["src/server/routes/seoLandingPages.routes", "post", "/write", "adminSeoPagesRouter"],
  ["src/server/routes/seoLandingPages.routes", "put", "/", "adminSeoPagesRouter"],
  // Family calendar: the secret link and emails to Estera.
  ["src/server/routes/adminCalendar.routes", "get", "/family-calendar"],
  ["src/server/routes/adminCalendar.routes", "patch", "/family-calendar"],
  ["src/server/routes/adminCalendar.routes", "post", "/family-calendar/rotate"],
  ["src/server/routes/adminCalendar.routes", "post", "/family-calendar/send-email"],
  ["src/server/routes/adminCalendar.routes", "post", "/family-calendar/sign-out-all"],
  ["src/server/routes/adminCalendar.routes", "get", "/family-time"],
  ["src/server/routes/adminCalendar.routes", "post", "/family-time/:id/decision"],
  ["src/server/routes/adminCalendar.routes", "delete", "/family-time/:id"],
  ["src/server/routes/albumSubscriptions.routes", "post", "/admin-add"],
  ["src/server/routes/albumSubscriptions.routes", "get", "/list/:slug"],
  ["src/server/routes/albumSubscriptions.routes", "delete", "/unsubscribe"],
  ["src/server/routes/albumSubscriptions.routes", "post", "/updates-bulk"],
  ["src/server/routes/albumSubscriptions.routes", "post", "/updates-preview"],
  ["src/server/routes/albumSubscriptions.routes", "get", "/admin/albums-overview"],
  ["src/server/routes/albumSubscriptions.routes", "get", "/admin/promises"],
  ["src/server/routes/albumSubscriptions.routes", "post", "/admin/promises/:id/done"],
  // Photo reviewers' profiles hold emails and phone numbers; reminders send SMS.
  ["src/server/routes/proposalLinks.routes", "get", "/admin/reviewers"],
  ["src/server/routes/proposalLinks.routes", "post", "/admin/reviewers"],
  ["src/server/routes/proposalLinks.routes", "patch", "/admin/reviewers/:id"],
  ["src/server/routes/proposalLinks.routes", "post", "/admin/:token/reminder"],
  ["src/server/routes/leads.routes", "get", "/email-log"],
  ["src/server/routes/leads.routes", "get", "/email-log/:id"],
  ["src/server/routes/leads.routes", "get", "/sms-log"],
  ["src/server/routes/leads.routes", "get", "/email-inbox-sync"],
  ["src/server/routes/leads.routes", "post", "/email-inbox-sync"],
  ["src/server/routes/qrMoments.routes", "get", "/admin/:eventSlug/couple-sms"],
  ["src/server/routes/qrMoments.routes", "post", "/admin/:eventSlug/couple-sms"],
  ["src/server/routes/qrMoments.routes", "post", "/admin/:eventSlug/couple-sms/sent"],
  ["src/server/routes/contracts.routes", "get", "/"],
  ["src/server/routes/contracts.routes", "post", "/"],
  ["src/server/routes/contracts.routes", "get", "/:id"],
  ["src/server/routes/contracts.routes", "patch", "/:id"],
  ["src/server/routes/contracts.routes", "delete", "/:id"],
  ["src/server/routes/contracts.routes", "get", "/:id/preview"],
  ["src/server/routes/contracts.routes", "post", "/:id/create-event"],
  ["src/server/routes/contracts.routes", "post", "/:id/reset-signature"],
  ["src/server/routes/contracts.routes", "post", "/:id/cancel"],
  ["src/server/routes/contracts.routes", "post", "/:id/prestator-sign"],
  ["src/server/routes/contracts.routes", "post", "/:id/send"],
  ["src/server/routes/handover.routes", "get", "/"],
  ["src/server/routes/handover.routes", "post", "/"],
  ["src/server/routes/handover.routes", "get", "/:id"],
  ["src/server/routes/handover.routes", "patch", "/:id"],
  ["src/server/routes/handover.routes", "delete", "/:id"],
  ["src/server/routes/handover.routes", "get", "/:id/preview"],
  ["src/server/routes/handover.routes", "post", "/:id/send"],
  ["src/server/routes/mementos.routes", "get", "/mementos"],
  ["src/server/routes/mementos.routes", "post", "/mementos"],
  ["src/server/routes/mementos.routes", "patch", "/mementos/:id"],
  ["src/server/routes/mementos.routes", "delete", "/mementos/:id"],
  ["src/server/routes/mementos.routes", "post", "/mementos/send-test-email"],
  ["src/server/routes/inspiration.routes", "post", "/inspiration/suggest-tags"],
  ["src/server/routes/inspiration.routes", "post", "/inspiration/photos"],
  ["src/server/routes/inspiration.routes", "patch", "/inspiration/photos/:id"],
  ["src/server/routes/inspiration.routes", "delete", "/inspiration/photos/:id"],
  ["src/server/routes/analytics.routes", "get", "/analytics/visits", "analyticsAdminRouter"],
  ["src/server/routes/analytics.routes", "get", "/analytics/stats", "analyticsAdminRouter"],
  ["src/server/routes/analytics.routes", "get", "/analytics/consent", "analyticsAdminRouter"],
  ["src/server/routes/album.routes", "get", "/admin/list"],
  ["src/server/routes/album.routes", "post", "/:slug/delete-photo"],
  ["src/server/routes/album.routes", "post", "/:slug/swisslink"],
  ["src/server/routes/event.routes", "get", "/"],
  ["src/server/routes/event.routes", "post", "/"],
  ["src/server/routes/event.routes", "post", "/register-event"],
  ["src/server/routes/event.routes", "post", "/date-available"],
];

describe("admin routes require a signed-in supreme admin", () => {
  test.each(ADMIN_ONLY)("%s %s %s", async (modulePath, method, path, exportName) => {
    const middlewares = await middlewaresOf(modulePath, method, path, exportName);
    expect(middlewares.indexOf(requireFirebaseAuth)).toBe(0);
    expect(middlewares).toContain(requireSupremeAdmin);
  });

  test.each([
    ["get", "/inspiration/photos"],
    ["post", "/inspiration/suggest-tags-from-image"],
  ])("collaborator route %s %s requires a signed-in account", async (method, path) => {
    const middlewares = await middlewaresOf("src/server/routes/inspiration.routes", method, path);
    expect(middlewares[0]).toBe(requireFirebaseAuth);
    expect(middlewares).not.toContain(requireSupremeAdmin);
  });
});

describe("client-facing token links stay public", () => {
  test.each([
    ["src/server/routes/contracts.routes", "get", "/sign/:token"],
    ["src/server/routes/contracts.routes", "post", "/sign/:token"],
    ["src/server/routes/handover.routes", "get", "/sign/:token"],
    ["src/server/routes/adminEvents.routes", "get", "/events/:id/post-event-backup/status"],
    ["src/server/routes/adminEvents.routes", "get", "/events/:id/post-event-backup/confirm"],
  ])("%s %s %s", async (modulePath, method, path) => {
    const middlewares = await middlewaresOf(modulePath, method, path);
    expect(middlewares).not.toContain(requireFirebaseAuth);
  });
});
