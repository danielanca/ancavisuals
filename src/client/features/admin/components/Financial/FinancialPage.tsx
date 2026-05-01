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
}

interface State {
  activeTab: ActiveTab;
  selectedYear: number;
  selectedMonth: number;
  expenses: Expense[];
  invoices: Invoice[];
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
  | { type: "SET_EXPENSES"; expenses: Expense[] }
  | { type: "SET_INVOICES"; invoices: Invoice[] }
  | { type: "SET_EVENTS"; events: ClientEvent[] }
  | { type: "SET_FISCAL"; settings: Partial<FiscalSettings> }
  | { type: "SET_LOADING_EXPENSES"; value: boolean }
  | { type: "SET_LOADING_INVOICES"; value: boolean }
  | { type: "SET_LOADING_EVENTS"; value: boolean }
  | { type: "ADD_EXPENSE"; expense: Expense }
  | { type: "REMOVE_EXPENSE"; id: string }
  | { type: "ADD_INVOICE"; invoice: Invoice }
  | { type: "REMOVE_INVOICE"; id: string }
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
  expenses: [],
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
    case "SET_MONTH": return { ...state, selectedMonth: action.month };
    case "SET_EXPENSES": return { ...state, expenses: action.expenses, loadingExpenses: false };
    case "SET_INVOICES": return { ...state, invoices: action.invoices, loadingInvoices: false };
    case "SET_EVENTS": return { ...state, events: action.events, loadingEvents: false };
    case "SET_FISCAL": return { ...state, fiscalSettings: action.settings };
    case "SET_LOADING_EXPENSES": return { ...state, loadingExpenses: action.value };
    case "SET_LOADING_INVOICES": return { ...state, loadingInvoices: action.value };
    case "SET_LOADING_EVENTS": return { ...state, loadingEvents: action.value };
    case "ADD_EXPENSE": return { ...state, expenses: [action.expense, ...state.expenses] };
    case "REMOVE_EXPENSE": return { ...state, expenses: state.expenses.filter((e) => e.id !== action.id) };
    case "ADD_INVOICE": return { ...state, invoices: [action.invoice, ...state.invoices] };
    case "REMOVE_INVOICE": return { ...state, invoices: state.invoices.filter((i) => i.id !== action.id) };
    case "SHOW_ADD_EXPENSE": return { ...state, showAddExpense: action.value };
    case "SHOW_ADD_INVOICE": return { ...state, showAddInvoice: action.value };
    case "SHOW_FISCAL_SETTINGS": return { ...state, showFiscalSettings: action.value };
    case "SET_DELETING": return { ...state, deletingId: action.id };
    case "SET_PDF_LOADING": return { ...state, pdfLoadingId: action.id };
    default: return state;
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  { value: "combustibil", label: "Combustibil", defaultDeductibility: 50 },
  { value: "echipament", label: "Echipament foto/video", defaultDeductibility: 100 },
  { value: "transport", label: "Transport", defaultDeductibility: 100 },
  { value: "software", label: "Software / Abonamente", defaultDeductibility: 100 },
  { value: "cazare", label: "Cazare", defaultDeductibility: 100 },
  { value: "alimentatie", label: "Alimentație", defaultDeductibility: 50 },
  { value: "marketing", label: "Marketing / Publicitate", defaultDeductibility: 100 },
  { value: "altele", label: "Alte cheltuieli", defaultDeductibility: 50 },
];

