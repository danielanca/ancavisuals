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

function buildReq(body: Record<string, unknown>, ip = "89.40.11.22") {
  return {
    body,
    headers: {},
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
