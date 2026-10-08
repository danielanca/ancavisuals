import React, { useMemo, useState } from "react";
import { normalizeTrafficSource, referralTraffic, type ReferralVisit } from "../../../../shared/referralTraffic";

export default function ReferralTrafficPanel({ visits, cutoff, periodLabel }: { visits: ReferralVisit[]; cutoff: Date; periodLabel: string }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const sources = useMemo(() => referralTraffic(visits, cutoff), [visits, cutoff]);
  const query = normalizeTrafficSource(search);
  const rows = sources.filter((row) => !query || row.source.includes(query));
  const detail = rows.find((row) => row.source === selected);

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 space-y-4" aria-label="Trafic după site-ul de proveniență">
      <div>
        <h2 className="text-base font-semibold text-white">Trafic după site-ul de proveniență</h2>
        <p className="mt-1 text-xs text-neutral-400">{periodLabel} · sursa UTM sau domeniul de proveniență al vizitei</p>
      </div>
      <div>
        <label htmlFor="traffic-source-search" className="mb-2 block text-xs text-neutral-300">Caută un site sau o sursă</label>
        <input id="traffic-source-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ex.: sibiunews sau sibiunews.net" className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-400" />
      </div>
      <div className="overflow-x-auto max-h-80">
        <table className="w-full text-left text-xs">
          <thead className="text-neutral-400"><tr><th className="py-2 pr-3">Site / sursă</th><th className="px-2 py-2">Vizitatori unici</th><th className="px-2 py-2">Vizite</th><th className="px-2 py-2">Pagini accesate</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.source} className="border-t border-neutral-800">
                <td className="py-3 pr-3"><button type="button" onClick={() => setSelected(row.source === selected ? null : row.source)} aria-expanded={row.source === selected} className="break-all text-amber-300 hover:underline">{row.source}</button></td>
                <td className="px-2 text-white">{row.visitors}</td><td className="px-2 text-neutral-300">{row.sessions}</td><td className="px-2 text-neutral-300">{row.pageViews}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="py-4 text-sm text-neutral-400">{query ? "Niciun trafic identificat pentru această sursă în perioada selectată." : "Nicio sursă externă identificată în perioada selectată."}</p>}
      </div>
      {detail && (
        <div className="border-t border-neutral-700 pt-4">
          <h3 className="mb-3 text-sm text-white">Pagini accesate din {detail.source}</h3>
          <ul className="max-h-60 overflow-y-auto space-y-2">
            {detail.pages.map(({ page, count }) => <li key={page} className="flex justify-between gap-4 text-xs"><span className="break-all font-mono text-neutral-300">{page}</span><span className="text-amber-300">{count}</span></li>)}
          </ul>
        </div>
      )}
      <p className="text-xs leading-relaxed text-neutral-500">Pe baza ultimelor {visits.length} accesări încărcate (maximum 2.000). Dacă site-ul sursă nu transmite proveniența, vizita poate apărea ca directă. Un link cu utm_source=sibiunews.net&amp;utm_medium=referral permite identificarea sursei și în acest caz.</p>
    </section>
  );
}
