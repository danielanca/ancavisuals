import React, { useEffect, useState } from "react";
import useAuth from "../auth/useAuth";
import Breadcrumb from "./Breadcrumb";

interface FirmSettings {
  ownerName: string;
  cif: string;
  address: string;
  city: string;
  county: string;
  postalCode: string;
  iban: string;
  bank: string;
  invoiceSeries: string;
}

const EMPTY: FirmSettings = {
  ownerName: "",
  cif: "",
  address: "",
  city: "",
  county: "",
  postalCode: "",
  iban: "",
  bank: "",
  invoiceSeries: "",
};

const inputClass =
  "w-full bg-neutral-950 text-white text-sm placeholder-neutral-600 border border-neutral-800 rounded-lg px-3 py-2 outline-none focus:border-neutral-500 transition-colors";

const labelClass = "block text-neutral-400 text-xs font-medium mb-1 uppercase tracking-wide";

const FIELDS: { key: keyof FirmSettings; label: string; placeholder: string; hint?: string }[] = [
  { key: "ownerName", label: "Nume firmă / PFA", placeholder: "ANCA DANIEL EMANUEL PFA" },
  { key: "cif", label: "CIF / CUI", placeholder: "RO12345678" },
  { key: "address", label: "Stradă și număr", placeholder: "Str. Exemplu, Nr. 1" },
  { key: "city", label: "Oraș", placeholder: "Cluj-Napoca" },
  { key: "county", label: "Județ", placeholder: "Cluj" },
  { key: "postalCode", label: "Cod poștal", placeholder: "400001" },
  { key: "iban", label: "IBAN", placeholder: "RO49 BTRL 0000 0000 0000 0000", hint: "Se afișează pe facturi și contracte" },
  { key: "bank", label: "Bancă", placeholder: "Banca Transilvania" },
  { key: "invoiceSeries", label: "Serie factură", placeholder: "ADE", hint: "Prefixul seriei (ex: ADE → ADE-0001)" },
];

export default function AdminSettingsPage() {
  const { auth } = useAuth();
  const [form, setForm] = useState<FirmSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.accessToken) return;
    fetch("/api/admin/invoices/fiscal-settings", {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setForm({ ...EMPTY, ...data });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [auth.accessToken]);

  const handleChange = (key: keyof FirmSettings) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    setSaved(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/invoices/fiscal-settings", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error("Eroare server.");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare necunoscută.");
    } finally {
      setSaving(false);
    }
  };

  const isMissing = !form.ownerName || !form.cif || !form.iban;

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6 max-w-2xl mx-auto">
      <Breadcrumb />

      <div className="mt-6 mb-8">
        <h1 className="text-2xl font-bold text-white">Setări firmă</h1>
        <p className="text-neutral-400 text-sm mt-1">
          Aceste date apar pe toate facturile și contractele generate.
        </p>
      </div>

      {isMissing && !loading && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-sm">
          ⚠️ Datele firmei sunt incomplete. Facturile generate nu vor conține detaliile emitentului până când completezi câmpurile obligatorii (Nume, CIF, IBAN).
        </div>
      )}

      {loading ? (
        <div className="text-neutral-500 text-sm py-12 text-center">Se încarcă...</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-white font-semibold text-sm uppercase tracking-wide text-neutral-400 mb-2">Date firmă</h2>
            {FIELDS.slice(0, 2).map(({ key, label, placeholder, hint }) => (
              <div key={key}>
                <label className={labelClass}>{label}</label>
                <input
                  className={inputClass}
                  value={form[key]}
                  onChange={handleChange(key)}
                  placeholder={placeholder}
                />
                {hint && <p className="text-neutral-600 text-[11px] mt-1">{hint}</p>}
              </div>
            ))}
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-neutral-400 font-semibold text-sm uppercase tracking-wide mb-2">Adresă sediu</h2>
            {FIELDS.slice(2, 6).map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className={labelClass}>{label}</label>
                <input
                  className={inputClass}
                  value={form[key]}
                  onChange={handleChange(key)}
                  placeholder={placeholder}
                />
              </div>
            ))}
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-neutral-400 font-semibold text-sm uppercase tracking-wide mb-2">Date bancare & facturare</h2>
            {FIELDS.slice(6).map(({ key, label, placeholder, hint }) => (
              <div key={key}>
                <label className={labelClass}>{label}</label>
                <input
                  className={inputClass}
                  value={form[key]}
                  onChange={handleChange(key)}
                  placeholder={placeholder}
                />
                {hint && <p className="text-neutral-600 text-[11px] mt-1">{hint}</p>}
              </div>
            ))}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-neutral-200 transition-colors disabled:opacity-50"
          >
            {saving ? "Se salvează..." : "Salvează setările"}
          </button>

          {saved && (
            <p className="text-center text-emerald-400 text-sm">✓ Salvat cu succes</p>
          )}
        </form>
      )}
    </div>
  );
}
