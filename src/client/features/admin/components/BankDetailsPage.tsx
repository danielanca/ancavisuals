import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AdminSettings } from "../types";
import AncaLoader from "../../../components/UI/AncaLoader";
import Breadcrumb from "./Breadcrumb";

const DEFAULT_SETTINGS: AdminSettings = {
  goals: {
    sixMonths: { targetRevenue: 15000, startDate: "2026-04-01", endDate: "2026-09-30" },
    oneYear: { targetRevenue: 30000, startDate: "2026-01-01", endDate: "2026-12-31" },
  },
  currency: "EUR",
  exchangeRate: 5.0,
  bankDetails: {
    beneficiaryName: "",
    iban: "",
  },
};

function normalizeSettings(settingsData: Partial<AdminSettings>): AdminSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...settingsData,
    goals: {
      ...DEFAULT_SETTINGS.goals,
      ...settingsData.goals,
    },
    bankDetails: {
      ...DEFAULT_SETTINGS.bankDetails,
      ...settingsData.bankDetails,
    },
  };
}

const inputClass =
  "w-full bg-neutral-950 text-white text-sm placeholder-neutral-600 border border-neutral-800 rounded-lg px-3 py-2 outline-none focus:border-neutral-500 transition-colors";

const BankDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [form, setForm] = useState(DEFAULT_SETTINGS.bankDetails);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        const normalized = normalizeSettings(data);
        setSettings(normalized);
        setForm(normalized.bankDetails);
      })
      .catch((e: Error) => setPageError(e.message))
      .finally(() => setPageLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    const updated: AdminSettings = {
      ...settings,
      bankDetails: {
        beneficiaryName: form.beneficiaryName.trim(),
        iban: form.iban.trim().toUpperCase(),
      },
    };
    setSettings(updated);
    try {
      await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  if (pageLoading) return <AncaLoader />;

  if (pageError) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
        <p className="text-red-400 text-sm">Eroare: {pageError}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <Breadcrumb />

          <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Setări admin</p>
          <h1 className="text-white text-2xl font-light">Detalii bancare</h1>
          <p className="text-neutral-400 text-sm mt-1">
            Folosite în contracte când metoda de plată este transfer bancar.
          </p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-neutral-400 text-xs font-medium mb-1 uppercase tracking-wide">
                Nume beneficiar
              </label>
              <input
                className={inputClass}
                value={form.beneficiaryName}
                onChange={(e) => setForm((prev) => ({ ...prev, beneficiaryName: e.target.value }))}
                placeholder="Ex: ANCA DANIEL EMANUEL PFA"
              />
            </div>
            <div>
              <label className="block text-neutral-400 text-xs font-medium mb-1 uppercase tracking-wide">
                IBAN
              </label>
              <input
                className={`${inputClass} font-mono`}
                value={form.iban}
                onChange={(e) => setForm((prev) => ({ ...prev, iban: e.target.value }))}
                placeholder="Ex: RO49AAAA1B31007593840000"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-neutral-200 disabled:opacity-50 transition-colors"
            >
              {saving ? "Se salvează..." : "Salvează"}
            </button>
            {saved && <span className="text-emerald-400 text-sm">Salvat</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BankDetailsPage;
