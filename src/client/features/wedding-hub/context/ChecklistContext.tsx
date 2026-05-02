import React, { createContext, useContext, useReducer, useMemo } from "react";

export type ChecklistCategory = {
  id: string;
  name: string;
  order: number;
  isDefault: boolean;
  createdAt: string;
};

export type ChecklistItem = {
  id: string;
  categoryId: string;
  title: string;
  notes: string;
  isCompleted: boolean;
  isDefault: boolean;
  completedAt: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
};

type ChecklistState = {
  categories: ChecklistCategory[];
  items: ChecklistItem[];
  loading: boolean;
  error: string | null;
};

type ChecklistAction =
  | { type: "SET_DATA"; categories: ChecklistCategory[]; items: ChecklistItem[] }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "ADD_CATEGORY"; category: ChecklistCategory }
  | { type: "REMOVE_CATEGORY"; categoryId: string }
  | { type: "ADD_ITEM"; item: ChecklistItem }
  | { type: "UPDATE_ITEM"; item: ChecklistItem }
  | { type: "REMOVE_ITEM"; itemId: string };

const initialState: ChecklistState = {
  categories: [],
  items: [],
  loading: true,
  error: null,
};

function checklistReducer(state: ChecklistState, action: ChecklistAction): ChecklistState {
  switch (action.type) {
    case "SET_DATA":
      return { ...state, categories: action.categories, items: action.items, loading: false, error: null };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    case "SET_ERROR":
      return { ...state, error: action.error, loading: false };
    case "ADD_CATEGORY":
      return { ...state, categories: [...state.categories, action.category] };
    case "REMOVE_CATEGORY":
      return {
        ...state,
        categories: state.categories.filter((c) => c.id !== action.categoryId),
        items: state.items.filter((i) => i.categoryId !== action.categoryId),
      };
    case "ADD_ITEM":
      return { ...state, items: [...state.items, action.item] };
    case "UPDATE_ITEM":
      return {
        ...state,
        items: state.items.map((i) => (i.id === action.item.id ? action.item : i)),
      };
    case "REMOVE_ITEM":
      return { ...state, items: state.items.filter((i) => i.id !== action.itemId) };
    default:
      return state;
  }
}

type ChecklistContextValue = ChecklistState & {
  setData: (categories: ChecklistCategory[], items: ChecklistItem[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  addCategory: (category: ChecklistCategory) => void;
  removeCategory: (categoryId: string) => void;
  addItem: (item: ChecklistItem) => void;
  updateItem: (item: ChecklistItem) => void;
  removeItem: (itemId: string) => void;
};

const ChecklistContext = createContext<ChecklistContextValue | null>(null);

export function ChecklistProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(checklistReducer, initialState);

  const actions = useMemo(
    () => ({
      setData: (categories: ChecklistCategory[], items: ChecklistItem[]) =>
        dispatch({ type: "SET_DATA", categories, items }),
      setLoading: (loading: boolean) => dispatch({ type: "SET_LOADING", loading }),
      setError: (error: string | null) => dispatch({ type: "SET_ERROR", error }),
      addCategory: (category: ChecklistCategory) => dispatch({ type: "ADD_CATEGORY", category }),
      removeCategory: (categoryId: string) => dispatch({ type: "REMOVE_CATEGORY", categoryId }),
      addItem: (item: ChecklistItem) => dispatch({ type: "ADD_ITEM", item }),
      updateItem: (item: ChecklistItem) => dispatch({ type: "UPDATE_ITEM", item }),
      removeItem: (itemId: string) => dispatch({ type: "REMOVE_ITEM", itemId }),
    }),
    [],
  );

  const contextValue = useMemo(() => ({ ...state, ...actions }), [state, actions]);

  return <ChecklistContext.Provider value={contextValue}>{children}</ChecklistContext.Provider>;
}

export function useChecklist() {
  const context = useContext(ChecklistContext);
  if (!context) throw new Error("useChecklist must be used inside ChecklistProvider");
  return context;
}
