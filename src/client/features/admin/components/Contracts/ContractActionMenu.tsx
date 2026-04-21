import React, { useEffect, useRef, useState } from "react";

interface ContractItem {
  id: string;
  status: "draft" | "sent" | "signed" | "expired" | "anulat";
  eventId?: string;
}

interface Props {
  contract: ContractItem;
  canCreateEvent: boolean;
  isSigned: boolean;
  sending: string | null;
  cancelling: string | null;
  deleting: string | null;
  onEdit: () => void;
  onSign: () => void;
  onPreview: () => void;
  onCreateEvent: () => void;
  onSend: () => void;
  onCopyLink: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onResetSignature: () => void;
}

const ContractActionMenu: React.FC<Props> = ({
  contract, canCreateEvent, isSigned, sending, cancelling, deleting,
  onEdit, onSign, onPreview, onCreateEvent, onSend, onCopyLink, onCancel, onDelete, onResetSignature,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const canSend = contract.status === "draft" || contract.status === "sent";
  const canEdit = contract.status !== "signed";
  const canSign = contract.status === "draft" && !isSigned;

  const Item: React.FC<{
    label: string;
    onClick: () => void;
    color?: string;
    disabled?: boolean;
    loading?: boolean;
  }> = ({ label, onClick, color = "text-neutral-200", disabled, loading }) => (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={() => { setOpen(false); onClick(); }}
      className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-neutral-800 disabled:opacity-40 ${color}`}
    >
      {loading ? "..." : label}
    </button>
  );

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white transition-colors text-lg leading-none"
        aria-label="Acțiuni"
      >
        ⋮
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-48 bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl overflow-hidden">
          {canEdit && (
            <Item label="✏️  Editează" onClick={onEdit} color="text-amber-400" />
          )}
          {canSign && (
            <Item label="🖊️  Semnează tu" onClick={onSign} color="text-blue-400" />
          )}
          <Item label="👁  Preview PDF" onClick={onPreview} color="text-purple-400" />
          {canCreateEvent && (
            <Item label="📅  Generează eveniment" onClick={onCreateEvent} color="text-violet-400" />
          )}
          {canSend && (
            <Item
              label={contract.status === "sent" ? "📤  Retrimite link" : "📤  Trimite link"}
              onClick={onSend}
              color="text-emerald-400"
              loading={sending === contract.id}
            />
          )}
          <Item label="🔗  Copiază link" onClick={onCopyLink} />
          {canSend && (
            <>
              <div className="border-t border-neutral-800 my-1" />
              <Item
                label="🚫  Anulează"
                onClick={onCancel}
                color="text-red-400"
                loading={cancelling === contract.id}
              />
            </>
          )}
          {contract.status === "signed" && (
            <>
              <div className="border-t border-neutral-800 my-1" />
              <Item
                label="🧪  Șterge semnătură (test)"
                onClick={onResetSignature}
                color="text-orange-400"
              />
            </>
          )}
          <div className="border-t border-neutral-800 my-1" />
          <Item
            label="🗑  Șterge definitiv"
            onClick={onDelete}
            color="text-red-600"
            loading={deleting === contract.id}
          />
        </div>
      )}
    </div>
  );
};

export default ContractActionMenu;
