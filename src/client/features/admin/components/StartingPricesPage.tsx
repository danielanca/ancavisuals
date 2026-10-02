import React, { useEffect, useState } from "react";
import useAuth from "../auth/useAuth";
import Breadcrumb from "./Breadcrumb";
import {
  DEFAULT_STARTING_PRICES,
  normalizeStartingPrices,
  STARTING_PRICE_TYPES,
  type StartingPriceKey,
} from "../../../../shared/pricing/startingPrices";

type Draft = Record<StartingPriceKey, string>;

const toDraft = (prices: Record<StartingPriceKey, number>): Draft =>
  Object.fromEntries(STARTING_PRICE_TYPES.map(({ key }) => [key, String(prices[key])])) as Draft;

export default function StartingPricesPage() {
  const { auth } = useAuth();
  const [draft, setDraft] = useState<Draft>(toDraft(DEFAULT_STARTING_PRICES));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/starting-prices", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setDraft(toDraft(normalizeStartingPrices(d?.prices))))
      .catch(() => setMessage({ ok: false, text: "Nu s-au putut încărca prețurile — se afișează valorile implicite." }))
      .finally(() => setLoading(false));
  }, []);

  const invalid = STARTING_PRICE_TYPES.some(({ key }) => {
    const value = Number(draft[key]);
    return !Number.isInteger(value) || value <= 0 || value > 100_000;
  });

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const prices = Object.fromEntries(STARTING_PRICE_TYPES.map(({ key }) => [key, Number(draft[key])]));
      const res = await fetch("/api/admin/starting-prices", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({ prices }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Nu s-au putut salva prețurile.");
      setDraft(toDraft(normalizeStartingPrices(data.prices)));
      setMessage({ ok: true, text: "Salvat. Site-ul folosește noile prețuri în cel mult un minut." });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Nu s-au putut salva prețurile." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-xl mx-auto space-y-6">
        <Breadcrumb />

        <div>
          <h1 className="text-white text-2xl font-light tracking-tight">Prețuri de pornire</h1>
          <p className="text-neutral-500 text-sm mt-1">
            „Pachetele foto-video încep de la …” — apare după „Verifică disponibilitatea” pe landing-uri (/oferta/…) și pe /bio, și e folosit de chatbot.
          </p>
        </div>

        <div className="rounded-xl border border-neutral-800 divide-y divide-neutral-800">
          {STARTING_PRICE_TYPES.map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="text-neutral-200 text-sm">{label}</span>
              <span className="flex items-center gap-2">
                <span className="text-neutral-500 text-sm">de la</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  disabled={loading}
                  value={draft[key]}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                  className="w-28 bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm text-right tabular-nums"
                />
                <span className="text-neutral-500 text-sm">€</span>
              </span>
            </label>
          ))}
        </div>
        <p className="text-neutral-600 text-xs">Orice alt tip de eveniment (logodnă, aniversare…) folosește prețul de la „Alt eveniment”.</p>

        <div className="flex items-center gap-3">
          <button
            onClick={() => void save()}
            disabled={loading || saving || invalid}
            className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium disabled:opacity-40"
          >
            {saving ? "Se salvează…" : "Salvează"}
          </button>
          {invalid && <span className="text-amber-400 text-xs">Fiecare preț trebuie să fie un număr întreg pozitiv.</span>}
        </div>
        {message && <p className={`text-sm ${message.ok ? "text-green-400" : "text-red-400"}`}>{message.text}</p>}
      </div>
    </div>
  );
}
