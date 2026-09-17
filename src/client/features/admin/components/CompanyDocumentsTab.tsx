import React, { useEffect, useState } from "react";

interface CompanyDocument {
  id: string;
  category: string;
  label: string;
  notes: string | null;
  fileUrl: string;
  fileName: string;
  mediaType: string;
  uploadedAt: string;
}

const CATEGORIES: { value: string; label: string; hint?: string }[] = [
  { value: "certificat_constatator", label: "Certificat constatator ONRC", hint: "Dovada înregistrării firmei/PFA la Registrul Comerțului — băncile și partenerii cer de obicei unul emis recent." },
  { value: "cif", label: "Certificat de înregistrare fiscală (CIF/CUI)" },
  { value: "act_constitutiv", label: "Act constitutiv / Decizie înființare PFA" },
  { value: "acord_vecini", label: "Foi / acorduri de la vecini" },
  { value: "drept_profesare_acasa", label: "Drept de a profesa la domiciliu", hint: "Acord, autorizație sau document care dovedește dreptul de a desfășura activitatea în locuință." },
  { value: "contract_comodat", label: "Contract de comodat" },
  { value: "contract_inchiriere_masina", label: "Contract închiriere mașină PF → PFA" },
  { value: "contract_sediu", label: "Contract / acord spațiu sediu social" },
  { value: "altele", label: "Alt document" },
];

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fileIcon(mediaType: string): string {
  if (mediaType.includes("pdf")) return "📄";
  if (mediaType.includes("image")) return "🖼️";
  return "📎";
}

interface AddDocumentModalProps {
  accessToken: string;
  onClose: () => void;
  onAdded: (doc: CompanyDocument) => void;
}

function AddDocumentModal({ accessToken, onClose, onAdded }: AddDocumentModalProps) {
  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [label, setLabel] = useState(CATEGORIES[0].label);
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleCategoryChange(value: string) {
    setCategory(value);
    const preset = CATEGORIES.find((c) => c.value === value);
    if (preset && preset.value !== "altele") setLabel(preset.label);
    if (preset && preset.value === "altele") setLabel("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !label.trim()) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);
      formData.append("label", label.trim());
      if (notes.trim()) formData.append("notes", notes.trim());

      const response = await fetch("/api/admin/company-documents/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const data = await response.json() as CompanyDocument & { error?: string };
      if (!response.ok || data.error) throw new Error(data.error ?? `HTTP ${response.status}`);
      onAdded(data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare la încărcare.");
    } finally {
      setUploading(false);
    }
  }

  const activeCategory = CATEGORIES.find((c) => c.value === category);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-neutral-800">
          <h2 className="text-white font-semibold">Document nou</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Tip document *</label>
            <select value={category} onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            {activeCategory?.hint && <p className="mt-1 text-[11px] text-neutral-500">{activeCategory.hint}</p>}
          </div>

          {category === "altele" && (
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Denumire document *</label>
              <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} required
                placeholder="ex: Certificat ISO, Autorizație ANSPDCP..."
                className="w-full bg-neutral-800 border border-neutral-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500" />
            </div>
          )}

          <div>
            <label className="block text-xs text-neutral-400 mb-1">Notițe (opțional)</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="ex: valabil până la reînnoire, emis pe 12.09.2026..."
              className="w-full bg-neutral-800 border border-neutral-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500" />
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-1">Fișier (PDF, poză sau document) *</label>
            <input type="file" accept="application/pdf,image/*,.doc,.docx,.odt" required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full bg-neutral-800 border border-neutral-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500" />
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2.5 text-sm text-red-300">
              <span className="shrink-0">✕</span>
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-sm border border-neutral-700 text-neutral-400 rounded-lg hover:border-neutral-500 transition-colors">
              Anulează
            </button>
            <button type="submit" disabled={!file || !label.trim() || uploading}
              className="flex-1 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors disabled:opacity-50">
              {uploading ? "Se încarcă..." : "Salvează"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CompanyDocumentsTab({ accessToken }: { accessToken: string }) {
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/admin/company-documents", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((data: { documents?: CompanyDocument[] }) => {
        setDocuments(data.documents ?? []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Eroare la încărcare.");
        setLoading(false);
      });
  }, [accessToken]);

  async function handleDelete(id: string) {
    if (!window.confirm("Ștergi acest document?")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/admin/company-documents/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleOpen(doc: CompanyDocument) {
    const newWindow = window.open("about:blank", "_blank");
    if (!newWindow) return;
    setOpeningId(doc.id);
    try {
      const response = await fetch(`/api/admin/company-documents/${doc.id}/file`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error("Documentul nu a putut fi deschis.");
      const blobUrl = URL.createObjectURL(await response.blob());
      newWindow.location.href = blobUrl;
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (err) {
      newWindow.close();
      setError(err instanceof Error ? err.message : "Documentul nu a putut fi deschis.");
    } finally {
      setOpeningId(null);
    }
  }

  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    docs: documents.filter((d) => d.category === cat.value),
  })).filter((group) => group.value !== "altele" || group.docs.length > 0);

  const uncategorized = documents.filter((d) => !CATEGORIES.some((c) => c.value === d.category));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
          <p className="text-neutral-400 text-sm max-w-2xl">
          Păstrează într-un singur loc actele firmei/PFA-ului: certificate ONRC, acorduri de la vecini, dreptul de a lucra de acasă și contractele pentru spațiu sau mașină.
        </p>
        <button
          onClick={() => setShowAddModal(true)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors"
        >
          + Document
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {loading ? (
        <div className="text-neutral-500 text-sm py-12 text-center">Se încarcă...</div>
      ) : documents.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center">
          <p className="text-neutral-400 text-sm">Niciun document încărcat încă.</p>
          <p className="text-neutral-600 text-xs mt-1">Începe cu certificatul constatator ONRC și contractul de comodat.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {[...grouped, ...(uncategorized.length > 0 ? [{ value: "altele", label: "Alte documente", hint: undefined, docs: uncategorized }] : [])]
            .filter((group) => group.docs.length > 0)
            .map((group) => (
              <div key={group.value}>
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">{group.label}</h3>
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl divide-y divide-neutral-800/60">
                  {group.docs.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl shrink-0">{fileIcon(doc.mediaType)}</span>
                        <div className="min-w-0">
                          <p className="text-sm text-neutral-200 truncate">{doc.label}</p>
                          <p className="text-xs text-neutral-500 mt-0.5 truncate">
                            {fmtDate(doc.uploadedAt)} · {doc.fileName}
                            {doc.notes ? ` · ${doc.notes}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleOpen(doc)}
                          disabled={openingId === doc.id}
                          className="px-3 py-1.5 text-xs border border-neutral-700 text-neutral-300 rounded-lg hover:border-neutral-500 hover:text-white transition-colors"
                        >
                          {openingId === doc.id ? "Se deschide..." : "Deschide"}
                        </button>
                        <button
                          onClick={() => void handleDelete(doc.id)}
                          disabled={deletingId === doc.id}
                          className="px-2 py-1.5 text-xs text-neutral-500 hover:text-red-400 transition-colors disabled:opacity-50"
                          aria-label={`Șterge ${doc.label}`}
                        >
                          {deletingId === doc.id ? "..." : "✕"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {showAddModal && (
        <AddDocumentModal
          accessToken={accessToken}
          onClose={() => setShowAddModal(false)}
          onAdded={(doc) => setDocuments((prev) => [doc, ...prev])}
        />
      )}
    </div>
  );
}
