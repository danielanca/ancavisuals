import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ConfirmModal from "../ConfirmModal";
import ContractActionMenu from "./ContractActionMenu";
import Breadcrumb from "../Breadcrumb";
import useAuth from "../../auth/useAuth";

interface ContractItem {
  id: string;
  token: string;
  status: "draft" | "sent" | "signed" | "expired" | "anulat";
  eventType: string;
  eventDate: string;
  eventDates?: string[];
  clientEmail: string;
  clientName?: string;
  clientAddress?: string;
  clientCity?: string;
  clientCounty?: string;
  clientCIF?: string;
  priceTotal: number;
  priceAdvance?: number;
  priceRest?: number;
  currency?: string;
  eurRate?: number;
  createdAt: string;
  signedAt?: string;
  prestatorSignatureBase64?: string;
  eventId?: string;
  fiscalized?: boolean;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "#888" },
  sent: { label: "Trimis", color: "#f59e0b" },
  signed: { label: "Semnat", color: "#22c55e" },
  expired: { label: "Expirat", color: "#ef4444" },
  anulat: { label: "Anulat", color: "#6b7280" },
};

const ContractListPage: React.FC = () => {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [reminding, setReminding] = useState<string | null>(null);
  const [creatingEvent, setCreatingEvent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  type PendingAction = { type: "delete" | "cancel" | "send"; id: string; contractLabel: string } | null;
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [invoiceModal, setInvoiceModal] = useState<ContractItem | null>(null);

  // Provider signature modal
  const [signingId, setSigningId] = useState<string | null>(null);
  const [sigSaving, setSigSaving] = useState(false);
  const [sigError, setSigError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const hasSignature = useRef(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/contracts").then((r) => r.json()),
      fetch("/api/admin/booked-dates").then((r) => r.json()),
    ])
      .then(([contractsData, bookedDatesData]) => {
        if (contractsData.error) throw new Error(contractsData.error);
        if (bookedDatesData.error) throw new Error(bookedDatesData.error);
        setContracts(contractsData.contracts ?? []);
        setBookedDates(new Set((bookedDatesData.dates ?? []).map((item: { date: string }) => item.date)));
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Initialize canvas when the modal opens
  useEffect(() => {
    if (!signingId) return;
    // Small delay to ensure the DOM is mounted
    const t = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      hasSignature.current = false;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const getPos = (e: MouseEvent | Touch, rect: DOMRect) => ({
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height),
      });

      const onDown = (e: MouseEvent) => {
        isDrawing.current = true;
        lastPos.current = getPos(e, canvas.getBoundingClientRect());
      };
      const onMove = (e: MouseEvent) => {
        if (!isDrawing.current) return;
        const pos = getPos(e, canvas.getBoundingClientRect());
        ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(pos.x, pos.y); ctx.stroke();
        lastPos.current = pos; hasSignature.current = true;
      };
      const onUp = () => { isDrawing.current = false; };

      const onTouchStart = (e: TouchEvent) => {
        e.preventDefault(); isDrawing.current = true;
        lastPos.current = getPos(e.touches[0], canvas.getBoundingClientRect());
      };
      const onTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        if (!isDrawing.current) return;
        const pos = getPos(e.touches[0], canvas.getBoundingClientRect());
        ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(pos.x, pos.y); ctx.stroke();
        lastPos.current = pos; hasSignature.current = true;
      };
      const onTouchEnd = () => { isDrawing.current = false; };

      canvas.addEventListener("mousedown", onDown);
      canvas.addEventListener("mousemove", onMove);
      canvas.addEventListener("mouseup", onUp);
      canvas.addEventListener("mouseleave", onUp);
      canvas.addEventListener("touchstart", onTouchStart, { passive: false });
      canvas.addEventListener("touchmove", onTouchMove, { passive: false });
      canvas.addEventListener("touchend", onTouchEnd);
    }, 50);

    return () => clearTimeout(t);
  }, [signingId]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    hasSignature.current = false;
  };

  const handleSaveSig = async () => {
    if (!hasSignature.current) { setSigError("Semnează mai întâi."); return; }
    const canvas = canvasRef.current;
    if (!canvas || !signingId) return;
    setSigSaving(true);
    setSigError(null);
    try {
      const res = await fetch(`/api/contracts/${signingId}/prestator-sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prestatorSignatureBase64: canvas.toDataURL("image/png") }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setContracts((prev) =>
        prev.map((c) => c.id === signingId
          ? { ...c, prestatorSignatureBase64: canvas.toDataURL("image/png") }
          : c
        )
      );
      setSigningId(null);
    } catch (e: unknown) {
      setSigError(e instanceof Error ? e.message : "Eroare necunoscută");
    } finally {
      setSigSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/contracts/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setContracts((prev) => prev.filter((c) => c.id !== id));
    } catch (e: unknown) {
      setActionError("Eroare: " + (e instanceof Error ? e.message : "necunoscută"));
    } finally {
      setDeleting(null);
    }
  };

  const handleCancel = async (id: string) => {
    setCancelling(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/contracts/${id}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setContracts((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: "anulat" as const } : c))
      );
    } catch (e: unknown) {
      setActionError("Eroare: " + (e instanceof Error ? e.message : "necunoscută"));
    } finally {
      setCancelling(null);
    }
  };

  const handleResetSignature = async (id: string) => {
    setActionError(null);
    try {
      const res = await fetch(`/api/contracts/${id}/reset-signature`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setContracts((prev) =>
        prev.map((c) => c.id === id ? { ...c, status: "sent" as const, prestatorSignatureBase64: undefined } : c)
      );
      showToast("Semnătură ștearsă — contractul e din nou activ.");
    } catch (e: unknown) {
      setActionError("Eroare: " + (e instanceof Error ? e.message : "necunoscută"));
    }
  };

  const handleSend = async (id: string) => {
    setSending(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/contracts/${id}/send`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setContracts((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: "sent" as const } : c))
      );
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
      const res = await fetch(`/api/contracts/${id}/resend`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast("Contract retrimis pe email către tine și client.");
    } catch (e: unknown) {
      setActionError("Eroare la retrimitre: " + (e instanceof Error ? e.message : "necunoscută"));
    } finally {
      setResending(null);
    }
  };

  const handleReminder = async (id: string) => {
    setReminding(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/contracts/${id}/reminder`, {
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

  const handleCreateEvent = async (id: string) => {
    setCreatingEvent(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/contracts/${id}/create-event`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Eroare necunoscută");
      const contract = contracts.find((item) => item.id === id);
      setContracts((prev) =>
        prev.map((contract) =>
          contract.id === id ? { ...contract, eventId: data.eventId } : contract
        )
      );
      if (contract?.eventDate) {
        setBookedDates((prev) => {
          const next = new Set(prev);
          (contract.eventDates?.length ? contract.eventDates : [contract.eventDate]).forEach((date) => next.add(normalizeDate(date)));
          return next;
        });
      }
      showToast("Eveniment generat din contract.");
    } catch (e: unknown) {
      setActionError("Eroare la generarea evenimentului: " + (e instanceof Error ? e.message : "necunoscută"));
    } finally {
      setCreatingEvent(null);
    }
  };

  const handleToggleFiscalized = async (id: string, current: boolean) => {
    try {
      await fetch(`/api/contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({ fiscalized: !current }),
      });
      setContracts((prev) => prev.map((c) => c.id === id ? { ...c, fiscalized: !current } : c));
      showToast(!current ? "Marcat ca fiscalizat." : "Marcat ca nefiscalizat.");
    } catch {
      setActionError("Eroare la actualizare status fiscal.");
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const confirmAction = (type: "delete" | "cancel" | "send", id: string, contractLabel: string) => {
    setPendingAction({ type, id, contractLabel });
  };

  const executePendingAction = () => {
    if (!pendingAction) return;
    const { type, id } = pendingAction;
    setPendingAction(null);
    if (type === "delete") handleDelete(id);
    else if (type === "cancel") handleCancel(id);
    else if (type === "send") handleSend(id);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric" });
  };

  const normalizeDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr.slice(0, 10);
    return d.toISOString().slice(0, 10);
  };

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-4xl mx-auto">
        <Breadcrumb />

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-white text-2xl font-light tracking-tight">Contracte</h1>
            <p className="text-neutral-400 text-sm mt-1">{contracts.length} contracte totale</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate("/admin")}
              className="px-3 py-1.5 text-xs text-neutral-400 border border-neutral-800 rounded-lg hover:border-neutral-600 transition-colors"
            >
              ← Dashboard
            </button>
            <button
              onClick={() => navigate("/admin/contracts/templates")}
              className="px-3 py-1.5 text-xs text-neutral-400 border border-neutral-800 rounded-lg hover:border-neutral-600 transition-colors"
            >
              Șabloane
            </button>
            <button
              onClick={() => navigate("/admin/contracts/create")}
              className="px-4 py-1.5 text-xs text-white bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 hover:text-emerald-300 transition-colors font-medium"
            >
              + Contract nou
            </button>
          </div>
        </div>

        {loading && (
          <div className="text-center py-20 text-neutral-500 text-sm">Se încarcă...</div>
        )}

        {error && (
          <div className="text-center py-20 text-red-400 text-sm">Eroare: {error}</div>
        )}

        {!loading && !error && contracts.length === 0 && (
          <div className="text-center py-20 text-neutral-500 text-sm">
            <p className="mb-4">Niciun contract creat încă.</p>
            <button
              onClick={() => navigate("/admin/contracts/create")}
              className="px-5 py-2 text-sm bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 hover:text-emerald-300 transition-colors"
            >
              Creează primul contract
            </button>
          </div>
        )}

        {!loading && contracts.length > 0 && (
          <div className="space-y-3">
            {contracts.map((contract) => {
              const statusInfo = STATUS_LABELS[contract.status] ?? STATUS_LABELS.draft;
              const isSigned = !!contract.prestatorSignatureBase64;
              const contractDates = contract.eventDates?.length ? contract.eventDates : [contract.eventDate];
              const isDateBooked = contractDates.some((date) => bookedDates.has(normalizeDate(date)));
              const canCreateEvent = !contract.eventId && !isDateBooked;
              return (
                <div
                  key={contract.id}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-white font-medium text-sm">
                          {contract.eventType}
                        </span>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{
                            color: statusInfo.color,
                            background: statusInfo.color + "22",
                          }}
                        >
                          {statusInfo.label}
                        </span>
                        {isSigned && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium text-blue-400 bg-blue-400/10">
                            Semnat de tine
                          </span>
                        )}
                        <button
                          onClick={() => handleToggleFiscalized(contract.id, contract.fiscalized ?? false)}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                            contract.fiscalized
                              ? "text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20"
                              : "text-neutral-500 bg-neutral-800 hover:bg-neutral-700"
                          }`}
                        >
                          {contract.fiscalized ? "✓ Fiscalizat" : "Nefiscalizat"}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-neutral-400 text-xs">
                        <span>{contractDates.length > 1 ? "Perioadă" : "Data"}: {contractDates.map(formatDate).join(", ")}</span>
                        <span>Client: {contract.clientEmail}</span>
                        {contract.clientName && <span>Semnat de: {contract.clientName}</span>}
                        <span>Preț: {contract.priceTotal} {contract.currency ?? "RON"}</span>
                        <span>Creat: {formatDate(contract.createdAt)}</span>
                        {contract.signedAt && <span>Semnat: {formatDate(contract.signedAt)}</span>}
                        {contract.eventId && (
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate("/admin", { state: { scrollToEvent: contract.eventId } }); }}
                            className="text-violet-400 hover:text-violet-300 transition-colors"
                          >
                            → eveniment
                          </button>
                        )}
                        {!contract.eventId && isDateBooked && (
                          <span className="text-amber-400">
                            Data ocupată
                          </span>
                        )}
                      </div>
                    </div>

                    <ContractActionMenu
                      contract={contract}
                      canCreateEvent={canCreateEvent}
                      isSigned={isSigned}
                      sending={sending}
                      cancelling={cancelling}
                      deleting={deleting}
                      resending={resending}
                      reminding={reminding}
                      onEdit={() => navigate(`/admin/contracts/${contract.id}/edit`)}
                      onSign={() => { setSigError(null); setSigningId(contract.id); }}
                      onPreview={() => window.open(`/api/contracts/${contract.id}/preview`, "_blank")}
                      onCreateEvent={() => handleCreateEvent(contract.id)}
                      onSend={() => confirmAction("send", contract.id, `${contract.eventType} — ${contract.clientEmail}`)}
                      onCopyLink={() => {
                        const url = `${window.location.origin}/contract/${contract.token}`;
                        navigator.clipboard.writeText(url);
                        showToast("Link copiat în clipboard!");
                      }}
                      onCancel={() => confirmAction("cancel", contract.id, `${contract.eventType} — ${contract.clientEmail}`)}
                      onDelete={() => confirmAction("delete", contract.id, `${contract.eventType} — ${contract.clientEmail}`)}
                      onResetSignature={() => handleResetSignature(contract.id)}
                      onResend={() => handleResend(contract.id)}
                      onReminder={() => handleReminder(contract.id)}
                      onGenerateInvoice={() => setInvoiceModal(contract)}
                    />
                  </div>
                  {creatingEvent === contract.id && (
                    <p className="mt-3 text-xs text-violet-400">Se generează evenimentul...</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* INVOICE MODAL */}
      {invoiceModal && (
        <InvoiceModal
          contract={invoiceModal}
          accessToken={auth.accessToken}
          onClose={() => setInvoiceModal(null)}
          onNavigateToFinancial={() => navigate("/admin/financial")}
        />
      )}

      {/* PROVIDER SIGNATURE MODAL */}
      {signingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-white text-base font-semibold mb-1">Semnătura ta</h2>
            <p className="text-neutral-400 text-xs mb-4">
              Semnează mai jos. Semnătura va apărea în PDF-ul contractului.
            </p>
            <canvas
              ref={canvasRef}
              width={600}
              height={180}
              className="w-full rounded-lg border border-neutral-700 bg-white cursor-crosshair touch-none block"
              style={{ height: 180 }}
            />
            {sigError && <p className="text-red-400 text-xs mt-2">{sigError}</p>}
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={clearCanvas}
                className="px-3 py-1.5 text-xs border border-neutral-700 text-neutral-400 rounded-lg hover:border-neutral-500 transition-colors"
              >
                Șterge
              </button>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => setSigningId(null)}
                className="px-4 py-1.5 text-xs text-neutral-400 border border-neutral-700 rounded-lg hover:border-neutral-500 transition-colors"
              >
                Anulează
              </button>
              <button
                type="button"
                onClick={handleSaveSig}
                disabled={sigSaving}
                className="px-4 py-1.5 text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-50 font-medium"
              >
                {sigSaving ? "Se salvează..." : "Salvează semnătura"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingAction && (
        <ConfirmModal
          title={
            pendingAction.type === "delete" ? "Șterge contract" :
            pendingAction.type === "cancel" ? "Anulează contract" :
            "Trimite link semnare"
          }
          message={
            pendingAction.type === "delete"
              ? `Ștergi definitiv contractul pentru ${pendingAction.contractLabel}? Acțiunea nu poate fi anulată.`
              : pendingAction.type === "cancel"
              ? `Anulezi contractul pentru ${pendingAction.contractLabel}? Clientul nu va mai putea semna.`
              : `Trimiți link-ul de semnare pe email la ${pendingAction.contractLabel}?`
          }
          confirmLabel={
            pendingAction.type === "delete" ? "Șterge definitiv" :
            pendingAction.type === "cancel" ? "Anulează contractul" :
            "Trimite"
          }
          variant={pendingAction.type === "send" ? "default" : "danger"}
          onConfirm={executePendingAction}
          onCancel={() => setPendingAction(null)}
        />
      )}

      {actionError && (
        <div className="fixed bottom-4 right-4 z-50 bg-red-500/20 border border-red-500/40 text-red-400 text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-3">
          {actionError}
          <button onClick={() => setActionError(null)} className="text-red-300 hover:text-white">✕</button>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 bg-neutral-800 border border-neutral-700 text-neutral-200 text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 shrink-0">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {toast}
        </div>
      )}

    </div>
  );
};

