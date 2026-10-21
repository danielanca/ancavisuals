import { afterEach, expect, test } from "vitest";
import {
  DEFAULT_GREETING,
  greetingFor,
  readVisitorPlan,
  saveCheckedDate,
  saveConfiguratorOffer,
  subscribeToVisitorPlan,
} from "src/client/features/chat/configuratorOffer";

afterEach(() => localStorage.clear());

const offer = { text: "Oferta configurată pe site: nuntă\n• Foto + Video — 1.100 €", event: "Nuntă", picks: ["Foto + Video", "Fotocabină / Oglindă foto"] };

test("without anything done on the site, the default greeting (bold like WhatsApp)", () => {
  expect(greetingFor(readVisitorPlan())).toBe(DEFAULT_GREETING);
  expect(DEFAULT_GREETING).toContain("*Salutare dragilor!*");
  expect(DEFAULT_GREETING).toContain("*Ne puteți scrie mai jos*");
});

test("a free date checked: says the date is free, for their event, with what they picked", () => {
  saveConfiguratorOffer(offer);
  saveCheckedDate({ label: "12 iunie 2027", available: true, eventType: "Nuntă" });
  expect(greetingFor(readVisitorPlan())).toBe(
    "*Salutare dragilor!* 👋 Data de 12 iunie 2027 este liberă și vă putem ajuta cu nunta voastră 😊 Am văzut că vă interesează foto + video și fotocabină / oglindă foto. Ce informații vă mai putem da? *Ne puteți scrie mai jos* 👇",
  );
});

test("a free date without the configurator uses the checked event type", () => {
  saveCheckedDate({ label: "3 mai 2027", available: true, eventType: "Botez" });
  expect(greetingFor(readVisitorPlan())).toContain("Data de 3 mai 2027 este liberă și vă putem ajuta cu botezul vostru");
});

test("a taken date is not announced; the picks still are", () => {
  saveConfiguratorOffer(offer);
  saveCheckedDate({ label: "12 iunie 2027", available: false });
  const greeting = greetingFor(readVisitorPlan());
  expect(greeting).not.toContain("liberă");
  expect(greeting).toContain("Am văzut că vă interesează foto + video și fotocabină / oglindă foto.");
});

test("old plans (over 30 days) are forgotten", () => {
  localStorage.setItem("checked-date", JSON.stringify({ label: "1 mai 2026", available: true, savedAt: Date.now() - 31 * 86_400_000 }));
  expect(readVisitorPlan().checkedDate).toBeNull();
});

test("subscribers hear about a new offer right away", () => {
  const seen: (string | undefined)[] = [];
  const stop = subscribeToVisitorPlan((plan) => seen.push(plan.offer?.text));
  saveConfiguratorOffer(offer);
  stop();
  expect(seen).toEqual([undefined, offer.text]);
});
