/*
 * Purpose: under the photo gallery of the QR Moments guest page — the guest who is getting married
 * next goes straight to the price configurator on /oferta (same question as WeddingCta on /share).
 */
import { sendLiveEvent } from "../../utils/liveEvent";

export const QR_BRIDE_OFFER_PATH = "/oferta?utm_source=qr-moments&utm_medium=guest#configurator";

export default function QrBrideCta() {
  return (
    <section aria-labelledby="qr-bride-title" className="border border-neutral-950 bg-white px-5 py-6 text-left">
      <p className="text-[10px] uppercase tracking-[0.24em] text-neutral-500">Pentru viitorii miri</p>
      <h2 id="qr-bride-title" className="mt-2 text-xl font-semibold leading-snug text-neutral-950">Urmează să fii mire sau mireasă? 💍</h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600">
        Alege ce vrei pentru nunta voastră și vezi pe loc prețul și dacă data e liberă.
      </p>
      <a
        href={QR_BRIDE_OFFER_PATH}
        onClick={() => sendLiveEvent("contact_clicked", { label: "QR Moments: mire/mireasă → configurator", meta: { source: "qr-moments" } })}
        className="mt-4 inline-block bg-neutral-950 px-6 py-3 text-sm font-bold uppercase tracking-wide text-white no-underline hover:bg-neutral-800"
      >
        Calculează-ți oferta →
      </a>
    </section>
  );
}
