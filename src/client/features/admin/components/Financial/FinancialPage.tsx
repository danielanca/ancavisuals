import React, { useReducer, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../../auth/useAuth";
import type { ClientEvent } from "../../types";
import Breadcrumb from "../Breadcrumb";

// ─── Types ───────────────────────────────────────────────────────────────────

type ActiveTab = "overview" | "cheltuieli" | "facturi";

interface FiscalSettings {
  ownerName: string;
  cif: string;
  address: string;
  iban: string;
  bank: string;
  invoiceSeries: string;
}

interface ExpenseDoc {
  url: string;
  name: string;
  hash?: string;
  duplicateExpenseId?: string | null;
}

interface Expense {
  id: string;
  date: string;
  category: string;
  description: string | null;
  supplier: string | null;
  amount: number;
  currency: string;
  deductibility: number;
  deductibleAmount: number;
  invoiceNumber?: string | null;
  factura: ExpenseDoc | null;
  chitanta: ExpenseDoc | null;
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Invoice {
  id: string;
  invoiceNumber: number;
  series: string;
  year: number;
  date: string;
  type: "B2C" | "B2B";
  clientName: string;
  clientAddress: string | null;
  clientCIF: string | null;
  items: InvoiceItem[];
  totalAmount: number;
  currency: string;
  notes: string | null;
  eventId: string | null;
  paid: boolean;
  paidAt: string | null;
}

// ─── PFA Tax Calculator ───────────────────────────────────────────────────────

const SMIN_2026 = 3_700; // salariu minim brut 2026

function calcPfaTax(taxableBase: number): {
  impozit: number;
  cassBase: number;
  cass: number;
  total: number;
  trimestrial: number;
} {
  const impozit = Math.round(Math.max(0, taxableBase) * 0.1 * 100) / 100;

  let cassBase = 0;
  if (taxableBase >= 24 * SMIN_2026) cassBase = 24 * SMIN_2026;
  else if (taxableBase >= 12 * SMIN_2026) cassBase = 12 * SMIN_2026;
  else if (taxableBase >= 6 * SMIN_2026) cassBase = 6 * SMIN_2026;

  const cass = Math.round(cassBase * 0.1 * 100) / 100;
  const total = impozit + cass;
  const trimestrial = Math.round(total / 4 * 100) / 100;
  return { impozit, cassBase, cass, total, trimestrial };
}

function getScadente(year: number): { label: string; date: Date; quarter: number }[] {
  return [
    { label: "T1", quarter: 1, date: new Date(year, 3, 25) },
    { label: "T2", quarter: 2, date: new Date(year, 6, 25) },
    { label: "T3", quarter: 3, date: new Date(year, 9, 25) },
    { label: "T4", quarter: 4, date: new Date(year + 1, 0, 25) },
  ];
}

interface State {
  activeTab: ActiveTab;
  selectedYear: number;
  selectedMonth: number;
  selectedMonthTo: number;
  expenseRevision: number;
  expenses: Expense[];
  invoices: Invoice[];
  duplicateAlert: { expense: Expense; year: number } | null;
  highlightedExpenseId: string | null;
  events: ClientEvent[];
  fiscalSettings: Partial<FiscalSettings>;
  loadingExpenses: boolean;
  loadingInvoices: boolean;
  loadingEvents: boolean;
  showAddExpense: boolean;
  showAddInvoice: boolean;
  showFiscalSettings: boolean;
  deletingId: string | null;
  pdfLoadingId: string | null;
}

type Action =
  | { type: "SET_TAB"; tab: ActiveTab }
  | { type: "SET_YEAR"; year: number }
  | { type: "SET_MONTH"; month: number }
  | { type: "SET_MONTH_TO"; month: number }
  | { type: "SET_EXPENSES"; expenses: Expense[] }
  | { type: "SET_INVOICES"; invoices: Invoice[] }
  | { type: "SET_EVENTS"; events: ClientEvent[] }
  | { type: "SET_FISCAL"; settings: Partial<FiscalSettings> }
  | { type: "SET_LOADING_EXPENSES"; value: boolean }
  | { type: "SET_LOADING_INVOICES"; value: boolean }
  | { type: "SET_LOADING_EVENTS"; value: boolean }
  | { type: "ADD_EXPENSE"; expense: Expense }
  | { type: "BUMP_EXPENSE_REVISION" }
  | { type: "REMOVE_EXPENSE"; id: string }
  | { type: "SET_DUPLICATE_ALERT"; payload: { expense: Expense; year: number } | null }
  | { type: "SET_HIGHLIGHTED_EXPENSE"; id: string | null }
  | { type: "ADD_INVOICE"; invoice: Invoice }
  | { type: "REMOVE_INVOICE"; id: string }
  | { type: "SET_INVOICE_PAID"; id: string; paid: boolean; paidAt: string | null }
  | { type: "SHOW_ADD_EXPENSE"; value: boolean }
  | { type: "SHOW_ADD_INVOICE"; value: boolean }
  | { type: "SHOW_FISCAL_SETTINGS"; value: boolean }
  | { type: "SET_DELETING"; id: string | null }
  | { type: "SET_PDF_LOADING"; id: string | null };

const CURRENT_YEAR = new Date().getFullYear();

const initialState: State = {
  activeTab: "overview",
  selectedYear: CURRENT_YEAR,
  selectedMonth: 0,
  selectedMonthTo: 0,
  expenseRevision: 0,
  expenses: [],
  duplicateAlert: null,
  highlightedExpenseId: null,
  invoices: [],
  events: [],
  fiscalSettings: {},
  loadingExpenses: false,
  loadingInvoices: false,
  loadingEvents: false,
  showAddExpense: false,
  showAddInvoice: false,
  showFiscalSettings: false,
  deletingId: null,
  pdfLoadingId: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_TAB": return { ...state, activeTab: action.tab };
    case "SET_YEAR": return { ...state, selectedYear: action.year };
    case "SET_MONTH": return { ...state, selectedMonth: action.month, selectedMonthTo: 0 };
    case "SET_MONTH_TO": return { ...state, selectedMonthTo: action.month };
    case "SET_EXPENSES": return { ...state, expenses: action.expenses, loadingExpenses: false };
    case "SET_INVOICES": return { ...state, invoices: action.invoices, loadingInvoices: false };
    case "SET_EVENTS": return { ...state, events: action.events, loadingEvents: false };
    case "SET_FISCAL": return { ...state, fiscalSettings: action.settings };
    case "SET_LOADING_EXPENSES": return { ...state, loadingExpenses: action.value };
    case "SET_LOADING_INVOICES": return { ...state, loadingInvoices: action.value };
    case "SET_LOADING_EVENTS": return { ...state, loadingEvents: action.value };
    case "ADD_EXPENSE": return { ...state, expenses: [action.expense, ...state.expenses] };
    case "BUMP_EXPENSE_REVISION": return { ...state, expenseRevision: state.expenseRevision + 1 };
    case "REMOVE_EXPENSE": return { ...state, expenses: state.expenses.filter((e) => e.id !== action.id) };
    case "ADD_INVOICE": return { ...state, invoices: [action.invoice, ...state.invoices] };
    case "REMOVE_INVOICE": return { ...state, invoices: state.invoices.filter((i) => i.id !== action.id) };
    case "SET_INVOICE_PAID": return {
      ...state,
      invoices: state.invoices.map((inv) =>
        inv.id === action.id ? { ...inv, paid: action.paid, paidAt: action.paidAt } : inv
      ),
    };
    case "SHOW_ADD_EXPENSE": return { ...state, showAddExpense: action.value };
    case "SHOW_ADD_INVOICE": return { ...state, showAddInvoice: action.value };
    case "SHOW_FISCAL_SETTINGS": return { ...state, showFiscalSettings: action.value };
    case "SET_DELETING": return { ...state, deletingId: action.id };
    case "SET_PDF_LOADING": return { ...state, pdfLoadingId: action.id };
    case "SET_DUPLICATE_ALERT": return { ...state, duplicateAlert: action.payload };
    case "SET_HIGHLIGHTED_EXPENSE": return { ...state, highlightedExpenseId: action.id };
    default: return state;
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  { value: "combustibil", label: "Combustibil",          emoji: "⛽", color: "bg-orange-500/15 text-orange-400 border-orange-500/30",   defaultDeductibility: 50  },
  { value: "echipament",  label: "Echipament foto/video", emoji: "📷", color: "bg-blue-500/15 text-blue-400 border-blue-500/30",         defaultDeductibility: 100 },
  { value: "transport",   label: "Transport",             emoji: "🚗", color: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",         defaultDeductibility: 100 },
  { value: "software",    label: "Software / Abo.",       emoji: "💻", color: "bg-violet-500/15 text-violet-400 border-violet-500/30",   defaultDeductibility: 100 },
  { value: "cazare",      label: "Cazare",                emoji: "🏨", color: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",   defaultDeductibility: 100 },
  { value: "alimentatie", label: "Alimentație",           emoji: "🍽️", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", defaultDeductibility: 50  },
  { value: "marketing",   label: "Marketing",             emoji: "📣", color: "bg-pink-500/15 text-pink-400 border-pink-500/30",         defaultDeductibility: 100 },
  { value: "altele",      label: "Alte cheltuieli",       emoji: "📦", color: "bg-neutral-700/50 text-neutral-400 border-neutral-600/30", defaultDeductibility: 50  },
];

const MONTHS = ["Toate", "Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

function fmtCurrency(amount: number, currency = "RON"): string {
  return new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + " " + currency;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
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

function CategoryBadge({ value }: { value: string }) {
  const cat = EXPENSE_CATEGORIES.find((c) => c.value === value);
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${cat?.color ?? "bg-neutral-800 text-neutral-400 border-neutral-700"}`}>
      {cat?.emoji} {cat?.label ?? value}
    </span>
  );
}

// ─── Add Expense Modal ────────────────────────────────────────────────────────

interface AddExpenseModalProps {
  accessToken: string;
  existingExpenses: Expense[];
  onClose: () => void;
  onAdded: (expense: Expense) => void;
  onDuplicateFound: (duplicate: Expense) => void;
}

interface DocSlot {
  file: File | null;
  scanning: boolean;
}

async function uploadExpenseFile(file: File, date: string, accessToken: string): Promise<ExpenseDoc> {
  const year = new Date(date).getFullYear();
  const month = new Date(date).getMonth() + 1;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("year", String(year));
  formData.append("month", String(month));
  const response = await fetch("/api/admin/expenses/upload-doc", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  if (!response.ok) throw new Error(`Upload eșuat: ${response.status}`);
  return response.json() as Promise<ExpenseDoc>;
}

function DocUploadRow({
  label,
  slot,
  onFileChange,
  onScan,
}: {
  label: string;
  slot: DocSlot;
  onFileChange: (file: File | null) => void;
  onScan: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);

  return (
    <div>
      <label className="block text-xs text-neutral-400 mb-1">{label}</label>
      <div
        className={[
          "flex gap-2 rounded-lg border transition-colors",
          dragging ? "border-violet-500 bg-violet-600/10" : "border-transparent",
        ].join(" ")}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) onFileChange(file);
        }}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={[
            "flex-1 min-w-0 px-3 py-2 text-sm border rounded-lg transition-colors text-left truncate",
            slot.file
              ? "border-neutral-600 text-neutral-200"
              : "border-neutral-700 text-neutral-400 hover:border-neutral-500",
          ].join(" ")}
        >
          {slot.file ? slot.file.name : dragging ? "Dă drumul aici..." : "Trage sau apasă"}
        </button>
        {slot.file && (
          <>
            <button type="button" onClick={onScan} disabled={slot.scanning}
              className="px-3 py-2 text-sm bg-violet-600/20 text-violet-400 border border-violet-600/40 rounded-lg hover:bg-violet-600/30 transition-colors disabled:opacity-50 whitespace-nowrap">
              {slot.scanning ? "Scanează..." : "Extrage AI"}
            </button>
            <button type="button" onClick={() => onFileChange(null)}
              className="px-2 text-neutral-600 hover:text-red-400 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*,.pdf" className="hidden"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)} />
    </div>
  );
}

function AddExpenseModal({ accessToken, existingExpenses, onClose, onAdded, onDuplicateFound }: AddExpenseModalProps) {
  const [date, setDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [category, setCategory] = React.useState("combustibil");
  const [description, setDescription] = React.useState("");
  const [supplier, setSupplier] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [currency, setCurrency] = React.useState("RON");
  const [deductibility, setDeductibility] = React.useState(50);
  const [invoiceNumber, setInvoiceNumber] = React.useState("");
  const [facturaSlot, setFacturaSlot] = React.useState<DocSlot>({ file: null, scanning: false });
  const [chitantaSlot, setChitantaSlot] = React.useState<DocSlot>({ file: null, scanning: false });
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [scanError, setScanError] = React.useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = React.useState<string | null>(null);

  function handleCategoryChange(value: string) {
    setCategory(value);
    const cat = EXPENSE_CATEGORIES.find((c) => c.value === value);
    if (cat) setDeductibility(cat.defaultDeductibility);
  }

  async function handleScan(slot: DocSlot, setSlot: React.Dispatch<React.SetStateAction<DocSlot>>) {
    if (!slot.file) return;
    setSlot((prev) => ({ ...prev, scanning: true }));
    setError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);
    try {
      const base64 = await fileToBase64(slot.file);
      const response = await fetch("/api/admin/expenses/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ fileBase64: base64, mediaType: slot.file.type }),
        signal: controller.signal,
      });
      const data = await response.json() as { extracted?: Record<string, unknown>; error?: string };
      if (!response.ok) throw new Error(data.error ?? `Eroare server (${response.status})`);
      if (!data.extracted) throw new Error("AI-ul nu a putut extrage date din imagine. Încearcă cu o poză mai clară.");
      if (data.extracted) {
        const extracted = data.extracted as Record<string, unknown>;
        if (extracted.date) setDate(String(extracted.date));
        if (extracted.supplier) setSupplier(String(extracted.supplier));
        if (extracted.amount != null) setAmount(String(extracted.amount));
        if (extracted.currency) setCurrency(String(extracted.currency));
        if (extracted.description) setDescription(String(extracted.description));
        if (extracted.category) {
          const cat = EXPENSE_CATEGORIES.find((c) => c.value === String(extracted.category));
          if (cat) handleCategoryChange(cat.value);
        }
        if (extracted.invoiceNumber) {
          const extractedInvoiceNumber = String(extracted.invoiceNumber);
          setInvoiceNumber(extractedInvoiceNumber);
          const dupByInvoice = existingExpenses.find((exp) => exp.invoiceNumber === extractedInvoiceNumber);
          if (dupByInvoice) {
            setDuplicateWarning(`⚠️ Numărul de factură "${extractedInvoiceNumber}" există deja (${dupByInvoice.supplier ?? ""} · ${new Date(dupByInvoice.date).toLocaleDateString("ro-RO")})`);
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setScanError("Extragerea a depășit 30 de secunde. Încearcă din nou sau completează manual.");
      } else {
        setScanError(err instanceof Error ? err.message : "Scanare eșuată. Completează manual.");
      }
    } finally {
      clearTimeout(timeoutId);
      setSlot((prev) => ({ ...prev, scanning: false }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || !date || !category) return;

    setError(null);
    setDuplicateWarning(null);

    // Check 1: supplier + amount + currency (client-side)
    if (supplier.trim()) {
      const normalizedSupplier = supplier.trim().toLowerCase();
      const duplicate = existingExpenses.find(
        (exp) =>
          exp.supplier?.toLowerCase() === normalizedSupplier &&
          exp.amount === Number(amount) &&
          exp.currency === currency,
      );
      if (duplicate) { onDuplicateFound(duplicate); return; }
    }

    // Check 2: invoice number (client-side)
    if (invoiceNumber.trim()) {
      const duplicate = existingExpenses.find((exp) => exp.invoiceNumber === invoiceNumber.trim());
      if (duplicate) { onDuplicateFound(duplicate); return; }
    }

    setSaving(true);
    setUploading(true);

    let factura: ExpenseDoc | null = null;
    let chitanta: ExpenseDoc | null = null;

    try {
      const uploads = await Promise.all([
        facturaSlot.file ? uploadExpenseFile(facturaSlot.file, date, accessToken) : Promise.resolve(null),
        chitantaSlot.file ? uploadExpenseFile(chitantaSlot.file, date, accessToken) : Promise.resolve(null),
      ]);
      factura = uploads[0];
      chitanta = uploads[1];
    } catch {
      setError("Upload eșuat. Încearcă din nou.");
      setSaving(false);
      setUploading(false);
      return;
    }
    setUploading(false);

    // Check 3: hash duplicate returned from upload-doc
    const dupeId = factura?.duplicateExpenseId ?? chitanta?.duplicateExpenseId;
    if (dupeId) {
      const dupeExpense = existingExpenses.find((exp) => exp.id === dupeId);
      if (dupeExpense) {
        onDuplicateFound(dupeExpense);
      } else {
        setDuplicateWarning("⚠️ Fișier identic deja încărcat într-o altă cheltuială (alt an/lună).");
        setError("Duplicat detectat. Verifică cheltuielile din alte perioade.");
      }
      setSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          date, category,
          description: description || undefined,
          supplier: supplier || undefined,
          amount: Number(amount), currency, deductibility,
          invoiceNumber: invoiceNumber.trim() || undefined,
          factura, chitanta,
        }),
      });
      const data = await response.json() as { id?: string; error?: string; existingId?: string; message?: string };

      // Check 4: server-side duplicate (hash or invoice number across all years)
      if (response.status === 409) {
        const dupeExpense = data.existingId ? existingExpenses.find((exp) => exp.id === data.existingId) : null;
        if (dupeExpense) {
          onDuplicateFound(dupeExpense);
        } else {
          setError(`⚠️ ${data.message ?? "Duplicat detectat de server."}`);
        }
        return;
      }

      if (!response.ok || data.error) throw new Error(data.error ?? `HTTP ${response.status}`);

      const deductibleAmount = Math.round((Number(amount) * deductibility) / 100 * 100) / 100;
      onAdded({
        id: data.id!,
        date: new Date(date).toISOString(),
        category,
        description: description || null,
        supplier: supplier || null,
        amount: Number(amount),
        currency,
        deductibility,
        deductibleAmount,
        invoiceNumber: invoiceNumber.trim() || null,
        factura,
        chitanta,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare la salvare.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-neutral-800">
          <h2 className="text-white font-semibold">Cheltuială nouă</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Two labeled document slots */}
          <div className="space-y-3">
            <DocUploadRow label="Factură" slot={facturaSlot}
              onFileChange={(file) => setFacturaSlot({ file, scanning: false })}
              onScan={() => handleScan(facturaSlot, setFacturaSlot)} />
            <DocUploadRow label="Chitanță" slot={chitantaSlot}
              onFileChange={(file) => setChitantaSlot({ file, scanning: false })}
              onScan={() => handleScan(chitantaSlot, setChitantaSlot)} />
            {(facturaSlot.file || chitantaSlot.file) && (
              <p className="text-xs text-neutral-500">"Extrage AI" completează automat câmpurile de mai jos din documentul ales.</p>
            )}
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-1">Data *</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
              className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-500" />
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-1">Categorie *</label>
            <select value={category} onChange={(e) => handleCategoryChange(e.target.value)} required
              className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-500">
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-1">Furnizor</label>
            <input type="text" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="ex: Petrom, Dedeman..."
              className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-500" />
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-1">Descriere</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ce s-a cumpărat..."
              className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-500" />
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-1">Număr factură</label>
            <input type="text" value={invoiceNumber} onChange={(e) => { setInvoiceNumber(e.target.value); setDuplicateWarning(null); }}
              placeholder="ex: FA-2024-001"
              className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-500" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Sumă *</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min="0" step="0.01" required
                className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-500" />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Monedă</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-500">
                <option value="RON">RON</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-2">Deductibilitate *</label>
            <div className="flex gap-2">
              {[50, 100].map((pct) => (
                <button key={pct} type="button" onClick={() => setDeductibility(pct)}
                  className={`flex-1 py-2 text-sm rounded-lg border transition-colors font-medium ${deductibility === pct ? "bg-emerald-600/20 border-emerald-500 text-emerald-400" : "border-neutral-700 text-neutral-400 hover:border-neutral-500"}`}>
                  {pct}%
                </button>
              ))}
              <div className="flex-1 flex items-center gap-1">
                <input type="number" min="0" max="100" value={deductibility}
                  onChange={(e) => setDeductibility(Number(e.target.value))}
                  className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-500" />
                <span className="text-neutral-400 text-sm">%</span>
              </div>
            </div>
            {amount && (
              <p className="text-xs text-neutral-500 mt-1">
                Deductibil: <span className="text-emerald-400 font-medium">{fmtCurrency(Math.round(Number(amount) * deductibility / 100 * 100) / 100, currency)}</span>
              </p>
            )}
          </div>

          {duplicateWarning && (
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/40 rounded-lg px-3 py-2.5 text-sm text-amber-300">
              <span className="shrink-0">⚠️</span>
              <span>{duplicateWarning}</span>
            </div>
          )}

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
            <button type="submit" disabled={saving || uploading}
              className="flex-1 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors disabled:opacity-50">
              {uploading ? "Se încarcă fișiere..." : saving ? "Se salvează..." : "Salvează"}
            </button>
          </div>
        </form>
      </div>
    </div>

      {/* Scan error dialog — outside z-50 stacking context so it always appears on top */}
      {scanError && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-red-900/60 bg-neutral-950 p-6 space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <span className="text-red-400 text-xl leading-none mt-0.5">✕</span>
              <div>
                <p className="text-white font-semibold text-sm mb-1">Extragere AI eșuată</p>
                <p className="text-red-300 text-sm leading-relaxed break-all">{scanError}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setScanError(null)}
              className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium transition-colors"
            >
              Completează manual
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Fiscal Settings Modal ────────────────────────────────────────────────────

interface FiscalSettingsModalProps {
  accessToken: string;
  current: Partial<FiscalSettings>;
  onClose: () => void;
  onSaved: (settings: Partial<FiscalSettings>) => void;
}

function FiscalSettingsModal({ accessToken, current, onClose, onSaved }: FiscalSettingsModalProps) {
  const [form, setForm] = React.useState<Partial<FiscalSettings>>({ ...current });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function handleChange(field: keyof FiscalSettings, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/invoices/fiscal-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      onSaved(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare.");
    } finally {
      setSaving(false);
    }
  }

  const fields: { key: keyof FiscalSettings; label: string; placeholder: string }[] = [
    { key: "ownerName", label: "Nume PFA", placeholder: "ANCA DANIEL EMANUEL PFA" },
    { key: "cif", label: "CIF", placeholder: "RO12345678" },
    { key: "address", label: "Adresă", placeholder: "Str. Exemplu, Nr. 1, Cluj-Napoca" },
    { key: "iban", label: "IBAN", placeholder: "RO49 BTRL ..." },
    { key: "bank", label: "Bancă", placeholder: "Banca Transilvania" },
    { key: "invoiceSeries", label: "Serie factură", placeholder: "ADE" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-neutral-800">
          <h2 className="text-white font-semibold">Date fiscale PFA</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {fields.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs text-neutral-400 mb-1">{label}</label>
              <input type="text" value={form[key] ?? ""} onChange={(e) => handleChange(key, e.target.value)} placeholder={placeholder}
                className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-500" />
            </div>
          ))}
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-sm border border-neutral-700 text-neutral-400 rounded-lg hover:border-neutral-500">Anulează</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50">
              {saving ? "Se salvează..." : "Salvează"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Invoice Modal ────────────────────────────────────────────────────────

interface AddInvoiceModalProps {
  accessToken: string;
  events: ClientEvent[];
  onClose: () => void;
  onAdded: (invoice: Invoice) => void;
}

function AddInvoiceModal({ accessToken, events, onClose, onAdded }: AddInvoiceModalProps) {
  const [selectedEventId, setSelectedEventId] = React.useState("");
  const [date, setDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [invoiceType, setInvoiceType] = React.useState<"B2C" | "B2B">("B2C");
  const [clientName, setClientName] = React.useState("");
  const [clientAddress, setClientAddress] = React.useState("");
  const [clientCIF, setClientCIF] = React.useState("");
  const [items, setItems] = React.useState<InvoiceItem[]>([{ description: "Servicii fotografiere", quantity: 1, unitPrice: 0, total: 0 }]);
  const [currency, setCurrency] = React.useState("RON");
  const [exchangeRate, setExchangeRate] = React.useState(5);
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/admin/settings", {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })
      .then((r) => r.json())
      .then((data: { exchangeRate?: unknown }) => {
        const nextRate = Number(data.exchangeRate);
        if (Number.isFinite(nextRate) && nextRate > 0) setExchangeRate(nextRate);
      })
      .catch(() => {});
  }, [accessToken]);

  function prefillFromEvent(eventId: string) {
    setSelectedEventId(eventId);
    if (!eventId) return;
    const event = events.find((e) => e.id === eventId);
    if (!event) return;
    setClientName(event.client.fullName);
    if (event.eventDate) setDate(event.eventDate.toISOString().split("T")[0]);
    if (event.services?.length) {
      setItems(event.services.map((service) => ({
        description: service.name,
        quantity: 1,
        unitPrice: service.price,
        total: service.price,
      })));
    } else {
      setItems([{ description: `Servicii ${event.type}`, quantity: 1, unitPrice: event.pricing.total, total: event.pricing.total }]);
    }
  }

  function updateItem(index: number, field: keyof InvoiceItem, value: string | number) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: typeof value === "string" ? Number(value) || value : value };
        if (field === "quantity" || field === "unitPrice") {
          updated.total = Math.round(Number(updated.quantity) * Number(updated.unitPrice) * 100) / 100;
        }
        return updated as InvoiceItem;
      })
    );
  }

  function addItem() {
    setItems((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0, total: 0 }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function convertInvoiceCurrency(targetCurrency: "RON" | "EUR") {
    if (currency === targetCurrency) return;
    const rate = exchangeRate > 0 ? exchangeRate : 5;
    const multiplier = targetCurrency === "RON" ? rate : 1 / rate;

    setItems((prev) =>
      prev.map((item) => {
        const unitPrice = Math.round(item.unitPrice * multiplier * 100) / 100;
        return {
          ...item,
          unitPrice,
          total: Math.round(item.quantity * unitPrice * 100) / 100,
        };
      }),
    );
    setCurrency(targetCurrency);
  }

  const totalAmount = useMemo(() => Math.round(items.reduce((sum, item) => sum + item.total, 0) * 100) / 100, [items]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName || !items.length) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          date,
          type: invoiceType,
          clientName,
          clientAddress: clientAddress || undefined,
          clientCIF: invoiceType === "B2B" ? clientCIF || undefined : undefined,
          items,
          totalAmount,
          currency,
          notes: notes || undefined,
          eventId: selectedEventId || undefined,
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      onAdded({
        id: data.id,
        invoiceNumber: data.invoiceNumber,
        series: data.series,
        year: new Date(date).getFullYear(),
        date: new Date(date).toISOString(),
        type: invoiceType,
        clientName,
        clientAddress: clientAddress || null,
        clientCIF: invoiceType === "B2B" ? clientCIF || null : null,
        items,
        totalAmount,
        currency,
        notes: notes || null,
        eventId: selectedEventId || null,
        paid: false,
        paidAt: null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-neutral-800">
          <h2 className="text-white font-semibold">Factură nouă</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Event picker */}
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Completează din eveniment (opțional)</label>
            <select value={selectedEventId} onChange={(e) => prefillFromEvent(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-500">
              <option value="">— Completare manuală —</option>
              {events
                .filter((ev) => ev.eventDate)
                .sort((a, b) => (b.eventDate?.getTime() ?? 0) - (a.eventDate?.getTime() ?? 0))
                .map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.client.fullName} · {ev.type} · {ev.eventDate?.toLocaleDateString("ro-RO")}
                  </option>
                ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Data *</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
                className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-500" />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Tip *</label>
              <div className="flex gap-2 h-[38px]">
                {(["B2C", "B2B"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setInvoiceType(t)}
                    className={`flex-1 text-sm rounded-lg border transition-colors font-medium ${invoiceType === t ? "bg-emerald-600/20 border-emerald-500 text-emerald-400" : "border-neutral-700 text-neutral-400 hover:border-neutral-500"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-1">Nume client *</label>
            <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} required
              className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-500" />
          </div>

          <div className={`grid gap-3 ${invoiceType === "B2B" ? "grid-cols-2" : "grid-cols-1"}`}>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Adresă client</label>
              <input type="text" value={clientAddress} onChange={(e) => setClientAddress(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-500" />
            </div>
            {invoiceType === "B2B" && (
              <div>
                <label className="block text-xs text-neutral-400 mb-1">CIF / CUI client</label>
                <input type="text" value={clientCIF} onChange={(e) => setClientCIF(e.target.value)} placeholder="RO..."
                  className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-500" />
              </div>
            )}
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-neutral-400">Servicii *</label>
              <button type="button" onClick={addItem} className="text-xs text-emerald-400 hover:text-emerald-300">+ Adaugă rând</button>
            </div>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-1 items-center">
                  <input type="text" value={item.description} onChange={(e) => updateItem(index, "description", e.target.value)}
                    placeholder="Descriere serviciu" className="col-span-5 bg-neutral-800 border border-neutral-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-neutral-500" />
                  <input type="number" value={item.quantity} onChange={(e) => updateItem(index, "quantity", e.target.value)}
                    min="1" className="col-span-2 bg-neutral-800 border border-neutral-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-neutral-500 text-right" />
                  <input type="number" value={item.unitPrice} onChange={(e) => updateItem(index, "unitPrice", e.target.value)}
                    min="0" step="0.01" className="col-span-2 bg-neutral-800 border border-neutral-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-neutral-500 text-right" />
                  <span className="col-span-2 text-xs text-white text-right pr-1">{fmtCurrency(item.total, "")}</span>
                  <button type="button" onClick={() => removeItem(index)} disabled={items.length === 1}
                    className="col-span-1 text-neutral-600 hover:text-red-400 disabled:opacity-0 flex justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>
              ))}
              <p className="text-xs text-neutral-500 pl-1">Cant. · Preț unit · Total</p>
            </div>
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-neutral-800">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-neutral-400">Monedă:</span>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)}
                  className="bg-neutral-800 border border-neutral-700 text-white text-xs rounded-lg px-2 py-1 focus:outline-none">
                  <option value="RON">RON</option>
                  <option value="EUR">EUR</option>
                </select>
                {currency === "EUR" ? (
                  <button
                    type="button"
                    onClick={() => convertInvoiceCurrency("RON")}
                    className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-400 transition-colors hover:bg-emerald-500/20 hover:text-emerald-300"
                  >
                    Convertește în RON
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => convertInvoiceCurrency("EUR")}
                    className="rounded-lg border border-neutral-700 px-2.5 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-500 hover:text-white"
                  >
                    Convertește în EUR
                  </button>
                )}
                <span className="text-[11px] text-neutral-500">Curs: 1 EUR = {fmtCurrency(exchangeRate, "RON")}</span>
              </div>
              <span className="text-white font-semibold">Total: {fmtCurrency(totalAmount, currency)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-1">Observații</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opțional..."
              className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-500" />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-sm border border-neutral-700 text-neutral-400 rounded-lg hover:border-neutral-500">Anulează</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50">
              {saving ? "Se salvează..." : "Creează factura"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const FinancialPage: React.FC = () => {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [exchangeRate, setExchangeRate] = React.useState(5);

  const authHeader = useMemo(() => ({ Authorization: `Bearer ${auth.accessToken}` }), [auth.accessToken]);

  // Load expenses
  useEffect(() => {
    if (!auth.accessToken) return;
    dispatch({ type: "SET_LOADING_EXPENSES", value: true });
    const hasRange = state.selectedMonth > 0 && state.selectedMonthTo > state.selectedMonth;
    const params = hasRange
      ? `?year=${state.selectedYear}&monthFrom=${state.selectedMonth}&monthTo=${state.selectedMonthTo}`
      : state.selectedMonth > 0
        ? `?year=${state.selectedYear}&month=${state.selectedMonth}`
        : `?year=${state.selectedYear}`;
    fetch(`/api/admin/expenses${params}`, { headers: authHeader })
      .then((r) => r.json())
      .then((data) => dispatch({ type: "SET_EXPENSES", expenses: data.expenses ?? [] }))
      .catch(() => dispatch({ type: "SET_LOADING_EXPENSES", value: false }));
  }, [auth.accessToken, state.selectedYear, state.selectedMonth, state.selectedMonthTo, state.expenseRevision, authHeader]);

  // Load invoices
  useEffect(() => {
    if (!auth.accessToken) return;
    dispatch({ type: "SET_LOADING_INVOICES", value: true });
    fetch(`/api/admin/invoices?year=${state.selectedYear}`, { headers: authHeader })
      .then((r) => r.json())
      .then((data) => dispatch({ type: "SET_INVOICES", invoices: data.invoices ?? [] }))
      .catch(() => dispatch({ type: "SET_LOADING_INVOICES", value: false }));
  }, [auth.accessToken, state.selectedYear, authHeader]);

  // Load events + fiscal settings once
  useEffect(() => {
    if (!auth.accessToken) return;
    fetch("/api/admin/events", { headers: authHeader })
      .then((r) => r.json())
      .then((data) => {
        const events = (data.events ?? []).map((event: ClientEvent & { eventDate: string | null; createdAt: string }) => ({
          ...event,
          eventDate: event.eventDate ? new Date(event.eventDate) : null,
          createdAt: new Date(event.createdAt),
        }));
        dispatch({ type: "SET_EVENTS", events });
      })
      .catch(() => {});

    fetch("/api/admin/invoices/fiscal-settings", { headers: authHeader })
      .then((r) => r.json())
      .then((data) => dispatch({ type: "SET_FISCAL", settings: data }))
      .catch(() => {});

    fetch("/api/admin/settings", { headers: authHeader })
      .then((r) => r.json())
      .then((data: { exchangeRate?: unknown }) => {
        const rate = Number(data.exchangeRate);
        if (rate > 0) setExchangeRate(rate);
      })
      .catch(() => {});
  }, [auth.accessToken, authHeader]);

  // Overview calculations
  const overview = useMemo(() => {
    const toRON = (amount: number, currency: string) => currency === "EUR" ? amount * exchangeRate : amount;

    const totalIncome = state.invoices.reduce((sum, inv) => sum + toRON(inv.totalAmount, inv.currency), 0);
    const totalUnpaid = state.invoices.filter(inv => !inv.paid).reduce((sum, inv) => sum + toRON(inv.totalAmount, inv.currency), 0);
    const totalExpenses = state.expenses.reduce((sum, exp) => sum + toRON(exp.amount, exp.currency), 0);
    const totalDeductible = state.expenses.reduce((sum, exp) => sum + toRON(exp.deductibleAmount, exp.currency), 0);
    const netBalance = totalIncome - totalExpenses;
    const taxableBase = totalIncome - totalDeductible;

    const monthlyMap: Record<number, { income: number; expenses: number; deductible: number }> = {};
    for (let month = 1; month <= 12; month++) {
      monthlyMap[month] = { income: 0, expenses: 0, deductible: 0 };
    }
    state.invoices.forEach((inv) => {
      const month = new Date(inv.date).getMonth() + 1;
      monthlyMap[month].income += inv.totalAmount;
    });
    state.expenses.forEach((exp) => {
      const month = new Date(exp.date).getMonth() + 1;
      monthlyMap[month].expenses += toRON(exp.amount, exp.currency);
      monthlyMap[month].deductible += toRON(exp.deductibleAmount, exp.currency);
    });

    return {
      totalIncome,
      totalUnpaid,
      totalExpenses,
      totalDeductible,
      netBalance,
      taxableBase,
      monthlyMap,
    };
  }, [state.invoices, state.expenses, exchangeRate]);

  const [exportingKey, setExportingKey] = React.useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = React.useState(false);
  const exportMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (!exportMenuRef.current?.contains(e.target as Node)) setShowExportMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showExportMenu]);

  async function handleExport(key: string, endpoint: string, filename: string) {
    setExportingKey(key);
    setShowExportMenu(false);
    try {
      const response = await fetch(`/api/admin/invoices/${endpoint}?year=${state.selectedYear}`, { headers: authHeader });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename.replace("{year}", String(state.selectedYear));
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Export eșuat.");
    } finally {
      setExportingKey(null);
    }
  }

  async function handleDeleteExpense(id: string) {
    dispatch({ type: "SET_DELETING", id });
    await fetch(`/api/admin/expenses/${id}`, { method: "DELETE", headers: authHeader });
    dispatch({ type: "REMOVE_EXPENSE", id });
    dispatch({ type: "SET_DELETING", id: null });
  }

  async function handleDeleteInvoice(id: string) {
    dispatch({ type: "SET_DELETING", id });
    await fetch(`/api/admin/invoices/${id}`, { method: "DELETE", headers: authHeader });
    dispatch({ type: "REMOVE_INVOICE", id });
    dispatch({ type: "SET_DELETING", id: null });
  }

  async function handleTogglePaid(invoice: Invoice) {
    const nextPaid = !invoice.paid;
    dispatch({ type: "SET_INVOICE_PAID", id: invoice.id, paid: nextPaid, paidAt: nextPaid ? new Date().toISOString() : null });
    await fetch(`/api/admin/invoices/${invoice.id}/paid`, {
      method: "PATCH",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ paid: nextPaid }),
    });
  }

  async function handleDownloadPdf(invoiceId: string, ref: string) {
    dispatch({ type: "SET_PDF_LOADING", id: invoiceId });
    try {
      const response = await fetch(`/api/admin/invoices/${invoiceId}/pdf`, { headers: authHeader });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `factura-${ref}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      dispatch({ type: "SET_PDF_LOADING", id: null });
    }
  }

  const hasFiscalSettings = state.fiscalSettings.ownerName && state.fiscalSettings.cif;

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-4xl mx-auto space-y-6">

        <Breadcrumb />

        {/* Duplicate alert banner */}
        {state.duplicateAlert && (
          <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/40 rounded-xl px-4 py-3">
            <span className="text-amber-400 text-lg shrink-0">⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="text-amber-300 text-sm font-medium">
                Există deja o cheltuială identică pe anul {state.duplicateAlert.year}
              </p>
              <p className="text-amber-400/70 text-xs mt-0.5">
                {state.duplicateAlert.expense.supplier} · {fmtCurrency(state.duplicateAlert.expense.amount, state.duplicateAlert.expense.currency)} · {fmtDate(state.duplicateAlert.expense.date)}
              </p>
            </div>
            <button
              onClick={() => {
                dispatch({ type: "SET_DUPLICATE_ALERT", payload: null });
                setTimeout(() => dispatch({ type: "SET_HIGHLIGHTED_EXPENSE", id: null }), 3000);
              }}
              className="text-amber-400/60 hover:text-amber-300 text-lg leading-none shrink-0"
              aria-label="Închide alertă"
            >×</button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white text-xl font-light tracking-tight">Financiar</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Export dropdown */}
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setShowExportMenu(v => !v)}
                disabled={exportingKey !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-neutral-700 text-neutral-400 rounded-lg hover:border-neutral-500 hover:text-white transition-colors disabled:opacity-50"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                {exportingKey ? "Se generează..." : "Export"}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-9 z-30 w-56 rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl overflow-hidden">
                  {[
                    { key: "csv",      label: "CSV pentru contabil",          sub: "2 fișiere Excel-ready",      endpoint: "export-csv",      file: "fiscal-csv-{year}.zip" },
                    { key: "report",   label: "Raport fiscal PDF",             sub: "Sumar anual complet",         endpoint: "export-report",   file: "raport-fiscal-{year}.pdf" },
                    { key: "registru", label: "Registru incasări și plăți",   sub: "Document obligatoriu PFA",    endpoint: "export-registru", file: "registru-incasari-plati-{year}.pdf" },
                    { key: "zip",      label: "ZIP documente",                 sub: "Facturi PDF + chitanțe",      endpoint: "export-zip",      file: "fiscal-{year}.zip" },
                  ].map(item => (
                    <button key={item.key} onClick={() => handleExport(item.key, item.endpoint, item.file)}
                      className="w-full text-left px-4 py-3 hover:bg-neutral-800 transition-colors border-b border-neutral-800 last:border-0">
                      <div className="text-sm text-white">{item.label}</div>
                      <div className="text-xs text-neutral-500 mt-0.5">{item.sub}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => dispatch({ type: "SET_YEAR", year: state.selectedYear - 1 })}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <span className="text-white text-sm font-medium w-12 text-center">{state.selectedYear}</span>
              <button onClick={() => dispatch({ type: "SET_YEAR", year: state.selectedYear + 1 })}
                disabled={state.selectedYear >= CURRENT_YEAR}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-neutral-800">
          {([["overview", "Overview"], ["cheltuieli", "Cheltuieli"], ["facturi", "Facturi emise"]] as const).map(([tab, label]) => (
            <button key={tab} onClick={() => dispatch({ type: "SET_TAB", tab })}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${state.activeTab === tab ? "border-white text-white" : "border-transparent text-neutral-500 hover:text-neutral-300"}`}>
              {label}
            </button>
          ))}
        </div>

        {/* ─── Overview Tab ─── */}
        {state.activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Incasări", value: overview.totalIncome, color: "text-emerald-400", desc: "din facturi emise", info: "Totalul din facturile emise. Nu include extrasele de cont." },
                { label: "Cheltuieli", value: overview.totalExpenses, color: "text-red-400", desc: "total plătit", info: "Totalul din cheltuielile înregistrate manual." },
                { label: "Deductibil", value: overview.totalDeductible, color: "text-amber-400", desc: "din cheltuieli", info: "Partea deductibilă calculată din cheltuielile înregistrate." },
                { label: "De încasat", value: overview.totalUnpaid, color: overview.totalUnpaid > 0 ? "text-sky-400" : "text-neutral-500", desc: "facturi neplătite", info: "Totalul facturilor marcate ca neplătite." },
              ].map(({ label, value, color, desc, info }) => (
                <div key={label} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                  <div className="mb-1 flex items-center gap-1.5">
                    <p className="text-xs text-neutral-500">{label}</p>
                    <InfoBadge title={label} description={info} />
                  </div>
                  <p className={`text-lg font-semibold ${color}`}>{fmtCurrency(value, "RON")}</p>
                  <p className="text-xs text-neutral-600 mt-0.5">{desc}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-sky-100">Extrasele de cont au pagină separată.</p>
                  <p className="text-xs text-sky-100/80">
                    Le poți gestiona separat de contabilitatea introdusă manual, fără să se amestece cu overview-ul de aici.
                  </p>
                </div>
                <button
                  onClick={() => navigate("/admin/bank-statements")}
                  className="rounded-lg border border-sky-400/40 px-3 py-2 text-xs font-medium text-sky-100 transition-colors hover:border-sky-300 hover:bg-sky-400/10"
                >
                  Deschide extrasele
                </button>
              </div>
            </div>

            {(() => {
              const tax = calcPfaTax(overview.taxableBase);
              const scadente = getScadente(state.selectedYear);
              const today = new Date();
              const nextScadenta = scadente.find(s => s.date > today);
              const daysToNext = nextScadenta ? Math.ceil((nextScadenta.date.getTime() - today.getTime()) / 86_400_000) : null;

              return (
                <>
                  {/* Calculator taxe PFA */}
                  <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-white">Estimare taxe PFA {state.selectedYear}</p>
                      <InfoBadge title="Estimare taxe" description="Calculat pe baza datelor introduse. Consultă un expert fiscal pentru valorile finale." />
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Bază impozabilă</span>
                        <span className="text-white font-medium">{fmtCurrency(Math.max(0, overview.taxableBase), "RON")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Impozit venit (10%)</span>
                        <span className="text-amber-400 font-medium">{fmtCurrency(tax.impozit, "RON")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Bază CASS</span>
                        <span className="text-white">{tax.cassBase > 0 ? fmtCurrency(tax.cassBase, "RON") : <span className="text-neutral-500">sub prag</span>}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400">CASS (10%)</span>
                        <span className="text-amber-400 font-medium">{fmtCurrency(tax.cass, "RON")}</span>
                      </div>
                    </div>
                    <div className="border-t border-neutral-800 pt-3 flex items-center justify-between">
                      <div>
                        <span className="text-xs text-neutral-500">Total estimat</span>
                        <p className="text-lg font-semibold text-amber-300">{fmtCurrency(tax.total, "RON")}</p>
                      </div>
                      {tax.total > 0 && (
                        <div className="text-right">
                          <span className="text-xs text-neutral-500">Rată trimestrială</span>
                          <p className="text-base font-semibold text-white">{fmtCurrency(tax.trimestrial, "RON")}</p>
                        </div>
                      )}
                    </div>
                    {overview.taxableBase <= 0 && (
                      <p className="text-xs text-neutral-600">Nicio taxă estimată — cheltuielile depășesc incasările.</p>
                    )}
                    <p className="text-xs text-neutral-600">Estimare orientativă · SMIN 2026 = 3.700 RON · Curs EUR = {exchangeRate} RON</p>
                  </div>

                  {/* Scadențe trimestriale */}
                  {tax.total > 0 && (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-white">Scadențe plăți anticipate {state.selectedYear}</p>
                        {daysToNext !== null && nextScadenta && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${daysToNext <= 14 ? "bg-red-500/20 text-red-400" : daysToNext <= 30 ? "bg-amber-500/20 text-amber-400" : "bg-neutral-800 text-neutral-400"}`}>
                            {nextScadenta.label} în {daysToNext} zile
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {scadente.map(s => {
                          const isPast = s.date < today;
                          const isNext = nextScadenta?.quarter === s.quarter;
                          return (
                            <div key={s.quarter} className={`rounded-lg p-3 border ${isNext ? "border-amber-500/40 bg-amber-500/10" : isPast ? "border-neutral-800 bg-neutral-800/50 opacity-50" : "border-neutral-800"}`}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-neutral-300">{s.label}</span>
                                {isPast && <span className="text-[10px] text-neutral-600">trecut</span>}
                                {isNext && <span className="text-[10px] text-amber-400">urmează</span>}
                              </div>
                              <p className={`text-sm font-semibold ${isNext ? "text-amber-300" : "text-white"}`}>{fmtCurrency(tax.trimestrial, "RON")}</p>
                              <p className="text-[10px] text-neutral-500 mt-0.5">
                                {s.date.toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: s.date.getFullYear() !== today.getFullYear() ? "numeric" : undefined })}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-neutral-600 mt-3">* Sumele sunt estimative. Baza reală se stabilește prin D212 depusă la ANAF.</p>
                    </div>
                  )}
                </>
              );
            })()}

            {/* Monthly breakdown */}
            <div>
              <h2 className="text-sm font-medium text-neutral-400 mb-3">Defalcare lunară</h2>
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-800">
                      <th className="text-left text-xs text-neutral-500 px-4 py-2.5 font-medium">Luna</th>
                      <th className="text-right text-xs text-neutral-500 px-4 py-2.5 font-medium">Incasări</th>
                      <th className="text-right text-xs text-neutral-500 px-4 py-2.5 font-medium">Cheltuieli</th>
                      <th className="text-right text-xs text-neutral-500 px-4 py-2.5 font-medium">Deductibil</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MONTHS.slice(1).map((monthName, index) => {
                      const monthData = overview.monthlyMap[index + 1];
                      const isEmpty = monthData.income === 0 && monthData.expenses === 0;
                      return (
                        <tr key={monthName} className={`border-b border-neutral-800/50 last:border-0 ${isEmpty ? "opacity-30" : ""}`}>
                          <td className="px-4 py-2.5 text-neutral-300">{monthName}</td>
                          <td className="px-4 py-2.5 text-right text-emerald-400">{monthData.income > 0 ? fmtCurrency(monthData.income, "RON") : "—"}</td>
                          <td className="px-4 py-2.5 text-right text-red-400">{monthData.expenses > 0 ? fmtCurrency(monthData.expenses, "RON") : "—"}</td>
                          <td className="px-4 py-2.5 text-right text-amber-400">{monthData.deductible > 0 ? fmtCurrency(monthData.deductible, "RON") : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── Cheltuieli Tab ─── */}
        {state.activeTab === "cheltuieli" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              {/* Month filter with range support */}
              <div className="flex gap-1 flex-wrap">
                {MONTHS.map((monthName, index) => {
                  const isFrom = state.selectedMonth === index && index > 0;
                  const isTo = state.selectedMonthTo === index && index > 0;
                  const inRange = state.selectedMonth > 0 && state.selectedMonthTo > state.selectedMonth
                    && index > state.selectedMonth && index < state.selectedMonthTo;
                  const isActive = index === 0 ? state.selectedMonth === 0 : isFrom || isTo || inRange;
                  return (
                    <button key={monthName}
                      onClick={() => {
                        if (index === 0) {
                          dispatch({ type: "SET_MONTH", month: 0 });
                        } else if (state.selectedMonth === 0 || state.selectedMonthTo > 0) {
                          dispatch({ type: "SET_MONTH", month: index });
                        } else if (index > state.selectedMonth) {
                          dispatch({ type: "SET_MONTH_TO", month: index });
                        } else {
                          dispatch({ type: "SET_MONTH", month: index });
                        }
                      }}
                      className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                        isFrom || isTo
                          ? "bg-white text-neutral-900 border-white font-medium"
                          : inRange
                            ? "bg-neutral-200 text-neutral-800 border-neutral-300 font-medium"
                            : isActive
                              ? "bg-white text-neutral-900 border-white font-medium"
                              : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
                      }`}>
                      {monthName}
                    </button>
                  );
                })}
                {state.selectedMonthTo > 0 && (
                  <span className="text-xs text-neutral-500 self-center ml-1">
                    {MONTHS[state.selectedMonth]}–{MONTHS[state.selectedMonthTo]}
                  </span>
                )}
              </div>
              <button onClick={() => dispatch({ type: "SHOW_ADD_EXPENSE", value: true })}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors font-medium">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Cheltuială nouă
              </button>
            </div>

            {state.loadingExpenses ? (
              <p className="text-neutral-500 text-sm text-center py-10">Se încarcă...</p>
            ) : state.expenses.length === 0 ? (
              <div className="text-center py-16 text-neutral-600">
                <p className="text-sm">Nicio cheltuială înregistrată.</p>
                <p className="text-xs mt-1">Adaugă prima cheltuială cu butonul de mai sus.</p>
              </div>
            ) : (
              <>
                <div className="flex gap-4 text-sm px-1">
                  <span className="text-neutral-400">Total: <span className="text-white font-medium">{fmtCurrency(state.expenses.reduce((s, e) => s + (e.currency === "EUR" ? e.amount * exchangeRate : e.amount), 0), "RON")}</span></span>
                  <span className="text-neutral-400">Deductibil: <span className="text-emerald-400 font-medium">{fmtCurrency(state.expenses.reduce((s, e) => s + (e.currency === "EUR" ? e.deductibleAmount * exchangeRate : e.deductibleAmount), 0), "RON")}</span></span>
                </div>
                <div className="space-y-2">
                  {state.expenses.map((expense) => (
                    <div key={expense.id} id={`expense-${expense.id}`}
                      className={`rounded-xl px-4 py-3 flex items-center gap-4 border transition-colors duration-500 ${state.highlightedExpenseId === expense.id ? "bg-amber-500/10 border-amber-500/50" : "bg-neutral-900 border-neutral-800"}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white text-sm font-medium">{fmtCurrency(expense.amount, expense.currency)}</span>
                          <CategoryBadge value={expense.category} />
                          <span className="text-xs text-amber-500">{expense.deductibility}% ded.</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500 flex-wrap">
                          <span>{fmtDate(expense.date)}</span>
                          {expense.supplier && <span>· {expense.supplier}</span>}
                          {expense.description && <span>· {expense.description}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {expense.factura && (
                          <a href={expense.factura.url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 transition-colors">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                            Factură
                          </a>
                        )}
                        {expense.chitanta && (
                          <a href={expense.chitanta.url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 transition-colors">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                            Chitanță
                          </a>
                        )}
                        <button onClick={() => handleDeleteExpense(expense.id)} disabled={state.deletingId === expense.id}
                          className="text-neutral-600 hover:text-red-400 transition-colors disabled:opacity-50">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── Facturi Tab ─── */}
        {state.activeTab === "facturi" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex gap-2">
                <button onClick={() => dispatch({ type: "SHOW_FISCAL_SETTINGS", value: true })}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs border rounded-lg transition-colors ${!hasFiscalSettings ? "border-amber-500/50 text-amber-400 bg-amber-500/10" : "border-neutral-700 text-neutral-400 hover:border-neutral-500"}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 1 0 .01 14.14" /></svg>
                  Date fiscale{!hasFiscalSettings ? " !" : ""}
                </button>
              </div>
              <button onClick={() => dispatch({ type: "SHOW_ADD_INVOICE", value: true })}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors font-medium">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Factură nouă
              </button>
            </div>

            {!hasFiscalSettings && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-amber-300 font-medium">Date fiscale PFA incomplete</p>
                  <p className="text-xs text-amber-400/70 mt-0.5">Completează CIF, IBAN etc. pentru a putea genera PDF-uri de factură valide.</p>
                </div>
                <button
                  onClick={() => dispatch({ type: "SHOW_FISCAL_SETTINGS", value: true })}
                  className="shrink-0 px-3 py-1.5 text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg transition-colors">
                  Completează acum →
                </button>
              </div>
            )}

            {state.loadingInvoices ? (
              <p className="text-neutral-500 text-sm text-center py-10">Se încarcă...</p>
            ) : state.invoices.length === 0 ? (
              <div className="text-center py-16 text-neutral-600">
                <p className="text-sm">Nicio factură emisă.</p>
                <p className="text-xs mt-1">Creează prima factură din evenimentele existente.</p>
              </div>
            ) : (
              <>
                <div className="text-sm px-1 text-neutral-400">
                  Total facturat: <span className="text-white font-medium">{fmtCurrency(state.invoices.reduce((s, inv) => s + inv.totalAmount, 0), "RON")}</span>
                </div>
                <div className="space-y-2">
                  {state.invoices.map((invoice) => {
                    const invoiceRef = `${invoice.series}-${String(invoice.invoiceNumber).padStart(4, "0")}`;
                    return (
                      <div key={invoice.id} className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white text-sm font-medium font-mono">{invoiceRef}</span>
                            <span className="text-white text-sm">{fmtCurrency(invoice.totalAmount, invoice.currency)}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${invoice.type === "B2B" ? "bg-blue-500/20 text-blue-400" : "bg-neutral-800 text-neutral-400"}`}>{invoice.type}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500">
                            <span>{fmtDate(invoice.date)}</span>
                            <span>·</span>
                            <span>{invoice.clientName}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleTogglePaid(invoice)}
                            title={invoice.paid ? "Marchează ca neplătită" : "Marchează ca plătită"}
                            className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors font-medium ${invoice.paid ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" : "border-neutral-700 text-neutral-500 hover:border-neutral-500 hover:text-neutral-300"}`}
                          >
                            {invoice.paid ? "✓ Plătită" : "Neplătită"}
                          </button>
                          <button onClick={() => handleDownloadPdf(invoice.id, invoiceRef)} disabled={state.pdfLoadingId === invoice.id}
                            className="text-xs flex items-center gap-1 px-2.5 py-1.5 border border-neutral-700 text-neutral-400 rounded-lg hover:border-neutral-500 hover:text-white transition-colors disabled:opacity-50">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                            {state.pdfLoadingId === invoice.id ? "..." : "PDF"}
                          </button>
                          <button onClick={() => handleDeleteInvoice(invoice.id)} disabled={state.deletingId === invoice.id}
                            className="text-neutral-600 hover:text-red-400 transition-colors disabled:opacity-50">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

      </div>

      {/* Modals */}
      {state.showAddExpense && (
        <AddExpenseModal
          accessToken={auth.accessToken ?? ""}
          existingExpenses={state.expenses}
          onClose={() => dispatch({ type: "SHOW_ADD_EXPENSE", value: false })}
          onAdded={(expense) => {
            dispatch({ type: "ADD_EXPENSE", expense });
            dispatch({ type: "BUMP_EXPENSE_REVISION" });
          }}
          onDuplicateFound={(duplicate) => {
            dispatch({ type: "SHOW_ADD_EXPENSE", value: false });
            dispatch({ type: "SET_TAB", tab: "cheltuieli" });
            dispatch({ type: "SET_DUPLICATE_ALERT", payload: { expense: duplicate, year: new Date(duplicate.date).getFullYear() } });
            dispatch({ type: "SET_HIGHLIGHTED_EXPENSE", id: duplicate.id });
            setTimeout(() => {
              document.getElementById(`expense-${duplicate.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 150);
          }}
        />
      )}

      {state.showAddInvoice && (
        <AddInvoiceModal accessToken={auth.accessToken ?? ""} events={state.events}
          onClose={() => dispatch({ type: "SHOW_ADD_INVOICE", value: false })}
          onAdded={(invoice) => dispatch({ type: "ADD_INVOICE", invoice })} />
      )}

      {state.showFiscalSettings && (
        <FiscalSettingsModal accessToken={auth.accessToken ?? ""} current={state.fiscalSettings}
          onClose={() => dispatch({ type: "SHOW_FISCAL_SETTINGS", value: false })}
          onSaved={(settings) => dispatch({ type: "SET_FISCAL", settings })} />
      )}
    </div>
  );
};

export default FinancialPage;
