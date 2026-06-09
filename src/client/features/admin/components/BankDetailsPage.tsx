import React, { useEffect, useState, useCallback } from "react";
import type { BankProfile } from "../types";
import AncaLoader from "../../../components/UI/AncaLoader";
import Breadcrumb from "./Breadcrumb";

const inputClass =
  "w-full bg-neutral-950 text-white text-sm placeholder-neutral-600 border border-neutral-800 rounded-lg px-3 py-2 outline-none focus:border-neutral-500 transition-colors";

function generateId(): string {
  return `bank_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function ProfileForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: Omit<BankProfile, "id">;
  onSave: (data: Omit<BankProfile, "id">) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState(initial);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="space-y-3 pt-2">
      <div>
        <label className="block text-neutral-400 text-xs font-medium mb-1 uppercase tracking-wide">
          Etichetă (nume scurt)
        </label>
        <input
          className={inputClass}
          value={form.label}
          onChange={set("label")}
          placeholder="Ex: Cont principal, Revolut, BT EUR..."
          autoFocus
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="block text-neutral-400 text-xs font-medium mb-1 uppercase tracking-wide">
            Nume beneficiar
          </label>
          <input
            className={inputClass}
            value={form.beneficiaryName}
            onChange={set("beneficiaryName")}
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
            onChange={(e) => setForm(prev => ({ ...prev, iban: e.target.value.toUpperCase() }))}
            placeholder="Ex: RO49AAAA1B31007593840000"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={saving || !form.label.trim()}
          className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-neutral-200 disabled:opacity-50 transition-colors"
        >
          {saving ? "Se salvează..." : "Salvează"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-neutral-700 text-neutral-400 text-sm hover:text-white hover:border-neutral-500 transition-colors"
        >
          Anulează
        </button>
      </div>
    </div>
  );
}

const BankDetailsPage: React.FC = () => {
  const [profiles, setProfiles] = useState<BankProfile[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        let loaded: BankProfile[] = Array.isArray(data.bankProfiles) ? data.bankProfiles : [];
        // Migrate old single bankDetails to profiles array
        if (loaded.length === 0 && (data.bankDetails?.beneficiaryName || data.bankDetails?.iban)) {
          loaded = [{
            id: generateId(),
            label: "Cont principal",
            beneficiaryName: data.bankDetails.beneficiaryName ?? "",
            iban: data.bankDetails.iban ?? "",
          }];
        }
        setProfiles(loaded);
      })
      .catch((e: Error) => setPageError(e.message))
      .finally(() => setPageLoading(false));
  }, []);

  const persistProfiles = useCallback(async (updated: BankProfile[]) => {
    setSaving(true);
    try {
      await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankProfiles: updated }),
      });
      setProfiles(updated);
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const handleAdd = async (data: Omit<BankProfile, "id">) => {
    const newProfile: BankProfile = { id: generateId(), ...data };
    const ok = await persistProfiles([...profiles, newProfile]);
    if (ok) {
      setAddingNew(false);
      setSavedId(newProfile.id);
      setTimeout(() => setSavedId(null), 2000);
    }
  };

  const handleEdit = async (id: string, data: Omit<BankProfile, "id">) => {
    const updated = profiles.map(p => p.id === id ? { ...p, ...data } : p);
    const ok = await persistProfiles(updated);
    if (ok) {
      setEditingId(null);
      setSavedId(id);
      setTimeout(() => setSavedId(null), 2000);
    }
  };

  const handleDelete = async (id: string) => {
    const updated = profiles.filter(p => p.id !== id);
    await persistProfiles(updated);
    setConfirmDeleteId(null);
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
            Profile de cont folosite în contracte când metoda de plată este transfer bancar.
          </p>
        </div>

        <div className="space-y-3">
          {profiles.length === 0 && !addingNew && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 text-center">
              <p className="text-neutral-500 text-sm">Nu ai adăugat niciun cont bancar.</p>
            </div>
          )}

          {profiles.map((profile, index) => (
            <div key={profile.id} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
              {editingId === profile.id ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-neutral-500 uppercase tracking-widest">Editare profil</span>
                  </div>
                  <ProfileForm
                    initial={{ label: profile.label, beneficiaryName: profile.beneficiaryName, iban: profile.iban }}
                    onSave={(data) => handleEdit(profile.id, data)}
                    onCancel={() => setEditingId(null)}
                    saving={saving}
                  />
                </>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-medium">{profile.label}</span>
                      {index === 0 && (
                        <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                          implicit
                        </span>
                      )}
                      {savedId === profile.id && (
                        <span className="text-emerald-400 text-xs">Salvat ✓</span>
                      )}
                    </div>
                    <p className="text-neutral-400 text-sm truncate">{profile.beneficiaryName || <span className="text-neutral-600 italic">beneficiar necompletat</span>}</p>
                    <p className="text-neutral-500 text-xs font-mono">{profile.iban || <span className="italic">IBAN necompletat</span>}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditingId(profile.id)}
                      className="text-xs text-neutral-400 hover:text-white border border-neutral-700 hover:border-neutral-500 rounded-lg px-3 py-1.5 transition-colors"
                    >
                      Editează
                    </button>
                    {confirmDeleteId === profile.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-neutral-400">Sigur?</span>
                        <button
                          type="button"
                          onClick={() => handleDelete(profile.id)}
                          className="text-xs text-red-400 hover:text-red-300 border border-red-500/40 hover:border-red-400 rounded-lg px-2.5 py-1.5 transition-colors"
                        >
                          Da
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs text-neutral-500 hover:text-white rounded-lg px-2 py-1.5 transition-colors"
                        >
                          Nu
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(profile.id)}
                        className="text-xs text-neutral-600 hover:text-red-400 border border-neutral-800 hover:border-red-500/40 rounded-lg px-3 py-1.5 transition-colors"
                      >
                        Șterge
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {addingNew && (
            <div className="bg-neutral-900 border border-emerald-500/25 rounded-2xl p-5">
              <span className="text-xs text-emerald-400 uppercase tracking-widest">Profil nou</span>
              <ProfileForm
                initial={{ label: "", beneficiaryName: "", iban: "" }}
                onSave={handleAdd}
                onCancel={() => setAddingNew(false)}
                saving={saving}
              />
            </div>
          )}

          {!addingNew && (
            <button
              type="button"
              onClick={() => { setAddingNew(true); setEditingId(null); }}
              className="w-full py-3 rounded-xl border border-dashed border-neutral-700 text-neutral-500 text-sm hover:border-neutral-500 hover:text-white transition-colors"
            >
              + Adaugă profil bancar
            </button>
          )}
        </div>

        <p className="text-neutral-600 text-xs">
          Primul profil din listă este marcat ca implicit și va fi pre-selectat la crearea unui contract nou.
        </p>
      </div>
    </div>
  );
};

export default BankDetailsPage;
