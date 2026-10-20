/*
 * Purpose: link preview for /propune/<token> (the "Link unic de selecție poze" sent on WhatsApp).
 * WhatsApp & co. read the Open Graph tags from the server HTML, so the site-wide tags are swapped
 * for an invitation: "Salomeea, ai fost invitată să alegi pozele pentru Instagram și site" + the
 * event date from the album slug. Private link → noindex. The site's own og:image stays.
 */
import { firestore } from "../firestore";
import { APP_BASE_URL } from "../constants/domain";
import { eventDateFromSlug } from "../../shared/albumUpdates";
import { setMeta } from "./shareOg";

const PROPOSAL_PATH = /^\/propune\/([A-Za-z0-9_-]{16,64})\/?$/;

export const proposalTokenFromPath = (path: string): string | null => PROPOSAL_PATH.exec(path)?.[1] ?? null;

export function applyProposalOg(html: string, token: string, link: { label?: string; albumSlug?: string } | null): string {
  const name = (link?.label ?? "").trim();
  const date = link?.albumSlug ? eventDateFromSlug(link.albumSlug) : null;
  const title = `${name ? `${name}, ai` : "Ai"} fost invitată să alegi pozele pentru Instagram și site`;
  const description = `${date ? `Din albumul evenimentului din ${date}` : "Din albumul evenimentului"} · Anca Visuals. Deschide linkul, scrie-ți numele și alege pozele preferate.`;
  const url = `${APP_BASE_URL.replace(/\/+$/, "")}/propune/${token}`;
  let out = html;
  out = setMeta(out, "property", "og:title", title);
  out = setMeta(out, "property", "og:description", description);
  out = setMeta(out, "property", "og:url", url);
  out = setMeta(out, "name", "description", description);
  out = setMeta(out, "name", "robots", "noindex,nofollow");
  out = out.replace(/<title>[^<]*<\/title>/i, `<title>${title.replace(/</g, "&lt;")}</title>`);
  return out;
}

/** An unknown / deactivated link still gets the invitation wording (without a name) and noindex. */
export async function proposalOgFor(html: string, path: string): Promise<string> {
  const token = proposalTokenFromPath(path);
  if (!token) return html;
  try {
    const snap = await firestore().collection("proposalLinks").doc(token).get();
    const link = snap.exists ? (snap.data() as { label?: string; albumSlug?: string; active?: boolean }) : null;
    return applyProposalOg(html, token, link && link.active !== false ? link : null);
  } catch {
    return applyProposalOg(html, token, null);
  }
}
