/*
 * Purpose: remembers what a visitor did on the site — the offer built in the price configurator
 * and the last date they checked — so the WhatsApp box at the end of the page (<ChatWithUs />)
 * can greet them about it ("Data de 12 iunie 2027 este liberă…") and add the offer to their
 * message on request. Kept in this browser only (localStorage, 30 days); nothing is sent until
 * they press send.
 */

const OFFER_KEY = "configurator-offer";
const DATE_KEY = "checked-date";
const CHANGE_EVENT = "av:visitor-plan";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** The configurator's choices: the full offer text plus what to mention in the greeting. */
export type ConfiguratorOffer = {
  text: string;
  /** The event as the configurator names it: "Nuntă", "Botez", "Majorat", "Corporate". */
  event: string;
  /** What they picked, e.g. ["Foto + Video", "Fotocabină / Oglindă foto"]. */
  picks: string[];
};

/** The last date checked anywhere on the site (landing, /contact, /bio). */
export type CheckedDate = { label: string; available: boolean; eventType?: string };

export type VisitorPlan = { offer: ConfiguratorOffer | null; checkedDate: CheckedDate | null };

function write(key: string, value: object): void {
  try {
    localStorage.setItem(key, JSON.stringify({ ...value, savedAt: Date.now() }));
  } catch { /* storage blocked — the box just keeps its default greeting */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function read<T>(key: string): T | null {
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? "null") as (T & { savedAt?: number }) | null;
    if (!stored || !stored.savedAt || Date.now() - stored.savedAt > MAX_AGE_MS) return null;
    return stored;
  } catch {
    return null;
  }
}

export const saveConfiguratorOffer = (offer: ConfiguratorOffer) => write(OFFER_KEY, offer);
export const saveCheckedDate = (date: CheckedDate) => write(DATE_KEY, date);

export function readVisitorPlan(): VisitorPlan {
  const offer = read<ConfiguratorOffer>(OFFER_KEY);
  const checkedDate = read<CheckedDate>(DATE_KEY);
  return {
    offer: offer?.text ? offer : null,
    checkedDate: checkedDate?.label ? checkedDate : null,
  };
}

/** Calls back now and whenever the plan changes (this tab or another one). */
export function subscribeToVisitorPlan(callback: (plan: VisitorPlan) => void): () => void {
  const update = () => callback(readVisitorPlan());
  update();
  const onStorage = (event: StorageEvent) => { if (event.key === OFFER_KEY || event.key === DATE_KEY) update(); };
  window.addEventListener(CHANGE_EVENT, update);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, update);
    window.removeEventListener("storage", onStorage);
  };
}

// *text* is bold, as in WhatsApp.
export const DEFAULT_GREETING = "*Salutare dragilor!* 👋 Haideți să vedem dacă vă putem ajuta cu evenimentul vostru 😊 *Ne puteți scrie mai jos* 👇";

const EVENT_PHRASE: Record<string, string> = {
  "nuntă": "nunta voastră",
  "botez": "botezul vostru",
  "majorat": "majoratul",
};

const eventPhrase = (event?: string) => EVENT_PHRASE[(event ?? "").toLocaleLowerCase("ro-RO")] ?? "evenimentul vostru";

/** "foto + video", "foto + video și fotocabină / oglindă foto", "a, b și c". */
function listPicks(picks: string[]): string {
  const items = picks.map((pick) => pick.toLocaleLowerCase("ro-RO"));
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} și ${items[items.length - 1]}`;
}

/** Our first WhatsApp message, about what the visitor already did on the site. */
export function greetingFor({ offer, checkedDate }: VisitorPlan): string {
  const picks = offer?.picks.length ? ` Am văzut că vă interesează ${listPicks(offer.picks)}.` : "";
  if (checkedDate?.available) {
    const about = eventPhrase(offer?.event ?? checkedDate.eventType);
    return `*Salutare dragilor!* 👋 Data de ${checkedDate.label} este liberă și vă putem ajuta cu ${about} 😊${picks} Ce informații vă mai putem da? *Ne puteți scrie mai jos* 👇`;
  }
  if (offer && picks) {
    return `*Salutare dragilor!* 👋${picks} Haideți să vedem dacă vă putem ajuta cu ${eventPhrase(offer.event)} 😊 *Ne puteți scrie mai jos* 👇`;
  }
  return DEFAULT_GREETING;
}
