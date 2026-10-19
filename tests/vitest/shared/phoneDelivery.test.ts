import { expect, test } from "vitest";
import { parsePhoneDelivery, phoneChannelsFor, phoneDeliveryFromChoice } from "src/shared/albumUpdates";

test("admin choice overrides the phone channel only for subscribers who left a phone channel", () => {
  expect(phoneChannelsFor(["sms"], "subscriber")).toEqual(["sms"]);
  expect(phoneChannelsFor(["sms"], "whatsapp")).toEqual(["whatsapp"]);
  expect(phoneChannelsFor(["whatsapp", "email"], "sms")).toEqual(["sms"]);
  expect(phoneChannelsFor(["whatsapp"], "both")).toEqual(["whatsapp", "sms"]);
  // Email-only subscribers never get SMS/WhatsApp, whatever the admin picks.
  expect(phoneChannelsFor(["email"], "both")).toEqual([]);
});

test("unknown delivery falls back to each subscriber's own choice", () => {
  expect(parsePhoneDelivery("sms")).toBe("sms");
  expect(parsePhoneDelivery("fax")).toBe("subscriber");
  expect(parsePhoneDelivery(undefined)).toBe("subscriber");
});

test("ticked SMS / WhatsApp boxes map to the delivery; none ticked sends nothing by phone", () => {
  expect(phoneDeliveryFromChoice(true, true)).toBe("both");
  expect(phoneDeliveryFromChoice(true, false)).toBe("sms");
  expect(phoneDeliveryFromChoice(false, true)).toBe("whatsapp");
  expect(phoneDeliveryFromChoice(false, false)).toBe("none");
  expect(phoneChannelsFor(["sms", "whatsapp"], "none")).toEqual([]);
});
