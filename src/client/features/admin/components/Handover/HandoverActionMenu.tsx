import React, { useEffect, useRef, useState } from "react";

interface HandoverItem {
  id: string;
  status: "draft" | "sent" | "signed" | "expired";
}

interface Props {
  handover: HandoverItem;
  sending: string | null;
  deleting: string | null;
  resending: string | null;
  reminding: string | null;
  onPreview: () => void;
  onSend: () => void;
  onCopyLink: () => void;
  onDelete: () => void;
  onResend: () => void;
  onReminder: () => void;
  onEdit: () => void;
}

const HandoverActionMenu: React.FC<Props> = ({
  handover, sending, deleting, resending, reminding,
  onPreview, onSend, onCopyLink, onDelete, onResend, onReminder, onEdit,
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

  const canSend = handover.status === "draft" || handover.status === "sent";

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
        <div className="absolute right-0 top-10 z-50 w-52 bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl overflow-hidden">
          <Item label="👁  Preview PDF" onClick={onPreview} color="text-purple-400" />
          <Item label="✏️  Editează AWB / link" onClick={onEdit} color="text-amber-400" />
          {canSend && (
            <Item
              label={handover.status === "sent" ? "📤  Retrimite link" : "📤  Trimite link"}
              onClick={onSend}
              color="text-emerald-400"
              loading={sending === handover.id}
            />
          )}
          {handover.status === "sent" && (
            <Item
              label="📩  Email re-amintire"
              onClick={onReminder}
              color="text-sky-400"
              loading={reminding === handover.id}
            />
          )}
          <Item label="🔗  Copiază link" onClick={onCopyLink} />
          {handover.status === "signed" && (
            <>
              <div className="border-t border-neutral-800 my-1" />
              <Item
                label="📧  Retrimite PV semnat"
                onClick={onResend}
                color="text-emerald-400"
                loading={resending === handover.id}
              />
            </>
          )}
          <div className="border-t border-neutral-800 my-1" />
          <Item
            label="🗑  Șterge definitiv"
            onClick={onDelete}
            color="text-red-600"
            loading={deleting === handover.id}
          />
        </div>
      )}
    </div>
  );
};

export default HandoverActionMenu;