// ── Invoice Modal ──────────────────────────────────────────────────────────

interface ContractForInvoice {
  id: string;
  eventType: string;
  eventDate: string;
  clientName?: string;
  clientAddress?: string;
  clientCity?: string;
  clientCounty?: string;
  clientCIF?: string;
  clientType?: "PF" | "PJ";
  priceTotal: number;
  priceAdvance?: number;
  priceRest?: number;
  currency?: string;
  eurRate?: number;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function dueDateISO(from?: string) {
  const d = from ? new Date(from) : new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

function defaultDescription(contract: ContractForInvoice) {
  const d = new Date(contract.eventDate);
  const dateStr = isNaN(d.getTime()) ? contract.eventDate : d.toLocaleDateString("ro-RO", { day: "2-digit", month: "long", year: "numeric" });
  return `Servicii foto-video ${contract.eventType} — ${dateStr}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function InvoiceModal({ contract, accessToken, onClose, onNavigateToFinancial }: {
  contract: ContractForInvoice;
  accessToken: string;
  onClose: () => void;
  onNavigateToFinancial: () => void;
}) {
  const [currency, setCurrency] = React.useState<"RON" | "EUR">(
    contract.currency === "EUR" ? "EUR" : "RON",
  );
  const priceAdvance = contract.priceAdvance ?? 0;
  const priceRest = contract.priceRest ?? (contract.priceTotal - priceAdvance);

  const [invoiceDate, setInvoiceDate] = React.useState(todayISO);
  const [dueDate, setDueDate] = React.useState(() => dueDateISO(todayISO()));
  const [amountType, setAmountType] = React.useState<"total" | "advance" | "rest">("total");
  const [invoiceAmount, setInvoiceAmount] = React.useState(String(contract.priceTotal));
  const [description, setDescription] = React.useState(() => defaultDescription(contract));
  const [buyerName, setBuyerName] = React.useState(contract.clientName ?? "");
  const [buyerAddress, setBuyerAddress] = React.useState(contract.clientAddress ?? "");
  const [buyerCity, setBuyerCity] = React.useState(contract.clientCity ?? "");
  const [buyerCounty, setBuyerCounty] = React.useState(contract.clientCounty ?? "");
  const [buyerCIF, setBuyerCIF] = React.useState(contract.clientCIF ?? "");
  const [exchangeRate, setExchangeRate] = React.useState(() => contract.eurRate ? String(contract.eurRate) : "");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [savedId, setSavedId] = React.useState<string | null>(null);
  const [savedRef, setSavedRef] = React.useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = React.useState(false);
  const [downloadingXml, setDownloadingXml] = React.useState(false);

  const downloadFile = async (url: string, filename: string, mimeType: string, setLoading: (v: boolean) => void) => {
    setLoading(true);
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw new Error("Eroare server");
      const blob = await res.blob();
      downloadBlob(new Blob([blob], { type: mimeType }), filename);
    } catch (e) {
      alert("Nu s-a putut descărca fișierul: " + (e instanceof Error ? e.message : "eroare"));
    } finally {
      setLoading(false);
    }
  };

  const displayAmount =
    amountType === "advance" ? priceAdvance :
    amountType === "rest" ? priceRest :
    contract.priceTotal;

  React.useEffect(() => {
    setInvoiceAmount(String(displayAmount));
  }, [displayAmount]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          date: invoiceDate,
          dueDate,
          type: buyerCIF ? "B2B" : "B2C",
          clientName: buyerName.trim(),
          clientAddress: buyerAddress.trim(),
          clientCity: buyerCity.trim(),
          clientCounty: buyerCounty.trim(),
          clientCIF: buyerCIF || undefined,
          taxExchangeRate: exchangeRate ? parseFloat(exchangeRate) : undefined,
          items: [{ description, quantity: 1, unitPrice: Number(invoiceAmount), total: Number(invoiceAmount) }],
          totalAmount: Number(invoiceAmount),
          currency,
          notes: `Contract ${contract.eventType} — ${contract.eventDate?.slice(0, 10) ?? ""}`,
          eventId: contract.id,
          eventDate: contract.eventDate?.slice(0, 10) || undefined,
        }),
      });
      const data = await res.json() as { id?: string; invoiceNumber?: number; series?: string; invoiceRef?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Eroare server.");
      setSavedId(data.id!);
      setSavedRef(data.invoiceRef ?? `${data.series}-${String(data.invoiceNumber).padStart(4, "0")}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare necunoscută.");
    } finally {
      setSaving(false);
    }
  };

