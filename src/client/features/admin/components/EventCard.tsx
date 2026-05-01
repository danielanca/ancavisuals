import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { ClientEvent, EventExpense, EventStatus } from "../types";
import Redacted from "./Redacted";
import EventStatusBadge from "./EventStatusBadge";
import FileDropZone from "./FileDropZone";
import MultiFileDropZone from "./MultiFileDropZone";
import ConfirmModal from "./ConfirmModal";
import { slugify } from "../../../utils/slugify";
import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";

interface EventCardProps {
  event: ClientEvent;
  initialCollapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
  onUpdated?: (updated: Partial<ClientEvent>) => void;
  onDeleted?: () => void;
}

const STATUS_OPTIONS: EventStatus[] = ["lead", "tentativ", "confirmat", "finalizat", "anulat"];

const inputClass =
  "w-full bg-neutral-800 text-white text-sm placeholder-neutral-600 border border-neutral-700 rounded-lg px-3 py-2 outline-none focus:border-neutral-500 transition-colors";
const labelClass = "block text-neutral-400 text-xs font-medium mb-1 uppercase tracking-wide";

const formatEUR = (amount: number) =>
  new Intl.NumberFormat("ro-RO", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);

const formatRON = (amount: number) =>
  new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(amount);

const EventCard: React.FC<EventCardProps> = ({ event, initialCollapsed = false, onCollapseChange, onUpdated, onDeleted }) => {
  const navigate = useNavigate();
  const hasEventData = Boolean(event?.client);
  const fallbackDate = event?.eventDate ? new Date(event.eventDate) : null;
  const fallbackName = event?.client?.fullName ?? "";

  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [editing, setEditing] = useState(false);
  useBodyScrollLock(editing);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [quickSaving, setQuickSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteStep, setDeleteStep] = useState<"first" | "confirm" | null>(null);
  const [contractUrl, setContractUrl] = useState(event.contractUrl ?? "");
  const [invoiceUrl, setInvoiceUrl] = useState(event.invoiceUrl ?? "");
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>(event.attachmentUrls ?? []);
  const [templateUrls, setTemplateUrls] = useState<string[]>(event.templateUrls ?? []);
  const [albumSlug, setAlbumSlug] = useState(event.albumSlug ?? "");
  const [albumPin, setAlbumPin] = useState(event.albumPin ?? "");
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [albumCreating, setAlbumCreating] = useState(false);
  const [albumError, setAlbumError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processLog, setProcessLog] = useState<string[]>([]);
  const [expenses, setExpenses] = useState<EventExpense[]>(event.expenses ?? []);
  const [newExpenseLabel, setNewExpenseLabel] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [expenseSaving, setExpenseSaving] = useState(false);

  const eventDate = fallbackDate;
  const isPast = eventDate
    ? new Date(new Date(eventDate).setHours(23, 59, 59, 999)) < new Date()
    : false;
  const isLead = event.status === "lead" || event.status === "tentativ";
  const isFiscalized = event.fiscalized === true;

  const dateSlug = eventDate ? eventDate.toISOString().slice(0, 10) : "no-date";
  const nameSlug = slugify(fallbackName);
  const docBasePath = (type: "contract" | "factura") =>
    `admin-docs/${event.id}/${nameSlug}_${dateSlug}_${type}`;

  const displayStatus: typeof event.status =
    !isLead && isPast && event.status === "confirmat" ? "finalizat" : event.status;

  const formattedDate = eventDate
    ? eventDate.toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" })
    : "Dată nespecificată";

  const eventEndDate = event.eventEndDate ? new Date(event.eventEndDate) : null;
  const formattedEndDate = eventEndDate
    ? eventEndDate.toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const [form, setForm] = useState({
    fullName: fallbackName,
    phone: event?.client?.phone ?? "",
    email: event?.client?.email ?? "",
    eventDate: eventDate ? eventDate.toISOString().slice(0, 10) : "",
    eventEndDate: eventEndDate ? eventEndDate.toISOString().slice(0, 10) : "",
    typeLabel: event.typeLabel ?? "",
    total: String(event?.pricing?.total ?? 0),
    advanceAmount: String(event?.pricing?.advanceAmount ?? 0),
    advancePaid: event?.pricing?.advancePaid ?? false,
    fiscalized: isFiscalized,
    status: event.status,
    notes: event.notes ?? "",
  });

  const suggestedSlug = eventDate
    ? `${String(eventDate.getDate()).padStart(2, "0")}${eventDate.toLocaleString("ro-RO", { month: "long" }).toLowerCase().replace(/\s+/g, "")}${eventDate.getFullYear()}`
    : "";

  // Auto-detect album in Bunny when card is expanded and no albumSlug is set yet
  useEffect(() => {
    if (!hasEventData || collapsed || albumSlug || !suggestedSlug || isLead) return;
    let cancelled = false;
    fetch(`/api/admin/events/${event.id}/detect-album`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: suggestedSlug }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.found && data.slug) {
          setAlbumSlug(data.slug);
          onUpdated?.({ albumSlug: data.slug });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [hasEventData, collapsed, albumSlug, suggestedSlug, isLead, event.id, onUpdated]);

  if (!hasEventData) return null;

  const set =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const saveDocUrl = async (field: "contractUrl" | "invoiceUrl", url: string) => {
    if (field === "contractUrl") setContractUrl(url);
    else setInvoiceUrl(url);
    await fetch(`/api/admin/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: url }),
    });
  };

  const saveAttachments = async (urls: string[]) => {
    setAttachmentUrls(urls);
    await fetch(`/api/admin/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attachmentUrls: urls }),
    });
  };

  const handleCreateAlbum = async (slug: string, pin: string) => {
    setAlbumCreating(true);
    setAlbumError(null);
    const res = await fetch(`/api/admin/events/${event.id}/create-album`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, pin }),
    });
    const data = await res.json();
    if (!res.ok) { setAlbumError(data.error); setAlbumCreating(false); return; }
    setAlbumSlug(slug);
    setAlbumPin(pin);
    setShowAlbumModal(false);
    setAlbumCreating(false);
    onUpdated?.({ albumSlug: slug, albumPin: pin });
  };

  const handleProcessAlbum = async () => {
    if (!event.id || processing) return;
    setProcessing(true);
    setProcessLog(["Se conectează..."]);

    try {
      const res = await fetch(`/api/admin/events/${event.id}/process-album`, { method: "POST" });
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
            if (data.stage === "start") {
              setProcessLog((l) => [...l, `📂 ${data.total} poze găsite`]);
            } else if (data.stage === "previews") {
              if (data.current) setProcessLog((l) => [...l, `🖼 Preview: ${data.current} (${data.done}/${data.total})`]);
              else setProcessLog((l) => [...l, `🖼 ${data.message}`]);
            } else if (data.stage === "previews_complete") {
              setProcessLog((l) => [...l, `✅ Previews: ${data.done} generate, ${data.skipped} sărite`]);
            } else if (data.stage === "done") {
              setProcessLog((l) => [...l, "🎉 Procesare completă!"]);
            } else if (data.error) {
              setProcessLog((l) => [...l, `❌ Eroare: ${data.error}`]);
            } else if (data.warning) {
              setProcessLog((l) => [...l, `⚠️ ${data.warning}`]);
            }
          } catch {}
        }
      }
    } catch (err) {
      setProcessLog((l) => [...l, `❌ ${String(err)}`]);
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveAlbumPin = async (pin: string) => {
    setAlbumPin(pin);
    await fetch(`/api/admin/events/${event.id}/album`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ albumPin: pin }),
    });
    onUpdated?.({ albumPin: pin });
  };

  const saveTemplates = async (urls: string[]) => {
    setTemplateUrls(urls);
    await fetch(`/api/admin/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateUrls: urls }),
    });
  };

  const persistExpenses = async (updated: EventExpense[]) => {
    setExpenses(updated);
    await fetch(`/api/admin/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expenses: updated }),
    });
    onUpdated?.({ expenses: updated });
  };

  const addExpense = async () => {
    const amount = parseFloat(newExpenseAmount);
    if (!newExpenseLabel.trim() || !amount) return;
    setExpenseSaving(true);
    await persistExpenses([
      ...expenses,
      { id: crypto.randomUUID(), label: newExpenseLabel.trim(), amount },
    ]);
    setNewExpenseLabel("");
    setNewExpenseAmount("");
    setExpenseSaving(false);
  };

  const removeExpense = (id: string) =>
    persistExpenses(expenses.filter((expense) => expense.id !== id));

  const deleteDocUrl = async (field: "contractUrl" | "invoiceUrl") => {
    if (field === "contractUrl") setContractUrl("");
    else setInvoiceUrl("");
    await fetch(`/api/admin/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: "" }),
    });
  };

  const quickStatus = async (newStatus: EventStatus) => {
    setQuickSaving(true);
    try {
      const res = await fetch(`/api/admin/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      onUpdated?.({ status: newStatus });
    } catch {
      // silently fail — user can retry
    } finally {
      setQuickSaving(false);
    }
  };

  const quickFiscalized = async (nextFiscalized: boolean) => {
    setQuickSaving(true);
    try {
      const res = await fetch(`/api/admin/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fiscalized: nextFiscalized }),
      });
      if (!res.ok) throw new Error();
      onUpdated?.({ fiscalized: nextFiscalized });
    } catch {
      // silently fail — user can retry
    } finally {
      setQuickSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/events/${event.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onDeleted?.();
    } catch {
      setDeleting(false);
    }
  };

  const handleArchive = async () => {
    setDeleteStep(null);
    try {
      const res = await fetch(`/api/admin/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "anulat" }),
      });
      if (!res.ok) throw new Error();
      onUpdated?.({ status: "anulat" });
    } catch {}
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);

    const total = parseFloat(form.total) || 0;
    const advanceAmount = parseFloat(form.advanceAmount) || 0;

    const payload: Record<string, unknown> = {
      "client.fullName": form.fullName,
      "client.phone": form.phone,
      "client.email": form.email,
      status: form.status,
      fiscalized: form.fiscalized,
      notes: form.notes,
      typeLabel: form.typeLabel || null,
      "pricing.total": total,
      "pricing.advanceAmount": advanceAmount,
      "pricing.advancePaid": form.advancePaid,
      "pricing.remainingAmount": total - advanceAmount,
    };

    if (form.eventDate) {
      payload.eventDate = form.eventDate;
    }
    if (form.eventEndDate) {
      payload.eventEndDate = form.eventEndDate;
    } else {
      payload.eventEndDate = null;
    }

    try {
      const res = await fetch(`/api/admin/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Eroare la salvare.");
      onUpdated?.({
        client: { ...event.client, fullName: form.fullName, phone: form.phone, email: form.email },
        eventDate: form.eventDate ? new Date(form.eventDate) : null,
        eventEndDate: form.eventEndDate ? new Date(form.eventEndDate) : null,
        typeLabel: form.typeLabel || undefined,
        status: form.status as EventStatus,
        fiscalized: form.fiscalized,
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
          onClick={() => setCollapsed((c) => { const next = !c; onCollapseChange?.(next); return next; })}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <EventStatusBadge status={displayStatus} />
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                isFiscalized
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
              }`}
            >
              <Redacted>{isFiscalized ? "Fiscalizat" : "Nefiscalizat"}</Redacted>
            </span>
            <span className="text-neutral-500 text-xs">•</span>
            <span className="text-white text-sm font-medium truncate"><Redacted>{event.client.fullName}</Redacted></span>
            <span className="text-neutral-500 text-xs">•</span>
            <span className={`text-xs ${event.type === "Nuntă" ? "text-emerald-400" : "text-neutral-500"}`}>{event.typeLabel || event.type}</span>
            <span className="text-neutral-500 text-xs">•</span>
            <span className={`text-xs ${eventDate ? "text-neutral-400" : "text-neutral-600 italic"}`}>
              {formattedDate}
            </span>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            {!isLead && (
              <span className="text-neutral-300 text-xs font-medium">
                <Redacted>{formatEUR(event.pricing?.total ?? 0)}</Redacted>
              </span>
            )}
            {!isLead && (
              <div className="flex items-center gap-2">
                {(event.contractId || contractUrl || attachmentUrls.length > 0) ? (
                  <span title="Contract existent" className="text-xs text-emerald-400 font-medium">C✓</span>
                ) : (
                  <span title="Fără contract" className="text-xs text-neutral-600">C—</span>
                )}
                <span title={invoiceUrl ? "Factură încărcată" : "Factură lipsă"} className={`text-xs ${invoiceUrl ? "text-emerald-400" : "text-neutral-600"}`}>
                  {invoiceUrl ? "F✓" : "F—"}
                </span>
              </div>
            )}
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              className={`text-neutral-500 transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </button>

        {/* Body */}
        {!collapsed && (
          <div className="px-4 pb-4 border-t border-neutral-800 pt-3 space-y-3">

            {/* Info row */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-neutral-400">
              {eventDate && (
                <span className="flex items-center gap-1.5">
                  <span>📅</span>
                  {formattedDate}
                  {formattedEndDate && ` → ${formattedEndDate}`}
                </span>
              )}
              {event.type && (
                <span className="flex items-center gap-1.5">
                  <span>🎉</span>
                  {event.typeLabel || event.type}
                </span>
              )}
              <button
                type="button"
                onClick={() => quickFiscalized(!isFiscalized)}
                disabled={quickSaving}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors disabled:opacity-50 ${
                  isFiscalized
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                }`}
              >
                <span>{isFiscalized ? "🧾" : "🏠"}</span>
                <Redacted>{isFiscalized ? "Fiscalizat" : "Nefiscalizat"}</Redacted>
              </button>
              {event.client.phone && (
                <span className="flex items-center gap-1.5">
                  <span>📞</span>
                  <Redacted>{event.client.phone}</Redacted>
                  <a
                    href={`tel:${event.client.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="px-2 py-0.5 rounded-md bg-neutral-700 hover:bg-neutral-600 text-xs transition-colors"
                  >
                    Sună
                  </a>
                  <a
                    href={`https://wa.me/${event.client.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="px-2 py-0.5 rounded-md bg-green-700/60 hover:bg-green-600/70 text-xs transition-colors"
                  >
                    WhatsApp
                  </a>
                </span>
              )}
              {event.client.email && (
                <span className="flex items-center gap-1.5"><span>✉</span><Redacted>{event.client.email}</Redacted></span>
              )}
              {!isLead && (
                <>
                  <span className="flex items-center gap-1.5"><span>💶</span><Redacted>{formatEUR(event.pricing?.total ?? 0)}</Redacted></span>
                  <span className="flex items-center gap-1.5">
                    <span>{event.pricing?.advancePaid ? "✅" : "⏳"}</span>
                    {event.pricing?.advancePaid ? "Avans încasat (" : "Avans neîncasat ("}
                    <Redacted>{formatEUR(event.pricing?.advanceAmount ?? 0)}</Redacted>)
                  </span>
                  {(event.pricing?.remainingAmount ?? 0) > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span>💳</span>
                      Rest de plată: <Redacted>{formatEUR(event.pricing.remainingAmount)}</Redacted>
                    </span>
                  )}
                </>
              )}
              {event.contractId ? (
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/admin/contracts/${event.contractId}/edit`); }}
                  className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>→ Vezi contract</span>
                </button>
              ) : !isLead && event.status !== "anulat" && !contractUrl && attachmentUrls.length === 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/admin/contracts/create", {
                      state: {
                        eventId: event.id,
                        eventType: event.type,
                        eventDate: eventDate ? eventDate.toISOString().slice(0, 10) : "",
                        clientEmail: event.client.email ?? "",
                      },
                    });
                  }}
                  className="flex items-center gap-1 text-amber-400 hover:text-amber-300 transition-colors"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Creează contract</span>
                </button>
              )}
            </div>

            {event.notes && (
              <p className="text-neutral-500 text-xs leading-relaxed border-t border-neutral-800 pt-2">
                {event.notes}
              </p>
            )}

            {/* Quick actions for leads */}
            {isLead && (
              <div className="flex items-center gap-2 border-t border-neutral-800 pt-3">
                {event.status === "lead" && (
                  <button
                    onClick={() => quickStatus("tentativ")}
                    disabled={quickSaving}
                    className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-medium hover:bg-blue-500/30 transition-colors disabled:opacity-40"
                  >
                    Tentativ
                  </button>
                )}
                <button
                  onClick={() => quickStatus("confirmat")}
                  disabled={quickSaving}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/30 transition-colors disabled:opacity-40"
                >
                  ✓ Confirmă
                </button>
                <button
                  onClick={() => quickStatus("anulat")}
                  disabled={quickSaving}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-colors disabled:opacity-40"
                >
                  ✗ Renunță
                </button>
                <div className="ml-auto flex items-center gap-3">
                  {onDeleted && (
                    <button
                      onClick={() => setDeleteStep("first")}
                      disabled={deleting}
                      className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-400 transition-colors disabled:opacity-40"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                      {deleting ? "Se șterge..." : "Șterge"}
                    </button>
                  )}
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-white transition-colors"
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

            {/* Documents (only for confirmed events) */}
            {!isLead && (contractUrl || invoiceUrl) && (
              <div className="flex gap-3 border-t border-neutral-800 pt-2">
                {contractUrl && (
                  <a href={contractUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                    </svg>
                    Contract
                  </a>
                )}
                {invoiceUrl && (
                  <a href={invoiceUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                    </svg>
                    Factură
                  </a>
                )}
              </div>
            )}

            {/* Photobooth template */}
            {templateUrls.length > 0 && (
              <div className="border-t border-neutral-800 pt-3 space-y-2">
                <p className="text-neutral-500 text-xs uppercase tracking-wide font-medium">Template fotocabină</p>
                <div className="flex flex-col gap-1">
                  {templateUrls.map((url, i) => (
                    <a
                      key={url}
                      href={url}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-emerald-400 hover:text-emerald-300 text-sm transition-colors"
                    >
                      ↓ Download Photobooth template{templateUrls.length > 1 ? ` ${i + 1}` : ""}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Album media */}
            {!isLead && (
              <div className="border-t border-neutral-800 pt-3">
                {albumSlug ? (
                  <div className="space-y-2">
                    <p className="text-neutral-500 text-xs uppercase tracking-wide font-medium">Album media</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={`/media/${albumSlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-violet-400 hover:text-violet-300 text-sm transition-colors"
                      >
                        → Vezi Galerie
                      </a>
                      {albumPin && (
                        <span className="text-neutral-400 text-xs">
                          PIN: <span className="font-mono text-white">{albumPin}</span>
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowAlbumModal(true); }}
                        className="text-xs text-neutral-500 hover:text-white transition-colors"
                      >
                        Editează PIN
                      </button>
                      <span className="text-neutral-700 text-xs font-mono">/media/{albumSlug}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleProcessAlbum(); }}
                        disabled={processing}
                        className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white border border-neutral-700 hover:border-neutral-500 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
                      >
                        {processing ? (
                          <>
                            <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity=".25"/><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                            Procesează...
                          </>
                        ) : "⚙️ Procesează album"}
                      </button>
                      {import.meta.env.VITE_BUNNY_STORAGE_ZONE_ID && (
                        <a
                          href={`https://dash.bunny.net/storage/${import.meta.env.VITE_BUNNY_STORAGE_ZONE_ID}/file-manager?path=${albumSlug}&page=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white border border-neutral-700 hover:border-neutral-500 rounded-lg px-3 py-1.5 transition-colors"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                          </svg>
                          Compress în Bunny
                        </a>
                      )}
                    </div>

                    {processLog.length > 0 && (
                      <div className="mt-2 bg-neutral-950 border border-neutral-800 rounded-lg p-3 max-h-40 overflow-y-auto">
                        {processLog.map((line, i) => (
                          <p key={i} className="text-xs font-mono text-neutral-300 leading-5">{line}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowAlbumModal(true); }}
                    className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                    </svg>
                    Creează album media
                  </button>
                )}
              </div>
            )}

            {/* Album modal */}
            {showAlbumModal && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
                onClick={(e) => { e.stopPropagation(); setShowAlbumModal(false); }}
              >
                <div
                  className="bg-neutral-900 border border-neutral-700 rounded-xl p-6 w-full max-w-sm space-y-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-white font-semibold text-base">
                    {albumSlug ? "Editează album" : "Creează album media"}
                  </h3>
                  {!albumSlug && (
                    <div>
                      <label className={labelClass}>Slug album</label>
                      <AlbumSlugInput suggestedSlug={suggestedSlug} onCreate={handleCreateAlbum} creating={albumCreating} error={albumError} />
                    </div>
                  )}
                  {albumSlug && (
                    <AlbumPinInput currentPin={albumPin} onSave={handleSaveAlbumPin} onClose={() => setShowAlbumModal(false)} />
                  )}
                  {!albumSlug && (
                    <button
                      onClick={() => setShowAlbumModal(false)}
                      className="w-full py-2 rounded-lg border border-neutral-700 text-neutral-400 text-sm hover:text-white transition-colors"
                    >
                      Anulează
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Cheltuieli eveniment */}
            <div className="border-t border-neutral-800 pt-3 space-y-2">
              <p className="text-neutral-500 text-xs uppercase tracking-wide font-medium">Cheltuieli eveniment</p>

              {expenses.length > 0 && (
                <div className="space-y-1.5">
                  {expenses.map((expense) => (
                    <div key={expense.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-neutral-300 flex-1 truncate">{expense.label}</span>
                      <span className="text-neutral-400 font-mono shrink-0">{formatRON(expense.amount)}</span>
                      <button
                        onClick={() => removeExpense(expense.id)}
                        className="text-neutral-600 hover:text-red-400 transition-colors shrink-0"
                        title="Șterge"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-1 border-t border-neutral-800/60">
                    <span className="text-neutral-500 text-xs">Total cheltuieli</span>
                    <span className="text-neutral-300 text-xs font-semibold font-mono">
                      {formatRON(expenses.reduce((sum, expense) => sum + expense.amount, 0))}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  className="flex-1 bg-neutral-800 text-white text-xs placeholder-neutral-600 border border-neutral-700 rounded-lg px-3 py-1.5 outline-none focus:border-neutral-500 transition-colors min-w-0"
                  placeholder="ex: Motorină, Nepoata Maria..."
                  value={newExpenseLabel}
                  onChange={(e) => setNewExpenseLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addExpense(); }}
                />
                <input
                  type="number"
                  className="w-24 bg-neutral-800 text-white text-xs placeholder-neutral-600 border border-neutral-700 rounded-lg px-3 py-1.5 outline-none focus:border-neutral-500 transition-colors"
                  placeholder="RON"
                  value={newExpenseAmount}
                  onChange={(e) => setNewExpenseAmount(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addExpense(); }}
                />
                <button
                  onClick={addExpense}
                  disabled={expenseSaving || !newExpenseLabel.trim() || !newExpenseAmount}
                  className="px-3 py-1.5 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white text-xs font-medium transition-colors disabled:opacity-40 shrink-0"
                >
                  {expenseSaving ? "..." : "Adaugă"}
                </button>
              </div>
            </div>

            {/* Edit button for confirmed events */}
            {!isLead && (
              <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
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
                {onDeleted && (
                  <button
                    onClick={() => setDeleteStep("first")}
                    disabled={deleting}
                    className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-400 transition-colors disabled:opacity-40"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                    {deleting ? "Se șterge..." : "Șterge definitiv"}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 1: Archive or Delete */}
      {deleteStep === "first" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={() => setDeleteStep(null)}>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 className="text-white font-semibold text-base">Ce vrei să faci?</h3>
              <p className="text-neutral-400 text-sm mt-1">
                Evenimentul <span className="text-white">{event.client.fullName}</span> poate fi arhivat sau șters definitiv.
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={handleArchive}
                className="w-full py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium transition-colors text-left px-4"
              >
                📦 Mută în Arhivă
                <p className="text-neutral-400 text-xs font-normal mt-0.5">Evenimentul rămâne vizibil în tab-ul Arhivă</p>
              </button>
              <button
                onClick={() => setDeleteStep("confirm")}
                className="w-full py-2.5 rounded-lg border border-red-900/50 hover:border-red-700 text-red-400 hover:text-red-300 text-sm font-medium transition-colors text-left px-4"
              >
                🗑 Șterge definitiv
                <p className="text-red-500/60 text-xs font-normal mt-0.5">Ireversibil — nu poate fi recuperat</p>
              </button>
            </div>
            <button onClick={() => setDeleteStep(null)} className="w-full py-2 text-neutral-500 hover:text-white text-sm transition-colors">
              Anulează
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Final delete confirmation */}
      {deleteStep === "confirm" && (
        <ConfirmModal
          title="Ești absolut sigur?"
          message={`Ștergi definitiv evenimentul lui ${event.client.fullName}. Această acțiune este ireversibilă și nu poate fi anulată.`}
          confirmLabel={deleting ? "Se șterge..." : "Da, șterge definitiv"}
          variant="danger"
          onConfirm={() => { setDeleteStep(null); handleDelete(); }}
          onCancel={() => setDeleteStep(null)}
        />
      )}


      {/* Edit modal */}
      {editing && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
          onClick={() => setEditing(false)}
        >
          <div
            className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-white text-base font-semibold">Modifică</h2>
              <button onClick={() => setEditing(false)} className="text-neutral-500 hover:text-white transition-colors text-lg leading-none">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className={labelClass}>Nume client</label>
                <input className={inputClass} value={form.fullName} onChange={set("fullName")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Telefon</label>
                  <input className={inputClass} value={form.phone} onChange={set("phone")} />
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <input className={inputClass} value={form.email} onChange={set("email")} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Data evenimentului</label>
                  <input type="date" className={inputClass} value={form.eventDate} onChange={set("eventDate")} />
                </div>
                <div>
                  <label className={labelClass}>Dată sfârșit (opțional)</label>
                  <input type="date" className={inputClass} value={form.eventEndDate} onChange={set("eventEndDate")} min={form.eventDate || undefined} />
                </div>
              </div>
              {event.type === "Altele" && (
                <div>
                  <label className={labelClass}>Descriere</label>
                  <input className={inputClass} placeholder="ex: Concediu, Vacanță..." value={form.typeLabel} onChange={set("typeLabel")} />
                </div>
              )}
              <div>
                <label className={labelClass}>Status</label>
                <select className={inputClass} value={form.status} onChange={set("status")}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id={`fiscalized-${event.id}`}
                  type="checkbox"
                  checked={form.fiscalized}
                  onChange={(e) => setForm((f) => ({ ...f, fiscalized: e.target.checked }))}
                  className="w-4 h-4 accent-emerald-500"
                />
                <label htmlFor={`fiscalized-${event.id}`} className="text-neutral-400 text-xs cursor-pointer">
                  Fiscalizat
                </label>
              </div>
              {!form.fiscalized && (
                <p className="text-[11px] text-amber-400">
                  Eveniment marcat ca nefiscalizat, deci nu necesită factură.
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Preț total (EUR)</label>
                  <input type="number" className={inputClass} value={form.total} onChange={set("total")} />
                </div>
                <div>
                  <label className={labelClass}>Avans (EUR)</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={form.advanceAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm((f) => ({
                        ...f,
                        advanceAmount: val,
                        advancePaid: Number(val) > 0 ? true : f.advancePaid,
                      }));
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="advancePaid"
                  type="checkbox"
                  checked={form.advancePaid}
                  onChange={(e) => setForm((f) => ({ ...f, advancePaid: e.target.checked }))}
                  className="w-4 h-4 accent-emerald-500"
                />
                <label htmlFor="advancePaid" className="text-neutral-400 text-xs cursor-pointer">
                  Avans încasat
                </label>
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
                onUploaded={(url) => saveDocUrl("contractUrl", url)}
                onDeleted={() => deleteDocUrl("contractUrl")}
              />
              <FileDropZone
                label="Factură"
                storagePath={docBasePath("factura")}
                currentUrl={invoiceUrl}
                onUploaded={(url) => saveDocUrl("invoiceUrl", url)}
                onDeleted={() => deleteDocUrl("invoiceUrl")}
              />
              <MultiFileDropZone
                label="Contract fizic (poze / scan)"
                storagePath={`admin-docs/${event.id}/attachments`}
                urls={attachmentUrls}
                onUrlsChange={saveAttachments}
              />
              <MultiFileDropZone
                label="Template fotocabină (PNG/JPG)"
                storagePath={`admin-docs/${event.id}/templates`}
                urls={templateUrls}
                onUrlsChange={saveTemplates}
                accept=".png,.jpg,.jpeg"
              />
            </div>

            {saveError && (
              <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {saveError}
              </p>
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

const AlbumSlugInput: React.FC<{
  suggestedSlug: string;
  creating: boolean;
  error: string | null;
  onCreate: (slug: string, pin: string) => void;
}> = ({ suggestedSlug, creating, error, onCreate }) => {
  const [slug, setSlug] = useState(suggestedSlug);
  const [pin, setPin] = useState("");

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-neutral-400 text-xs font-medium mb-1 uppercase tracking-wide">Slug album</label>
        <input
          className="w-full bg-neutral-800 text-white text-sm placeholder-neutral-600 border border-neutral-700 rounded-lg px-3 py-2 outline-none focus:border-neutral-500 font-mono"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
          placeholder="ex: 14februarie2026"
        />
      </div>
      <div>
        <label className="block text-neutral-400 text-xs font-medium mb-1 uppercase tracking-wide">PIN (opțional)</label>
        <input
          className="w-full bg-neutral-800 text-white text-sm placeholder-neutral-600 border border-neutral-700 rounded-lg px-3 py-2 outline-none focus:border-neutral-500 font-mono"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="ex: 1234"
          inputMode="numeric"
        />
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button
        onClick={() => onCreate(slug, pin)}
        disabled={creating || !slug}
        className="w-full py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-40"
      >
        {creating ? "Se creează..." : "Creează album"}
      </button>
    </div>
  );
};

const AlbumPinInput: React.FC<{
  currentPin: string;
  onSave: (pin: string) => void;
  onClose: () => void;
}> = ({ currentPin, onSave, onClose }) => {
  const [pin, setPin] = useState(currentPin);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await onSave(pin);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 800);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-neutral-400 text-xs font-medium mb-1 uppercase tracking-wide">PIN acces album</label>
        <input
          className="w-full bg-neutral-800 text-white text-sm placeholder-neutral-600 border border-neutral-700 rounded-lg px-3 py-2 outline-none focus:border-neutral-500 font-mono"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="Fără PIN"
          inputMode="numeric"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 py-2 rounded-lg border border-neutral-700 text-neutral-400 text-sm hover:text-white transition-colors"
        >
          Anulează
        </button>
        <button
          onClick={handleSave}
          className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
        >
          {saved ? "Salvat ✓" : "Salvează"}
        </button>
      </div>
    </div>
  );
};

export default EventCard;
