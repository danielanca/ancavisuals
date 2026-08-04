import React from "react";
import Breadcrumb from "../Breadcrumb";
import useAuth from "../../auth/useAuth";
import { ROMANIAN_COUNTIES, getCitiesForCounty } from "../../../../data/romaniaLocations";

interface BankStatementEntry {
  date: string;
  direction: "in" | "out";
  amount: number;
  currency: string;
  counterparty: string | null;
  description: string | null;
  justificationStatus: "matched" | "unmatched";
  matchedLabel: string | null;
}

interface BankStatement {
  id: string;
  statementDate: string;
  year: number;
  file: {
    url: string;
    name: string;
    mediaType?: string;
  };
  entries: BankStatementEntry[];
  unmatchedCount: number;
  createdAt: string;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, index) => CURRENT_YEAR - index);

function fmtCurrency(amount: number, currency = "RON"): string {
  return new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + " " + currency;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function summarizeCurrencies(entries: Array<{ amount: number; currency: string }>): string {
  const totals = new Map<string, number>();
  entries.forEach((entry) => {
    totals.set(entry.currency, (totals.get(entry.currency) ?? 0) + entry.amount);
  });
  return [...totals.entries()]
    .map(([currency, amount]) => fmtCurrency(Math.round(amount * 100) / 100, currency))
    .join(" · ");
}

let activeInfoBadgeId: string | null = null;

function InfoBadge({ title, description }: { title: string; description: string }) {
  const detailsRef = React.useRef<HTMLDetailsElement>(null);
  const badgeId = React.useId();

  React.useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const details = detailsRef.current;
      if (!details?.open) return;
      if (details.contains(event.target as Node)) return;
      details.open = false;
      if (activeInfoBadgeId === badgeId) activeInfoBadgeId = null;
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [badgeId]);

  const handleToggle = (event: React.SyntheticEvent<HTMLDetailsElement>) => {
    const details = event.currentTarget;
    if (details.open) {
      if (activeInfoBadgeId && activeInfoBadgeId !== badgeId) {
        const previous = document.getElementById(activeInfoBadgeId) as HTMLDetailsElement | null;
        if (previous) previous.open = false;
      }
      activeInfoBadgeId = badgeId;
    } else if (activeInfoBadgeId === badgeId) {
      activeInfoBadgeId = null;
    }
  };

  return (
    <details id={badgeId} ref={detailsRef} onToggle={handleToggle} className="group relative inline-block">
      <summary
        className="flex h-4 w-4 cursor-pointer list-none items-center justify-center rounded-full border border-neutral-700 text-[10px] font-semibold text-neutral-400 transition-colors hover:border-neutral-500 hover:text-white"
        aria-label={`${title}: ${description}`}
      >
        i
      </summary>
      <div className="absolute left-0 top-6 z-20 w-64 rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-xs text-neutral-200 shadow-2xl">
        <div className="mb-1 font-medium text-white">{title}</div>
        <div className="leading-relaxed text-neutral-300">{description}</div>
      </div>
    </details>
  );
}

interface AddBankStatementModalProps {
  accessToken: string;
  selectedYear: number;
  onClose: () => void;
  onAdded: (statement: BankStatement) => void;
}

