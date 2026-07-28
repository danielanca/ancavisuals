import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ConfirmModal from "../ConfirmModal";
import Breadcrumb from "../Breadcrumb";
import useAuth from "../../auth/useAuth";
import HandoverActionMenu from "./HandoverActionMenu";
import EditHandoverModal from "./EditHandoverModal";

interface HandoverItem {
  id: string;
  token: string;
  status: "draft" | "sent" | "signed" | "expired";
  eventType: string;
  eventDate: string;
  clientEmail: string;
  clientName?: string;
  digitalLinkUrl?: string;
  awb?: string;
  courierDeliveryDays?: number;
  materialsReportWindowDays?: number;
  digitalLinkExpiryDays?: number;
  createdAt: string;
  signedAt?: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "#888" },
  sent: { label: "Trimis", color: "#f59e0b" },
  signed: { label: "Semnat", color: "#22c55e" },
  expired: { label: "Expirat", color: "#ef4444" },
};

const HandoverListPage: React.FC = () => {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const [items, setItems] = useState<HandoverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [sending, setSending] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [reminding, setReminding] = useState<string | null>(null);

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
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast("Email de re-amintire trimis clientului.");
    } catch (e: unknown) {
      setActionError("Eroare la reminder: " + (e instanceof Error ? e.message : "necunoscută"));
    } finally {
      setReminding(null);
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

  const handleEditSave = async (updates: { awb: string; digitalLinkUrl: string }) => {
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
            <h1 className="text-white text-2xl font-light tracking-tight">Procese Verbale</h1>
            <p className="text-neutral-400 text-sm mt-1">{items.length} procese verbale totale</p>
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
              + Proces Verbal nou
            </button>
          </div>
        </div>

        {loading && <div className="text-center py-20 text-neutral-500 text-sm">Se încarcă...</div>}
        {error && <div className="text-center py-20 text-red-400 text-sm">Eroare: {error}</div>}

        {!loading && !error && items.length === 0 && (
          <div className="text-center py-20 text-neutral-500 text-sm">
            <p className="mb-4">Niciun proces verbal creat încă.</p>
            <button
              onClick={() => navigate("/admin/handover/new")}
              className="px-5 py-2 text-sm bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 hover:text-emerald-300 transition-colors"
            >
              Creează primul proces verbal
            </button>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="space-y-3">
            {items.map((item) => {
              const statusInfo = STATUS_LABELS[item.status] ?? STATUS_LABELS.draft;
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
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-neutral-400 text-xs">
                        <span>Data: {formatDate(item.eventDate)}</span>
                        <span>Client: {item.clientEmail}</span>
                        {item.clientName && <span>Semnat de: {item.clientName}</span>}
                        <span>Creat: {formatDate(item.createdAt)}</span>
                        {item.signedAt && <span>Semnat: {formatDate(item.signedAt)}</span>}
                        {item.awb && <span>AWB: {item.awb}</span>}
                      </div>
                    </div>

                    <HandoverActionMenu
                      handover={item}
                      sending={sending}
                      deleting={deleting}
                      resending={resending}
                      reminding={reminding}
                      onPreview={() => window.open(`/api/handover/${item.id}/preview`, "_blank")}
                      onSend={() => confirmAction("send", item.id, `${item.eventType} — ${item.clientEmail}`)}
                      onCopyLink={() => {
                        const url = `${window.location.origin}/proces-verbal/${item.token}`;
                        navigator.clipboard.writeText(url);
                        showToast("Link copiat în clipboard!");
                      }}
                      onDelete={() => confirmAction("delete", item.id, `${item.eventType} — ${item.clientEmail}`)}
                      onResend={() => handleResend(item.id)}
                      onReminder={() => handleReminder(item.id)}
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
            initialDigitalLinkUrl={editingItem.digitalLinkUrl}
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
