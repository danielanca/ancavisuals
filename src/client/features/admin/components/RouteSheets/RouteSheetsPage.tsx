import React, { useCallback, useEffect, useReducer, useRef } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../../auth/useAuth";
import AncaLoader from "../../../../components/UI/AncaLoader";
import { useBodyScrollLock } from "../../../../hooks/useBodyScrollLock";

interface VehicleSettings {
  homeAddress: string;
  licensePlate: string;
  carMake: string;
  carModel: string;
  fuelType: string;
  fuelConsumption: number | "";
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

interface ClientEvent {
  id: string;
  clientName: string;
  eventDate: string | null;
  eventLocation?: string;
  eventType?: string;
}

type Modal = "add" | "vehicle" | null;

interface AddForm {
  eventId: string;
  date: string;
  departure: string;
  destination: string;
  purpose: string;
  kmDus: string;
  kmIntors: string;
}

interface State {
  sheets: RouteSheet[];
  loading: boolean;
  vehicle: VehicleSettings;
  vehicleLoaded: boolean;
  vehicleSaving: boolean;
  vehicleDraft: VehicleSettings;
  events: ClientEvent[];
  eventsLoaded: boolean;
  modal: Modal;
  addForm: AddForm;
  adding: boolean;
  addError: string;
  downloadingId: string | null;
  monthlyYear: number;
  monthlyMonth: number;
  downloadingMonthly: boolean;
  deletingId: string | null;
}

type Action =
  | { type: "SET_SHEETS"; sheets: RouteSheet[] }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_VEHICLE"; vehicle: VehicleSettings }
  | { type: "SET_VEHICLE_LOADED" }
  | { type: "SET_VEHICLE_SAVING"; saving: boolean }
  | { type: "SET_VEHICLE_DRAFT"; draft: VehicleSettings }
  | { type: "PATCH_VEHICLE_DRAFT"; patch: Partial<VehicleSettings> }
  | { type: "SET_EVENTS"; events: ClientEvent[] }
  | { type: "SET_EVENTS_LOADED" }
  | { type: "SET_MODAL"; modal: Modal }
  | { type: "PATCH_ADD_FORM"; patch: Partial<AddForm> }
  | { type: "SET_ADDING"; adding: boolean }
  | { type: "SET_ADD_ERROR"; error: string }
  | { type: "SHEET_ADDED"; sheet: RouteSheet }
  | { type: "SHEET_DELETED"; id: string }
  | { type: "SET_DOWNLOADING"; id: string | null }
  | { type: "SET_MONTHLY_YEAR"; year: number }
  | { type: "SET_MONTHLY_MONTH"; month: number }
  | { type: "SET_DOWNLOADING_MONTHLY"; value: boolean }
  | { type: "SET_DELETING"; id: string | null };

const DEFAULT_VEHICLE: VehicleSettings = {
  homeAddress: "",
  licensePlate: "",
  carMake: "",
  carModel: "",
  fuelType: "benzină",
  fuelConsumption: "",
};

const now = new Date();

const initialState: State = {
  sheets: [],
  loading: true,
  vehicle: DEFAULT_VEHICLE,
  vehicleLoaded: false,
  vehicleSaving: false,
  vehicleDraft: DEFAULT_VEHICLE,
  events: [],
  eventsLoaded: false,
  modal: null,
  addForm: {
    eventId: "",
    date: now.toISOString().slice(0, 10),
    departure: "",
    destination: "",
    purpose: "",
    kmDus: "",
    kmIntors: "",
  },
  adding: false,
  addError: "",
  downloadingId: null,
  monthlyYear: now.getFullYear(),
  monthlyMonth: now.getMonth() + 1,
  downloadingMonthly: false,
  deletingId: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_SHEETS": return { ...state, sheets: action.sheets };
    case "SET_LOADING": return { ...state, loading: action.loading };
    case "SET_VEHICLE": return { ...state, vehicle: action.vehicle, vehicleDraft: action.vehicle };
    case "SET_VEHICLE_LOADED": return { ...state, vehicleLoaded: true };
    case "SET_VEHICLE_SAVING": return { ...state, vehicleSaving: action.saving };
    case "SET_VEHICLE_DRAFT": return { ...state, vehicleDraft: action.draft };
    case "PATCH_VEHICLE_DRAFT": return { ...state, vehicleDraft: { ...state.vehicleDraft, ...action.patch } };
    case "SET_EVENTS": return { ...state, events: action.events };
    case "SET_EVENTS_LOADED": return { ...state, eventsLoaded: true };
    case "SET_MODAL": return { ...state, modal: action.modal, addError: "" };
    case "PATCH_ADD_FORM": return { ...state, addForm: { ...state.addForm, ...action.patch } };
    case "SET_ADDING": return { ...state, adding: action.adding };
    case "SET_ADD_ERROR": return { ...state, addError: action.error };
    case "SHEET_ADDED": return { ...state, sheets: [action.sheet, ...state.sheets], modal: null, adding: false };
    case "SHEET_DELETED": return { ...state, sheets: state.sheets.filter((sheet) => sheet.id !== action.id), deletingId: null };
    case "SET_DOWNLOADING": return { ...state, downloadingId: action.id };
    case "SET_MONTHLY_YEAR": return { ...state, monthlyYear: action.year };
    case "SET_MONTHLY_MONTH": return { ...state, monthlyMonth: action.month };
    case "SET_DOWNLOADING_MONTHLY": return { ...state, downloadingMonthly: action.value };
    case "SET_DELETING": return { ...state, deletingId: action.id };
    default: return state;
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const MONTHS = ["Ianuarie","Februarie","Martie","Aprilie","Mai","Iunie","Iulie","August","Septembrie","Octombrie","Noiembrie","Decembrie"];
const FUEL_TYPES = ["benzină", "motorină", "hibrid", "electric", "GPL"];

export default function RouteSheetsPage() {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const [state, dispatch] = useReducer(reducer, initialState);
  useBodyScrollLock(state.modal !== null);
  const hasFetchedRef = useRef(false);

  const token = auth.accessToken;

  const authFetch = useCallback((url: string, options?: RequestInit) =>
    fetch(url, { ...options, headers: { ...(options?.headers ?? {}), Authorization: `Bearer ${token}` } }),
    [token]
  );

  useEffect(() => {
    if (!token || hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    Promise.all([
      authFetch("/api/admin/route-sheets").then((r) => r.json()),
      authFetch("/api/admin/route-sheets/vehicle-settings").then((r) => r.json()),
      fetch("/api/admin/events").then((r) => r.json()),
    ]).then(([sheetsData, vehicleData, eventsData]) => {
      dispatch({ type: "SET_SHEETS", sheets: sheetsData.sheets ?? [] });
      if (vehicleData && !vehicleData.error) {
        const merged = { ...DEFAULT_VEHICLE, ...vehicleData };
        dispatch({ type: "SET_VEHICLE", vehicle: merged });
      }
      dispatch({ type: "SET_VEHICLE_LOADED" });
      if (eventsData.events) {
        const mapped: ClientEvent[] = eventsData.events
          .filter((event: { eventDate?: string | null }) => event.eventDate)
          .map((event: { id: string; clientName: string; eventDate: string; eventLocation?: string; eventType?: string }) => ({
            id: event.id,
            clientName: event.clientName,
            eventDate: event.eventDate,
            eventLocation: event.eventLocation ?? "",
            eventType: event.eventType ?? "",
          }));
        dispatch({ type: "SET_EVENTS", events: mapped });
        dispatch({ type: "SET_EVENTS_LOADED" });
      }
    }).finally(() => dispatch({ type: "SET_LOADING", loading: false }));
  }, [token, authFetch]);

  const saveVehicle = async () => {
    dispatch({ type: "SET_VEHICLE_SAVING", saving: true });
    await authFetch("/api/admin/route-sheets/vehicle-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.vehicleDraft),
    });
    dispatch({ type: "SET_VEHICLE", vehicle: state.vehicleDraft });
    dispatch({ type: "SET_VEHICLE_SAVING", saving: false });
    dispatch({ type: "SET_MODAL", modal: null });
  };

  const openAdd = () => {
    dispatch({
      type: "PATCH_ADD_FORM",
      patch: { departure: state.vehicle.homeAddress, eventId: "", date: new Date().toISOString().slice(0, 10), destination: "", purpose: "", kmDus: "", kmIntors: "" },
    });
    dispatch({ type: "SET_MODAL", modal: "add" });
  };

  const handleEventPick = (eventId: string) => {
    dispatch({ type: "PATCH_ADD_FORM", patch: { eventId } });
    if (!eventId) return;
    const event = state.events.find((ev) => ev.id === eventId);
    if (!event) return;
    dispatch({
      type: "PATCH_ADD_FORM",
      patch: {
        date: event.eventDate ? new Date(event.eventDate).toISOString().slice(0, 10) : state.addForm.date,
        destination: event.eventLocation ?? "",
        purpose: event.eventType
          ? `Fotografiere ${event.eventType.toLowerCase()} — ${event.clientName}`
          : `Fotografiere eveniment — ${event.clientName}`,
      },
    });
  };

  const submitAdd = async () => {
    const { date, departure, destination, purpose, kmDus, kmIntors, eventId } = state.addForm;
    if (!date || !departure || !destination || !purpose || !kmDus || !kmIntors) {
      dispatch({ type: "SET_ADD_ERROR", error: "Completează toate câmpurile obligatorii." });
      return;
    }
    dispatch({ type: "SET_ADDING", adding: true });
    dispatch({ type: "SET_ADD_ERROR", error: "" });
    try {
      const event = eventId ? state.events.find((ev) => ev.id === eventId) : null;
      const response = await authFetch("/api/admin/route-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          departure,
          destination,
          purpose,
          kmDus: Number(kmDus),
          kmIntors: Number(kmIntors),
          eventId: eventId || null,
          eventName: event ? event.clientName : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        dispatch({ type: "SET_ADD_ERROR", error: data.error ?? "Eroare la salvare." });
        return;
      }
      const kmTotal = Number(kmDus) + Number(kmIntors);
      const fuelConsumption = Number(state.vehicle.fuelConsumption);
      const newSheet: RouteSheet = {
        id: data.id,
        sheetNumber: data.sheetNumber,
        date: new Date(date).toISOString(),
        departure,
        destination,
        purpose,
        kmDus: Number(kmDus),
        kmIntors: Number(kmIntors),
        kmTotal,
        fuelConsumed: fuelConsumption ? Math.round(kmTotal * fuelConsumption / 100 * 100) / 100 : null,
        eventId: eventId || null,
        eventName: event ? event.clientName : null,
      };
      dispatch({ type: "SHEET_ADDED", sheet: newSheet });
    } catch (error) {
      dispatch({ type: "SET_ADD_ERROR", error: String(error) });
      dispatch({ type: "SET_ADDING", adding: false });
    }
  };

  const downloadSingle = async (sheet: RouteSheet) => {
    dispatch({ type: "SET_DOWNLOADING", id: sheet.id });
    try {
      const response = await authFetch(`/api/admin/route-sheets/${sheet.id}/pdf`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `foaie-parcurs-${sheet.sheetNumber}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      dispatch({ type: "SET_DOWNLOADING", id: null });
    }
  };

  const downloadMonthly = async () => {
    dispatch({ type: "SET_DOWNLOADING_MONTHLY", value: true });
    try {
      const response = await authFetch("/api/admin/route-sheets/pdf/monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: state.monthlyYear, month: state.monthlyMonth }),
      });
      if (!response.ok) {
        const data = await response.json();
        alert(data.error ?? "Nicio foaie pentru luna selectată.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `foi-parcurs-${state.monthlyYear}-${String(state.monthlyMonth).padStart(2, "0")}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      dispatch({ type: "SET_DOWNLOADING_MONTHLY", value: false });
    }
  };

  const deleteSheet = async (id: string) => {
    if (!confirm("Ștergi această foaie definitiv?")) return;
    dispatch({ type: "SET_DELETING", id });
    await authFetch(`/api/admin/route-sheets/${id}`, { method: "DELETE" });
    dispatch({ type: "SHEET_DELETED", id });
  };

  if (state.loading) return <AncaLoader />;

  const vehicleIncomplete = !state.vehicle.licensePlate || !state.vehicle.carMake || !state.vehicle.homeAddress;

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm">
          <button onClick={() => navigate("/admin")} className="text-neutral-500 hover:text-white transition-colors">
            Dashboard
          </button>
          <span className="text-neutral-700">/</span>
          <span className="text-neutral-300">Foi de parcurs</span>
        </nav>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-white text-2xl font-light tracking-tight">Foi de parcurs</h1>
            <p className="text-neutral-500 text-sm mt-1">{state.sheets.length} {state.sheets.length === 1 ? "foaie" : "foi"} salvate</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => { dispatch({ type: "SET_VEHICLE_DRAFT", draft: state.vehicle }); dispatch({ type: "SET_MODAL", modal: "vehicle" }); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-700 text-neutral-400 text-sm hover:border-neutral-500 hover:text-white transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Mașină
            </button>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Adaugă foaie
            </button>
          </div>
        </div>

        {/* Vehicle info banner or warning */}
        {vehicleIncomplete ? (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-amber-400 text-lg">⚠️</span>
            <div>
              <p className="text-amber-300 text-sm font-medium">Configurează datele mașinii</p>
              <p className="text-amber-600 text-xs mt-0.5">Adresa de plecare, nr. înmatriculare și marca sunt necesare pentru a genera foi.</p>
            </div>
            <button
              onClick={() => { dispatch({ type: "SET_VEHICLE_DRAFT", draft: state.vehicle }); dispatch({ type: "SET_MODAL", modal: "vehicle" }); }}
              className="ml-auto px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs hover:bg-amber-500/30 transition-colors whitespace-nowrap"
            >
              Completează
            </button>
          </div>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 flex items-center gap-4 text-sm">
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1">
              <div><p className="text-neutral-600 text-xs">Nr. înmatriculare</p><p className="text-white font-mono font-semibold">{state.vehicle.licensePlate || "—"}</p></div>
              <div><p className="text-neutral-600 text-xs">Mașina</p><p className="text-white">{state.vehicle.carMake} {state.vehicle.carModel}</p></div>
              <div><p className="text-neutral-600 text-xs">Carburant</p><p className="text-white">{state.vehicle.fuelType} · {state.vehicle.fuelConsumption || "—"} L/100</p></div>
              <div><p className="text-neutral-600 text-xs">Adresă plecare</p><p className="text-white text-xs truncate">{state.vehicle.homeAddress || "—"}</p></div>
            </div>
          </div>
        )}

        {/* Monthly PDF generator */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
          <p className="text-neutral-400 text-sm font-medium flex-shrink-0">PDF lunar:</p>
          <select
            value={state.monthlyMonth}
            onChange={(event) => dispatch({ type: "SET_MONTHLY_MONTH", month: Number(event.target.value) })}
            className="bg-neutral-800 text-white text-sm border border-neutral-700 rounded-lg px-3 py-1.5 outline-none focus:border-violet-500"
          >
            {MONTHS.map((name, index) => (
              <option key={index + 1} value={index + 1}>{name}</option>
            ))}
          </select>
          <select
            value={state.monthlyYear}
            onChange={(event) => dispatch({ type: "SET_MONTHLY_YEAR", year: Number(event.target.value) })}
            className="bg-neutral-800 text-white text-sm border border-neutral-700 rounded-lg px-3 py-1.5 outline-none focus:border-violet-500"
          >
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <button
            onClick={downloadMonthly}
            disabled={state.downloadingMonthly}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-neutral-700 text-white text-sm hover:bg-neutral-600 disabled:opacity-40 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {state.downloadingMonthly ? "Se generează..." : "Descarcă PDF"}
          </button>
        </div>

        {/* Sheets list */}
        {state.sheets.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-neutral-500 text-sm">Nicio foaie de parcurs. Apasă "Adaugă foaie" pentru a începe.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {state.sheets.map((sheet) => (
              <div key={sheet.id} className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-400 text-xs font-mono font-semibold shrink-0">
                  {sheet.sheetNumber}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white text-sm font-medium">{fmtDate(sheet.date)}</span>
                    <span className="text-neutral-600 text-xs">·</span>
                    <span className="text-neutral-400 text-xs truncate max-w-[200px]">{sheet.destination}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-neutral-500 text-xs">{sheet.kmTotal} km total</span>
                    {sheet.fuelConsumed != null && (
                      <span className="text-neutral-600 text-xs">· {sheet.fuelConsumed} L</span>
                    )}
                    {sheet.eventName && (
                      <span className="text-violet-400/70 text-xs">· {sheet.eventName}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => downloadSingle(sheet)}
                    disabled={state.downloadingId === sheet.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 text-xs hover:bg-neutral-700 disabled:opacity-40 transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    {state.downloadingId === sheet.id ? "..." : "PDF"}
                  </button>
                  <button
                    onClick={() => deleteSheet(sheet.id)}
                    disabled={state.deletingId === sheet.id}
                    className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 text-xs flex items-center justify-center hover:bg-red-500/20 disabled:opacity-40 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Vehicle settings modal */}
      {state.modal === "vehicle" && (
        <VehicleModal
          draft={state.vehicleDraft}
          saving={state.vehicleSaving}
          onPatch={(patch) => dispatch({ type: "PATCH_VEHICLE_DRAFT", patch })}
          onSave={saveVehicle}
          onClose={() => dispatch({ type: "SET_MODAL", modal: null })}
        />
      )}

      {/* Add sheet modal */}
      {state.modal === "add" && (
        <AddModal
          form={state.addForm}
          events={state.events}
          adding={state.adding}
          error={state.addError}
          onPatch={(patch) => dispatch({ type: "PATCH_ADD_FORM", patch })}
          onEventPick={handleEventPick}
          onSubmit={submitAdd}
          onClose={() => dispatch({ type: "SET_MODAL", modal: null })}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-neutral-400 text-xs mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full bg-neutral-800 text-white text-sm border border-neutral-700 rounded-lg px-3 py-2 outline-none focus:border-violet-500 transition-colors placeholder-neutral-600";
const selectCls = "w-full bg-neutral-800 text-white text-sm border border-neutral-700 rounded-lg px-3 py-2 outline-none focus:border-violet-500 transition-colors";

function VehicleModal({
  draft,
  saving,
  onPatch,
  onSave,
  onClose,
}: {
  draft: VehicleSettings;
  saving: boolean;
  onPatch: (patch: Partial<VehicleSettings>) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-white text-base font-semibold">Date mașină & plecare</h2>

        <Field label="Adresă plecare (acasă)">
          <input className={inputCls} placeholder="ex: Turda, Str. Plopilor 3" value={draft.homeAddress} onChange={(e) => onPatch({ homeAddress: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nr. înmatriculare">
            <input className={inputCls} placeholder="ex: CJ 123 ABC" value={draft.licensePlate} onChange={(e) => onPatch({ licensePlate: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Tip carburant">
            <select className={selectCls} value={draft.fuelType} onChange={(e) => onPatch({ fuelType: e.target.value })}>
              {FUEL_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </Field>
          <Field label="Marcă">
            <input className={inputCls} placeholder="ex: Dacia" value={draft.carMake} onChange={(e) => onPatch({ carMake: e.target.value })} />
          </Field>
          <Field label="Model">
            <input className={inputCls} placeholder="ex: Logan" value={draft.carModel} onChange={(e) => onPatch({ carModel: e.target.value })} />
          </Field>
        </div>
        <Field label="Consum normat (L/100km)">
          <input className={inputCls} type="number" step="0.1" min="0" placeholder="ex: 6.5" value={draft.fuelConsumption} onChange={(e) => onPatch({ fuelConsumption: e.target.value === "" ? "" : Number(e.target.value) })} />
        </Field>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-700 text-neutral-300 text-sm hover:border-neutral-500 transition-colors">
            Anulează
          </button>
          <button onClick={onSave} disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 disabled:opacity-40 transition-colors">
            {saving ? "Se salvează..." : "Salvează"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddModal({
  form,
  events,
  adding,
  error,
  onPatch,
  onEventPick,
  onSubmit,
  onClose,
}: {
  form: AddForm;
  events: ClientEvent[];
  adding: boolean;
  error: string;
  onPatch: (patch: Partial<AddForm>) => void;
  onEventPick: (id: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const kmDus = Number(form.kmDus) || 0;
  const kmIntors = Number(form.kmIntors) || 0;
  const kmTotal = kmDus + kmIntors;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-white text-base font-semibold">Adaugă foaie de parcurs</h2>

        {events.length > 0 && (
          <Field label="Eveniment (opțional — pre-completează datele)">
            <select className={selectCls} value={form.eventId} onChange={(e) => onEventPick(e.target.value)}>
              <option value="">— Fără eveniment / manual —</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.clientName}{event.eventDate ? ` · ${new Date(event.eventDate).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" })}` : ""}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Data deplasării *">
          <input className={inputCls} type="date" value={form.date} onChange={(e) => onPatch({ date: e.target.value })} />
        </Field>

        <Field label="Adresă plecare *">
          <input className={inputCls} placeholder="ex: Turda, Str. Plopilor 3" value={form.departure} onChange={(e) => onPatch({ departure: e.target.value })} />
        </Field>

        <Field label="Destinație *">
          <input className={inputCls} placeholder="ex: Cluj-Napoca, Restaurant X" value={form.destination} onChange={(e) => onPatch({ destination: e.target.value })} />
        </Field>

        <Field label="Scopul deplasării *">
          <input className={inputCls} placeholder="ex: Fotografiere nuntă — Ion și Maria" value={form.purpose} onChange={(e) => onPatch({ purpose: e.target.value })} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Km dus *">
            <input className={inputCls} type="number" min="0" placeholder="0" value={form.kmDus} onChange={(e) => onPatch({ kmDus: e.target.value })} />
          </Field>
          <Field label="Km întors *">
            <input className={inputCls} type="number" min="0" placeholder="0" value={form.kmIntors} onChange={(e) => onPatch({ kmIntors: e.target.value })} />
          </Field>
        </div>

        {kmTotal > 0 && (
          <div className="bg-neutral-800 rounded-xl px-4 py-2.5 flex items-center justify-between">
            <span className="text-neutral-400 text-sm">Total km</span>
            <span className="text-white font-semibold text-sm">{kmTotal} km</span>
          </div>
        )}

        {error && <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-700 text-neutral-300 text-sm hover:border-neutral-500 transition-colors">
            Anulează
          </button>
          <button onClick={onSubmit} disabled={adding} className="flex-1 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 disabled:opacity-40 transition-colors">
            {adding ? "Se salvează..." : "Salvează foaia"}
          </button>
        </div>
      </div>
    </div>
  );
}
