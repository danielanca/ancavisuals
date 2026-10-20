import { describe, expect, it } from "vitest";
import {
  albumNotificationUrl,
  notificationSourceFromAttribution,
  parseNotificationSource,
} from "../../../src/shared/albumNotificationSource";

describe("albumNotificationUrl", () => {
  it("adds a short source param, keeping the query the link needs", () => {
    expect(albumNotificationUrl("https://ancavisuals.ro/", "08august2026", "sms", "nou")).toBe("https://ancavisuals.ro/media/08august2026?s=sms-nou");
    expect(albumNotificationUrl("https://ancavisuals.ro", "a b", "wa", "poze", { select: "print" })).toBe("https://ancavisuals.ro/media/a%20b?select=print&s=wa-poze");
  });

  it("stays short enough not to cost an extra SMS segment", () => {
    expect("?s=sms-nou".length).toBeLessThanOrEqual(10);
  });
});

describe("parseNotificationSource", () => {
  it("reads channel and kind", () => {
    expect(parseNotificationSource("sms-nou")).toEqual({ channel: "sms", kind: "nou", label: "SMS · noutate album" });
    expect(parseNotificationSource("WA-POZE")?.label).toBe("WhatsApp · reamintire alege pozele");
    expect(parseNotificationSource("email-expira")?.label).toBe("Email · album aproape de expirare");
  });

  it("rejects anything else, including prototype keys", () => {
    for (const value of [null, "", "sms", "fax-nou", "sms-xyz", "constructor-nou", "sms-toString", "sms-nou-extra"]) {
      expect(parseNotificationSource(value)).toBeNull();
    }
  });
});

describe("notificationSourceFromAttribution", () => {
  it("only trusts the notification medium", () => {
    expect(notificationSourceFromAttribution({ utmSource: "sms", utmMedium: "notificare", utmCampaign: "nou" })?.label).toBe("SMS · noutate album");
    expect(notificationSourceFromAttribution({ utmSource: "sms", utmMedium: "cpc", utmCampaign: "nou" })).toBeNull();
  });
});