  const inp = "w-full bg-neutral-950 text-white text-sm placeholder-neutral-600 border border-neutral-800 rounded-lg px-3 py-2 outline-none focus:border-neutral-500 transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4" onClick={onClose}>
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white text-base font-semibold">🧾 Generează factură</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors text-lg">✕</button>
        </div>

        <div className="text-xs text-neutral-500 mb-4">
          {contract.eventType} · {contract.clientName ?? "—"} · Contract: {contract.priceTotal} {contract.currency ?? "RON"}
        </div>

        {!savedId ? (
          <>
            <div className="space-y-3">
              <div>
                <label className="block text-neutral-400 text-xs font-medium mb-1 uppercase tracking-wide">Data facturii</label>
                <input type="date" className={inp} value={invoiceDate} onChange={(e) => { setInvoiceDate(e.target.value); setDueDate(dueDateISO(e.target.value)); }} />
                <p className="text-neutral-600 text-[10px] mt-1">Pune data când ai primit banii, nu neapărat azi.</p>
              </div>

              <div>
                <label className="block text-neutral-400 text-xs font-medium mb-1 uppercase tracking-wide">Scadență</label>
                <input type="date" className={inp} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                <p className="text-neutral-600 text-[10px] mt-1">Implicit +30 zile față de data facturii.</p>
              </div>

              <div className="pt-1">
                <p className="text-neutral-300 text-xs font-medium uppercase tracking-wide mb-2">Date cumpărător</p>
                <div className="space-y-2">
                  <input className={inp} value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Nume complet / denumire firmă" />
                  <input className={inp} value={buyerAddress} onChange={(e) => setBuyerAddress(e.target.value)} placeholder="Adresă (stradă, număr)" />
                  <div className="grid grid-cols-2 gap-2">
                    <input className={inp} value={buyerCity} onChange={(e) => setBuyerCity(e.target.value)} placeholder="Oraș" />
                    <input className={inp} value={buyerCounty} onChange={(e) => setBuyerCounty(e.target.value)} placeholder="Județ" />
                  </div>
                </div>
                <p className="text-neutral-600 text-[10px] mt-1">Adresa, orașul și județul sunt obligatorii pentru factură/e-Factura.</p>
              </div>

              <div>
                <label className="block text-neutral-400 text-xs font-medium mb-2 uppercase tracking-wide">Sumă facturată</label>
                <label className="flex items-center gap-2 mb-2 text-sm text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currency === "RON"}
                    onChange={(e) => setCurrency(e.target.checked ? "RON" : (contract.currency === "EUR" ? "EUR" : "RON"))}
                    className="h-4 w-4 accent-amber-500"
                  />
                  Generează factura în RON
                </label>
                <div className="flex gap-2">
                  {([
                    ["total", `Total — ${contract.priceTotal} ${contract.currency ?? "RON"}`],
                    ["advance", `Avans — ${priceAdvance} ${contract.currency ?? "RON"}`],
                    ["rest", `Rest — ${priceRest} ${contract.currency ?? "RON"}`],
                  ] as const).map(([val, label]) => (
                    <button key={val} onClick={() => setAmountType(val)}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors ${
                        amountType === val
                          ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                          : "text-neutral-400 border-neutral-800 hover:border-neutral-600"
                      }`}
                    >{label}</button>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input className={`${inp} flex-1`} type="number" min="0.01" step="0.01" value={invoiceAmount}
                    onChange={(e) => setInvoiceAmount(e.target.value)} aria-label={`Sumă în ${currency}`} />
                  <span className="text-sm text-neutral-400">{currency}</span>
                </div>
                <p className="text-neutral-600 text-[10px] mt-1">Introdu suma încasată efectiv, în moneda selectată. Suma nu se convertește automat.</p>
              </div>

              <div>
                <label className="block text-neutral-400 text-xs font-medium mb-1 uppercase tracking-wide">Descriere</label>
                <input className={inp} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>

              <div>
                <label className="block text-neutral-400 text-xs font-medium mb-1 uppercase tracking-wide">CIF cumpărător (opțional — doar B2B)</label>
                <input className={inp} value={buyerCIF} onChange={(e) => setBuyerCIF(e.target.value)} placeholder="Lasă gol pentru B2C (persoană fizică)" />
              </div>

              {currency !== "RON" && (
                <div>
                  <label className="block text-neutral-400 text-xs font-medium mb-1 uppercase tracking-wide">Curs BNR {currency}/RON <span className="text-amber-500">*</span></label>
                  <input className={inp} value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} placeholder="ex: 4.9700" type="number" step="0.0001" min="0" />
                  <p className="text-neutral-600 text-[10px] mt-1">Necesar pentru e-Factura CIUS-RO când moneda nu e RON. Verifică cursul BNR de la data facturii.</p>
                </div>
              )}
            </div>

            {error && <p className="mt-3 text-red-400 text-xs">{error}</p>}

            <button onClick={handleSave} disabled={saving || !Number.isFinite(Number(invoiceAmount)) || Number(invoiceAmount) <= 0}
              className="mt-5 w-full py-2.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 text-sm font-medium hover:bg-amber-500/30 transition-colors disabled:opacity-50"
            >
              {saving ? "Se salvează..." : `Creează factura — ${invoiceAmount || "0"} ${currency}`}
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-center">
              <p className="text-emerald-400 text-sm font-semibold">{savedRef}</p>
              <p className="text-neutral-400 text-xs mt-1">Factura a fost salvată în sistem</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => downloadFile(`/api/admin/invoices/${savedId}/pdf`, `${savedRef}.pdf`, "application/pdf", setDownloadingPdf)}
                disabled={downloadingPdf}
                className="py-2.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/25 text-sm font-medium hover:bg-red-500/25 transition-colors disabled:opacity-50"
              >
                {downloadingPdf ? "..." : "📄 PDF"}
              </button>
              <button
                onClick={() => downloadFile(`/api/admin/invoices/${savedId}/xml`, `${savedRef}.xml`, "application/xml", setDownloadingXml)}
                disabled={downloadingXml}
                className="py-2.5 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/25 text-sm font-medium hover:bg-blue-500/25 transition-colors disabled:opacity-50"
              >
                {downloadingXml ? "..." : "📦 XML e-Factura"}
              </button>
            </div>

            <button
              onClick={() => { onClose(); onNavigateToFinancial(); }}
              className="w-full py-2 text-xs text-neutral-400 hover:text-white border border-neutral-800 rounded-lg hover:border-neutral-600 transition-colors"
            >
              → Vezi toate facturile în Rezumat financiar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ContractListPage;