function AddBankStatementModal({ accessToken, selectedYear, onClose, onAdded }: AddBankStatementModalProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [processing, setProcessing] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [statusLabel, setStatusLabel] = React.useState("Pregătit pentru upload");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!processing || progress < 100) return;

    const labels = [
      "Upload finalizat. Serverul pregătește documentul...",
      "AI citește extrasul și extrage tranzacțiile...",
      "AI încearcă să identifice încasările și plățile...",
      "Se caută potriviri cu facturile și cheltuielile existente...",
      "Se finalizează reconcilierea extrasului...",
    ];

    let index = 0;
    setStatusLabel(labels[0]);
    const interval = window.setInterval(() => {
      index = Math.min(index + 1, labels.length - 1);
      setStatusLabel(labels[index]);
    }, 1800);

    return () => window.clearInterval(interval);
  }, [processing, progress]);

  function uploadAndAnalyzeStatement(formData: FormData): Promise<BankStatement> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/admin/bank-statements/upload-analyze");
      xhr.responseType = "json";
      xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const nextProgress = Math.min(100, Math.round((event.loaded / event.total) * 100));
        setProgress(nextProgress);
        setStatusLabel(nextProgress < 100 ? `Se încarcă fișierul... ${nextProgress}%` : "Upload finalizat. Pornește analiza AI...");
      };

      xhr.onerror = () => reject(new Error("Upload eșuat. Verifică conexiunea și încearcă din nou."));
      xhr.onabort = () => reject(new Error("Upload anulat."));
      xhr.onload = () => {
        const data = xhr.response as { error?: string; statement?: BankStatement } | null;
        if (xhr.status < 200 || xhr.status >= 300 || data?.error || !data?.statement) {
          reject(new Error(data?.error ?? "Nu s-a putut analiza extrasul."));
          return;
        }
        resolve(data.statement);
      };

      xhr.send(formData);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setProcessing(true);
    setProgress(0);
    setStatusLabel("Pornim upload-ul...");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("year", String(selectedYear));
      const statement = await uploadAndAnalyzeStatement(formData);
      setStatusLabel("Gata. Adaug extrasul în listă...");
      onAdded(statement);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare la analiză.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-xl border border-neutral-800 bg-neutral-900">
        <div className="flex items-center justify-between border-b border-neutral-800 p-5">
          <h2 className="text-white font-semibold">Extras de cont nou</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-xs text-neutral-400">Fișier extras *</label>
            <input
              type="file"
              accept="image/*,.pdf,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-500"
            />
            <p className="mt-1 text-xs text-neutral-500">
              AI extrage toate tranzacțiile și încearcă să le lege automat de facturi și cheltuieli deja existente.
            </p>
          </div>

          {processing && (
            <div className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-300">{statusLabel}</span>
                <span className="text-neutral-500">{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
                  style={{ width: `${Math.max(progress, 6)}%` }}
                />
              </div>
              <p className="text-[11px] text-neutral-500">
                Bara arată progresul de upload. După 100%, mesajele indică etapele de analiză AI până vine răspunsul final.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-neutral-700 py-2 text-sm text-neutral-400 hover:border-neutral-500">
              Anulează
            </button>
            <button type="submit" disabled={!file || processing} className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-50">
              {processing ? "Se procesează..." : "Analizează extrasul"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface QuickAddInvoiceModalProps {
  accessToken: string;
  entry: BankStatementEntry;
  onClose: () => void;
  onAdded: () => void;
}

function QuickAddInvoiceModal({ accessToken, entry, onClose, onAdded }: QuickAddInvoiceModalProps) {
  const [invoiceType, setInvoiceType] = React.useState<"B2C" | "B2B">("B2C");
  const [clientName, setClientName] = React.useState(entry.counterparty ?? "");
  const [clientCIF, setClientCIF] = React.useState("");
  const [clientAddress, setClientAddress] = React.useState("");
  const [clientCounty, setClientCounty] = React.useState("");
  const [clientCity, setClientCity] = React.useState("");
  const [description, setDescription] = React.useState(entry.description ?? "Servicii foto/video");
  const [amount, setAmount] = React.useState(String(entry.amount));
  const [date, setDate] = React.useState(entry.date.slice(0, 10));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const numAmount = Number(amount);
      const res = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          date,
          type: invoiceType,
          clientName,
          clientAddress,
          clientCity,
          clientCounty,
          clientCIF: invoiceType === "B2B" ? clientCIF || undefined : undefined,
          items: [{ description, quantity: 1, unitPrice: numAmount, total: numAmount }],
          totalAmount: numAmount,
          currency: entry.currency,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Eroare la salvare.");
      onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare.");
    } finally {
      setSaving(false);
    }
  }

  const inp = "w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-xl border border-neutral-800 bg-neutral-900 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-neutral-800 p-5">
          <h2 className="text-white font-semibold">Factură nouă din extras</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3 text-xs text-neutral-400">
            Precompletat din tranzacția de {fmtCurrency(entry.amount, entry.currency)} din {fmtDate(entry.date)}
            {entry.counterparty ? ` · ${entry.counterparty}` : ""}
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => setInvoiceType("B2C")} className={`flex-1 rounded-lg border py-2 text-sm ${invoiceType === "B2C" ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-neutral-700 text-neutral-400"}`}>Persoană fizică</button>
            <button type="button" onClick={() => setInvoiceType("B2B")} className={`flex-1 rounded-lg border py-2 text-sm ${invoiceType === "B2B" ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-neutral-700 text-neutral-400"}`}>Firmă</button>
          </div>

          <div>
            <label className="mb-1 block text-xs text-neutral-400">Nume client *</label>
            <input className={inp} value={clientName} onChange={(e) => setClientName(e.target.value)} required />
          </div>

          {invoiceType === "B2B" && (
            <div>
              <label className="mb-1 block text-xs text-neutral-400">CIF / CUI client</label>
              <input className={inp} value={clientCIF} onChange={(e) => setClientCIF(e.target.value)} />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs text-neutral-400">Adresă (stradă) *</label>
            <input className={inp} value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} required placeholder="Str. Exemplu nr. 1" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Județ *</label>
              <select className={inp} value={clientCounty} onChange={(e) => setClientCounty(e.target.value)} required>
                <option value="">Selectează județul</option>
                {ROMANIAN_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Oraș *</label>
              <input className={inp} list="quick-invoice-cities" value={clientCity} onChange={(e) => setClientCity(e.target.value)} required />
              <datalist id="quick-invoice-cities">
                {getCitiesForCounty(clientCounty).map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-neutral-400">Descriere serviciu</label>
            <input className={inp} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Sumă ({entry.currency})</label>
              <input className={inp} type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Data</label>
              <input className={inp} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-neutral-700 py-2 text-sm text-neutral-400 hover:border-neutral-500">Anulează</button>
            <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-50">
              {saving ? "Se salvează..." : "Salvează factura"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const EXPENSE_CATEGORIES = [
  { value: "combustibil", label: "Combustibil" },
  { value: "echipament", label: "Echipament" },
  { value: "transport", label: "Transport" },
  { value: "software", label: "Software" },
  { value: "cazare", label: "Cazare" },
  { value: "alimentatie", label: "Alimentație" },
  { value: "marketing", label: "Marketing" },
  { value: "altele", label: "Altele" },
];

interface QuickAddExpenseModalProps {
  accessToken: string;
  entry: BankStatementEntry;
  onClose: () => void;
  onAdded: () => void;
}

function QuickAddExpenseModal({ accessToken, entry, onClose, onAdded }: QuickAddExpenseModalProps) {
  const [category, setCategory] = React.useState("altele");
  const [supplier, setSupplier] = React.useState(entry.counterparty ?? "");
  const [description, setDescription] = React.useState(entry.description ?? "");
  const [amount, setAmount] = React.useState(String(entry.amount));
  const [date, setDate] = React.useState(entry.date.slice(0, 10));
  const [deductibility, setDeductibility] = React.useState("100");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          date,
          category,
          description: description || undefined,
          supplier: supplier || undefined,
          amount: Number(amount),
          currency: entry.currency,
          deductibility: Number(deductibility),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.message ?? data.error ?? "Eroare la salvare.");
      onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare.");
    } finally {
      setSaving(false);
    }
  }

  const inp = "w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-neutral-800 p-5">
          <h2 className="text-white font-semibold">Cheltuială nouă din extras</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3 text-xs text-neutral-400">
            Precompletat din tranzacția de {fmtCurrency(entry.amount, entry.currency)} din {fmtDate(entry.date)}
            {entry.counterparty ? ` · ${entry.counterparty}` : ""}
          </div>

          <div>
            <label className="mb-1 block text-xs text-neutral-400">Categorie *</label>
            <select className={inp} value={category} onChange={(e) => setCategory(e.target.value)} required>
              {EXPENSE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-neutral-400">Furnizor</label>
            <input className={inp} value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-xs text-neutral-400">Descriere</label>
            <input className={inp} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Sumă ({entry.currency})</label>
              <input className={inp} type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Deductibil %</label>
              <input className={inp} type="number" min="0" max="100" value={deductibility} onChange={(e) => setDeductibility(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Data</label>
              <input className={inp} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-neutral-700 py-2 text-sm text-neutral-400 hover:border-neutral-500">Anulează</button>
            <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-50">
              {saving ? "Se salvează..." : "Salvează cheltuiala"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const BankStatementsPage: React.FC = () => {
  const { auth } = useAuth();
  const [selectedYear, setSelectedYear] = React.useState(CURRENT_YEAR);
  const [bankStatements, setBankStatements] = React.useState<BankStatement[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [rematchingId, setRematchingId] = React.useState<string | null>(null);
  const [quickAdd, setQuickAdd] = React.useState<{ statementId: string; type: "invoice" | "expense"; entry: BankStatementEntry } | null>(null);

  const authHeader = React.useMemo(() => ({ Authorization: `Bearer ${auth.accessToken}` }), [auth.accessToken]);

  React.useEffect(() => {
    if (!auth.accessToken) return;
    setLoading(true);
    fetch(`/api/admin/bank-statements?year=${selectedYear}`, { headers: authHeader })
      .then((response) => response.json())
      .then((data) => setBankStatements(data.statements ?? []))
      .catch(() => setBankStatements([]))
      .finally(() => setLoading(false));
  }, [auth.accessToken, authHeader, selectedYear]);

  const totals = React.useMemo(() => {
    const entries = bankStatements.flatMap((statement) => statement.entries);
    const incoming = entries.filter((entry) => entry.direction === "in");
    const outgoing = entries.filter((entry) => entry.direction === "out");
    const unmatched = entries.filter((entry) => entry.justificationStatus === "unmatched").length;

    return {
      incomingCount: incoming.length,
      outgoingCount: outgoing.length,
      unmatched,
      incomingLabel: summarizeCurrencies(incoming),
      outgoingLabel: summarizeCurrencies(outgoing),
    };
  }, [bankStatements]);

  async function handleDeleteBankStatement(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/admin/bank-statements/${id}`, { method: "DELETE", headers: authHeader });
      setBankStatements((current) => current.filter((statement) => statement.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRematch(id: string) {
    setRematchingId(id);
    try {
      const response = await fetch(`/api/admin/bank-statements/${id}/rematch`, { method: "POST", headers: authHeader });
      const data = await response.json() as { statement?: BankStatement };
      if (data.statement) {
        setBankStatements((current) => current.map((statement) => statement.id === id ? data.statement! : statement));
      }
    } finally {
      setRematchingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <Breadcrumb />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <h1 className="text-xl font-light tracking-tight text-white">Extrase cont</h1>
            <div className="flex items-center gap-2 text-sm text-neutral-400">
              <span>Separat de zona financiară existentă. Aici vezi doar reconcilierea extraselor.</span>
              <InfoBadge title="Extrase cont" description="Pagina asta nu adaugă automat sume în încasări sau cheltuieli. Arată doar ce a identificat AI în bancă și ce mai trebuie justificat." />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:outline-none"
            >
              {YEARS.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Extras nou
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-xs text-neutral-500">Încasări detectate</p>
            <p className="mt-1 text-sm font-medium text-emerald-400">{totals.incomingLabel || "—"}</p>
            <p className="mt-1 text-xs text-neutral-600">{totals.incomingCount} tranzacții</p>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-xs text-neutral-500">Plăți detectate</p>
            <p className="mt-1 text-sm font-medium text-red-400">{totals.outgoingLabel || "—"}</p>
            <p className="mt-1 text-xs text-neutral-600">{totals.outgoingCount} tranzacții</p>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-xs text-neutral-500">Rămase nejustificate</p>
            <p className={`mt-1 text-sm font-medium ${totals.unmatched > 0 ? "text-amber-400" : "text-emerald-400"}`}>
              {totals.unmatched}
            </p>
            <p className="mt-1 text-xs text-neutral-600">după potrivirea cu facturi și cheltuieli</p>
          </div>
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-neutral-500">Se încarcă...</p>
        ) : bankStatements.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/40 py-16 text-center text-neutral-600">
            <p className="text-sm">Niciun extras analizat.</p>
            <p className="mt-1 text-xs">Încarcă un PDF sau o imagine, iar AI va completa toate entry-urile.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bankStatements.map((statement) => {
              const incoming = statement.entries.filter((entry) => entry.direction === "in");
              const outgoing = statement.entries.filter((entry) => entry.direction === "out");

              return (
                <div key={statement.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white">{statement.file.name}</span>
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${statement.unmatchedCount > 0 ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                          {statement.unmatchedCount > 0 ? `${statement.unmatchedCount} nejustificate` : "Totul justificat"}
                        </span>
                        <InfoBadge title="Status extras" description="Verde înseamnă că toate tranzacțiile au fost corelate de AI cu facturi sau cheltuieli. Galben înseamnă că au rămas tranzacții fără justificare." />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap text-xs text-neutral-500">
                        <span>{fmtDate(statement.statementDate)}</span>
                        <span>·</span>
                        <a href={statement.file.url} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">
                          Vezi extrasul
                        </a>
                      </div>
                      <div className="flex gap-4 flex-wrap pt-1 text-xs text-neutral-400">
                        <span>Încasări: <span className="text-emerald-400">{summarizeCurrencies(incoming)}</span></span>
                        <span>Plăți: <span className="text-red-400">{summarizeCurrencies(outgoing)}</span></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleRematch(statement.id)}
                        disabled={rematchingId === statement.id}
                        className="flex items-center gap-1.5 text-xs text-neutral-400 transition-colors hover:text-white disabled:opacity-50"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
                        {rematchingId === statement.id ? "Se reverifică..." : "Re-verifică"}
                      </button>
                      <button
                        onClick={() => handleDeleteBankStatement(statement.id)}
                        disabled={deletingId === statement.id}
                        className="text-neutral-600 transition-colors hover:text-red-400 disabled:opacity-50"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-neutral-800">
                          <th className="px-2 py-2 text-left text-xs font-medium text-neutral-500">Data</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-neutral-500">Sens</th>
                          <th className="px-2 py-2 text-right text-xs font-medium text-neutral-500">Sumă</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-neutral-500">Parte / descriere</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-neutral-500">Justificare</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statement.entries.map((entry, index) => (
                          <tr key={`${statement.id}-${index}`} className="border-b border-neutral-800/50 last:border-0">
                            <td className="px-2 py-2 text-neutral-300">{fmtDate(entry.date)}</td>
                            <td className={`px-2 py-2 text-xs font-medium ${entry.direction === "in" ? "text-emerald-400" : "text-red-400"}`}>
                              {entry.direction === "in" ? "Încasare" : "Plată"}
                            </td>
                            <td className="px-2 py-2 text-right text-white">{fmtCurrency(entry.amount, entry.currency)}</td>
                            <td className="px-2 py-2 text-neutral-400">
                              <div>{entry.counterparty ?? "—"}</div>
                              {entry.description && <div className="text-xs text-neutral-500">{entry.description}</div>}
                            </td>
                            <td className="px-2 py-2">
                              {entry.justificationStatus === "matched" ? (
                                <span className="inline-flex rounded bg-emerald-500/15 px-2 py-1 text-xs text-emerald-400">{entry.matchedLabel}</span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex rounded bg-amber-500/15 px-2 py-1 text-xs text-amber-400">Nejustificată încă</span>
                                  <button
                                    type="button"
                                    onClick={() => setQuickAdd({ statementId: statement.id, type: entry.direction === "in" ? "invoice" : "expense", entry })}
                                    className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 transition-colors hover:border-emerald-500 hover:text-emerald-400"
                                  >
                                    + {entry.direction === "in" ? "Factură" : "Cheltuială"}
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddBankStatementModal
          accessToken={auth.accessToken ?? ""}
          selectedYear={selectedYear}
          onClose={() => setShowAddModal(false)}
          onAdded={(statement) => setBankStatements((current) => [statement, ...current])}
        />
      )}

      {quickAdd?.type === "invoice" && (
        <QuickAddInvoiceModal
          accessToken={auth.accessToken ?? ""}
          entry={quickAdd.entry}
          onClose={() => setQuickAdd(null)}
          onAdded={() => handleRematch(quickAdd.statementId)}
        />
      )}

      {quickAdd?.type === "expense" && (
        <QuickAddExpenseModal
          accessToken={auth.accessToken ?? ""}
          entry={quickAdd.entry}
          onClose={() => setQuickAdd(null)}
          onAdded={() => handleRematch(quickAdd.statementId)}
        />
      )}
    </div>
  );
};

export default BankStatementsPage;
