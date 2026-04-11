import React, { useState } from "react";
import type { ClientEvent, EventStatus } from "../../types/admin";
import EventStatusBadge from "./EventStatusBadge";
import FileDropZone from "./FileDropZone";
import { slugify } from "../../utils/slugify";

interface EventCardProps {
  event: ClientEvent;
  initialCollapsed?: boolean;
  onUpdated?: (updated: Partial<ClientEvent>) => void;
}

const STATUS_OPTIONS: EventStatus[] = ["lead", "tentativ", "confirmat", "finalizat", "anulat"];

const inputClass =
  "w-full bg-neutral-800 text-white text-sm placeholder-neutral-600 border border-neutral-700 rounded-lg px-3 py-2 outline-none focus:border-neutral-500 transition-colors";
const labelClass = "block text-neutral-400 text-xs font-medium mb-1 uppercase tracking-wide";

const formatEUR = (amount: number) =>
  new Intl.NumberFormat("ro-RO", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);

const EventCard: React.FC<EventCardProps> = ({ event, initialCollapsed = false, onUpdated }) => {
  if (!event?.client || !event?.pricing) return null;

  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [contractUrl, setContractUrl] = useState(event.contractUrl ?? "");
  const [invoiceUrl, setInvoiceUrl] = useState(event.invoiceUrl ?? "");

  const eventDate = new Date(event.eventDate);
  const isPast = eventDate < new Date();

  const dateSlug = eventDate.toISOString().slice(0, 10);
  const nameSlug = slugify(event.client.fullName);
  const docBasePath = (type: "contract" | "factura") =>
    `admin-docs/${event.id}/${nameSlug}_${dateSlug}_${type}`;
  const displayStatus: typeof event.status =
    isPast && event.status === "confirmat" ? "finalizat" : event.status;

  const formattedDate = eventDate.toLocaleDateString("ro-RO", {
    day: "numeric", month: "long", year: "numeric",
  });

  // Edit form state — initialised from event
  const [form, setForm] = useState({
    fullName: event.client.fullName,
    phone: event.client.phone ?? "",
    eventDate: eventDate.toISOString().slice(0, 10),
    total: String(event.pricing.total),
    advanceAmount: String(event.pricing.advanceAmount),
    advancePaid: event.pricing.advancePaid,
    status: event.status,
    notes: event.notes ?? "",
  });

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const saveDocUrl = async (field: "contractUrl" | "invoiceUrl", url: string) => {
    if (field === "contractUrl") setContractUrl(url);
    else setInvoiceUrl(url);
    await fetch(`/api/admin/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: url }),
    });
  };

  const deleteDocUrl = async (field: "contractUrl" | "invoiceUrl") => {
    if (field === "contractUrl") setContractUrl("");
    else setInvoiceUrl("");
    await fetch(`/api/admin/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: "" }),
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);

    const total = parseFloat(form.total) || 0;
    const advanceAmount = parseFloat(form.advanceAmount) || 0;

    const payload = {
      "client.fullName": form.fullName,
      "client.phone": form.phone,
      eventDate: form.eventDate,
      status: form.status,
      notes: form.notes,
      "pricing.total": total,
      "pricing.advanceAmount": advanceAmount,
      "pricing.advancePaid": form.advancePaid,
      "pricing.remainingAmount": total - advanceAmount,
    };

    try {
      const res = await fetch(`/api/admin/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Eroare la salvare.");
      onUpdated?.({
        client: { ...event.client, fullName: form.fullName, phone: form.phone },
        eventDate: new Date(form.eventDate),
        status: form.status as EventStatus,
        notes: form.notes,
        pricing: { total, advanceAmount, advancePaid: form.advancePaid, remainingAmount: total - advanceAmount },
      });
      setEditing(false);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Eroare necunoscută.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl hover:border-neutral-700 transition-colors">

        {/* Header row */}
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <EventStatusBadge status={displayStatus} />
            <span className="text-neutral-500 text-xs">•</span>
            <span className="text-white text-sm font-medium truncate">{event.client.fullName}</span>
            <span className="text-neutral-500 text-xs">•</span>
            <span className="text-neutral-400 text-xs">{formattedDate}</span>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-neutral-300 text-xs font-medium">{formatEUR(event.pricing.total)}</span>
            <div className="flex items-center gap-1">
              <span title={contractUrl ? "Contract încărcat" : "Contract lipsă"} className={`text-xs ${contractUrl ? "text-emerald-400" : "text-red-400"}`}>
                {contractUrl ? "✓" : "✗"}
              </span>
              <span className="text-neutral-700 text-xs">C</span>
              <span title={invoiceUrl ? "Factură încărcată" : "Factură lipsă"} className={`text-xs ml-1.5 ${invoiceUrl ? "text-emerald-400" : "text-red-400"}`}>
                {invoiceUrl ? "✓" : "✗"}
              </span>
              <span className="text-neutral-700 text-xs">F</span>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`text-neutral-500 transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </button>

        {/* Body */}
        {!collapsed && (
          <div className="px-4 pb-4 border-t border-neutral-800 pt-3 space-y-2">
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-neutral-400">
              <span className="flex items-center gap-1.5"><span>📅</span>{formattedDate}</span>
              <span className="flex items-center gap-1.5"><span>💶</span>{formatEUR(event.pricing.total)}</span>
              <span className="flex items-center gap-1.5">
                <span>{event.pricing.advancePaid ? "✅" : "⏳"}</span>
                {event.pricing.advancePaid
                  ? `Avans încasat (${formatEUR(event.pricing.advanceAmount)})`
                  : `Avans neîncasat (${formatEUR(event.pricing.advanceAmount)})`}
              </span>
              {event.type && <span className="flex items-center gap-1.5"><span>🎉</span>{event.type}</span>}
              {event.client.phone && <span className="flex items-center gap-1.5"><span>📞</span>{event.client.phone}</span>}
              {event.contractId && <span className="flex items-center gap-1.5 font-mono"><span>#</span>{event.contractId}</span>}
            </div>

            {event.notes && (
              <p className="text-neutral-500 text-xs leading-relaxed border-t border-neutral-800 pt-2">{event.notes}</p>
            )}

            {(contractUrl || invoiceUrl) && (
              <div className="flex gap-3 border-t border-neutral-800 pt-2">
                {contractUrl && (
                  <a href={contractUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                    Contract
                  </a>
                )}
                {invoiceUrl && (
                  <a href={invoiceUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                    Factură
                  </a>
                )}
              </div>
            )}

            <div className="pt-2 border-t border-neutral-800">
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Modifică
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editing && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
          onClick={() => setEditing(false)}
        >
          <div
            className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-white text-base font-semibold">Modifică eveniment</h2>
              <button onClick={() => setEditing(false)} className="text-neutral-500 hover:text-white transition-colors text-lg leading-none">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className={labelClass}>Nume client</label>
                <input className={inputClass} value={form.fullName} onChange={set("fullName")} />
              </div>
              <div>
                <label className={labelClass}>Telefon</label>
                <input className={inputClass} value={form.phone} onChange={set("phone")} />
              </div>
              <div>
                <label className={labelClass}>Data evenimentului</label>
                <input type="date" className={inputClass} value={form.eventDate} onChange={set("eventDate")} />
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select className={inputClass} value={form.status} onChange={set("status")}>
                  {STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Preț total (EUR)</label>
                  <input type="number" className={inputClass} value={form.total} onChange={set("total")} />
                </div>
                <div>
                  <label className={labelClass}>Avans (EUR)</label>
                  <input type="number" className={inputClass} value={form.advanceAmount} onChange={set("advanceAmount")} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="advancePaid"
                  type="checkbox"
                  checked={form.advancePaid}
                  onChange={e => setForm(f => ({ ...f, advancePaid: e.target.checked }))}
                  className="w-4 h-4 accent-emerald-500"
                />
                <label htmlFor="advancePaid" className="text-neutral-400 text-xs cursor-pointer">Avans încasat</label>
              </div>
              <div>
                <label className={labelClass}>Note</label>
                <textarea className={`${inputClass} resize-none`} rows={3} value={form.notes} onChange={set("notes")} />
              </div>
            </div>

            {/* Documents */}
            <div className="border-t border-neutral-800 pt-3 space-y-3">
              <p className="text-neutral-500 text-xs uppercase tracking-wide font-medium">Documente</p>
              <FileDropZone
                label="Contract"
                storagePath={docBasePath("contract")}
                currentUrl={contractUrl}
                onUploaded={url => saveDocUrl("contractUrl", url)}
                onDeleted={() => deleteDocUrl("contractUrl")}
              />
              <FileDropZone
                label="Factură"
                storagePath={docBasePath("factura")}
                currentUrl={invoiceUrl}
                onUploaded={url => saveDocUrl("invoiceUrl", url)}
                onDeleted={() => deleteDocUrl("invoiceUrl")}
              />
            </div>

            {saveError && (
              <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{saveError}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setEditing(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-700 text-neutral-300 text-sm hover:border-neutral-500 transition-colors"
              >
                Anulează
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-neutral-200 disabled:opacity-40 transition-colors"
              >
                {saving ? "Se salvează..." : "Salvează"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EventCard;
