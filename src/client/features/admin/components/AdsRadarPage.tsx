import React, { useEffect, useState } from "react";
import useAuth from "../auth/useAuth";

interface KeywordSuggestion {
  keyword: string;
  volume: number | null;
  trendScore: number | null;
  rising: boolean;
}
interface VolumeRow {
  keyword: string;
  volume: number | null;
  cpc: number | null;
  competition: string | null;
  competitionIndex: number | null;
  lowBid: number | null;
  highBid: number | null;
}
interface DataForSeoStats {
  balance: number;
}

const competitionLabel: Record<string, string> = { LOW: "Scăzută", MEDIUM: "Medie", HIGH: "Ridicată" };

const AdsRadarPage: React.FC = () => {
  const { auth } = useAuth();
  const [seedsInput, setSeedsInput] = useState("");
  const [city, setCity] = useState("");
  const [suggestions, setSuggestions] = useState<KeywordSuggestion[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [volumeRows, setVolumeRows] = useState<VolumeRow[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [checkingVolume, setCheckingVolume] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<DataForSeoStats | null>(null);

  useEffect(() => {
    if (!auth.accessToken) return;
    fetch("/api/admin/seo-radar/stats?provider=dataforseo", { headers: { Authorization: `Bearer ${auth.accessToken}` } })
      .then(async response => {
        const data = await response.json();
        if (response.ok) setStats(data);
      })
      .catch(() => {});
  }, [auth.accessToken]);

  const generateSuggestions = async () => {
    const seeds = seedsInput.split(",").map(part => part.trim()).filter(Boolean).slice(0, 5);
    if (!seeds.length) {
      setError("Adaugă cel puțin un termen de pornire (ex: fotograf nuntă, videograf evenimente).");
      return;
    }
    setSuggesting(true);
    setError("");
    setVolumeRows([]);
    try {
      const response = await fetch("/api/admin/ads-radar/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({ seeds, city: city.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Generarea sugestiilor a eșuat.");
      setSuggestions(data.suggestions);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generarea sugestiilor a eșuat.");
    } finally {
      setSuggesting(false);
    }
  };

  const toggleSelected = (keyword: string) => {
    setSelected(current => {
      const next = new Set(current);
      if (next.has(keyword)) next.delete(keyword);
      else next.add(keyword);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected(current => (current.size === suggestions.length ? new Set() : new Set(suggestions.map(item => item.keyword))));
  };

  const checkVolume = async () => {
    if (!selected.size) {
      setError("Selectează cel puțin un keyword pentru verificare.");
      return;
    }
    setCheckingVolume(true);
    setError("");
    try {
      const response = await fetch("/api/admin/ads-radar/volume", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({ keywords: Array.from(selected) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Verificarea volumului a eșuat.");
      const sorted = [...data.results].sort((a: VolumeRow, b: VolumeRow) => (b.volume ?? -1) - (a.volume ?? -1));
      setVolumeRows(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verificarea volumului a eșuat.");
    } finally {
      setCheckingVolume(false);
    }
  };

  return (
    <div className="min-h-screen bg-black px-6 py-10 text-white md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-6 border-b border-white/10 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-amber-200/70">AncaVisuals · Ads Radar</p>
            <h1 className="mt-4 text-4xl font-light md:text-6xl">Descoperă keyword-uri pentru Ads</h1>
            <p className="mt-3 max-w-2xl text-sm text-gray-400">
              Pornește de la câțiva termeni, primește variante reale căutate pe Google, apoi verifică volumul de căutări
              (date Google Ads) pentru cele pe care vrei să le folosești în campanii.
            </p>
          </div>
          {stats && (
            <div className="min-w-[240px] rounded-2xl border border-amber-200/20 bg-amber-200/10 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-200/70">Sold DataForSEO</p>
              <strong className="mt-2 block text-3xl font-light">${stats.balance.toFixed(2)}</strong>
            </div>
          )}
        </div>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-200/70">Pasul 1 · Sugestii de keyword-uri</p>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <label className="text-sm text-gray-300">
              Termeni de bază (separați prin virgulă)
              <input
                value={seedsInput}
                onChange={event => setSeedsInput(event.target.value)}
                placeholder="fotograf nuntă, videograf evenimente, fotocabină"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white"
              />
            </label>
            <label className="text-sm text-gray-300">
              Oraș (opțional)
              <input
                value={city}
                onChange={event => setCity(event.target.value)}
                placeholder="Cluj-Napoca"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white"
              />
            </label>
            <button
              onClick={generateSuggestions}
              disabled={suggesting}
              className="self-end rounded-xl bg-white px-6 py-3 font-medium text-black disabled:opacity-50"
            >
              {suggesting ? "Caut…" : "Generează sugestii"}
            </button>
          </div>
        </section>

        {error && <p className="mt-5 text-red-300">{error}</p>}

        {suggestions.length > 0 && (
          <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-200/70">
                Pasul 2 · Alege keyword-urile ({selected.size}/{suggestions.length} selectate)
              </p>
              <div className="flex items-center gap-3">
                <button onClick={toggleSelectAll} className="text-xs text-gray-400 underline underline-offset-4">
                  {selected.size === suggestions.length ? "Deselectează tot" : "Selectează tot"}
                </button>
                <button
                  onClick={checkVolume}
                  disabled={checkingVolume || !selected.size}
                  className="rounded-xl bg-amber-200 px-5 py-2 text-sm font-medium text-black disabled:opacity-50"
                >
                  {checkingVolume ? "Verific…" : "Verifică volumul Google Ads"}
                </button>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-gray-500">
                  <tr>
                    <th className="w-10 px-3 py-3" />
                    <th className="px-3 py-3">Keyword</th>
                    <th className="px-3 py-3">Volum estimat (Labs)</th>
                    <th className="px-3 py-3">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {suggestions.map(item => (
                    <tr key={item.keyword} className="hover:bg-white/5">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(item.keyword)}
                          onChange={() => toggleSelected(item.keyword)}
                          className="h-4 w-4"
                        />
                      </td>
                      <td className="px-3 py-3">{item.keyword}</td>
                      <td className="px-3 py-3">{item.volume !== null ? item.volume.toLocaleString("ro-RO") : "—"}</td>
                      <td className="px-3 py-3">
                        {item.rising && <span className="rounded-full bg-emerald-400/20 px-2 py-1 text-xs text-emerald-300">în creștere</span>}
                        {!item.rising && item.trendScore !== null && <span className="text-xs text-gray-500">{item.trendScore}</span>}
                        {!item.rising && item.trendScore === null && "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {volumeRows.length > 0 && (
          <section className="mt-8 rounded-3xl border border-amber-200/20 bg-amber-200/10 p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-amber-200/70">Pasul 3 · Date Google Ads</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-amber-200/60">
                  <tr>
                    <th className="px-3 py-3">Keyword</th>
                    <th className="px-3 py-3">Volum lunar</th>
                    <th className="px-3 py-3">CPC mediu</th>
                    <th className="px-3 py-3">Competiție</th>
                    <th className="px-3 py-3">Interval bid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-200/10">
                  {volumeRows.map(row => (
                    <tr key={row.keyword}>
                      <td className="px-3 py-3">{row.keyword}</td>
                      <td className="px-3 py-3">{row.volume !== null ? row.volume.toLocaleString("ro-RO") : "—"}</td>
                      <td className="px-3 py-3">{row.cpc !== null ? `${row.cpc.toFixed(2)} RON` : "—"}</td>
                      <td className="px-3 py-3">
                        {row.competition ? competitionLabel[row.competition] ?? row.competition : "—"}
                        {row.competitionIndex !== null ? ` (${row.competitionIndex})` : ""}
                      </td>
                      <td className="px-3 py-3">
                        {row.lowBid !== null && row.highBid !== null
                          ? `${row.lowBid.toFixed(2)} – ${row.highBid.toFixed(2)} RON`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default AdsRadarPage;
