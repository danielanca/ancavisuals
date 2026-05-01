import React, { useRef, useState } from "react";
import type { ClientEvent, EventType } from "../types";
import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";
import useAuth from "../auth/useAuth";

interface Props {
  onClose: () => void;
  onAdded: (event: ClientEvent) => void;
}

const EVENT_TYPES: EventType[] = ["Nuntă", "Botez", "Logodnă", "Aniversare", "Altele"];

const inputClass =
  "w-full bg-neutral-800 text-white text-sm placeholder-neutral-600 border border-neutral-700 rounded-lg px-3 py-2 outline-none focus:border-neutral-500 transition-colors";
const labelClass = "block text-neutral-400 text-xs font-medium mb-1 uppercase tracking-wide";

async function fileToBase64(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error ?? new Error("Nu s-a putut citi fișierul."));
    reader.readAsDataURL(file);
  });
}

const AddLeadModal: React.FC<Props> = ({ onClose, onAdded }) => {
  useBodyScrollLock(true);
  const { auth } = useAuth();
  const scanInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    type: "Nuntă" as EventType,
    typeLabel: "",
    eventDate: "",
    eventEndDate: "",
    notes: "",
    total: "",
    advanceAmount: "",
    advancePaid: false,
    fiscalized: false,
  });
  const [saving, setSaving] = useState(false);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const total = parseFloat(form.total) || 0;
  const advanceAmount = parseFloat(form.advanceAmount) || 0;
  const rest = Math.max(0, total - advanceAmount);
  const hasPrice = total > 0 || advanceAmount > 0;

  const formatEUR = (n: number) =>
    new Intl.NumberFormat("ro-RO", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

  const handleScan = async () => {
    if (!scanFile) return;
    if (!auth.accessToken) {
      setError("Trebuie să fii autentificat ca admin pentru extracția AI.");
      return;
    }

    setScanning(true);
    setError(null);

    try {
      const imageBase64 = await fileToBase64(scanFile);
      const response = await fetch("/api/admin/leads/extract-from-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.accessToken}`,
        },
        body: JSON.stringify({
          imageBase64,
          mediaType: scanFile.type,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Extracția AI a eșuat.");
      }

      const extracted = (data.extracted ?? {}) as {
        phone?: string | null;
        fullName?: string | null;
        eventDate?: string | null;
        eventTypeGuess?: EventType | null;
      };

      setForm((prev) => ({
        ...prev,
        phone: extracted.phone ?? prev.phone,
        fullName: extracted.fullName ?? prev.fullName,
        eventDate: extracted.eventDate ?? prev.eventDate,
        type: extracted.eventTypeGuess ?? prev.type,
      }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Nu s-au putut extrage datele.");
    } finally {
      setScanning(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.fullName.trim()) {
      setError("Numele clientului este obligatoriu.");
      return;
    }

    setSaving(true);
    setError(null);

    const isAltele = form.type === "Altele";
    const pricing = {
      total,
      advanceAmount,
      advancePaid: form.advancePaid,
      remainingAmount: rest,
    };

    const payload: Record<string, unknown> = {
      type: form.type,
      status: "lead",
      client: {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
      },
      pricing,
      fiscalized: form.fiscalized,
      ...(isAltele && form.typeLabel.trim() ? { typeLabel: form.typeLabel.trim() } : {}),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      ...(form.eventDate ? { eventDate: form.eventDate } : {}),
      ...(isAltele && form.eventEndDate ? { eventEndDate: form.eventEndDate } : {}),
    };

    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Eroare la salvare.");

      onAdded({
        id: data.id,
        type: form.type,
        status: "lead",
        fiscalized: form.fiscalized,
        createdAt: new Date(),
        eventDate: form.eventDate ? new Date(form.eventDate) : null,
        eventEndDate: isAltele && form.eventEndDate ? new Date(form.eventEndDate) : null,
        typeLabel: isAltele && form.typeLabel.trim() ? form.typeLabel.trim() : undefined,
        client: {
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
        },
        services: [],
        pricing,
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Eroare necunoscută.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white text-base font-semibold">Lead nou</h2>
            <p className="text-neutral-500 text-xs mt-0.5">
              Completează ce știi acum, restul mai târziu.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-neutral-200 text-sm font-medium">Extrage din screenshot cu Claude</p>
                <p className="text-neutral-500 text-xs mt-1">
                  Încearcă să completeze telefonul, numele, data și tipul evenimentului dacă apar clar în imagine.
                </p>
              </div>
              <button
                type="button"
                onClick={() => scanInputRef.current?.click()}
                className="shrink-0 px-3 py-2 rounded-lg border border-neutral-700 text-neutral-300 text-xs hover:border-neutral-500 transition-colors"
              >
                {scanFile ? "Schimbă poza" : "Alege poză"}
              </button>
            </div>

            <input
              ref={scanInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => setScanFile(event.target.files?.[0] ?? null)}
            />

            {scanFile && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-neutral-200 text-xs">{scanFile.name}</p>
                  <p className="text-neutral-500 text-[11px]">JPG, PNG, WebP sau screenshot din conversație</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleScan}
                    disabled={scanning}
                    className="px-3 py-2 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs hover:bg-amber-500/20 transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {scanning ? "Extrage..." : "Extrage AI"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setScanFile(null)}
                    className="text-neutral-500 hover:text-red-400 transition-colors text-lg leading-none"
                    aria-label="Elimină poza"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Nume */}
          <div>
            <label className={labelClass}>Nume client *</label>
            <input
              className={inputClass}
              placeholder="ex: Maria Ionescu"
              value={form.fullName}
              onChange={set("fullName")}
              autoFocus
            />
          </div>

          {/* Telefon + Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Telefon</label>
              <input className={inputClass} placeholder="07xx xxx xxx" value={form.phone} onChange={set("phone")} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input className={inputClass} placeholder="email@..." value={form.email} onChange={set("email")} />
            </div>
          </div>

          {/* Type + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Tip eveniment</label>
              <select className={inputClass} value={form.type} onChange={set("type")}>
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>
                {form.type === "Altele" ? "Dată început" : "Dată estimată"}
              </label>
              <input type="date" className={inputClass} value={form.eventDate} onChange={set("eventDate")} />
            </div>
          </div>

          {/* Other: description + end date */}
          {form.type === "Altele" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Descriere</label>
                <input className={inputClass} placeholder="ex: Concediu..." value={form.typeLabel} onChange={set("typeLabel")} />
              </div>
              <div>
                <label className={labelClass}>Dată sfârșit</label>
                <input
                  type="date" className={inputClass} value={form.eventEndDate}
                  onChange={set("eventEndDate")} min={form.eventDate || undefined}
                />
              </div>
            </div>
          )}

          {/* Pricing */}
          <div className="border-t border-neutral-800 pt-3 space-y-3">
            <p className="text-neutral-500 text-xs uppercase tracking-wide font-medium">Prețuri (opțional)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Preț total (EUR)</label>
                <input
                  type="number" min="0" className={inputClass}
                  placeholder="ex: 1500" value={form.total} onChange={set("total")}
                />
              </div>
              <div>
                <label className={labelClass}>Avans (EUR)</label>
                <input
                  type="number" min="0" className={inputClass}
                  placeholder="ex: 500" value={form.advanceAmount} onChange={set("advanceAmount")}
                />
              </div>
            </div>

            {/* Rest calculat automat */}
            {hasPrice && (
              <div className="flex items-center justify-between bg-neutral-800/60 rounded-lg px-3 py-2">
                <span className="text-neutral-400 text-xs">Rest de plată</span>
                <span className="text-white text-sm font-semibold">{formatEUR(rest)}</span>
              </div>
            )}

            {/* Advance collected */}
            {advanceAmount > 0 && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.advancePaid}
                  onChange={(e) => setForm((f) => ({ ...f, advancePaid: e.target.checked }))}
                  className="w-4 h-4 accent-emerald-500"
                />
                <span className="text-neutral-300 text-xs">Avans deja încasat</span>
              </label>
            )}

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.fiscalized}
                onChange={(e) => setForm((f) => ({ ...f, fiscalized: e.target.checked }))}
                className="w-4 h-4 accent-emerald-500"
              />
              <span className="text-neutral-300 text-xs">
                Fiscalizat
              </span>
            </label>
            {!form.fiscalized && (
              <p className="text-[11px] text-amber-400">
                Marcat ca eveniment nefiscalizat, fără nevoie de factură.
              </p>
            )}
          </div>

          {/* Note */}
          <div>
            <label className={labelClass}>Notă</label>
            <textarea
              className={`${inputClass} resize-none`}
              rows={2}
              placeholder="De unde a aflat, ce vrea, buget estimat..."
              value={form.notes}
              onChange={set("notes")}
            />
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-700 text-neutral-300 text-sm hover:border-neutral-500 transition-colors"
          >
            Anulează
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400 disabled:opacity-40 transition-colors"
          >
            {saving ? "Se salvează..." : "Adaugă Lead"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddLeadModal;
