import React from "react";
import { PROMO_DEADLINE, type FreePhotoboothOffer } from "./freePhotoboothOffer";

const dateFormat = new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Bucharest" });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest" });

/** Calendar days in Romania between signing and now: "azi", "ieri", "acum 5 zile", "acum 20 de zile". */
export function signedAgo(signedAt: string, now: number): string {
  const days = Math.round((Date.parse(dayKey.format(now)) - Date.parse(dayKey.format(new Date(signedAt)))) / 86_400_000);
  if (days <= 0) return "azi";
  if (days === 1) return "ieri";
  // Romanian puts "de" before numbers whose last two digits are 0 or 20–99 (20 de zile, 101 zile).
  const n = days % 100;
  return `acum ${days}${n === 0 || n >= 20 ? " de" : ""} zile`;
}

export default function FreePhotoboothContracts({ offer, now = Date.now() }: { offer: FreePhotoboothOffer; now?: number }) {
  const { contracts, totalSlots, remaining, failed, retry } = offer;
  const closed = remaining !== null && (remaining === 0 || now >= PROMO_DEADLINE);

  return (
    <div className="mt-10 border-t border-neutral-200 pt-7 text-left" aria-live="polite">
      <h3 className="text-lg font-semibold">Cine a încheiat cu noi un contract în ultimele zile, cu fotocabina gratuită</h3>
      {remaining !== null && totalSlots !== null && (
        <p className="mt-2 text-sm leading-relaxed text-neutral-700">
          {closed
            ? "Oferta s-a încheiat. Fotocabina și videobooth-ul rămân disponibile în configurator, la prețul obișnuit."
            : <>
                <strong className="font-semibold text-neutral-950">Fotocabina sau videobooth-ul</strong> (doar una dintre ele, la alegere),{" "}
                <strong className="font-semibold text-neutral-950">cadou pentru {totalSlots} nunți</strong> rezervate până pe{" "}
                <strong className="font-semibold text-neutral-950">30 octombrie</strong>.{" "}
                <span className="whitespace-nowrap">Locuri rămase: <strong className="font-bold text-neutral-950">{remaining}</strong>.</span>{" "}
                Când se termină, oferta se închide.
              </>}
        </p>
      )}
      <p className="mt-2 text-xs leading-relaxed text-neutral-500">Contracte semnate · Nume afișate parțial pentru confidențialitate</p>
      {failed ? (
        <p className="mt-4 text-sm text-neutral-600">Lista nu este disponibilă momentan. <button type="button" className="underline underline-offset-4" onClick={retry}>Reîncearcă</button></p>
      ) : contracts === null ? (
        <p className="mt-4 text-sm text-neutral-500">Se încarcă rezervările…</p>
      ) : contracts.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-600">Încă nu sunt contracte semnate cu fotocabina gratuită de afișat.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {contracts.map((contract, index) => (
            // Every other row grey, so a long list doesn't read as one block of identical boxes.
            <li key={`${contract.signedAt}-${index}`} className={`border border-neutral-200 p-4 ${index % 2 ? "bg-neutral-100" : "bg-white"} text-sm leading-relaxed [overflow-wrap:anywhere]`}>
              <span className="font-semibold text-neutral-950">{contract.maskedName}</span>
              {contract.city && <> din <span className="font-semibold text-neutral-950">{contract.city}</span></>}
              {" a semnat contractul cu fotocabina gratuită în data de "}
              <time dateTime={contract.signedAt} className="font-semibold text-neutral-950">{dateFormat.format(new Date(contract.signedAt))}</time>
              {` (${signedAgo(contract.signedAt, now)}).`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
