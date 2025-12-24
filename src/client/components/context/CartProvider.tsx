import React, { createContext, useContext, useEffect, useMemo, useReducer, useState } from "react";
import { CartInfoItemCookie } from "../../data/constants";

const LEGACY_KEY = "cartData";                                // old readers
const STORAGE_KEY = CartInfoItemCookie || LEGACY_KEY;        // primary writer

type CartState = Record<string, number>;

type Action =
  | { type: "HYDRATE"; payload: CartState }
  | { type: "ADD"; id: string; qty: number }
  | { type: "SET"; id: string; qty: number }
  | { type: "REMOVE"; id: string }
  | { type: "CLEAR" };

const reducer = (state: CartState, action: Action): CartState => {
  switch (action.type) {
    case "HYDRATE":
      return action.payload;
    case "ADD": {
      const next = Math.max(0, (state[action.id] || 0) + action.qty);
      if (next === 0) {
        const { [action.id]: _, ...rest } = state;
        return rest;
      }
      return { ...state, [action.id]: next };
    }
    case "SET": {
      const next = Math.max(0, action.qty);
      if (next === 0) {
        const { [action.id]: _, ...rest } = state;
        return rest;
      }
      return { ...state, [action.id]: next };
    }
    case "REMOVE": {
      const { [action.id]: _, ...rest } = state;
      return rest;
    }
    case "CLEAR":
      return {};
    default:
      return state;
  }
};

type CartItem = { id: string; qty: number };
type CartCtx = {
  items: CartItem[];
  totalItems: number;
  getQty: (id: string) => number;
  addItem: (id: string, qty?: number) => void;
  increment: (id: string, delta?: number) => void;
  decrement: (id: string, delta?: number) => void;
  setQty: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
  remove: (id: string) => void; // alias
  clear: () => void;
};

const CartContext = createContext<CartCtx | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, {});
  const [hydrated, setHydrated] = useState(false);

  // Hydrate ONCE from either key (prevents StrictMode double-write wiping)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as Array<{ id: string; itemNumber: string | number }>;
        const map: CartState = {};
        for (const it of arr) {
          const q = Number((it as any).itemNumber ?? 0);
          if (it.id && q > 0) map[it.id] = q;
        }
        dispatch({ type: "HYDRATE", payload: map });
      }
    } catch {
      // ignore
    } finally {
      setHydrated(true);
    }
  }, []);

  // Persist AFTER hydration; write to both keys for compatibility
  useEffect(() => {
    if (!hydrated) return;
    const legacy = Object.entries(state).map(([id, qty]) => ({ id, itemNumber: String(qty) }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy));
  }, [state, hydrated]);

  const items = useMemo(() => Object.entries(state).map(([id, qty]) => ({ id, qty })), [state]);
  const totalItems = useMemo(() => items.reduce((s, it) => s + (Number(it.qty) || 0), 0), [items]);

  const getQty = (id: string) => state[id] || 0;
  const addItem = (id: string, qty = 1) => dispatch({ type: "ADD", id, qty });
  const increment = (id: string, delta = 1) => dispatch({ type: "ADD", id, qty: delta });
  const decrement = (id: string, delta = 1) => dispatch({ type: "ADD", id, qty: -Math.abs(delta) });
  const setQty = (id: string, qty: number) => dispatch({ type: "SET", id, qty });
  const removeItem = (id: string) => dispatch({ type: "REMOVE", id });
  const remove = (id: string) => dispatch({ type: "REMOVE", id });
  const clear = () => dispatch({ type: "CLEAR" });

  const value: CartCtx = { items, totalItems, getQty, addItem, increment, decrement, setQty, removeItem, remove, clear };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
};
