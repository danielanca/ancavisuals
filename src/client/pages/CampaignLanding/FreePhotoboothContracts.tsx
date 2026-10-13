import React, { useEffect, useState } from "react";

interface Reservation { maskedName: string; city: string; signedAt: string }
const dateFormat = new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Bucharest" });

export default function FreePhotoboothContracts() {
  const [contracts, setContracts] = useState<Reservation[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    fetch("/api/campaign/olx/free-photobooth-contracts", { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error("Unavailable");
        return response.json();
      })
      .then(data => {
        if (!Array.isArray(data.contracts) || !data.contracts.every((item: Reservation) =>
          item && typeof item.maskedName === "string" && typeof item.city === "string" &&
          typeof item.signedAt === "string" && Number.isFinite(new Date(item.signedAt).getTime()))) {
          throw new Error("Invalid reservations");
        }
        if (!controller.signal.aborted) setContracts(data.contracts);
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [attempt]);

  return (
    <div className="mt-10 border-t border-neutral-200 pt-7 text-left" aria-live="polite">
      <h3 className="text-lg font-semibold">Cine a rezervat fotocabina gratuită</h3>
      <p className="mt-2 text-xs leading-relaxed text-neutral-500">Contracte semnate · Nume afișate parțial pentru confidențialitate</p>
      {failed ? (
        <p className="mt-4 text-sm text-neutral-600">Lista nu este disponibilă momentan. <button type="button" className="underline underline-offset-4" onClick={() => setAttempt(value => value + 1)}>Reîncearcă</button></p>
      ) : contracts === null ? (
        <p className="mt-4 text-sm text-neutral-500">Se încarcă rezervările…</p>
      ) : contracts.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-600">Încă nu sunt contracte semnate cu fotocabina gratuită de afișat.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {contracts.map((contract, index) => (
            <li key={`${contract.signedAt}-${index}`} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm leading-relaxed [overflow-wrap:anywhere]">
              <span className="font-semibold text-neutral-950">{contract.maskedName}</span>
              {contract.city && <> din <span className="font-medium">{contract.city}</span></>}
              {" a semnat contractul cu fotocabina gratuită în data de "}
              <time dateTime={contract.signedAt} className="font-medium">{dateFormat.format(new Date(contract.signedAt))}</time>.
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
