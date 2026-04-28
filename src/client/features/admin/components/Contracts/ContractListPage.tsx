import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ConfirmModal from "../ConfirmModal";
import ContractActionMenu from "./ContractActionMenu";
import Breadcrumb from "../Breadcrumb";

interface ContractItem {
  id: string;
  token: string;
  status: "draft" | "sent" | "signed" | "expired" | "anulat";
  eventType: string;
  eventDate: string;
  clientEmail: string;
  clientName?: string;
  priceTotal: number;
  currency?: string;
  createdAt: string;
  signedAt?: string;
  prestatorSignatureBase64?: string;
  eventId?: string;
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
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [creatingEvent, setCreatingEvent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  type PendingAction = { type: "delete" | "cancel" | "send"; id: string; contractLabel: string } | null;
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

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
          next.add(normalizeDate(contract.eventDate));
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
              const isDateBooked = bookedDates.has(normalizeDate(contract.eventDate));
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
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-neutral-400 text-xs">
                        <span>Data: {formatDate(contract.eventDate)}</span>
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

export default ContractListPage;
