import React, { createContext, useContext, useMemo, useReducer } from "react";
import type { WeddingHubState, WeddingHubAction, WeddingProfile, WeddingGuest, WeddingTable } from "../types";

const initialState: WeddingHubState = {
  weddingProfile: null,
  guests: [],
  tables: [],
  loadingProfile: true,
  loadingGuests: true,
  loadingTables: true,
  errorMessage: null,
};

function weddingHubReducer(state: WeddingHubState, action: WeddingHubAction): WeddingHubState {
  switch (action.type) {
    case "SET_PROFILE":
      return { ...state, weddingProfile: action.payload, loadingProfile: false };
    case "SET_GUESTS":
      return { ...state, guests: action.payload, loadingGuests: false };
    case "ADD_GUEST":
      return { ...state, guests: [...state.guests, action.payload] };
    case "UPDATE_GUEST":
      return {
        ...state,
        guests: state.guests.map((guest) =>
          guest.id === action.payload.id ? action.payload : guest,
        ),
      };
    case "REMOVE_GUEST":
      return {
        ...state,
        guests: state.guests.filter((guest) => guest.id !== action.payload),
      };
    case "SET_TABLES":
      return { ...state, tables: action.payload, loadingTables: false };
    case "ADD_TABLE":
      return { ...state, tables: [...state.tables, action.payload] };
    case "UPDATE_TABLE":
      return {
        ...state,
        tables: state.tables.map((table) =>
          table.id === action.payload.id ? action.payload : table,
        ),
      };
    case "REMOVE_TABLE":
      return {
        ...state,
        tables: state.tables.filter((table) => table.id !== action.payload),
        guests: state.guests.map((guest) =>
          guest.tableId === action.payload ? { ...guest, tableId: null } : guest,
        ),
      };
    case "SET_LOADING":
      return { ...state, ...action.payload };
    case "SET_ERROR":
      return { ...state, errorMessage: action.payload, loadingProfile: false, loadingGuests: false, loadingTables: false };
    default:
      return state;
  }
}

type WeddingHubContextType = {
  state: WeddingHubState;
  dispatch: React.Dispatch<WeddingHubAction>;
  setProfile: (profile: WeddingProfile) => void;
  setGuests: (guests: WeddingGuest[]) => void;
  setTables: (tables: WeddingTable[]) => void;
  addGuest: (guest: WeddingGuest) => void;
  updateGuest: (guest: WeddingGuest) => void;
  removeGuest: (guestId: string) => void;
  addTable: (table: WeddingTable) => void;
  updateTable: (table: WeddingTable) => void;
  removeTable: (tableId: string) => void;
};

const WeddingHubContext = createContext<WeddingHubContextType | undefined>(undefined);

export const WeddingHubProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [state, dispatch] = useReducer(weddingHubReducer, initialState);

  const actions = useMemo(() => ({
    setProfile: (profile: WeddingProfile) => dispatch({ type: "SET_PROFILE", payload: profile }),
    setGuests: (guests: WeddingGuest[]) => dispatch({ type: "SET_GUESTS", payload: guests }),
    setTables: (tables: WeddingTable[]) => dispatch({ type: "SET_TABLES", payload: tables }),
    addGuest: (guest: WeddingGuest) => dispatch({ type: "ADD_GUEST", payload: guest }),
    updateGuest: (guest: WeddingGuest) => dispatch({ type: "UPDATE_GUEST", payload: guest }),
    removeGuest: (guestId: string) => dispatch({ type: "REMOVE_GUEST", payload: guestId }),
    addTable: (table: WeddingTable) => dispatch({ type: "ADD_TABLE", payload: table }),
    updateTable: (table: WeddingTable) => dispatch({ type: "UPDATE_TABLE", payload: table }),
    removeTable: (tableId: string) => dispatch({ type: "REMOVE_TABLE", payload: tableId }),
  }), []);

  const contextValue = useMemo<WeddingHubContextType>(
    () => ({ state, dispatch, ...actions }),
    [state, actions],
  );

  return (
    <WeddingHubContext.Provider value={contextValue}>
      {children}
    </WeddingHubContext.Provider>
  );
};

export const useWeddingHub = (): WeddingHubContextType => {
  const context = useContext(WeddingHubContext);
  if (!context) {
    throw new Error("useWeddingHub must be used within <WeddingHubProvider>");
  }
  return context;
};
