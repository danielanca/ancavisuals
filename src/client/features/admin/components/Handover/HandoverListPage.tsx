import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ConfirmModal from "../ConfirmModal";
import Breadcrumb from "../Breadcrumb";
import useAuth from "../../auth/useAuth";
import HandoverActionMenu from "./HandoverActionMenu";
import EditHandoverModal from "./EditHandoverModal";
import { getPublicAppOrigin } from "./publicOrigin";
import { openAuthedInNewTab } from "../../providers/authFetch";
import { whatsappUrl } from "../../whatsappUrl";
import { daysUntil, digitalLinksValidUntil } from "../../../../../shared/handoverDownload";
import { AUTO_SIGN_REMINDER_INTERVAL_DAYS, AUTO_SIGN_REMINDER_MAX, nextAutoSignReminderAt } from "../../../../../shared/handoverSignReminder";

interface HandoverItem {
  id: string;
  eventId?: string | null;
  token: string;
  status: "draft" | "sent" | "signed" | "expired";
  eventType: string;
  eventDate: string;
  clientEmail: string;
  clientName?: string;
  includeDigitalLink?: boolean;
  includeCourier?: boolean;
  includePersonalHandover?: boolean;
  digitalLinkUrl?: string;
  digitalLinks?: { label: string; url: string }[];
  awb?: string;
  courierDeliveryDays?: number;
  materialsReportWindowDays?: number;
  digitalLinkExpiryDays?: number;
  createdAt: string;
  signedAt?: string;
  downloadReminderSentAt?: string | null;
  downloadReminderCount?: number;
  sentAt?: string | null;
  signReminderSentAt?: string | null;
  signReminderCount?: number;
  signReminderChannels?: string[];
  autoSignReminder?: boolean;
  autoSignReminderCount?: number;
}

interface LinkedEvent {
  id: string;
  type: string;
  typeLabel?: string;
  eventDate?: string | null;
  handoverId?: string;
  client?: { fullName?: string; phone?: string; email?: string };
}

const DeliveryBadge: React.FC<{ label: string }> = ({ label }) => (
  <span className="text-[10px] px-1.5 py-0.5 rounded border border-neutral-700 text-neutral-400">{label}</span>
);

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "#888" },
  sent: { label: "Trimis", color: "#f59e0b" },
  signed: { label: "Semnat", color: "#22c55e" },
  expired: { label: "Expirat", color: "#ef4444" },
};

function handoverWhatsAppMessage(token: string): string {
  return `Salutare! Aici se află materialele: ${getPublicAppOrigin()}/proces-verbal/${token}`;
}

function channelsLabel(channels: string[]): string {
  return channels.map((c) => (c === "sms" ? "SMS" : c)).join(" + ");
}

// Signed handovers with a digital link are the only ones where "download your materials" makes sense
function canRemindDownload(item: HandoverItem): boolean {
  return item.status === "signed" && item.includeDigitalLink !== false;
}

