import React, { useCallback, useEffect, useState } from "react";
import useAuth from "../auth/useAuth";
import Breadcrumb from "./Breadcrumb";
import { CONTACT_METRICS, type ContactMetric, type ContactStats } from "../../../../shared/contactStats";
import { visitDay, type VisitSource } from "../../../../shared/liveVisits";

const METRIC_LABEL: Record<ContactMetric, string> = {
  whatsapp: "WhatsApp",
  phone_shown: "Afișează numărul",
  phone_call: "Apel (tap pe număr)",
  availability: "Verifică disponibilitatea",
};

const SOURCE_LABEL: Record<VisitSource, string> = {
  google_ads: "Google Ads",
  organic: "Organic (Google & altele)",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  ai: "AI / LLM",
  referral: "Referral",
  direct: "Direct / necunoscut",
};

const RANGES = [
  { key: "today", label: "Azi", days: 1 },
  { key: "7", label: "7 zile", days: 7 },
  { key: "30", label: "30 zile", days: 30 },
  { key: "90", label: "90 zile", days: 90 },
] as const;

const daysAgo = (n: number) => visitDay(Date.now() - n * 86_400_000);

type Response = ContactStats & { truncated?: boolean; error?: string };

function Cell({ clicks, visitors }: { clicks: number; visitors: number }) {
  if (!clicks) return <span className="text-neutral-700">—</span>;
  return (
    <span className="text-white">
      {visitors}
      {clicks !== visitors && <span className="text-neutral-500 text-xs"> ({clicks} click)</span>}
    </span>
  );
}

function CountsTable({ title, rows }: { title: string; rows: { key: string; label: string; extra?: string; counts: ContactStats["totals"] }[] }) {
  return (
    <section className="space-y-2">
      <h2 className="text-neutral-400 text-xs uppercase tracking-wider">{title}</h2>
      <div className="overflow-x-auto rounded-xl border border-neutral-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-neutral-500 text-xs text-left">
              <th className="px-3 py-2 font-normal" />
              {CONTACT_METRICS.map((m) => <th key={m} className="px-3 py-2 font-normal text-right whitespace-nowrap">{METRIC_LABEL[m]}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-neutral-800/70">
                <td className="px-3 py-2 text-neutral-300 whitespace-nowrap">
                  {row.label}
                  {row.extra && <span className="text-neutral-600 text-xs"> · {row.extra}</span>}
                </td>
                {CONTACT_METRICS.map((m) => (
                  <td key={m} className="px-3 py-2 text-right tabular-nums"><Cell {...row.counts[m]} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function ContactStatsPage() {
  const { auth } = useAuth();
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("30");
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!auth.accessToken) return;
    const days = RANGES.find((r) => r.key === range)?.days ?? 30;
    const params = new URLSearchParams({ from: daysAgo(days - 1), to: visitDay() });
    setLoading(true);
    setError(null);
    fetch(`/api/admin/analytics/live/contact-stats?${params}`, { headers: { Authorization: `Bearer ${auth.accessToken}` } })
      .then((r) => r.json())
      .then((d: Response) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("Nu s-au putut încărca statisticile."))
      .finally(() => setLoading(false));
  }, [auth.accessToken, range]);

  useEffect(load, [load]);

  const sources = data
    ? (Object.entries(data.bySource) as [VisitSource, NonNullable<ContactStats["bySource"][VisitSource]>][])
      .sort(([a], [b]) => (a === "google_ads" ? -1 : b === "google_ads" ? 1 : a.localeCompare(b)))
    : [];

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <Breadcrumb />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-white text-2xl font-light tracking-tight">Statistici contact</h1>
            <p className="text-neutral-500 text-sm mt-1">
              Câte persoane au apăsat pe WhatsApp, „Afișează numărul” și „Verifică” — din sesiunile urmărite în Vizitatori live.
            </p>
          </div>
          <div className="flex gap-2">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${range === r.key ? "bg-violet-600 text-white" : "bg-neutral-800 text-neutral-400 hover:text-white"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {loading && <p className="text-neutral-500 text-sm">Se încarcă…</p>}

        {!loading && data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {CONTACT_METRICS.map((m) => (
                <div key={m} className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
                  <p className="text-neutral-500 text-xs">{METRIC_LABEL[m]}</p>
                  <p className="text-white text-3xl font-light mt-1 tabular-nums">{data.totals[m].visitors}</p>
                  <p className="text-neutral-600 text-xs mt-1">
                    persoane · {data.totals[m].clicks} click-uri
                    {data.bySource.google_ads?.counts[m].visitors ? ` · ${data.bySource.google_ads.counts[m].visitors} din Ads` : ""}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-neutral-600 text-xs">
              {data.visitors} vizitatori unici în {data.sessions} sesiuni. Cifra mare = persoane distincte; în paranteză, totalul de click-uri când cineva a apăsat de mai multe ori.
              Sesiunile arhivate din Vizitatori live nu sunt incluse.
              {data.truncated && " Atenție: intervalul are prea multe sesiuni, rezultatul e parțial."}
            </p>

            <CountsTable
              title="Pe sursă de trafic"
              rows={sources.map(([key, v]) => ({ key, label: SOURCE_LABEL[key] ?? key, extra: `${v.visitors} vizitatori`, counts: v.counts }))}
            />
            {data.byDay.length > 0 && (
              <CountsTable
                title="Pe zile"
                rows={data.byDay.map((d) => ({
                  key: d.day,
                  label: new Date(`${d.day}T12:00:00Z`).toLocaleDateString("ro-RO", { weekday: "short", day: "2-digit", month: "short" }),
                  counts: d.counts,
                }))}
              />
            )}
            {data.byPage.length > 0 && (
              <CountsTable title="Pe pagină" rows={data.byPage.slice(0, 20).map((p) => ({ key: p.page, label: p.page, counts: p.counts }))} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
