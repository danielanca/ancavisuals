/*
 * Purpose: the referral CTA of the QR Moments guest page — the same block as at the end of the
 * "au vizualizat" email (`renderReferralCta` in server/notifications/qrViewEmailAd.ts): the couple
 * they recommend gets the photo booth free, the guest a photo session (terms: /terms#recomandare).
 */
import { useId } from "react";
import { sendLiveEvent } from "../../utils/liveEvent";
import { referralWhatsappUrl } from "../MediaDownload/WeddingCta";

export default function QrReferralCta() {
  const origin = typeof window === "undefined" ? "https://ancavisuals.ro" : window.location.origin;
  // A unique id, so the heading label stays valid wherever the block is placed.
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="mt-6 border border-neutral-700 bg-[#111111] px-5 py-6 text-left">
      <p className="text-[10px] uppercase tracking-[0.24em] text-neutral-400">Recomandă-ne</p>
      <h2 id={titleId} className="mt-2 text-xl font-semibold leading-snug text-white">Cunoști pe cineva care se căsătorește? 💍</h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-200">
        Trimite-le acest mesaj. Ei primesc <strong className="text-white">fotocabina gratuit</strong> la nunta lor.
      </p>
      <p className="mt-1 text-sm leading-relaxed text-neutral-200">
        Iar tu primești <strong className="text-white">o ședință foto gratuită</strong> 📸
      </p>
      <a
        href={referralWhatsappUrl(origin)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => sendLiveEvent("referral_clicked", { label: "QR Moments: recomandă-ne pe WhatsApp", meta: { source: "qr-moments" } })}
        className="mt-4 inline-block bg-white px-6 py-3 text-sm font-bold uppercase tracking-wide text-black no-underline hover:bg-neutral-200"
      >
        Trimite pe WhatsApp →
      </a>
      <p className="mt-3 text-[11px] text-neutral-400">
        Se aplică{" "}
        <a href="/terms#recomandare" className="text-white underline underline-offset-2">termeni și condiții</a>.
      </p>
    </section>
  );
}
