/*
 * Purpose: verifies the public landing-page routes that feed the "verifică
 * disponibilitatea" / "lasă-ne numărul" flow — /contact, /contact-click,
 * /interaction, /geo-city — with Firestore, mailer, and Google Ads
 * conversion reporting mocked out. The quick "leave your phone" form only
 * ever collects a phone number (no name field), so /contact must accept
 * phone-only submissions instead of bouncing them with a generic error.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

type Handler = (req: any, res: any) => Promise<void> | void;

function createMockResponse() {
  const res: any = { status: vi.fn(), json: vi.fn(), send: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.send.mockReturnValue(res);
  return res;
}

async function loadRouter() {
  const sendEmail = vi.fn().mockResolvedValue(undefined);
  const reportLeadConversion = vi.fn().mockResolvedValue(undefined);
  const reportContactClickConversion = vi.fn().mockResolvedValue(undefined);
  const geolocateIp = vi.fn().mockResolvedValue({ countryCode: "RO", country: "România", city: "Cluj-Napoca" });

  const docGetMock = vi.fn().mockResolvedValue({ exists: true, data: () => ({ title: "Oferta Nunți" }) });
  const collectionMock = vi.fn(() => ({ doc: vi.fn(() => ({ get: docGetMock })) }));

  vi.doMock("src/server/firestore", () => ({ firestore: () => ({ collection: collectionMock }) }));
  vi.doMock("src/server/notifications/mailer.js", () => ({ sendEmail }));
  vi.doMock("src/server/notifications/mailer", () => ({ sendEmail }));
  vi.doMock("src/server/constants/credentials.js", () => ({ adminUser: { email: "admin@test.ro" } }));
  vi.doMock("src/server/constants/credentials", () => ({ adminUser: { email: "admin@test.ro" } }));
  vi.doMock("src/server/services/googleAdsConversion.service", () => ({
    reportLeadConversion,
    reportContactClickConversion,
  }));
  vi.doMock("src/server/utils/geolocateIp", () => ({ geolocateIp }));
  const logActivity = vi.fn().mockResolvedValue("activity-1");
  vi.doMock("src/server/services/activity.service", () => ({
    getNotificationSettings: vi.fn().mockResolvedValue({ email: { offerViewed: true } }),
    logActivity,
  }));
  vi.doMock("src/server/notifications/offerViewNotification", () => ({
    sendOfferViewNotification: vi.fn().mockResolvedValue(undefined),
  }));
  vi.doMock("src/server/middleware/requireFirebaseAuth", () => ({
    requireFirebaseAuth: (_req: any, _res: any, next: any) => next(),
    requireSupremeAdmin: (_req: any, _res: any, next: any) => next(),
  }));
  vi.doMock("src/server/constants/bunny", () => ({
    getBunnyStorageKey: () => "key",
    buildBunnyStorageUrl: (p: string) => `https://storage.test/${p}`,
    BUNNY_ACCESS_KEY_HEADER: "AccessKey",
  }));

  const mod = await import("src/server/routes/campaign.routes");
  const router = mod.default as any;

  const getHandler = (method: string, path: string): Handler => {
    const layer = router.stack.find((e: any) => e.route?.path === path && e.route.methods?.[method]);
    if (!layer) throw new Error(`Missing ${method.toUpperCase()} ${path}`);
    return layer.route.stack[layer.route.stack.length - 1].handle;
  };

  return {
    sendEmail,
    reportLeadConversion,
    reportContactClickConversion,
    geolocateIp,
    docGetMock,
    logActivity,
    postContact: getHandler("post", "/:slug/contact"),
    postContactClick: getHandler("post", "/:slug/contact-click"),
    postInteraction: getHandler("post", "/:slug/interaction"),
    getGeoCity: getHandler("get", "/geo-city"),
  };
}

describe("campaign.routes — public landing-page flow", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  describe("POST /:slug/contact", () => {
    test("accepts a phone-only submission from the quick 'lasă-ne numărul' form", async () => {
      const { postContact, sendEmail } = await loadRouter();
      const res = createMockResponse();

      await postContact(
        { params: { slug: "oferta-nunti" }, body: { name: "", phone: "+40745469907", eventDate: "2026-10-01" } },
        res,
      );

      expect(sendEmail).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test("omits the 'Nume' row from the email when no name was given", async () => {
      const { postContact, sendEmail } = await loadRouter();
      const res = createMockResponse();

      await postContact({ params: { slug: "oferta-nunti" }, body: { phone: "+40745469907" } }, res);

      const html = sendEmail.mock.calls[0][0].html as string;
      expect(html).not.toContain(">Nume<");
      expect(html).toContain("+40745469907");
    });

    test("accepts a full submission with name and phone", async () => {
      const { postContact, sendEmail } = await loadRouter();
      const res = createMockResponse();

      await postContact(
        { params: { slug: "oferta-nunti" }, body: { name: "Andrei Pop", phone: "+40745469907" } },
        res,
      );

      const html = sendEmail.mock.calls[0][0].html as string;
      expect(html).toContain("Andrei Pop");
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test("returns 400 when phone is missing", async () => {
      const { postContact, sendEmail } = await loadRouter();
      const res = createMockResponse();

      await postContact({ params: { slug: "oferta-nunti" }, body: { name: "Andrei Pop" } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(sendEmail).not.toHaveBeenCalled();
    });

    test("returns 400 when body is empty", async () => {
      const { postContact } = await loadRouter();
      const res = createMockResponse();

      await postContact({ params: { slug: "oferta-nunti" }, body: {} }, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("still emails the lead even when the campaign doc doesn't exist (falls back to slug as title)", async () => {
      const { postContact, sendEmail, docGetMock } = await loadRouter();
      docGetMock.mockResolvedValueOnce({ exists: false });
      const res = createMockResponse();

      await postContact({ params: { slug: "unknown-slug" }, body: { phone: "0712345678" } }, res);

      expect(sendEmail).toHaveBeenCalledOnce();
      expect(sendEmail.mock.calls[0][0].subject).toContain("unknown-slug");
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test("reports the lead conversion with gclid/wbraid/gbraid when present", async () => {
      const { postContact, reportLeadConversion } = await loadRouter();
      const res = createMockResponse();

      await postContact(
        { params: { slug: "oferta-nunti" }, body: { phone: "0712345678", gclid: "abc123" } },
        res,
      );

      expect(reportLeadConversion).toHaveBeenCalledWith(
        expect.objectContaining({ phone: "0712345678", gclid: "abc123" }),
      );
    });

    test("still returns ok:true to the user even if the Ads conversion report fails", async () => {
      const { postContact, reportLeadConversion, sendEmail } = await loadRouter();
      reportLeadConversion.mockRejectedValueOnce(new Error("ads down"));
      const res = createMockResponse();

      await postContact({ params: { slug: "oferta-nunti" }, body: { phone: "0712345678" } }, res);

      expect(sendEmail).toHaveBeenCalledOnce();
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test("still saves the lead and returns ok:true when sending the email fails (e.g. SMTP down)", async () => {
      const { postContact, sendEmail, logActivity } = await loadRouter();
      sendEmail.mockRejectedValueOnce(new Error("smtp down"));
      const res = createMockResponse();

      await postContact(
        { params: { slug: "oferta-nunti" }, body: { name: "Andrei Pop", phone: "0712345678" } },
        res,
      );

      expect(res.status).not.toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ ok: true });
      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "lead",
          title: expect.stringContaining("EMAIL EȘUAT"),
          emailSent: false,
          metadata: expect.objectContaining({ name: "Andrei Pop", phone: "0712345678" }),
        }),
      );
    });

    test("logs the lead with emailSent:true when the email actually goes out", async () => {
      const { postContact, logActivity } = await loadRouter();
      const res = createMockResponse();

      await postContact({ params: { slug: "oferta-nunti" }, body: { phone: "0712345678" } }, res);

      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({ type: "lead", emailSent: true }),
      );
    });

  });

  describe("POST /:slug/contact-click", () => {
    test("reports the conversion and responds 204", async () => {
      const { postContactClick, reportContactClickConversion } = await loadRouter();
      const res = createMockResponse();

      await postContactClick(
        { params: { slug: "oferta-nunti" }, body: { gclid: "abc123" } },
        res,
      );

      expect(reportContactClickConversion).toHaveBeenCalledWith(
        expect.objectContaining({ gclid: "abc123" }),
      );
      expect(res.status).toHaveBeenCalledWith(204);
    });

    test("never throws / never surfaces an error to the visitor when reporting fails", async () => {
      const { postContactClick, reportContactClickConversion } = await loadRouter();
      reportContactClickConversion.mockRejectedValueOnce(new Error("ads down"));
      const res = createMockResponse();

      expect(() => postContactClick({ params: { slug: "oferta-nunti" }, body: {} }, res)).not.toThrow();

      expect(res.status).toHaveBeenCalledWith(204);
    });
  });

  describe("POST /:slug/interaction", () => {
    test("always responds ok:true (no-op, never errors)", async () => {
      const { postInteraction } = await loadRouter();
      const res = createMockResponse();

      await postInteraction({ params: { slug: "oferta-nunti" }, body: { interaction: "form" } }, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });
  });

  describe("GET /geo-city", () => {
    test("returns the visitor's city when the IP resolves to Romania", async () => {
      const { getGeoCity } = await loadRouter();
      const res = createMockResponse();

      await getGeoCity({ headers: { "x-forwarded-for": "1.2.3.4" }, socket: {} }, res);

      expect(res.json).toHaveBeenCalledWith({ city: "Cluj-Napoca" });
    });

    test("returns city:null for non-Romanian visitors", async () => {
      const { getGeoCity, geolocateIp } = await loadRouter();
      geolocateIp.mockResolvedValueOnce({ countryCode: "DE", country: "Germany", city: "Berlin" });
      const res = createMockResponse();

      await getGeoCity({ headers: { "x-forwarded-for": "5.6.7.8" }, socket: {} }, res);

      expect(res.json).toHaveBeenCalledWith({ city: null });
    });
  });
});
