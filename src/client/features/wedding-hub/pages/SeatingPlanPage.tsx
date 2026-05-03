import React, { useReducer, useMemo, useRef } from "react";
import { useWeddingHub } from "../context/WeddingHubContext";
import { useWeddingHubAuth } from "../context/WeddingHubAuthContext";
import TableCard from "../components/TableCard";
import Loader from "../../../components/UI/Loader";
import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";
import type { RsvpStatus } from "../types";
import { printSeatingPlan } from "../utils/seatingPlanPdf";

const RSVP_ACCENT_CLASSES: Record<RsvpStatus, string> = {
  asteptare: "ring-1 ring-inset ring-yellow-400/40",
  confirmat: "ring-1 ring-inset ring-green-400/40",
  refuzat: "ring-1 ring-inset ring-red-400/40",
};

const RSVP_SELECTED_CLASSES: Record<RsvpStatus, string> = {
  asteptare: "bg-yellow-500/15 text-yellow-100 hover:bg-yellow-500/20",
  confirmat: "bg-green-500/15 text-green-100 hover:bg-green-500/20",
  refuzat: "bg-red-500/15 text-red-100 hover:bg-red-500/20",
};

type PageState = {
  newTableName: string;
  newTableAlias: string;
  newTableCapacity: string;
  isCreatingTable: boolean;
  createErrorMessage: string | null;
  showBulkCreateModal: boolean;
  showBulkInfoModal: boolean;
  bulkTableCount: number;
  bulkTableCapacity: number;
  bulkPrefix: string;
  bulkStartIndex: number;
  isBulkCreating: boolean;
  bulkCreateError: string | null;
  deletingTableId: string | null;
  updatingGuestId: string | null;
  selectedUnassignedGuestId: string | null;
  unassignedFilter: RsvpStatus | "all";
};

type PageAction =
  | { type: "SET_TABLE_NAME"; value: string }
  | { type: "SET_TABLE_ALIAS"; value: string }
  | { type: "SET_TABLE_CAPACITY"; value: string }
  | { type: "SET_CREATING"; value: boolean }
  | { type: "SET_CREATE_ERROR"; value: string | null }
  | { type: "OPEN_BULK_CREATE"; bulkStartIndex: number }
  | { type: "CLOSE_BULK_CREATE" }
  | { type: "OPEN_BULK_INFO" }
  | { type: "CLOSE_BULK_INFO" }
  | { type: "SET_BULK_COUNT"; value: number }
  | { type: "SET_BULK_CAPACITY"; value: number }
  | { type: "SET_BULK_PREFIX"; value: string }
  | { type: "SET_BULK_START_INDEX"; value: number }
  | { type: "SET_BULK_CREATING"; value: boolean }
  | { type: "SET_BULK_ERROR"; value: string | null }
  | { type: "SET_DELETING_TABLE"; tableId: string | null }
  | { type: "SET_UPDATING_GUEST"; guestId: string | null }
  | { type: "SET_SELECTED_UNASSIGNED_GUEST"; guestId: string | null }
  | { type: "SET_UNASSIGNED_FILTER"; value: RsvpStatus | "all" };

function pageReducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case "SET_TABLE_NAME": return { ...state, newTableName: action.value };
    case "SET_TABLE_ALIAS": return { ...state, newTableAlias: action.value };
    case "SET_TABLE_CAPACITY": return { ...state, newTableCapacity: action.value };
    case "SET_CREATING": return { ...state, isCreatingTable: action.value };
    case "SET_CREATE_ERROR": return { ...state, createErrorMessage: action.value, isCreatingTable: false };
    case "OPEN_BULK_CREATE":
      return {
        ...state,
        showBulkCreateModal: true,
        bulkStartIndex: action.bulkStartIndex,
        bulkCreateError: null,
      };
    case "CLOSE_BULK_CREATE":
      return {
        ...state,
        showBulkCreateModal: false,
        isBulkCreating: false,
        bulkCreateError: null,
      };
    case "OPEN_BULK_INFO":
      return { ...state, showBulkInfoModal: true };
    case "CLOSE_BULK_INFO":
      return { ...state, showBulkInfoModal: false };
    case "SET_BULK_COUNT": return { ...state, bulkTableCount: action.value };
    case "SET_BULK_CAPACITY": return { ...state, bulkTableCapacity: action.value };
    case "SET_BULK_PREFIX": return { ...state, bulkPrefix: action.value };
    case "SET_BULK_START_INDEX": return { ...state, bulkStartIndex: action.value };
    case "SET_BULK_CREATING": return { ...state, isBulkCreating: action.value };
    case "SET_BULK_ERROR": return { ...state, bulkCreateError: action.value, isBulkCreating: false };
    case "SET_DELETING_TABLE": return { ...state, deletingTableId: action.tableId };
    case "SET_UPDATING_GUEST": return { ...state, updatingGuestId: action.guestId };
    case "SET_SELECTED_UNASSIGNED_GUEST": return { ...state, selectedUnassignedGuestId: action.guestId };
    case "SET_UNASSIGNED_FILTER": return { ...state, unassignedFilter: action.value, selectedUnassignedGuestId: null };
    default: return state;
  }
}

function getGuestFamilySummary(guest: { accompanyingAdultNames?: string[]; childrenNames?: string[]; sameTableWithFamily?: boolean }): string | null {
  const familyMembers = [
    ...(guest.accompanyingAdultNames ?? []).map((name) => name.trim()).filter(Boolean),
    ...(guest.childrenNames ?? []).map((name) => name.trim()).filter(Boolean),
  ];

  if (familyMembers.length === 0) return guest.sameTableWithFamily ? "Vrea să stea împreună cu familia" : null;

  const preview = familyMembers.slice(0, 3).join(", ");
  const suffix = familyMembers.length > 3 ? ` +${familyMembers.length - 3}` : "";
  return `${preview}${suffix}`;
}

