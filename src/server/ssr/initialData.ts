import { getPublicCampaignCached } from "../routes/campaign.routes";
import { getPublicOfferCached } from "../routes/oferte.routes";
import type { InitialData } from "../../client/ssr/initialData";

// Pages that render on the server with their data — the ad landing (/oferta/olx)
// must show its hero in the first HTML, not after JS + two API calls.
const OFFER_PATH = /^\/(?:oferta|p)\/([^/]+)\/?$/;
// Has its own static page (FuneralOfferPage).
const STATIC_OFFER_SLUGS = new Set(["inmormantari"]);
const MAX_WAIT_MS = 2500;

async function load(slug: string): Promise<InitialData | null> {
  const campaign = await getPublicCampaignCached(slug);
  if (campaign) return { slug, campaign };
  const offer = await getPublicOfferCached(slug);
  return offer ? { slug, offer } : null;
}

/** Data for the page at `path`, or null (the page then loads it in the browser as before). Never throws. */
export async function loadInitialData(path: string): Promise<InitialData | null> {
  const slug = OFFER_PATH.exec(path)?.[1];
  if (!slug || STATIC_OFFER_SLUGS.has(slug)) return null;
  try {
    return await Promise.race([
      load(decodeURIComponent(slug)),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), MAX_WAIT_MS)),
    ]);
  } catch (error) {
    console.error("[ssr] initial data failed:", error);
    return null;
  }
}

/** `<script>` that hands the data to the browser — `<` escaped so the JSON can't close the tag. */
export function initialDataScript(data: InitialData | null): string {
  if (!data) return "";
  const json = JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  return `<script>window.__INITIAL_DATA__=${json}</script>`;
}