const MONTHS = ["Toate", "Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

function fmtCurrency(amount: number, currency = "RON"): string {
  return new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + " " + currency;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function categoryLabel(value: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

// ─── Add Expense Modal ────────────────────────────────────────────────────────

interface AddExpenseModalProps {
  accessToken: string;
  onClose: () => void;
  onAdded: (expense: Expense) => void;
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
  return (
    <div>
      <label className="block text-xs text-neutral-400 mb-1">{label}</label>
      <div className="flex gap-2">
        <button type="button" onClick={() => inputRef.current?.click()}
          className="flex-1 px-3 py-2 text-sm border border-neutral-700 text-neutral-300 rounded-lg hover:border-neutral-500 transition-colors text-left truncate">
          {slot.file ? slot.file.name : "Alege fișier..."}
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

function AddExpenseModal({ accessToken, onClose, onAdded }: AddExpenseModalProps) {
  const [date, setDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [category, setCategory] = React.useState("combustibil");
  const [description, setDescription] = React.useState("");
  const [supplier, setSupplier] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [currency, setCurrency] = React.useState("RON");
  const [deductibility, setDeductibility] = React.useState(50);
  const [facturaSlot, setFacturaSlot] = React.useState<DocSlot>({ file: null, scanning: false });
  const [chitantaSlot, setChitantaSlot] = React.useState<DocSlot>({ file: null, scanning: false });
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function handleCategoryChange(value: string) {
    setCategory(value);
    const cat = EXPENSE_CATEGORIES.find((c) => c.value === value);
    if (cat) setDeductibility(cat.defaultDeductibility);
  }

  async function handleScan(slot: DocSlot, setSlot: React.Dispatch<React.SetStateAction<DocSlot>>) {
    if (!slot.file) return;
    setSlot((prev) => ({ ...prev, scanning: true }));
    setError(null);
    try {
      const base64 = await fileToBase64(slot.file);
      const response = await fetch("/api/admin/expenses/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ fileBase64: base64, mediaType: slot.file.type }),
      });
      const data = await response.json();
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
      }
    } catch {
      setError("Scanare eșuată. Completează manual.");
    } finally {
      setSlot((prev) => ({ ...prev, scanning: false }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || !date || !category) return;
    setSaving(true);
    setUploading(true);
    setError(null);

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

    try {
      const response = await fetch("/api/admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          date, category,
          description: description || undefined,
          supplier: supplier || undefined,
          amount: Number(amount), currency, deductibility,
          factura, chitanta,
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const deductibleAmount = Math.round((Number(amount) * deductibility) / 100 * 100) / 100;
      onAdded({
        id: data.id,
        date: new Date(date).toISOString(),
        category,
        description: description || null,
        supplier: supplier || null,
        amount: Number(amount),
        currency,
        deductibility,
        deductibleAmount,
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

          <div className="grid grid-cols-2 gap-3">
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

          {error && <p className="text-red-400 text-sm">{error}</p>}

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
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-400">Monedă:</span>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)}
                  className="bg-neutral-800 border border-neutral-700 text-white text-xs rounded-lg px-2 py-1 focus:outline-none">
                  <option value="RON">RON</option>
                  <option value="EUR">EUR</option>
                </select>
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

  const authHeader = useMemo(() => ({ Authorization: `Bearer ${auth.accessToken}` }), [auth.accessToken]);

  // Load expenses
  useEffect(() => {
    if (!auth.accessToken) return;
    dispatch({ type: "SET_LOADING_EXPENSES", value: true });
    const params = state.selectedMonth > 0
      ? `?year=${state.selectedYear}&month=${state.selectedMonth}`
      : `?year=${state.selectedYear}`;
    fetch(`/api/admin/expenses${params}`, { headers: authHeader })
      .then((r) => r.json())
      .then((data) => dispatch({ type: "SET_EXPENSES", expenses: data.expenses ?? [] }))
      .catch(() => dispatch({ type: "SET_LOADING_EXPENSES", value: false }));
  }, [auth.accessToken, state.selectedYear, state.selectedMonth, authHeader]);

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
  }, [auth.accessToken, authHeader]);

  // Overview calculations
  const overview = useMemo(() => {
    const totalIncome = state.invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const totalExpenses = state.expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const totalDeductible = state.expenses.reduce((sum, exp) => sum + exp.deductibleAmount, 0);
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
      monthlyMap[month].expenses += exp.amount;
      monthlyMap[month].deductible += exp.deductibleAmount;
    });

    return { totalIncome, totalExpenses, totalDeductible, netBalance, taxableBase, monthlyMap };
  }, [state.invoices, state.expenses]);

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

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white text-xl font-light tracking-tight">Financiar</h1>
          </div>
          <select value={state.selectedYear} onChange={(e) => dispatch({ type: "SET_YEAR", year: Number(e.target.value) })}
            className="bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none">
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
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
                { label: "Incasări", value: overview.totalIncome, color: "text-emerald-400", desc: "din facturi emise" },
                { label: "Cheltuieli", value: overview.totalExpenses, color: "text-red-400", desc: "total plătit" },
                { label: "Deductibil", value: overview.totalDeductible, color: "text-amber-400", desc: "din cheltuieli" },
                { label: "Sold", value: overview.netBalance, color: overview.netBalance >= 0 ? "text-emerald-400" : "text-red-400", desc: "incasări − cheltuieli" },
              ].map(({ label, value, color, desc }) => (
                <div key={label} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                  <p className="text-xs text-neutral-500 mb-1">{label}</p>
                  <p className={`text-lg font-semibold ${color}`}>{fmtCurrency(value, "RON")}</p>
                  <p className="text-xs text-neutral-600 mt-0.5">{desc}</p>
                </div>
              ))}
            </div>

            {overview.taxableBase > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm">
                <p className="text-amber-300 font-medium mb-1">Estimare bază impozabilă {state.selectedYear}</p>
                <p className="text-neutral-300">Incasări − cheltuieli deductibile = <span className="text-white font-semibold">{fmtCurrency(overview.taxableBase, "RON")}</span></p>
                <p className="text-neutral-500 text-xs mt-1">Aceasta este o estimare. Consultă un expert fiscal pentru calculul final al impozitelor.</p>
              </div>
            )}

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
              {/* Month filter */}
              <div className="flex gap-1 flex-wrap">
                {MONTHS.map((monthName, index) => (
                  <button key={monthName} onClick={() => dispatch({ type: "SET_MONTH", month: index })}
                    className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${state.selectedMonth === index ? "bg-white text-neutral-900 border-white font-medium" : "border-neutral-700 text-neutral-400 hover:border-neutral-500"}`}>
                    {monthName}
                  </button>
                ))}
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
                  <span className="text-neutral-400">Total: <span className="text-white font-medium">{fmtCurrency(state.expenses.reduce((s, e) => s + e.amount, 0), "RON")}</span></span>
                  <span className="text-neutral-400">Deductibil: <span className="text-emerald-400 font-medium">{fmtCurrency(state.expenses.reduce((s, e) => s + e.deductibleAmount, 0), "RON")}</span></span>
                </div>
                <div className="space-y-2">
                  {state.expenses.map((expense) => (
                    <div key={expense.id} className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white text-sm font-medium">{fmtCurrency(expense.amount, expense.currency)}</span>
                          <span className="text-xs px-1.5 py-0.5 bg-neutral-800 text-neutral-400 rounded">{categoryLabel(expense.category)}</span>
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
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm text-amber-300">
                Completează datele fiscale PFA (CIF, IBAN etc.) pentru a putea genera PDF-uri de factură valide.
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
        <AddExpenseModal accessToken={auth.accessToken ?? ""} onClose={() => dispatch({ type: "SHOW_ADD_EXPENSE", value: false })}
          onAdded={(expense) => dispatch({ type: "ADD_EXPENSE", expense })} />
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