const HandoverListPage: React.FC = () => {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const [items, setItems] = useState<HandoverItem[]>([]);
  const [events, setEvents] = useState<LinkedEvent[]>([]);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [sending, setSending] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [reminding, setReminding] = useState<string | null>(null);
  const [autoToggling, setAutoToggling] = useState<string | null>(null);

  type PendingAction = { type: "delete" | "send"; id: string; label: string } | null;
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [editingItem, setEditingItem] = useState<HandoverItem | null>(null);

  useEffect(() => {
    fetch("/api/handover")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setItems(data.items ?? []);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!auth.accessToken) return;
    let active = true;
    fetch("/api/admin/events", { headers: { Authorization: `Bearer ${auth.accessToken}` } })
      .then(async res => {
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error ?? "Nu s-au putut încărca evenimentele.");
        if (active) setEvents(data.events ?? []);
      })
      .catch((error: Error) => { if (active) setEventsError(error.message); });
    return () => { active = false; };
  }, [auth.accessToken]);

  const linkedEvent = (item: HandoverItem) => {
    if (item.eventId) return events.find(event => event.id === item.eventId);
    const matches = events.filter(event => event.handoverId === item.id);
    return matches.length === 1 ? matches[0] : undefined;
  };

  const associateEvent = async (item: HandoverItem) => {
    const eventId = selectedEvents[item.id];
    if (!eventId || linkingId) return;
    setLinkingId(item.id); setActionError(null);
    try {
      const res = await fetch(`/api/handover/${encodeURIComponent(item.id)}/event`, {
        method: "POST", headers: { Authorization: `Bearer ${auth.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Nu s-a putut asocia evenimentul.");
      setItems(prev => prev.map(protocol => protocol.id === item.id ? { ...protocol, eventId } : protocol));
      setEvents(prev => prev.map(event => event.id === eventId ? { ...event, handoverId: item.id } : event));
    } catch (error) { setActionError(error instanceof Error ? error.message : "Nu s-a putut asocia evenimentul."); }
    finally { setLinkingId(null); }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleSend = async (id: string) => {
    setSending(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/handover/${id}/send`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: "sent" as const } : it)));
      showToast("Link trimis clientului.");
    } catch (e: unknown) {
      setActionError("Eroare la trimitere: " + (e instanceof Error ? e.message : "necunoscută"));
    } finally {
      setSending(null);
    }
  };

  const handleResend = async (id: string) => {
    setResending(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/handover/${id}/resend`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast("PV retrimis pe email către tine și client.");
    } catch (e: unknown) {
      setActionError("Eroare la retrimitere: " + (e instanceof Error ? e.message : "necunoscută"));
    } finally {
      setResending(null);
    }
  };

  const handleReminder = async (id: string) => {
    setReminding(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/handover/${id}/reminder`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email: true, sms: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const channels = [data.emailed && "email", data.smsSent && "sms"].filter(Boolean) as string[];
      setItems((prev) => prev.map((it) => (it.id === id
        ? { ...it, signReminderSentAt: data.signReminderSentAt, signReminderCount: data.signReminderCount, signReminderChannels: channels }
        : it)));
      showToast(`Reminder trimis clientului pe ${channelsLabel(channels)}.`);
      if (data.smsError) setActionError(`Emailul a plecat, dar SMS-ul nu: ${data.smsError}`);
    } catch (e: unknown) {
      setActionError("Eroare la reminder: " + (e instanceof Error ? e.message : "necunoscută"));
    } finally {
      setReminding(null);
    }
  };

  const handleAutoReminderToggle = async (id: string, enabled: boolean) => {
    setAutoToggling(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/handover/${id}/auto-reminder`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${auth.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, autoSignReminder: enabled } : it)));
    } catch (e: unknown) {
      setActionError("Eroare la reminderul automat: " + (e instanceof Error ? e.message : "necunoscută"));
    } finally {
      setAutoToggling(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/handover/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setItems((prev) => prev.filter((it) => it.id !== id));
    } catch (e: unknown) {
      setActionError("Eroare: " + (e instanceof Error ? e.message : "necunoscută"));
    } finally {
      setDeleting(null);
    }
  };

  const handleEditSave = async (updates: { awb: string; digitalLinks: { label: string; url: string }[] }) => {
    if (!editingItem) return;
    const res = await fetch(`/api/handover/${editingItem.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Eroare la salvare");
    setItems((prev) => prev.map((it) => (it.id === editingItem.id ? { ...it, ...updates } : it)));
    setEditingItem(null);
    showToast("Proces verbal actualizat.");
  };

  const confirmAction = (type: "delete" | "send", id: string, label: string) => {
    setPendingAction({ type, id, label });
  };

  const executePendingAction = () => {
    if (!pendingAction) return;
    const { type, id } = pendingAction;
    setPendingAction(null);
    if (type === "delete") handleDelete(id);
    else if (type === "send") handleSend(id);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-4xl mx-auto">
        <Breadcrumb />

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-white text-2xl font-light tracking-tight">Predarea responsabilității</h1>
            <p className="text-neutral-400 text-sm mt-1">Procese verbale pentru predarea materialelor și preluarea responsabilității de către client · {items.length} în total</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate("/admin")}
              className="px-3 py-1.5 text-xs text-neutral-400 border border-neutral-800 rounded-lg hover:border-neutral-600 transition-colors"
            >
              ← Dashboard
            </button>
            <button
              onClick={() => navigate("/admin/handover/new")}
              className="px-4 py-1.5 text-xs text-white bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 hover:text-emerald-300 transition-colors font-medium"
            >
              + Document de predare nou
            </button>
          </div>
        </div>

        {loading && <div className="text-center py-20 text-neutral-500 text-sm">Se încarcă...</div>}
        {error && <div className="text-center py-20 text-red-400 text-sm">Eroare: {error}</div>}
        {eventsError && <p role="alert" className="mb-4 text-red-400 text-sm">{eventsError}</p>}

        {!loading && !error && items.length === 0 && (
          <div className="text-center py-20 text-neutral-500 text-sm">
            <p className="mb-4">Nu există încă niciun document de predare.</p>
            <button
              onClick={() => navigate("/admin/handover/new")}
              className="px-5 py-2 text-sm bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 hover:text-emerald-300 transition-colors"
            >
              Creează primul document de predare
            </button>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="space-y-3">
            {items.map((item) => {
              const statusInfo = STATUS_LABELS[item.status] ?? STATUS_LABELS.draft;
              const event = linkedEvent(item);
              const remindDownload = canRemindDownload(item);
              const validUntil = remindDownload ? digitalLinksValidUntil(item.signedAt, item.digitalLinkExpiryDays) : null;
              const daysLeft = validUntil ? daysUntil(validUntil) : null;
              const awaitingSignature = item.status === "sent";
              const reminderEmail = Boolean(item.clientEmail?.trim() || event?.client?.email?.trim());
              const reminderPhone = Boolean(event?.client?.phone?.trim());
              const reminderChannels = [reminderEmail && "email", reminderPhone && "sms"].filter(Boolean) as string[];
              const nextAutoReminder = awaitingSignature ? nextAutoSignReminderAt({
                sentAt: item.sentAt, lastReminderAt: item.signReminderSentAt, autoCount: item.autoSignReminderCount, enabled: item.autoSignReminder,
              }) : null;
              return (
                <div key={item.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-white font-medium text-sm">{item.eventType}</span>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ color: statusInfo.color, background: statusInfo.color + "22" }}
                        >
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {item.includeDigitalLink !== false && <DeliveryBadge label="Link digital" />}
                        {item.includeCourier !== false && <DeliveryBadge label="Curier" />}
                        {item.includePersonalHandover && <DeliveryBadge label="Predare personală" />}
                      </div>
                      <div className="mb-3 text-xs">
                        {event ? <>
                          <button type="button" onClick={() => navigate("/admin", { state: { scrollToEvent: event.id } })}
                            className="text-amber-200 hover:text-amber-100 underline underline-offset-4 text-left">
                            Eveniment: {event.client?.fullName || "Fără nume"} · {event.typeLabel || event.type} · {event.eventDate ? formatDate(event.eventDate) : "Fără dată"}
                          </button>
                          <p className={`mt-1 ${item.status === "signed" ? "text-emerald-400" : "text-neutral-500"}`}>
                            {item.status === "signed" ? "Clientul a semnat preluarea responsabilității" : "Așteaptă semnarea de către client"}
                          </p>
                        </> : item.eventId ? <p className="text-neutral-500">Eveniment asociat indisponibil</p> : <>
                          <p className="text-neutral-500 mb-2">Fără eveniment asociat</p>
                          <div className="flex gap-2 flex-wrap">
                            <select aria-label={`Eveniment pentru ${item.id}`} value={selectedEvents[item.id] ?? ""}
                              onChange={e => setSelectedEvents(prev => ({ ...prev, [item.id]: e.target.value }))}
                              className="min-w-0 max-w-full rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-200 p-2">
                              <option value="">Selectează evenimentul</option>
                              {events.filter(candidate => !candidate.handoverId || candidate.handoverId === item.id).map(candidate => <option key={candidate.id} value={candidate.id}>
                                {candidate.client?.fullName || "Fără nume"} · {candidate.typeLabel || candidate.type} · {candidate.eventDate ? formatDate(candidate.eventDate) : "Fără dată"}
                              </option>)}
                            </select>
                            <button type="button" disabled={!selectedEvents[item.id] || linkingId !== null} onClick={() => void associateEvent(item)}
                              className="rounded-lg border border-amber-200/30 px-3 py-2 text-amber-200 hover:bg-amber-200/10 disabled:opacity-50">
                              {linkingId === item.id ? "Se asociază…" : "Asociază eveniment"}
                            </button>
                          </div>
                        </>}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-neutral-400 text-xs">
                        <span>Data: {formatDate(item.eventDate)}</span>
                        {item.clientEmail && <span>Client: {item.clientEmail}</span>}
                        {item.clientName && <span>Semnat de: {item.clientName}</span>}
                        {event?.client?.phone && <span className="flex items-center gap-1.5">
                          Telefon: {event.client.phone}
                          {whatsappUrl(event.client.phone) && <a href={whatsappUrl(event.client.phone, handoverWhatsAppMessage(item.token))!} target="_blank" rel="noopener noreferrer"
                            className="px-2 py-0.5 rounded-md bg-green-700/60 hover:bg-green-600/70 text-white transition-colors">
                            WhatsApp
                          </a>}
                        </span>}
                        <span>Creat: {formatDate(item.createdAt)}</span>
                        {item.signedAt && <span>Semnat: {formatDate(item.signedAt)}</span>}
                        {item.awb && <span>AWB: {item.awb}</span>}
                      </div>
                      {awaitingSignature && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-3 text-xs">
                          <button type="button" disabled={reminderChannels.length === 0 || reminding !== null}
                            onClick={() => void handleReminder(item.id)}
                            className="px-3 py-1.5 rounded-lg border border-sky-500/40 text-sky-300 hover:bg-sky-500/10 disabled:opacity-40 transition-colors">
                            {reminding === item.id ? "Se trimite…"
                              : reminderChannels.length === 0 ? "⏰ Reminder (fără email / telefon)"
                              : `${item.signReminderSentAt ? "🔁 Trimite din nou reminder" : "⏰ Trimite reminder"} (${channelsLabel(reminderChannels)})`}
                          </button>
                          {item.signReminderSentAt && (
                            <span className="text-sky-400">
                              Ultimul reminder: {formatDate(item.signReminderSentAt)}
                              {(item.signReminderCount ?? 0) > 1 && ` · ${item.signReminderCount}×`}
                              {(item.signReminderChannels?.length ?? 0) > 0 && ` · ${channelsLabel(item.signReminderChannels!)}`}
                            </span>
                          )}
                          <span className={item.autoSignReminder === false ? "text-neutral-600" : "text-neutral-400"}>
                            🤖 {item.autoSignReminder === false ? "Reminder automat oprit"
                              : nextAutoReminder ? `Automat la ${AUTO_SIGN_REMINDER_INTERVAL_DAYS} zile (max ${AUTO_SIGN_REMINDER_MAX}) · următorul: ${formatDate(nextAutoReminder.toISOString())}`
                              : `Cele ${AUTO_SIGN_REMINDER_MAX} remindere automate au fost trimise`}
                            {" · "}
                            <button type="button" disabled={autoToggling === item.id} onClick={() => void handleAutoReminderToggle(item.id, item.autoSignReminder === false)}
                              className="underline underline-offset-2 hover:text-white disabled:opacity-50">
                              {item.autoSignReminder === false ? "Pornește" : "Oprește"}
                            </button>
                          </span>
                        </div>
                      )}
                      {remindDownload && (validUntil || item.downloadReminderSentAt) && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs">
                          {validUntil && daysLeft !== null && (
                            <span className={daysLeft <= 0 ? "text-red-400" : daysLeft <= 3 ? "text-amber-400" : "text-neutral-400"}>
                              Link-uri valabile până: {formatDate(validUntil.toISOString())}
                              {daysLeft <= 0 ? " · expirate" : ` · ${daysLeft === 1 ? "o zi rămasă" : `${daysLeft} zile rămase`}`}
                            </span>
                          )}
                          {item.downloadReminderSentAt && (
                            <span className="text-sky-400">
                              Reminder descărcare trimis: {formatDate(item.downloadReminderSentAt)}
                              {(item.downloadReminderCount ?? 0) > 1 && ` · ${item.downloadReminderCount}×`}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <HandoverActionMenu
                      handover={item}
                      sending={sending}
                      deleting={deleting}
                      resending={resending}
                      onPreview={() => { void openAuthedInNewTab(`/api/handover/${item.id}/preview`).catch(() => {}); }}
                      onSend={() => confirmAction("send", item.id, `${item.eventType} — ${item.clientEmail || item.clientName || "client"}`)}
                      onCopyLink={() => {
                        const url = `${getPublicAppOrigin()}/proces-verbal/${item.token}`;
                        navigator.clipboard.writeText(url);
                        showToast("Link copiat în clipboard!");
                      }}
                      onDelete={() => confirmAction("delete", item.id, `${item.eventType} — ${item.clientEmail || item.clientName || "client"}`)}
                      onResend={() => handleResend(item.id)}
                      onEdit={() => setEditingItem(item)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {actionError && (
          <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2.5 text-red-400 text-sm">
            {actionError}
          </div>
        )}

        {toast && (
          <div className="fixed bottom-6 right-6 bg-neutral-900 border border-emerald-500/30 text-emerald-400 text-sm px-4 py-2.5 rounded-lg shadow-xl">
            {toast}
          </div>
        )}

        {editingItem && (
          <EditHandoverModal
            initialAwb={editingItem.awb}
            initialDigitalLinks={editingItem.digitalLinks}
            onSave={handleEditSave}
            onCancel={() => setEditingItem(null)}
          />
        )}

        {pendingAction && (
          <ConfirmModal
            title={pendingAction.type === "delete" ? "Șterge proces verbal" : "Trimite link semnare"}
            message={
              pendingAction.type === "delete"
                ? `Ștergi definitiv procesul verbal pentru ${pendingAction.label}?`
                : `Trimiți link-ul de semnare pentru ${pendingAction.label}?`
            }
            variant={pendingAction.type === "delete" ? "danger" : "default"}
            onConfirm={executePendingAction}
            onCancel={() => setPendingAction(null)}
          />
        )}
      </div>
    </div>
  );
};

export default HandoverListPage;
