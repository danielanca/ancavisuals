/*
 * Purpose: verifies that triggerEvent correctly applies the cooldown, IP
 * geo-filter, and — crucially — uses the caller-supplied html/subject for
 * Lead Rapid / booking submissions instead of the generic visitor template.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

type Handler = (req: any, res: any) => Promise<void>;

function createMockResponse() {
  const res = { status: vi.fn(), send: vi.fn(), setHeader: vi.fn() };
  res.status.mockReturnValue(res);
  res.send.mockReturnValue(res);
  return res;
}

function buildReq(body: Record<string, unknown>, ip = "89.40.11.22", headers: Record<string, string> = {}) {
  return {
    body,
    headers,
    connection: { remoteAddress: ip },
    socket: { remoteAddress: ip },
  };
}

async function loadController() {
  const sendEmailMock = vi.fn().mockResolvedValue(undefined);
  const fetchIpInfoMock = vi.fn().mockResolvedValue({ country: "RO", city: "Cluj-Napoca" });
  const getClientIpMock = vi.fn().mockReturnValue("89.40.11.22");
  const renderTriggerTemplateMock = vi.fn().mockReturnValue("<p>generic template</p>");
  const applyCORSpolicyMock = vi.fn();
  const markActivityEmailSentMock = vi.fn().mockResolvedValue(undefined);
  const logActivityMock = vi.fn().mockResolvedValue("activity-id");
  vi.doMock("src/server/services/activity.service.js", () => ({
    logActivity: logActivityMock,
    markActivityEmailSent: markActivityEmailSentMock,
    getNotificationSettings: vi.fn().mockResolvedValue({ email: { newVisitor: true, lead: true } }),
  }));
  const saveLeadMock = vi.fn().mockResolvedValue("lead-id");
  const updateLeadEmailStatusMock = vi.fn().mockResolvedValue(undefined);
  const logEmailMock = vi.fn().mockResolvedValue("log-id");
  vi.doMock("src/server/services/leads.service.js", () => ({
    saveLead: saveLeadMock,
    updateLeadEmailStatus: updateLeadEmailStatusMock,
  }));
  vi.doMock("src/server/services/emailLog.service.js", () => ({ logEmail: logEmailMock }));
  vi.doMock("src/server/services/googleAdsConversion.service.js", () => ({
    reportLeadConversion: vi.fn().mockResolvedValue(undefined),
    reportContactClickConversion: vi.fn().mockResolvedValue(undefined),
  }));

  vi.doMock("src/server/notifications/mailer", () => ({ sendEmail: sendEmailMock }));
  vi.doMock("src/server/utils/ipinfo", () => ({
    fetchIpInfo: fetchIpInfoMock,
    getClientIp: getClientIpMock,
  }));
  vi.doMock("src/server/notifications/templates/triggerTemplate", () => ({
    renderTriggerTemplate: renderTriggerTemplateMock,
  }));
  vi.doMock("src/server/constants/cors", () => ({ applyCORSpolicy: applyCORSpolicyMock }));
  vi.doMock("src/server/constants/credentials", () => ({
    adminUser: { email: "admin@test.ro" },
  }));

  const module = await import("src/server/controllers/triggerEvent.controller");

  return {
    triggerEvent: module.triggerEvent as Handler,
    saveLeadMock,
    updateLeadEmailStatusMock,
    logEmailMock,
    sendEmailMock,
    logActivityMock,
    markActivityEmailSentMock,
    fetchIpInfoMock,
    getClientIpMock,
    renderTriggerTemplateMock,
  };
}

describe("triggerEvent controller", () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  test.each([
    { typeEvent: "Vizitator", isNewVisitor: true },
    { typeEvent: "Vizitator", isNewVisitor: false },
    { typeEvent: "Vizitator din ChatGPT", utmSource: "chatgpt" },
    { typeEvent: "Vizitator", gclid: "ads-click" },
  ])("suppresses visitor emails and inbox entries: %j", async body => {
    const { triggerEvent, sendEmailMock, logActivityMock, fetchIpInfoMock } = await loadController();
    const res = createMockResponse();
    await triggerEvent(buildReq({ ...body, url: "/foto-video-majorat", browserVersion: "Chrome/120" }), res);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(logActivityMock).not.toHaveBeenCalled();
    expect(fetchIpInfoMock).not.toHaveBeenCalled();
  });

  test("records a lead as sent only after SMTP succeeds", async () => {
    const { triggerEvent, sendEmailMock, logActivityMock, markActivityEmailSentMock } = await loadController();
    sendEmailMock.mockImplementation(async () => {
      expect(markActivityEmailSentMock).not.toHaveBeenCalled();
    });
    const res = createMockResponse();
    await triggerEvent(buildReq({ typeEvent: "Rezervare", subject: "Cerere", html: "<p>Lead</p>", browserVersion: "Chrome/120" }), res);
    expect(logActivityMock).toHaveBeenCalledWith(expect.objectContaining({ type: "lead", emailSent: false }));
    expect(markActivityEmailSentMock).toHaveBeenCalledWith("activity-id");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("booking lead without browserVersion is accepted via the User-Agent header", async () => {
    const { triggerEvent, sendEmailMock } = await loadController();
    const res = createMockResponse();
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
    await triggerEvent(buildReq({ typeEvent: "Lead Rapid", subject: "Lead rapid", html: "<p>Lead</p>" }, "89.40.11.22", { "user-agent": ua }), res);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("final booking is not swallowed by the partial lead from the same IP", async () => {
    vi.useFakeTimers();
    try {
      const { triggerEvent, sendEmailMock } = await loadController();
      const ua = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile";
      await triggerEvent(buildReq({ typeEvent: "Lead Rapid", subject: "Lead rapid", html: "<p>Partial</p>" }, "89.40.11.23", { "user-agent": ua }), createMockResponse());
      vi.advanceTimersByTime(3 * 60 * 1000);
      await triggerEvent(buildReq({ typeEvent: "Rezervare", subject: "Rezervare", html: "<p>Final</p>" }, "89.40.11.23", { "user-agent": ua }), createMockResponse());
      expect(sendEmailMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  test("a lead stopped by a filter is still saved and its email logged as skipped", async () => {
    const { triggerEvent, sendEmailMock, saveLeadMock, updateLeadEmailStatusMock, logEmailMock } = await loadController();
    const res = createMockResponse();
    // No User-Agent at all → bot filter
    await triggerEvent(buildReq({
      typeEvent: "Lead Rapid", subject: "Lead rapid", html: "<p>Lead</p>",
      booking: { fullName: "Ion Pop", phone: "0711111111", eventType: "Nuntă", date: "12 iunie 2027", partial: true },
    }), res);
    expect(saveLeadMock).toHaveBeenCalledWith(expect.objectContaining({
      source: "configurator", name: "Ion Pop", phone: "0711111111", partial: true,
    }));
    expect(sendEmailMock).not.toHaveBeenCalled();
    // A blocked lead is an error in the funnel, never a silent drop.
    expect(logEmailMock).toHaveBeenCalledWith(expect.objectContaining({
      status: "skipped", severity: "error", reason: "bot: fără User-Agent", leadId: "lead-id", html: "<p>Lead</p>", source: "lead",
    }));
    expect(updateLeadEmailStatusMock).toHaveBeenCalledWith("lead-id", "skipped", "bot: fără User-Agent");
    expect(res.status).toHaveBeenCalledWith(204);
  });

  test("a delivered lead is marked sent", async () => {
    const { triggerEvent, updateLeadEmailStatusMock, sendEmailMock } = await loadController();
    await triggerEvent(buildReq({ typeEvent: "Rezervare", subject: "Cerere", html: "<p>Lead</p>", browserVersion: "Chrome/120 Mobile Safari" }), createMockResponse());
    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({ leadId: "lead-id", source: "lead" }));
    expect(updateLeadEmailStatusMock).toHaveBeenCalledWith("lead-id", "sent");
  });

  test("failed email never marks activity as sent", async () => {
    const { triggerEvent, sendEmailMock, markActivityEmailSentMock } = await loadController();
    sendEmailMock.mockRejectedValue(new Error("SMTP down"));
    const res = createMockResponse();
    await triggerEvent(buildReq({ typeEvent: "Rezervare", subject: "Cerere", html: "<p>Lead</p>", browserVersion: "Chrome/120" }), res);
    expect(markActivityEmailSentMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test("phone reveal remains a contact notification", async () => {
    const { triggerEvent, sendEmailMock, logActivityMock } = await loadController();
    await triggerEvent(buildReq({ typeEvent: "📞 Telefon", url: "/contact", browserVersion: "Chrome/120" }), createMockResponse());
    expect(sendEmailMock).toHaveBeenCalledOnce();
    expect(logActivityMock).toHaveBeenCalledWith(expect.objectContaining({ type: "contact" }));
  });
});
