import React from "react";
import { useNavigate } from "react-router-dom";
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
  matchedType: "invoice" | "expense" | null;
  matchedId: string | null;
  matchedLabel: string | null;
  matchedFileUrl: string | null;
}

interface BankStatement {
  id: string;
  statementDate: string;
  year: number;
  account: string;
  file: {
    url: string;
    name: string;
    mediaType?: string;
  };
  entries: BankStatementEntry[];
  unmatchedCount: number;
  createdAt: string;
}

const DEFAULT_ACCOUNT = "Cont principal";

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

function EmptyStatementRow({
  statement,
  showAccount,
  deleting,
  onDelete,
}: {
  statement: BankStatement;
  showAccount: boolean;
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
    <details className="group rounded-xl border border-neutral-800 bg-neutral-900/60">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2 flex-wrap">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-neutral-600 transition-transform group-open:rotate-90"><polyline points="9 18 15 12 9 6" /></svg>
          <span className="truncate text-sm text-neutral-300">{statement.file.name}</span>
          {showAccount && <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-xs font-medium text-sky-400">{statement.account}</span>}
          <span className="rounded bg-neutral-700/40 px-1.5 py-0.5 text-xs font-medium text-neutral-400">Extras gol · fără tranzacții</span>
          <span className="text-xs text-neutral-600">{fmtDate(statement.statementDate)}</span>
        </div>
      </summary>
      <div className="flex items-center justify-between gap-3 border-t border-neutral-800 px-4 py-3">
        <p className="text-xs text-neutral-500">
          AI a citit extrasul și nu a găsit nicio tranzacție — luna respectivă a avut 0 lei încasări și 0 lei plăți.
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <a
            href={statement.file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
            Vezi PDF
          </a>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="text-neutral-600 transition-colors hover:text-red-400 disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
          </button>
        </div>
      </div>
    </details>
  );
}

interface AddBankStatementModalProps {
  accessToken: string;
  selectedYear: number;
  knownAccounts: string[];
  defaultAccount: string;
  onClose: () => void;
  onAdded: (statement: BankStatement) => void;
}

function AddBankStatementModal({ accessToken, selectedYear, knownAccounts, defaultAccount, onClose, onAdded }: AddBankStatementModalProps) {
  const [files, setFiles] = React.useState<File[]>([]);
  const [account, setAccount] = React.useState(defaultAccount);
  const [processing, setProcessing] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [statusLabel, setStatusLabel] = React.useState("Pregătit pentru upload");
  const [error, setError] = React.useState<string | null>(null);
  const [fileIndex, setFileIndex] = React.useState(0);
  const [failedFiles, setFailedFiles] = React.useState<{ name: string; error: string }[]>([]);

  React.useEffect(() => {
    if (!processing || progress < 100) return;

    const labelPrefix = files.length > 1 ? `Fișier ${fileIndex + 1} din ${files.length}: ` : "";
    const labels = [
      `${labelPrefix}Upload finalizat. Serverul pregătește documentul...`,
      `${labelPrefix}AI citește extrasul și extrage tranzacțiile...`,
      `${labelPrefix}AI încearcă să identifice încasările și plățile...`,
      `${labelPrefix}Se caută potriviri cu facturile și cheltuielile existente...`,
      `${labelPrefix}Se finalizează reconcilierea extrasului...`,
    ];

    let index = 0;
    setStatusLabel(labels[0]);
    const interval = window.setInterval(() => {
      index = Math.min(index + 1, labels.length - 1);
      setStatusLabel(labels[index]);
    }, 1800);

    return () => window.clearInterval(interval);
  }, [processing, progress, fileIndex, files.length]);

  function uploadAndAnalyzeStatement(formData: FormData, labelPrefix: string): Promise<BankStatement> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/admin/bank-statements/upload-analyze");
      xhr.responseType = "json";
      xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const nextProgress = Math.min(100, Math.round((event.loaded / event.total) * 100));
        setProgress(nextProgress);
        setStatusLabel(nextProgress < 100 ? `${labelPrefix}Se încarcă fișierul... ${nextProgress}%` : `${labelPrefix}Upload finalizat. Pornește analiza AI...`);
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
    if (files.length === 0) return;
    setProcessing(true);
    setError(null);
    setFailedFiles([]);

    const failures: { name: string; error: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const current = files[i];
      setFileIndex(i);
      setProgress(0);
      setStatusLabel(files.length > 1 ? `Fișier ${i + 1} din ${files.length}: pornim upload-ul...` : "Pornim upload-ul...");

      try {
        const formData = new FormData();
        formData.append("file", current);
        formData.append("year", String(selectedYear));
        formData.append("account", account.trim() || DEFAULT_ACCOUNT);
        const labelPrefix = files.length > 1 ? `Fișier ${i + 1} din ${files.length}: ` : "";
        const statement = await uploadAndAnalyzeStatement(formData, labelPrefix);
        onAdded(statement);
      } catch (err) {
        failures.push({ name: current.name, error: err instanceof Error ? err.message : "Eroare la analiză." });
      }
    }

    setProcessing(false);
    if (failures.length === 0) {
      onClose();
    } else {
      setFailedFiles(failures);
      setFiles([]);
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
            <label className="mb-1 block text-xs text-neutral-400">Cont / PFA *</label>
            <input
              list="bank-statement-accounts"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              disabled={processing}
              required
              placeholder="ex. Cont principal, PFA 2"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-500 disabled:opacity-50"
            />
            <datalist id="bank-statement-accounts">
              {knownAccounts.map((a) => <option key={a} value={a} />)}
            </datalist>
            <p className="mt-1 text-xs text-neutral-500">
              Toate fișierele selectate mai jos vor fi salvate pe acest cont. Dacă e un cont nou, scrie orice nume — apare apoi în filtrul de conturi.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs text-neutral-400">Fișiere extras *</label>
            <input
              type="file"
              multiple
              accept="image/*,.pdf,application/pdf"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              disabled={processing}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-500 disabled:opacity-50"
            />
            <p className="mt-1 text-xs text-neutral-500">
              Poți selecta mai multe fișiere deodată (ex. extrasele pe mai multe luni). AI extrage toate tranzacțiile din fiecare și încearcă să le lege automat de facturi și cheltuieli deja existente.
            </p>
            {files.length > 0 && !processing && (
              <ul className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-1.5 text-xs text-neutral-300">
                    <span className="truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="shrink-0 text-neutral-500 hover:text-red-400"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
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
              {files.length > 1 && (
                <div className="h-1 overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className="h-full rounded-full bg-sky-500 transition-[width] duration-300"
                    style={{ width: `${Math.round((fileIndex / files.length) * 100)}%` }}
                  />
                </div>
              )}
              <p className="text-[11px] text-neutral-500">
                Bara arată progresul de upload. După 100%, mesajele indică etapele de analiză AI până vine răspunsul final.
              </p>
            </div>
          )}

          {failedFiles.length > 0 && (
            <div className="space-y-1.5 rounded-lg border border-red-500/40 bg-red-500/10 p-3">
              <p className="text-xs font-medium text-red-300">{failedFiles.length} fișier{failedFiles.length > 1 ? "e" : ""} nu {failedFiles.length > 1 ? "au" : "a"} putut fi procesat{failedFiles.length > 1 ? "e" : ""}:</p>
              {failedFiles.map((f, i) => (
                <p key={i} className="text-[11px] text-red-300/80 truncate">{f.name} — {f.error}</p>
              ))}
              <p className="text-[11px] text-red-300/60">Celelalte fișiere au fost adăugate cu succes. Selectează din nou fișierele de mai sus ca să reîncerci.</p>
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          {failedFiles.length > 0 && files.length === 0 ? (
            <div className="pt-2">
              <button type="button" onClick={onClose} className="w-full rounded-lg bg-emerald-600 py-2 text-sm text-white hover:bg-emerald-500">
                OK
              </button>
            </div>
          ) : (
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-neutral-700 py-2 text-sm text-neutral-400 hover:border-neutral-500">
                Anulează
              </button>
              <button type="submit" disabled={files.length === 0 || processing} className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-50">
                {processing ? "Se procesează..." : files.length > 1 ? `Analizează ${files.length} extrase` : "Analizează extrasul"}
              </button>
            </div>
          )}
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
  const [docFile, setDocFile] = React.useState<File | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let factura: { url: string; name: string; hash?: string } | null = null;
      if (docFile) {
        const year = new Date(date).getFullYear();
        const month = new Date(date).getMonth() + 1;
        const formData = new FormData();
        formData.append("file", docFile);
        formData.append("year", String(year));
        formData.append("month", String(month));
        const uploadRes = await fetch("/api/admin/expenses/upload-doc", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || uploadData.error) throw new Error(uploadData.error ?? "Nu s-a putut încărca documentul.");
        factura = { url: uploadData.url, name: uploadData.name, hash: uploadData.hash };
      }

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
          factura,
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

          <div>
            <label className="mb-1 block text-xs text-neutral-400">Factură / chitanță (opțional)</label>
            <div className="flex items-center gap-2">
              <label className="flex-1 min-w-0 cursor-pointer truncate rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-500">
                {docFile ? docFile.name : "Alege fișierul (PDF sau imagine)"}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {docFile && (
                <button type="button" onClick={() => setDocFile(null)} className="shrink-0 text-neutral-500 hover:text-red-400">
                  ✕
                </button>
              )}
            </div>
            <p className="mt-1 text-[11px] text-neutral-500">Fără document deductibilitatea rămâne validă, dar e mai greu de justificat la control.</p>
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
  const navigate = useNavigate();
  const [selectedYear, setSelectedYear] = React.useState(CURRENT_YEAR);
  const [selectedAccount, setSelectedAccount] = React.useState("");
  const [knownAccounts, setKnownAccounts] = React.useState<string[]>([]);
  const [bankStatements, setBankStatements] = React.useState<BankStatement[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [rematchingId, setRematchingId] = React.useState<string | null>(null);
  const [quickAdd, setQuickAdd] = React.useState<{ statementId: string; type: "invoice" | "expense"; entry: BankStatementEntry } | null>(null);
  const [renamingAccount, setRenamingAccount] = React.useState(false);
  const [renameValue, setRenameValue] = React.useState("");
  const [renaming, setRenaming] = React.useState(false);

  const authHeader = React.useMemo(() => ({ Authorization: `Bearer ${auth.accessToken}` }), [auth.accessToken]);

  React.useEffect(() => {
    if (!auth.accessToken) return;
    setLoading(true);
    const params = new URLSearchParams({ year: String(selectedYear) });
    if (selectedAccount) params.set("account", selectedAccount);
    fetch(`/api/admin/bank-statements?${params.toString()}`, { headers: authHeader })
      .then((response) => response.json())
      .then((data) => {
        setBankStatements(data.statements ?? []);
        setKnownAccounts(data.accounts ?? []);
      })
      .catch(() => setBankStatements([]))
      .finally(() => setLoading(false));
  }, [auth.accessToken, authHeader, selectedYear, selectedAccount]);

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

  async function handleRenameAccount() {
    const oldName = selectedAccount;
    const newName = renameValue.trim();
    if (!oldName || !newName || newName === oldName) { setRenamingAccount(false); return; }
    setRenaming(true);
    try {
      await fetch("/api/admin/bank-statements/rename-account", {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ oldName, newName }),
      });
      setBankStatements((current) => current.map((s) => s.account === oldName ? { ...s, account: newName } : s));
      setKnownAccounts((current) => [...new Set(current.map((a) => a === oldName ? newName : a))].sort());
      setSelectedAccount(newName);
      setRenamingAccount(false);
    } finally {
      setRenaming(false);
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
            {renamingAccount ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleRenameAccount(); if (e.key === "Escape") setRenamingAccount(false); }}
                  className="rounded-lg border border-emerald-500/50 bg-neutral-800 px-3 py-2 text-sm text-white focus:outline-none"
                />
                <button onClick={() => void handleRenameAccount()} disabled={renaming}
                  className="rounded-lg border border-emerald-500/40 px-2 py-2 text-xs text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50">
                  {renaming ? "..." : "✓"}
                </button>
                <button onClick={() => setRenamingAccount(false)} className="rounded-lg border border-neutral-700 px-2 py-2 text-xs text-neutral-400 hover:border-neutral-500">✕</button>
              </div>
            ) : (
              <>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:outline-none"
                >
                  <option value="">Toate conturile</option>
                  {knownAccounts.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
                {selectedAccount && (
                  <button
                    onClick={() => { setRenameValue(selectedAccount); setRenamingAccount(true); }}
                    title="Redenumește contul"
                    className="rounded-lg border border-neutral-700 px-2 py-2 text-xs text-neutral-400 transition-colors hover:border-neutral-500 hover:text-white"
                  >
                    ✎
                  </button>
                )}
              </>
            )}
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
              if (statement.entries.length === 0) {
                return (
                  <EmptyStatementRow
                    key={statement.id}
                    statement={statement}
                    showAccount={!selectedAccount}
                    deleting={deletingId === statement.id}
                    onDelete={() => handleDeleteBankStatement(statement.id)}
                  />
                );
              }

              const incoming = statement.entries.filter((entry) => entry.direction === "in");
              const outgoing = statement.entries.filter((entry) => entry.direction === "out");

              return (
                <details key={statement.id} open className="group rounded-xl border border-neutral-800 bg-neutral-900">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-4 flex-wrap">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-neutral-600 transition-transform group-open:rotate-90"><polyline points="9 18 15 12 9 6" /></svg>
                        <span className="text-sm font-medium text-white">{statement.file.name}</span>
                        {!selectedAccount && (
                          <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-xs font-medium text-sky-400">{statement.account}</span>
                        )}
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${statement.unmatchedCount > 0 ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                          {statement.unmatchedCount > 0 ? `${statement.unmatchedCount} nejustificate` : "Totul justificat"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap pl-5 text-xs text-neutral-500">
                        <span>{fmtDate(statement.statementDate)}</span>
                      </div>
                      <div className="flex gap-4 flex-wrap pl-5 pt-1 text-xs text-neutral-400">
                        <span>Încasări: <span className="text-emerald-400">{summarizeCurrencies(incoming)}</span></span>
                        <span>Plăți: <span className="text-red-400">{summarizeCurrencies(outgoing)}</span></span>
                      </div>
                    </div>
                  </summary>

                  <div className="border-t border-neutral-800 px-4 pb-4 pt-3">
                    <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <InfoBadge title="Status extras" description="Verde înseamnă că toate tranzacțiile au fost corelate de AI cu facturi sau cheltuieli. Galben înseamnă că au rămas tranzacții fără justificare." />
                        <a
                          href={statement.file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 rounded border border-neutral-700 px-2 py-0.5 text-xs text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                          Vezi PDF
                        </a>
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

                    <div className="overflow-x-auto">
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
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!entry.matchedId) return;
                                    if (entry.matchedFileUrl) {
                                      window.open(entry.matchedFileUrl, "_blank", "noopener,noreferrer");
                                      return;
                                    }
                                    const tab = entry.matchedType === "invoice" ? "facturi" : "cheltuieli";
                                    const param = entry.matchedType === "invoice" ? "highlightInvoice" : "highlightExpense";
                                    navigate(`/admin/financial?tab=${tab}&${param}=${entry.matchedId}&year=${statement.year}`);
                                  }}
                                  disabled={!entry.matchedId}
                                  className="inline-flex rounded bg-emerald-500/15 px-2 py-1 text-xs text-emerald-400 transition-colors hover:bg-emerald-500/25 hover:text-emerald-300 disabled:cursor-default disabled:hover:bg-emerald-500/15 disabled:hover:text-emerald-400"
                                  title={entry.matchedFileUrl ? "Deschide factura/chitanța" : entry.matchedId ? "Deschide în Financiar" : undefined}
                                >
                                  {entry.matchedLabel}
                                </button>
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
                </details>
              );
            })}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddBankStatementModal
          accessToken={auth.accessToken ?? ""}
          selectedYear={selectedYear}
          knownAccounts={knownAccounts}
          defaultAccount={selectedAccount || DEFAULT_ACCOUNT}
          onClose={() => setShowAddModal(false)}
          onAdded={(statement) => {
            if (!selectedAccount || statement.account === selectedAccount) {
              setBankStatements((current) => [statement, ...current]);
            }
            setKnownAccounts((current) => current.includes(statement.account) ? current : [...current, statement.account].sort());
          }}
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
