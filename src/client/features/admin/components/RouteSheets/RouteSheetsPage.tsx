import React, { useReducer, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../../auth/useAuth";
import type { ClientEvent } from "../../types";
import Breadcrumb from "../Breadcrumb";

// ─── Types ───────────────────────────────────────────────────────────────────

interface VehicleSettings {
  licensePlate: string;
  carMake: string;
  carModel: string;
  fuelType: string;
  fuelConsumption: number | null;
  defaultDeparture: string;
}

interface RouteSheet {
  id: string;
  sheetNumber: number;
  date: string;
  departure: string;
  destination: string;
  purpose: string;
  kmDus: number;
  kmIntors: number;
  kmTotal: number;
  fuelConsumed: number | null;
  eventId: string | null;
  eventName: string | null;
}

interface AddForm {
  date: string;
  departure: string;
  destination: string;
  purpose: string;
  kmDus: string;
  kmIntors: string;
  eventId: string;
}

interface State {
  sheets: RouteSheet[];
  vehicle: Partial<VehicleSettings>;
  events: ClientEvent[];
  loading: boolean;
  showAddModal: boolean;
  showVehicleModal: boolean;
  addForm: AddForm;
  saving: boolean;
  deletingId: string | null;
  pdfLoadingId: string | null;
  monthlyYear: number;
  monthlyMonth: number;
  monthlyLoading: boolean;
}

type Action =
  | { type: "SET_SHEETS"; sheets: RouteSheet[] }
  | { type: "SET_VEHICLE"; vehicle: Partial<VehicleSettings> }
  | { type: "SET_EVENTS"; events: ClientEvent[] }
  | { type: "SET_LOADING"; value: boolean }
  | { type: "SHOW_ADD"; value: boolean }
  | { type: "SHOW_VEHICLE"; value: boolean }
  | { type: "SET_ADD_FORM"; form: Partial<AddForm> }
  | { type: "RESET_ADD_FORM" }
  | { type: "SET_SAVING"; value: boolean }
  | { type: "ADD_SHEET"; sheet: RouteSheet }
  | { type: "REMOVE_SHEET"; id: string }
  | { type: "SET_DELETING"; id: string | null }
  | { type: "SET_PDF_LOADING"; id: string | null }
  | { type: "SET_MONTHLY_YEAR"; year: number }
  | { type: "SET_MONTHLY_MONTH"; month: number }
  | { type: "SET_MONTHLY_LOADING"; value: boolean };

const CURRENT_YEAR = new Date().getFullYear();

const EMPTY_FORM: AddForm = {
  date: new Date().toISOString().split("T")[0],
  departure: "",
  destination: "",
  purpose: "",
  kmDus: "",
  kmIntors: "",
  eventId: "",
};

const initialState: State = {
  sheets: [],
  vehicle: {},
  events: [],
  loading: true,
  showAddModal: false,
  showVehicleModal: false,
  addForm: EMPTY_FORM,
  saving: false,
  deletingId: null,
  pdfLoadingId: null,
  monthlyYear: CURRENT_YEAR,
  monthlyMonth: new Date().getMonth() + 1,
  monthlyLoading: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_SHEETS": return { ...state, sheets: action.sheets, loading: false };
    case "SET_VEHICLE": return { ...state, vehicle: action.vehicle };
    case "SET_EVENTS": return { ...state, events: action.events };
    case "SET_LOADING": return { ...state, loading: action.value };
    case "SHOW_ADD": return { ...state, showAddModal: action.value };
    case "SHOW_VEHICLE": return { ...state, showVehicleModal: action.value };
    case "SET_ADD_FORM": return { ...state, addForm: { ...state.addForm, ...action.form } };
    case "RESET_ADD_FORM": return { ...state, addForm: { ...EMPTY_FORM, departure: state.vehicle.defaultDeparture ?? "" } };
    case "SET_SAVING": return { ...state, saving: action.value };
    case "ADD_SHEET": return { ...state, sheets: [action.sheet, ...state.sheets] };
    case "REMOVE_SHEET": return { ...state, sheets: state.sheets.filter((s) => s.id !== action.id) };
    case "SET_DELETING": return { ...state, deletingId: action.id };
    case "SET_PDF_LOADING": return { ...state, pdfLoadingId: action.id };
    case "SET_MONTHLY_YEAR": return { ...state, monthlyYear: action.year };
    case "SET_MONTHLY_MONTH": return { ...state, monthlyMonth: action.month };
    case "SET_MONTHLY_LOADING": return { ...state, monthlyLoading: action.value };
    default: return state;
  }
}

