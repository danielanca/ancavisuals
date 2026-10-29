/*
 * Purpose: on a shared photo link, the guests looking at the photos are the next clients. Under
 * the photos we ask two direct questions — "are you getting married?" (→ check the date / offer)
 * and "do you know someone who is?" (→ a ready-written WhatsApp recommendation they forward).
 * Clicks go to the live-visitors panel; the date check counts as contact intent.
 */
import { sendLiveEvent } from "../../utils/liveEvent";

export const OFFER_PATH = "/oferta?utm_source=share&utm_medium=guest#verifica-data";

export function referralWhatsappUrl(origin: string): string {
  const text = `Bună! Vă recomand AncaVisuals dacă doriți fotograf și videograf la nuntă. Acum au fotocabina toată ziua la 200 € în loc de 450 €, iar QR code-ul e inclus: ${origin}/oferta?utm_source=recomandare`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export default function WeddingCta() {
  const origin = typeof window === "undefined" ? "https://ancavisuals.ro" : window.location.origin;
  return (
    <section aria-labelledby="wedding-cta-title" className="mt-10 border border-neutral-800 bg-[#0a0a0a] p-4 sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Pozele sunt făcute de AncaVisuals</p>
      <h2 id="wedding-cta-title" className="mt-1 text-xl font-bold text-white sm:text-2xl">Urmează o nuntă?</h2>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col border border-neutral-700 bg-black p-4">
          <p className="text-base font-bold text-white">💍 Urmează să fii mire sau mireasă?</p>
          <p className="mt-1 flex-1 text-sm leading-snug text-neutral-400">
            Vezi pe loc dacă data voastră e liberă și ce ofertă avem pentru voi.
          </p>
          <a
            href={OFFER_PATH}
            onClick={() => sendLiveEvent("contact_clicked", { label: "Link share: mire/mireasă → verifică data", meta: { source: "share-page" } })}
            className="mt-3 block bg-white px-4 py-3 text-center text-sm font-bold uppercase tracking-wide text-black no-underline hover:bg-neutral-200"
          >
            Verifică data →
          </a>
        </div>

        <div className="flex flex-col border border-[#166534] bg-[#06150c] p-4">
          <p className="text-base font-bold text-[#4ade80]">👫 Cunoști pe cineva care se căsătorește?</p>
          <p className="mt-1 flex-1 text-sm leading-snug text-[#bbf7d0]">
            Recomandă-ne cu un singur mesaj: îl scriem noi, tu doar alegi cui îl trimiți pe WhatsApp.
          </p>
          <a
            href={referralWhatsappUrl(origin)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => sendLiveEvent("referral_clicked", { label: "Link share: recomandă-ne pe WhatsApp", meta: { source: "share-page" } })}
            className="mt-3 block bg-[#22c55e] px-4 py-3 text-center text-sm font-bold uppercase tracking-wide text-white no-underline hover:bg-[#16a34a]"
          >
            Recomandă-ne pe WhatsApp →
          </a>
          <p className="mt-3 border border-dashed border-[#22c55e] px-3 py-2 text-center text-sm font-semibold text-[#4ade80]">
            🎁 Acum: fotocabina toată ziua la 200 € în loc de 450 €, plus QR code inclus.
          </p>
        </div>
      </div>
    </section>
  );
}