const SeatingPlanPage: React.FC = () => {
  const { state, addTable, removeTable, updateGuest, updateTable } = useWeddingHub();
  const { coupleAuth } = useWeddingHubAuth();
  const { guests, tables, loadingTables, weddingProfile } = state;
  const tablesSectionRef = useRef<HTMLDivElement>(null);

  const [pageState, dispatch] = useReducer(pageReducer, {
    newTableName: "",
    newTableAlias: "",
    newTableCapacity: "8",
    isCreatingTable: false,
    createErrorMessage: null,
    showBulkCreateModal: false,
    showBulkInfoModal: false,
    bulkTableCount: 15,
    bulkTableCapacity: 8,
    bulkPrefix: "Masa",
    bulkStartIndex: tables.length + 1,
    isBulkCreating: false,
    bulkCreateError: null,
    deletingTableId: null,
    updatingGuestId: null,
    selectedUnassignedGuestId: null,
    unassignedFilter: "all",
  });

  useBodyScrollLock(pageState.showBulkCreateModal);

  const unassignedGuests = useMemo(
    () => guests.filter((guest) => guest.tableId === null),
    [guests],
  );

  const filteredUnassignedGuests = useMemo(() => {
    if (pageState.unassignedFilter === "all") return unassignedGuests;
    return unassignedGuests.filter((guest) => guest.rsvpStatus === pageState.unassignedFilter);
  }, [unassignedGuests, pageState.unassignedFilter]);

  const unassignedCounts = useMemo(() => ({
    all: unassignedGuests.length,
    confirmat: unassignedGuests.filter((guest) => guest.rsvpStatus === "confirmat").length,
    asteptare: unassignedGuests.filter((guest) => guest.rsvpStatus === "asteptare").length,
    refuzat: unassignedGuests.filter((guest) => guest.rsvpStatus === "refuzat").length,
  }), [unassignedGuests]);

  const tableGuestsMap = useMemo(() => {
    const map = new Map<string, typeof guests>();
    tables.forEach((table) => {
      map.set(table.id, guests.filter((guest) => guest.tableId === table.id));
    });
    return map;
  }, [guests, tables]);

  const handleCreateTable = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pageState.newTableName.trim()) return;

    dispatch({ type: "SET_CREATING", value: true });
    dispatch({ type: "SET_CREATE_ERROR", value: null });

    try {
      const response = await fetch("/api/wedding-hub/tables", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${coupleAuth.coupleAccessToken}`,
        },
        body: JSON.stringify({
          tableName: pageState.newTableName.trim(),
          tableAlias: pageState.newTableAlias.trim(),
          capacity: Number(pageState.newTableCapacity) || 1,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error ?? "Nu s-a putut crea masa.");
      }

      const newTable = await response.json();
      addTable(newTable);
      dispatch({ type: "SET_TABLE_NAME", value: "" });
      dispatch({ type: "SET_TABLE_ALIAS", value: "" });
      dispatch({ type: "SET_CREATING", value: false });
    } catch (error: unknown) {
      dispatch({ type: "SET_CREATE_ERROR", value: (error as Error).message });
    }
  };

  const handleCreateBulkTables = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedCount = Math.min(50, Math.max(1, Math.floor(pageState.bulkTableCount)));
    const normalizedCapacity = Math.min(50, Math.max(1, Math.floor(pageState.bulkTableCapacity)));
    const normalizedPrefix = pageState.bulkPrefix.trim() || "Masa";
    const normalizedStartIndex = Math.max(1, Math.floor(pageState.bulkStartIndex));

    dispatch({ type: "SET_BULK_CREATING", value: true });
    dispatch({ type: "SET_BULK_ERROR", value: null });

    try {
      const createdTables: unknown[] = [];
      for (let index = 0; index < normalizedCount; index += 1) {
        const response = await fetch("/api/wedding-hub/tables", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${coupleAuth.coupleAccessToken}`,
          },
          body: JSON.stringify({
            tableName: `${normalizedPrefix} ${normalizedStartIndex + index}`,
            capacity: normalizedCapacity,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error ?? "Nu s-au putut crea mesele în bulk.");
        }

        const newTable = await response.json();
        createdTables.push(newTable);
        addTable(newTable);
      }

      dispatch({ type: "SET_BULK_CREATING", value: false });
      dispatch({ type: "CLOSE_BULK_CREATE" });
      dispatch({ type: "SET_BULK_START_INDEX", value: tables.length + createdTables.length + 1 });
      window.setTimeout(() => {
        tablesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 180);
    } catch (error: unknown) {
      dispatch({ type: "SET_BULK_ERROR", value: (error as Error).message });
    }
  };

  const handleAssignGuest = async (guestId: string, tableId: string) => {
    dispatch({ type: "SET_UPDATING_GUEST", guestId });
    try {
      const response = await fetch(`/api/wedding-hub/guests/${guestId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${coupleAuth.coupleAccessToken}`,
        },
        body: JSON.stringify({ tableId }),
      });
      if (!response.ok) throw new Error("Eroare la alocare.");
      const updatedGuest = await response.json();
      updateGuest(updatedGuest);
      dispatch({ type: "SET_SELECTED_UNASSIGNED_GUEST", guestId: null });
    } catch {
      // guest stays unassigned on failure
    } finally {
      dispatch({ type: "SET_UPDATING_GUEST", guestId: null });
    }
  };

  const handleUnassignGuest = async (guestId: string) => {
    dispatch({ type: "SET_UPDATING_GUEST", guestId });
    try {
      const response = await fetch(`/api/wedding-hub/guests/${guestId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${coupleAuth.coupleAccessToken}`,
        },
        body: JSON.stringify({ tableId: null }),
      });
      if (!response.ok) throw new Error("Eroare la scoatere.");
      const updatedGuest = await response.json();
      updateGuest(updatedGuest);
    } catch {
      // keep as-is on failure
    } finally {
      dispatch({ type: "SET_UPDATING_GUEST", guestId: null });
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    dispatch({ type: "SET_DELETING_TABLE", tableId });
    try {
      const response = await fetch(`/api/wedding-hub/tables/${tableId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${coupleAuth.coupleAccessToken}` },
      });
      if (!response.ok) throw new Error("Eroare la ștergere.");
      const result = await response.json();
      removeTable(tableId);
      if (result.unassignedGuestIds?.length) {
        result.unassignedGuestIds.forEach((guestId: string) => {
          const guest = guests.find((guest) => guest.id === guestId);
          if (guest) updateGuest({ ...guest, tableId: null });
        });
      }
    } catch {
      // keep table on failure
    } finally {
      dispatch({ type: "SET_DELETING_TABLE", tableId: null });
    }
  };

  if (loadingTables) return <Loader variant="fullscreen" />;

  const totalAssigned = guests.filter((guest) => guest.tableId !== null).length;
  const totalCapacity = tables.reduce((sum, table) => sum + table.capacity, 0);
  const totalGuests = guests.length;
  const missingSeats = Math.max(0, totalGuests - totalCapacity);
  const selectedUnassignedGuest = unassignedGuests.find((guest) => guest.id === pageState.selectedUnassignedGuestId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-light text-white">Plan de mese</h1>
          {tables.length > 0 && (
            <p className="text-neutral-500 text-sm">
              {tables.length} {tables.length === 1 ? "masă" : "mese"} · {totalCapacity} locuri · {totalAssigned} ocupate
            </p>
          )}
        </div>
        {tables.length > 0 && weddingProfile && (
          <button
            type="button"
            onClick={() => printSeatingPlan(weddingProfile, tables, guests)}
            className="flex items-center gap-2 self-start sm:self-auto rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-400 transition-colors hover:border-neutral-500 hover:text-white"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Descarcă PDF
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-[11px] text-neutral-500">
        <span className="text-neutral-400">Legendă RSVP:</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
          Confirmat
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
          În așteptare
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          Refuzat
        </span>
      </div>

      <form onSubmit={handleCreateTable} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-medium text-neutral-300">Creează masă nouă</h2>
          <button
            type="button"
            onClick={() => dispatch({ type: "OPEN_BULK_INFO" })}
            className="flex items-stretch overflow-hidden rounded-lg border border-neutral-700 text-xs text-neutral-300 transition-colors hover:border-rose-500 hover:text-white"
            aria-label="Creează mai multe mese și ajutor"
            title="Creează mai multe mese"
          >
            <span
              onClick={(event) => {
                event.stopPropagation();
                dispatch({ type: "OPEN_BULK_CREATE", bulkStartIndex: tables.length + 1 });
              }}
              className="px-3 py-1.5"
            >
              Creează mai multe mese
            </span>
            <span className="flex items-center border-l border-neutral-700 px-2.5 py-1.5 text-[11px] text-neutral-400 hover:text-white">
              ℹ️
            </span>
          </button>
        </div>
        {pageState.createErrorMessage && (
          <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded-lg px-3 py-2 mb-3">
            {pageState.createErrorMessage}
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <input
            type="text"
            placeholder="Numele mesei (ex: Masa 1, Familie)"
            value={pageState.newTableName}
            onChange={(e) => dispatch({ type: "SET_TABLE_NAME", value: e.target.value })}
            className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors"
          />
          <input
            type="text"
            placeholder="Pseudonim (ex: BFF Mire, Bunicii)"
            value={pageState.newTableAlias}
            onChange={(e) => dispatch({ type: "SET_TABLE_ALIAS", value: e.target.value })}
            className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors"
          />
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              max={50}
              value={pageState.newTableCapacity}
              onChange={(e) => dispatch({ type: "SET_TABLE_CAPACITY", value: e.target.value })}
              title="Locuri masă"
              aria-label="Locuri masă"
              placeholder="Locuri"
              className="w-20 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors text-center"
            />
            <button
              type="submit"
              disabled={pageState.isCreatingTable || !pageState.newTableName.trim()}
              className="flex-1 sm:flex-none bg-rose-600 hover:bg-rose-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            >
              {pageState.isCreatingTable ? "..." : "+ Masă"}
            </button>
          </div>
        </div>
        <p className="text-neutral-600 text-xs mt-2">Capacitate: numărul de locuri la masă</p>
      </form>

      {pageState.showBulkCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-white text-base font-medium">Creează mese în bulk</h3>
                <p className="text-neutral-500 text-xs mt-1">Generează automat mese numerotate incremental.</p>
              </div>
              <button
                type="button"
                onClick={() => dispatch({ type: "CLOSE_BULK_CREATE" })}
                className="text-neutral-500 hover:text-white transition-colors"
              >
                ×
              </button>
            </div>

            {pageState.bulkCreateError && (
              <div className="mb-4 rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2 text-sm text-red-300">
                {pageState.bulkCreateError}
              </div>
            )}

            <form onSubmit={handleCreateBulkTables} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs uppercase tracking-wide text-neutral-500">Număr mese</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={pageState.bulkTableCount}
                    onChange={(e) => dispatch({ type: "SET_BULK_COUNT", value: Number(e.target.value) })}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-rose-500 focus:outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs uppercase tracking-wide text-neutral-500">Locuri / masă</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={pageState.bulkTableCapacity}
                    onChange={(e) => dispatch({ type: "SET_BULK_CAPACITY", value: Number(e.target.value) })}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-rose-500 focus:outline-none"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs uppercase tracking-wide text-neutral-500">Prefix</span>
                  <input
                    type="text"
                    value={pageState.bulkPrefix}
                    onChange={(e) => dispatch({ type: "SET_BULK_PREFIX", value: e.target.value })}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-rose-500 focus:outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs uppercase tracking-wide text-neutral-500">Începe de la</span>
                  <input
                    type="number"
                    min={1}
                    value={pageState.bulkStartIndex}
                    onChange={(e) => dispatch({ type: "SET_BULK_START_INDEX", value: Number(e.target.value) })}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-rose-500 focus:outline-none"
                  />
                </label>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-400">
                Preview:{" "}
                <span className="text-neutral-200">
                  {pageState.bulkPrefix.trim() || "Masa"} {pageState.bulkStartIndex} -{" "}
                  {pageState.bulkPrefix.trim() || "Masa"}{" "}
                  {pageState.bulkStartIndex + Math.max(1, Math.floor(pageState.bulkTableCount)) - 1}
                </span>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => dispatch({ type: "CLOSE_BULK_CREATE" })}
                  className="flex-1 rounded-lg border border-neutral-700 px-4 py-2.5 text-sm text-neutral-300 transition-colors hover:text-white"
                >
                  Renunță
                </button>
                <button
                  type="submit"
                  disabled={pageState.isBulkCreating}
                  className="flex-1 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:opacity-50"
                >
                  {pageState.isBulkCreating ? "Se creează..." : "Creează bulk"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pageState.showBulkInfoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-white text-base font-medium">Creează mese în serie</h3>
                <p className="text-neutral-500 text-xs mt-1">Scurt ghid despre butonul de creare rapidă.</p>
              </div>
              <button
                type="button"
                onClick={() => dispatch({ type: "CLOSE_BULK_INFO" })}
                className="text-neutral-500 hover:text-white transition-colors"
              >
                ×
              </button>
            </div>
            <div className="space-y-3 text-sm text-neutral-300 leading-relaxed">
              <p>
                Folosește această opțiune când vrei să creezi mai multe mese dintr-un singur pas.
              </p>
              <p>
                Poți seta numărul de mese, locurile pe fiecare masă, prefixul numelui și de la ce număr să înceapă numerotarea.
              </p>
              <p className="text-neutral-500 text-xs">
                Exemplu: `Masa 12`, `Masa 13`, `Masa 14`... sau orice prefix alegi tu.
              </p>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => dispatch({ type: "CLOSE_BULK_INFO" })}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-500"
              >
                Am înțeles
              </button>
            </div>
          </div>
        </div>
      )}

      {unassignedGuests.length > 0 && (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4">
          <div className="flex flex-col gap-2 mb-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-medium text-neutral-400">
              Fără masă alocată ({filteredUnassignedGuests.length})
            </h2>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "all", label: "Toți", count: unassignedCounts.all },
                { value: "confirmat", label: "Acceptat", count: unassignedCounts.confirmat },
                { value: "asteptare", label: "În curs", count: unassignedCounts.asteptare },
                { value: "refuzat", label: "Respins", count: unassignedCounts.refuzat },
              ].map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => dispatch({ type: "SET_UNASSIGNED_FILTER", value: filter.value as RsvpStatus | "all" })}
                  className={`rounded-full px-3 py-1 text-[11px] transition-colors ${
                    pageState.unassignedFilter === filter.value
                      ? "bg-rose-600 text-white"
                      : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white"
                  }`}
                >
                  {filter.label} ({filter.count})
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-64 overflow-y-auto">
            {filteredUnassignedGuests.map((guest) => (
              <button
                key={guest.id}
                type="button"
                onClick={() => dispatch({
                  type: "SET_SELECTED_UNASSIGNED_GUEST",
                  guestId: pageState.selectedUnassignedGuestId === guest.id ? null : guest.id,
                })}
                className={`rounded-full px-2.5 py-1 text-xs transition-colors ${RSVP_ACCENT_CLASSES[guest.rsvpStatus]} ${
                  pageState.selectedUnassignedGuestId === guest.id
                    ? RSVP_SELECTED_CLASSES[guest.rsvpStatus]
                    : "bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700"
                }`}
              >
                <span className="block">{guest.firstName} {guest.lastName}</span>
                {getGuestFamilySummary(guest) && (
                  <span className="mt-1 block text-[11px] text-rose-200/60">
                    {guest.sameTableWithFamily ? "Familie · " : ""}
                    {getGuestFamilySummary(guest)}
                  </span>
                )}
              </button>
            ))}
          </div>

          {selectedUnassignedGuest && (
            <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-900 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-white">
                    Mută rapid: <span className="font-medium">{selectedUnassignedGuest.firstName} {selectedUnassignedGuest.lastName}</span>
                  </p>
                  {getGuestFamilySummary(selectedUnassignedGuest) && (
                    <p className="text-xs text-rose-200/60 mt-0.5">
                      {selectedUnassignedGuest.sameTableWithFamily ? "Familie · " : ""}
                      {getGuestFamilySummary(selectedUnassignedGuest)}
                    </p>
                  )}
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Alege o masă existentă
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "SET_SELECTED_UNASSIGNED_GUEST", guestId: null })}
                  className="text-neutral-500 hover:text-white text-sm transition-colors"
                >
                  Închide
                </button>
              </div>

              {tables.length === 0 ? (
                <p className="text-xs text-neutral-500 mt-3">Nu există încă mese create.</p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {tables.map((table) => {
                    const isTableFull = (tableGuestsMap.get(table.id)?.length ?? 0) >= table.capacity;
                    return (
                      <button
                        key={table.id}
                        type="button"
                        onClick={() => handleAssignGuest(selectedUnassignedGuest.id, table.id)}
                        disabled={isTableFull || pageState.updatingGuestId === selectedUnassignedGuest.id}
                        className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs text-neutral-200 transition-colors hover:border-rose-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <span className="block">{table.tableName}</span>
                        {table.tableAlias && (
                          <span className="block text-[11px] text-rose-300/70">
                            {table.tableAlias}
                          </span>
                        )}
                        <span className="block text-[11px] text-neutral-400">
                          ({tableGuestsMap.get(table.id)?.length ?? 0}/{table.capacity})
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div ref={tablesSectionRef}>
        {tables.length === 0 ? (
          <div className="text-center py-12 text-neutral-500">
            Nu ai creat încă nicio masă. Adaugă prima masă mai sus.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tables.map((table) => (
              <TableCard
                key={table.id}
                table={table}
                tableGuests={tableGuestsMap.get(table.id) ?? []}
                unassignedGuests={unassignedGuests}
                onAssignGuest={handleAssignGuest}
                onUnassignGuest={handleUnassignGuest}
                onDeleteTable={handleDeleteTable}
                onTableUpdated={updateTable}
                isDeleting={pageState.deletingTableId === table.id}
              />
            ))}
          </div>
        )}
      </div>

      {tables.length > 0 && missingSeats > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          <p className="font-medium">Se pare că nu sunt suficiente mese.</p>
          <p className="mt-1 text-xs text-amber-100/70 leading-relaxed">
            Ai {totalGuests} invitați și doar {totalCapacity} locuri. Mai ai nevoie de încă {missingSeats} locuri.
            Poți muta invitați la mesele existente sau poți crea mese suplimentare.
          </p>
        </div>
      )}
    </div>
  );
};

export default SeatingPlanPage;