const MONTHS = ["Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── Vehicle Modal ────────────────────────────────────────────────────────────

interface VehicleModalProps {
  accessToken: string;
  current: Partial<VehicleSettings>;
  onClose: () => void;
  onSaved: (vehicle: Partial<VehicleSettings>) => void;
}

function VehicleModal({ accessToken, current, onClose, onSaved }: VehicleModalProps) {
  const [form, setForm] = React.useState<Partial<VehicleSettings>>({ ...current });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function handleChange(field: keyof VehicleSettings, value: string) {
    setForm((prev) => ({
      ...prev,
      [field]: field === "fuelConsumption" ? (value === "" ? null : Number(value)) : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/route-sheets/vehicle-settings", {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-neutral-800">
          <h2 className="text-white font-semibold">Setări vehicul</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {[
            { key: "licensePlate" as const, label: "Nr. înmatriculare", placeholder: "B 123 ABC" },
            { key: "carMake" as const, label: "Marcă", placeholder: "Volkswagen" },
            { key: "carModel" as const, label: "Model", placeholder: "Passat" },
            { key: "fuelType" as const, label: "Tip carburant", placeholder: "Motorină" },
            { key: "defaultDeparture" as const, label: "Adresă plecare implicită", placeholder: "Str. Exemplu, Cluj-Napoca" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs text-neutral-400 mb-1">{label}</label>
              <input type="text" value={(form[key] as string) ?? ""} onChange={(e) => handleChange(key, e.target.value)} placeholder={placeholder}
                className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-500" />
            </div>
          ))}
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Consum normat (L/100km)</label>
            <input type="number" value={form.fuelConsumption ?? ""} onChange={(e) => handleChange("fuelConsumption", e.target.value)}
              min="0" step="0.1" placeholder="6.5"
              className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-500" />
          </div>
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

// ─── Add Sheet Modal ──────────────────────────────────────────────────────────

interface AddSheetModalProps {
  accessToken: string;
  form: AddForm;
  events: ClientEvent[];
  vehicle: Partial<VehicleSettings>;
  onFormChange: (updates: Partial<AddForm>) => void;
  onClose: () => void;
  onAdded: (sheet: RouteSheet) => void;
}

function AddSheetModal({ accessToken, form, events, vehicle, onFormChange, onClose, onAdded }: AddSheetModalProps) {
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const kmTotal = useMemo(() => {
    const dus = Number(form.kmDus) || 0;
    const intors = Number(form.kmIntors) || 0;
    return dus + intors;
  }, [form.kmDus, form.kmIntors]);

  const fuelEstimate = useMemo(() => {
    if (!vehicle.fuelConsumption || !kmTotal) return null;
    return Math.round((kmTotal * vehicle.fuelConsumption) / 100 * 100) / 100;
  }, [vehicle.fuelConsumption, kmTotal]);

  function prefillFromEvent(eventId: string) {
    onFormChange({ eventId });
    if (!eventId) return;
    const event = events.find((e) => e.id === eventId);
    if (!event) return;
    onFormChange({
      eventId,
      date: event.eventDate ? event.eventDate.toISOString().split("T")[0] : form.date,
      destination: event.client.fullName ? `Locație ${event.type} - ${event.client.fullName}` : form.destination,
      purpose: `Deplasare pentru ${event.type}`,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.departure || !form.destination || !form.purpose || !form.kmDus || !form.kmIntors) return;
    setSaving(true);
    setError(null);

    const event = form.eventId ? events.find((ev) => ev.id === form.eventId) : null;

    try {
      const response = await fetch("/api/admin/route-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          date: form.date,
          departure: form.departure,
          destination: form.destination,
          purpose: form.purpose,
          kmDus: Number(form.kmDus),
          kmIntors: Number(form.kmIntors),
          eventId: form.eventId || undefined,
          eventName: event ? `${event.type} - ${event.client.fullName}` : undefined,
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      onAdded({
        id: data.id,
        sheetNumber: data.sheetNumber,
        date: new Date(form.date).toISOString(),
        departure: form.departure,
        destination: form.destination,
        purpose: form.purpose,
        kmDus: Number(form.kmDus),
        kmIntors: Number(form.kmIntors),
        kmTotal,
        fuelConsumed: fuelEstimate,
        eventId: form.eventId || null,
        eventName: event ? `${event.type} - ${event.client.fullName}` : null,
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
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-neutral-800">
          <h2 className="text-white font-semibold">Foaie de parcurs nouă</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Completează din eveniment (opțional)</label>
            <select value={form.eventId} onChange={(e) => prefillFromEvent(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-500">
              <option value="">— Manual —</option>
              {events.filter((ev) => ev.eventDate).sort((a, b) => (b.eventDate?.getTime() ?? 0) - (a.eventDate?.getTime() ?? 0)).map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.client.fullName} · {ev.type} · {ev.eventDate?.toLocaleDateString("ro-RO")}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-1">Data *</label>
            <input type="date" value={form.date} onChange={(e) => onFormChange({ date: e.target.value })} required
              className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-500" />
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-1">Plecare *</label>
            <input type="text" value={form.departure} onChange={(e) => onFormChange({ departure: e.target.value })} required
              placeholder={vehicle.defaultDeparture ?? "Adresă plecare..."}
              className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-500" />
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-1">Destinație *</label>
            <input type="text" value={form.destination} onChange={(e) => onFormChange({ destination: e.target.value })} required
              className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-500" />
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-1">Scopul deplasării *</label>
            <input type="text" value={form.purpose} onChange={(e) => onFormChange({ purpose: e.target.value })} required
              className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-500" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Km dus *</label>
              <input type="number" value={form.kmDus} onChange={(e) => onFormChange({ kmDus: e.target.value })} min="0" required
                className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-500" />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Km întors *</label>
              <input type="number" value={form.kmIntors} onChange={(e) => onFormChange({ kmIntors: e.target.value })} min="0" required
                className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-500" />
            </div>
          </div>

          {kmTotal > 0 && (
            <div className="bg-neutral-800 rounded-lg px-4 py-3 text-sm space-y-1">
              <div className="flex justify-between text-neutral-300">
                <span>Total km:</span>
                <span className="font-semibold text-white">{kmTotal} km</span>
              </div>
              {fuelEstimate != null && (
                <div className="flex justify-between text-neutral-300">
                  <span>Combustibil estimat:</span>
                  <span className="font-semibold text-amber-400">{fuelEstimate} L</span>
                </div>
              )}
            </div>
          )}

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

// ─── Main Page ────────────────────────────────────────────────────────────────

const RouteSheetsPage: React.FC = () => {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const [state, dispatch] = useReducer(reducer, initialState);

  const authHeader = useMemo(() => ({ Authorization: `Bearer ${auth.accessToken}` }), [auth.accessToken]);

  useEffect(() => {
    if (!auth.accessToken) return;
    Promise.all([
      fetch("/api/admin/route-sheets", { headers: authHeader }).then((r) => r.json()),
      fetch("/api/admin/route-sheets/vehicle-settings", { headers: authHeader }).then((r) => r.json()),
      fetch("/api/admin/events", { headers: authHeader }).then((r) => r.json()),
    ]).then(([sheetsData, vehicleData, eventsData]) => {
      dispatch({ type: "SET_SHEETS", sheets: sheetsData.sheets ?? [] });
      dispatch({ type: "SET_VEHICLE", vehicle: vehicleData ?? {} });
      if (eventsData.events) {
        const events = eventsData.events.map((event: ClientEvent & { eventDate: string | null; createdAt: string }) => ({
          ...event,
          eventDate: event.eventDate ? new Date(event.eventDate) : null,
          createdAt: new Date(event.createdAt),
        }));
        dispatch({ type: "SET_EVENTS", events });
      }
    }).catch(() => dispatch({ type: "SET_LOADING", value: false }));
  }, [auth.accessToken, authHeader]);

  function openAdd() {
    dispatch({ type: "RESET_ADD_FORM" });
    dispatch({ type: "SHOW_ADD", value: true });
  }

  async function handleDelete(id: string) {
    dispatch({ type: "SET_DELETING", id });
    await fetch(`/api/admin/route-sheets/${id}`, { method: "DELETE", headers: authHeader });
    dispatch({ type: "REMOVE_SHEET", id });
    dispatch({ type: "SET_DELETING", id: null });
  }

  async function handlePdf(sheetId: string, sheetNumber: number) {
    dispatch({ type: "SET_PDF_LOADING", id: sheetId });
    try {
      const response = await fetch(`/api/admin/route-sheets/${sheetId}/pdf`, { headers: authHeader });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `foaie-parcurs-${sheetNumber}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      dispatch({ type: "SET_PDF_LOADING", id: null });
    }
  }

  async function handleMonthlyPdf() {
    dispatch({ type: "SET_MONTHLY_LOADING", value: true });
    try {
      const response = await fetch("/api/admin/route-sheets/pdf/monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ year: state.monthlyYear, month: state.monthlyMonth }),
      });
      if (response.status === 404) {
        alert("Nicio foaie de parcurs pentru luna selectată.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `foi-parcurs-${state.monthlyYear}-${String(state.monthlyMonth).padStart(2, "0")}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      dispatch({ type: "SET_MONTHLY_LOADING", value: false });
    }
  }

  const vehicleComplete = state.vehicle.licensePlate && state.vehicle.fuelConsumption;

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-4xl mx-auto space-y-6">

        <Breadcrumb />

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-white text-xl font-light tracking-tight">Foi de parcurs</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => dispatch({ type: "SHOW_VEHICLE", value: true })}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs border rounded-lg transition-colors ${!vehicleComplete ? "border-amber-500/50 text-amber-400 bg-amber-500/10" : "border-neutral-700 text-neutral-400 hover:border-neutral-500"}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 1 0 .01 14.14" /></svg>
              Vehicul{!vehicleComplete ? " !" : ""}
            </button>
            <button onClick={openAdd}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors font-medium">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Foaie nouă
            </button>
          </div>
        </div>

        {/* Vehicle banner */}
        {state.vehicle.licensePlate && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm flex items-center gap-4 flex-wrap">
            <span className="text-white font-mono font-semibold">{state.vehicle.licensePlate}</span>
            <span className="text-neutral-400">{state.vehicle.carMake} {state.vehicle.carModel}</span>
            {state.vehicle.fuelType && <span className="text-neutral-500">{state.vehicle.fuelType}</span>}
            {state.vehicle.fuelConsumption && <span className="text-amber-400">{state.vehicle.fuelConsumption} L/100km</span>}
          </div>
        )}

        {/* Monthly PDF generator */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-4">
          <p className="text-xs text-neutral-500 mb-3 uppercase tracking-wide">Generare PDF lunar</p>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={state.monthlyMonth} onChange={(e) => dispatch({ type: "SET_MONTHLY_MONTH", month: Number(e.target.value) })}
              className="bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none">
              {MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
            </select>
            <select value={state.monthlyYear} onChange={(e) => dispatch({ type: "SET_MONTHLY_YEAR", year: Number(e.target.value) })}
              className="bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none">
              {YEARS.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
            <button onClick={handleMonthlyPdf} disabled={state.monthlyLoading}
              className="flex items-center gap-1.5 px-4 py-2 text-sm border border-neutral-700 text-neutral-300 rounded-lg hover:border-neutral-500 hover:text-white transition-colors disabled:opacity-50">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
              {state.monthlyLoading ? "Se generează..." : "Descarcă PDF lunar"}
            </button>
          </div>
        </div>

        {/* Sheets list */}
        {state.loading ? (
          <p className="text-neutral-500 text-sm text-center py-10">Se încarcă...</p>
        ) : state.sheets.length === 0 ? (
          <div className="text-center py-16 text-neutral-600">
            <p className="text-sm">Nicio foaie de parcurs.</p>
            <p className="text-xs mt-1">Apasă "Foaie nouă" pentru a adăuga prima deplasare.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {state.sheets.map((sheet) => (
              <div key={sheet.id} className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-neutral-500 text-xs font-mono">#{sheet.sheetNumber}</span>
                    <span className="text-white text-sm font-medium">{sheet.destination}</span>
                    <span className="text-neutral-400 text-sm">{sheet.kmTotal} km</span>
                    {sheet.fuelConsumed != null && <span className="text-amber-400 text-xs">{sheet.fuelConsumed} L</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500">
                    <span>{fmtDate(sheet.date)}</span>
                    <span>·</span>
                    <span>{sheet.purpose}</span>
                    {sheet.eventName && <><span>·</span><span className="text-violet-400">{sheet.eventName}</span></>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => handlePdf(sheet.id, sheet.sheetNumber)} disabled={state.pdfLoadingId === sheet.id}
                    className="text-xs flex items-center gap-1 px-2.5 py-1.5 border border-neutral-700 text-neutral-400 rounded-lg hover:border-neutral-500 hover:text-white transition-colors disabled:opacity-50">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                    {state.pdfLoadingId === sheet.id ? "..." : "PDF"}
                  </button>
                  <button onClick={() => handleDelete(sheet.id)} disabled={state.deletingId === sheet.id}
                    className="text-neutral-600 hover:text-red-400 transition-colors disabled:opacity-50">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {state.showVehicleModal && (
        <VehicleModal accessToken={auth.accessToken ?? ""} current={state.vehicle}
          onClose={() => dispatch({ type: "SHOW_VEHICLE", value: false })}
          onSaved={(vehicle) => dispatch({ type: "SET_VEHICLE", vehicle })} />
      )}

      {state.showAddModal && (
        <AddSheetModal accessToken={auth.accessToken ?? ""} form={state.addForm} events={state.events} vehicle={state.vehicle}
          onFormChange={(updates) => dispatch({ type: "SET_ADD_FORM", form: updates })}
          onClose={() => dispatch({ type: "SHOW_ADD", value: false })}
          onAdded={(sheet) => { dispatch({ type: "ADD_SHEET", sheet }); dispatch({ type: "SHOW_ADD", value: false }); }} />
      )}
    </div>
  );
};

export default RouteSheetsPage;
