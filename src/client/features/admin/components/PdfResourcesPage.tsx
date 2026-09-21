import React, { useEffect, useState } from "react";
import Breadcrumb from "./Breadcrumb";
import useAuth from "../auth/useAuth";

interface PdfResource {
  id: string;
  title: string;
  filename: string;
  url: string;
  size: number;
  featuredOnBio: boolean;
  createdAt: string;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface AddPdfModalProps {
  accessToken: string;
  onClose: () => void;
  onAdded: (resource: PdfResource) => void;
}

function AddPdfModal({ accessToken, onClose, onAdded }: AddPdfModalProps) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title.trim()) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title.trim());

      const response = await fetch("/api/pdf-resources", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const data = await response.json() as { resource?: PdfResource; error?: string };
      if (!response.ok || data.error || !data.resource) throw new Error(data.error ?? `HTTP ${response.status}`);
      onAdded(data.resource);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare la încărcare.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-neutral-800">
          <h2 className="text-white font-semibold">PDF nou</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Titlu *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="ex: Ghidul pentru nunta perfectă"
              className="w-full bg-neutral-800 border border-neutral-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-1">Fișier PDF *</label>
            <input
              type="file"
              accept="application/pdf"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full bg-neutral-800 border border-neutral-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
            />
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
            <button type="submit" disabled={!file || !title.trim() || uploading}
              className="flex-1 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors disabled:opacity-50">
              {uploading ? "Se încarcă..." : "Salvează"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PdfResourcesTab({ accessToken }: { accessToken: string }) {
  const [resources, setResources] = useState<PdfResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/pdf-resources", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((data: { resources?: PdfResource[] }) => {
        setResources(data.resources ?? []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Eroare la încărcare.");
        setLoading(false);
      });
  }, [accessToken]);

  async function handleDelete(id: string) {
    if (!window.confirm("Ștergi acest PDF? Linkul va înceta să funcționeze.")) return;
    setBusyId(id);
    try {
      await fetch(`/api/pdf-resources/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setResources((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleFeatured(resource: PdfResource) {
    setBusyId(resource.id);
    try {
      const featured = !resource.featuredOnBio;
      await fetch(`/api/pdf-resources/${resource.id}/feature`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ featured }),
      });
      setResources((prev) => prev.map((r) => ({ ...r, featuredOnBio: r.id === resource.id ? featured : false })));
    } finally {
      setBusyId(null);
    }
  }

  async function handleCopy(resource: PdfResource) {
    try {
      await navigator.clipboard.writeText(resource.url);
      setCopiedId(resource.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch { /* clipboard indisponibil */ }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-neutral-400 text-sm max-w-2xl">
          Încarcă PDF-uri (ghiduri, broșuri, cataloage) stocate în Bunny — primești un link public pentru fiecare, iar unul poate fi fixat ca link special pe pagina /bio.
        </p>
        <button
          onClick={() => setShowAddModal(true)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors"
        >
          + PDF
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {loading ? (
        <div className="text-neutral-500 text-sm py-12 text-center">Se încarcă...</div>
      ) : resources.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center">
          <p className="text-neutral-400 text-sm">Niciun PDF încărcat încă.</p>
          <p className="text-neutral-600 text-xs mt-1">Începe cu Ghidul pentru nunta perfectă.</p>
        </div>
      ) : (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl divide-y divide-neutral-800/60">
          {resources.map((resource) => (
            <div key={resource.id} className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xl shrink-0">📄</span>
                <div className="min-w-0">
                  <p className="text-sm text-neutral-200 truncate flex items-center gap-2">
                    {resource.title}
                    {resource.featuredOnBio && (
                      <span className="text-[10px] uppercase tracking-wide text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5">Pe /bio</span>
                    )}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5 truncate">
                    {fmtDate(resource.createdAt)} · {fmtSize(resource.size)} · {resource.filename}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleCopy(resource)}
                  className="px-3 py-1.5 text-xs border border-neutral-700 text-neutral-300 rounded-lg hover:border-neutral-500 hover:text-white transition-colors"
                >
                  {copiedId === resource.id ? "Copiat!" : "Copiază link"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleToggleFeatured(resource)}
                  disabled={busyId === resource.id}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors disabled:opacity-50 ${
                    resource.featuredOnBio
                      ? "border-amber-500/50 text-amber-300 hover:border-amber-400"
                      : "border-neutral-700 text-neutral-300 hover:border-neutral-500 hover:text-white"
                  }`}
                >
                  {resource.featuredOnBio ? "Scoate de pe /bio" : "Fixează pe /bio"}
                </button>
                <button
                  onClick={() => void handleDelete(resource.id)}
                  disabled={busyId === resource.id}
                  className="px-2 py-1.5 text-xs text-neutral-500 hover:text-red-400 transition-colors disabled:opacity-50"
                  aria-label={`Șterge ${resource.title}`}
                >
                  {busyId === resource.id ? "..." : "✕"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddPdfModal
          accessToken={accessToken}
          onClose={() => setShowAddModal(false)}
          onAdded={(resource) => setResources((prev) => [resource, ...prev])}
        />
      )}
    </div>
  );
}

export default function PdfResourcesPage() {
  const { auth } = useAuth();

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-6 text-white sm:px-6 lg:px-8">
      <Breadcrumb />
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-8">
          <p className="mb-1 text-xs uppercase tracking-widest text-neutral-500">Marketing & Web</p>
          <h1 className="text-2xl font-bold text-white">PDF-uri & Ghiduri</h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-400">
            Biblioteca de PDF-uri publice ale site-ului — ghiduri, broșuri, oferte tipărite.
          </p>
        </div>
        <PdfResourcesTab accessToken={auth.accessToken ?? ""} />
      </div>
    </main>
  );
}
