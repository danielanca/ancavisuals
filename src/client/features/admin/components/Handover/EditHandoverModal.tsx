import React, { useState } from "react";
import { useBodyScrollLock } from "../../../../hooks/useBodyScrollLock";

interface Props {
  initialAwb?: string;
  initialDigitalLinkUrl?: string;
  onSave: (updates: { awb: string; digitalLinkUrl: string }) => Promise<void>;
  onCancel: () => void;
}

const inp = "w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-emerald-500/50 transition-colors placeholder-neutral-600";

const EditHandoverModal: React.FC<Props> = ({ initialAwb = "", initialDigitalLinkUrl = "", onSave, onCancel }) => {
  useBodyScrollLock(true);
  const [awb, setAwb] = useState(initialAwb);
  const [digitalLinkUrl, setDigitalLinkUrl] = useState(initialDigitalLinkUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave({ awb: awb.trim(), digitalLinkUrl: digitalLinkUrl.trim() });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Eroare necunoscută");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[60] px-4" onClick={onCancel}>
      <div
        className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-white text-base font-semibold mb-4">Editează AWB / link digital</h2>

        <div className="space-y-4">
          <div>
            <div className="text-xs font-medium text-neutral-400 mb-1.5 uppercase tracking-wide">Link digital (galerie / QR Moments)</div>
            <input className={inp} type="text" value={digitalLinkUrl} onChange={(e) => setDigitalLinkUrl(e.target.value)} placeholder="https://ancavisuals.ro/qr-moments/..." />
            <p className="text-neutral-500 text-xs mt-1.5">Trimis clientului pe email doar după ce semnează PV-ul.</p>
          </div>
          <div>
            <div className="text-xs font-medium text-neutral-400 mb-1.5 uppercase tracking-wide">AWB colet (opțional)</div>
            <input className={inp} type="text" value={awb} onChange={(e) => setAwb(e.target.value)} placeholder="Ex: 1234567890" />
            <p className="text-neutral-500 text-xs mt-1.5">Dacă e completat, apare în PV și în emailul de confirmare, ca reper de urmărire livrare.</p>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-700 text-neutral-300 text-sm hover:border-neutral-500 hover:text-white transition-colors disabled:opacity-40"
          >
            Anulează
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 hover:text-emerald-300 transition-colors disabled:opacity-40"
          >
            {saving ? "Se salvează..." : "Salvează"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditHandoverModal;
