import React, { useEffect, useReducer, useMemo, useRef } from "react";
import { ChecklistProvider, useChecklist } from "../context/ChecklistContext";
import type { ChecklistCategory, ChecklistItem } from "../context/ChecklistContext";
import { useWeddingHubAuth } from "../context/WeddingHubAuthContext";

// ─── Page-level state ────────────────────────────────────────────────────────

type PageState = {
  expandedCategories: string[];
  addingItemForCategory: string | null;
  newItemTitle: string;
  addingCategory: boolean;
  newCategoryName: string;
  togglingItemId: string | null;
  deletingItemId: string | null;
  deletingCategoryId: string | null;
  savingCategory: boolean;
  savingItem: boolean;
  pageError: string | null;
};

type PageAction =
  | { type: "TOGGLE_CATEGORY"; categoryId: string }
  | { type: "START_ADD_ITEM"; categoryId: string }
  | { type: "CANCEL_ADD_ITEM" }
  | { type: "SET_NEW_ITEM_TITLE"; title: string }
  | { type: "TOGGLE_ADD_CATEGORY" }
  | { type: "SET_NEW_CATEGORY_NAME"; name: string }
  | { type: "SET_TOGGLING_ITEM"; itemId: string | null }
  | { type: "SET_DELETING_ITEM"; itemId: string | null }
  | { type: "SET_DELETING_CATEGORY"; categoryId: string | null }
  | { type: "SET_SAVING_CATEGORY"; saving: boolean }
  | { type: "SET_SAVING_ITEM"; saving: boolean }
  | { type: "SET_PAGE_ERROR"; error: string | null }
  | { type: "ITEM_ADDED" }
  | { type: "CATEGORY_ADDED"; expandCategoryId: string };

const initialPageState: PageState = {
  expandedCategories: [],
  addingItemForCategory: null,
  newItemTitle: "",
  addingCategory: false,
  newCategoryName: "",
  togglingItemId: null,
  deletingItemId: null,
  deletingCategoryId: null,
  savingCategory: false,
  savingItem: false,
  pageError: null,
};

function pageReducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case "TOGGLE_CATEGORY":
      return {
        ...state,
        expandedCategories: state.expandedCategories.includes(action.categoryId)
          ? state.expandedCategories.filter((id) => id !== action.categoryId)
          : [...state.expandedCategories, action.categoryId],
        addingItemForCategory:
          state.addingItemForCategory === action.categoryId
            ? null
            : state.addingItemForCategory,
      };
    case "START_ADD_ITEM":
      return {
        ...state,
        addingItemForCategory: action.categoryId,
        newItemTitle: "",
        expandedCategories: state.expandedCategories.includes(action.categoryId)
          ? state.expandedCategories
          : [...state.expandedCategories, action.categoryId],
      };
    case "CANCEL_ADD_ITEM":
      return { ...state, addingItemForCategory: null, newItemTitle: "" };
    case "SET_NEW_ITEM_TITLE":
      return { ...state, newItemTitle: action.title };
    case "TOGGLE_ADD_CATEGORY":
      return { ...state, addingCategory: !state.addingCategory, newCategoryName: "" };
    case "SET_NEW_CATEGORY_NAME":
      return { ...state, newCategoryName: action.name };
    case "SET_TOGGLING_ITEM":
      return { ...state, togglingItemId: action.itemId };
    case "SET_DELETING_ITEM":
      return { ...state, deletingItemId: action.itemId };
    case "SET_DELETING_CATEGORY":
      return { ...state, deletingCategoryId: action.categoryId };
    case "SET_SAVING_CATEGORY":
      return { ...state, savingCategory: action.saving };
    case "SET_SAVING_ITEM":
      return { ...state, savingItem: action.saving };
    case "SET_PAGE_ERROR":
      return { ...state, pageError: action.error };
    case "ITEM_ADDED":
      return { ...state, addingItemForCategory: null, newItemTitle: "", savingItem: false };
    case "CATEGORY_ADDED":
      return {
        ...state,
        addingCategory: false,
        newCategoryName: "",
        savingCategory: false,
        expandedCategories: [...state.expandedCategories, action.expandCategoryId],
      };
    default:
      return state;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "ian", "feb", "mar", "apr", "mai", "iun",
  "iul", "aug", "sep", "oct", "nov", "dec",
];

function formatDueDate(isoString: string): string {
  const date = new Date(isoString);
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

function getDueDateStatus(dueDate: string | null): "overdue" | "soon" | "future" | null {
  if (!dueDate) return null;
  const diffDays = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 7) return "soon";
  return "future";
}

// ─── Inner page (consumes context) ───────────────────────────────────────────

function ChecklistPageContent() {
  const { categories, items, loading, error, setData, addCategory, removeCategory, addItem, updateItem, removeItem } =
    useChecklist();
  const { coupleAuth } = useWeddingHubAuth();
  const [pageState, dispatch] = useReducer(pageReducer, initialPageState);
  const newItemInputRef = useRef<HTMLInputElement>(null);
  const newCategoryInputRef = useRef<HTMLInputElement>(null);

  // ─── Fetch data on mount ──────────────────────────────────────────────────

  useEffect(() => {
    if (!coupleAuth.coupleAccessToken) return;

    (async () => {
      try {
        const response = await fetch("/api/wedding-hub/checklist", {
          headers: { Authorization: `Bearer ${coupleAuth.coupleAccessToken}` },
        });
        if (!response.ok) throw new Error("fetch failed");
        const data = await response.json();
        setData(data.categories, data.items);
      } catch {
        dispatch({ type: "SET_PAGE_ERROR", error: "Nu s-au putut încărca datele." });
      }
    })();
  }, [coupleAuth.coupleAccessToken, setData]);

  // ─── Focus new item input when add form opens ────────────────────────────

  useEffect(() => {
    if (pageState.addingItemForCategory && newItemInputRef.current) {
      newItemInputRef.current.focus();
    }
  }, [pageState.addingItemForCategory]);

  useEffect(() => {
    if (pageState.addingCategory && newCategoryInputRef.current) {
      newCategoryInputRef.current.focus();
    }
  }, [pageState.addingCategory]);

  // ─── Computed values ──────────────────────────────────────────────────────

  const totalItems = items.length;
  const completedItems = items.filter((item) => item.isCompleted).length;
  const globalProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const itemsByCategory = useMemo(() => {
    const map: Record<string, ChecklistItem[]> = {};
    for (const item of items) {
      if (!map[item.categoryId]) map[item.categoryId] = [];
      map[item.categoryId].push(item);
    }
    return map;
  }, [items]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleToggleItem = async (item: ChecklistItem) => {
    if (pageState.togglingItemId === item.id) return;
    dispatch({ type: "SET_TOGGLING_ITEM", itemId: item.id });

    const optimisticItem = {
      ...item,
      isCompleted: !item.isCompleted,
      completedAt: !item.isCompleted ? new Date().toISOString() : null,
    };
    updateItem(optimisticItem);

    try {
      const response = await fetch(`/api/wedding-hub/checklist/items/${item.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${coupleAuth.coupleAccessToken}`,
        },
        body: JSON.stringify({ isCompleted: !item.isCompleted }),
      });
      if (!response.ok) throw new Error("update failed");
      const updatedItem = await response.json();
      updateItem(updatedItem);
    } catch {
      updateItem(item); // revert on failure
    } finally {
      dispatch({ type: "SET_TOGGLING_ITEM", itemId: null });
    }
  };

  const handleAddItem = async (categoryId: string) => {
    const title = pageState.newItemTitle.trim();
    if (!title) return;

    dispatch({ type: "SET_SAVING_ITEM", saving: true });
    try {
      const response = await fetch("/api/wedding-hub/checklist/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${coupleAuth.coupleAccessToken}`,
        },
        body: JSON.stringify({ categoryId, title }),
      });
      if (!response.ok) throw new Error("add failed");
      const newItem = await response.json();
      addItem(newItem);
      dispatch({ type: "ITEM_ADDED" });
    } catch {
      dispatch({ type: "SET_SAVING_ITEM", saving: false });
      dispatch({ type: "SET_PAGE_ERROR", error: "Nu s-a putut adăuga task-ul." });
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (pageState.deletingItemId === itemId) return;
    dispatch({ type: "SET_DELETING_ITEM", itemId });

    try {
      const response = await fetch(`/api/wedding-hub/checklist/items/${itemId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${coupleAuth.coupleAccessToken}` },
      });
      if (!response.ok) throw new Error("delete failed");
      removeItem(itemId);
    } catch {
      dispatch({ type: "SET_PAGE_ERROR", error: "Nu s-a putut șterge task-ul." });
    } finally {
      dispatch({ type: "SET_DELETING_ITEM", itemId: null });
    }
  };

  const handleAddCategory = async () => {
    const name = pageState.newCategoryName.trim();
    if (!name) return;

    dispatch({ type: "SET_SAVING_CATEGORY", saving: true });
    try {
      const response = await fetch("/api/wedding-hub/checklist/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${coupleAuth.coupleAccessToken}`,
        },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error("add failed");
      const newCategory = await response.json();
      addCategory(newCategory);
      dispatch({ type: "CATEGORY_ADDED", expandCategoryId: newCategory.id });
    } catch {
      dispatch({ type: "SET_SAVING_CATEGORY", saving: false });
      dispatch({ type: "SET_PAGE_ERROR", error: "Nu s-a putut crea categoria." });
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (pageState.deletingCategoryId === categoryId) return;
    dispatch({ type: "SET_DELETING_CATEGORY", categoryId });

    try {
      const response = await fetch(`/api/wedding-hub/checklist/categories/${categoryId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${coupleAuth.coupleAccessToken}` },
      });
      if (!response.ok) throw new Error("delete failed");
      removeCategory(categoryId);
    } catch {
      dispatch({ type: "SET_PAGE_ERROR", error: "Nu s-a putut șterge categoria." });
    } finally {
      dispatch({ type: "SET_DELETING_CATEGORY", categoryId: null });
    }
  };

  // ─── Loading & Error states ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-light text-white">Checklist Planning</h1>
          <p className="mt-1 text-sm text-neutral-500">Se încarcă...</p>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-16 animate-pulse rounded-xl bg-neutral-900 border border-neutral-800" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-light text-white">Checklist Planning</h1>
        <div className="rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300">{error}</div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-light text-white">Checklist Planning</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Organizează toate task-urile pentru nunta ta
          </p>
        </div>
      </div>

      {/* Page-level error */}
      {pageState.pageError && (
        <div className="flex items-center justify-between rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300">
          <span>{pageState.pageError}</span>
          <button
            type="button"
            onClick={() => dispatch({ type: "SET_PAGE_ERROR", error: null })}
            className="ml-4 text-red-400 hover:text-red-200 transition-colors"
          >
            ×
          </button>
        </div>
      )}

      {/* Global progress */}
      {totalItems > 0 && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-neutral-400">
              {completedItems} din {totalItems} task-uri completate
            </span>
            <span className="text-sm font-medium text-rose-400">{globalProgress}%</span>
          </div>
          <div className="h-2 rounded-full bg-neutral-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-rose-600 transition-all duration-500"
              style={{ width: `${globalProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Empty state */}
      {categories.length === 0 && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 py-12 text-center">
          <p className="text-neutral-500 text-sm">Nu există categorii în checklist.</p>
          <p className="mt-1 text-neutral-600 text-xs">Adaugă o categorie nouă mai jos.</p>
        </div>
      )}

      {/* Categories */}
      <div className="space-y-3">
        {categories.map((category) => {
          const categoryItems = itemsByCategory[category.id] ?? [];
          const categoryCompleted = categoryItems.filter((item) => item.isCompleted).length;
          const categoryTotal = categoryItems.length;
          const categoryProgress =
            categoryTotal > 0 ? Math.round((categoryCompleted / categoryTotal) * 100) : 0;
          const isExpanded = pageState.expandedCategories.includes(category.id);
          const isAddingItem = pageState.addingItemForCategory === category.id;

          return (
            <div
              key={category.id}
              className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden"
            >
              {/* Category header */}
              <button
                type="button"
                onClick={() => dispatch({ type: "TOGGLE_CATEGORY", categoryId: category.id })}
                className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-neutral-800/40"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-medium text-white truncate">{category.name}</span>
                    <span className="flex-shrink-0 text-xs text-neutral-500">
                      {categoryCompleted}/{categoryTotal}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${categoryProgress}%`,
                        backgroundColor:
                          categoryProgress === 100
                            ? "#22c55e"
                            : categoryProgress > 50
                            ? "#e11d48"
                            : "#e11d48",
                      }}
                    />
                  </div>
                </div>
                <span
                  className={`flex-shrink-0 text-neutral-500 transition-transform duration-200 text-xs ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                >
                  ▼
                </span>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-neutral-800">
                  {/* Items */}
                  {categoryItems.length === 0 && !isAddingItem && (
                    <p className="px-5 py-4 text-sm text-neutral-600">Niciun task adăugat încă.</p>
                  )}

                  {categoryItems.map((item) => {
                    const dueDateStatus = getDueDateStatus(item.dueDate);
                    const isToggling = pageState.togglingItemId === item.id;
                    const isDeleting = pageState.deletingItemId === item.id;

                    return (
                      <div
                        key={item.id}
                        className="group flex items-center gap-3 px-5 py-3 border-b border-neutral-800/60 last:border-b-0 hover:bg-neutral-800/20 transition-colors"
                      >
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={() => handleToggleItem(item)}
                          disabled={isToggling}
                          className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                            item.isCompleted
                              ? "bg-rose-600 border-rose-600"
                              : "border-neutral-600 hover:border-rose-500"
                          } ${isToggling ? "opacity-40" : ""}`}
                          aria-label={item.isCompleted ? "Marchează ca nefinalizat" : "Marchează ca finalizat"}
                        >
                          {item.isCompleted && (
                            <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                              <path
                                d="M2 6l3 3 5-5"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </button>

                        {/* Title */}
                        <span
                          className={`flex-1 text-sm transition-colors ${
                            item.isCompleted
                              ? "line-through text-neutral-600"
                              : "text-neutral-200"
                          }`}
                        >
                          {item.title}
                        </span>

                        {/* Due date badge */}
                        {dueDateStatus && (
                          <span
                            className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${
                              dueDateStatus === "overdue"
                                ? "bg-red-900/30 border border-red-800/40 text-red-400"
                                : dueDateStatus === "soon"
                                ? "bg-yellow-900/30 border border-yellow-800/40 text-yellow-400"
                                : "bg-neutral-800 border border-neutral-700 text-neutral-400"
                            }`}
                          >
                            {formatDueDate(item.dueDate!)}
                          </span>
                        )}

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          disabled={isDeleting}
                          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-neutral-600 hover:text-red-400 text-xs px-1 disabled:opacity-40"
                          aria-label="Șterge task"
                        >
                          {isDeleting ? "..." : "×"}
                        </button>
                      </div>
                    );
                  })}

                  {/* Add item form */}
                  {isAddingItem ? (
                    <div className="flex items-center gap-2 px-5 py-3 border-t border-neutral-800/60">
                      <input
                        ref={newItemInputRef}
                        type="text"
                        value={pageState.newItemTitle}
                        onChange={(event) =>
                          dispatch({ type: "SET_NEW_ITEM_TITLE", title: event.target.value })
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") handleAddItem(category.id);
                          if (event.key === "Escape")
                            dispatch({ type: "CANCEL_ADD_ITEM" });
                        }}
                        placeholder="Nume task..."
                        className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500"
                        disabled={pageState.savingItem}
                      />
                      <button
                        type="button"
                        onClick={() => handleAddItem(category.id)}
                        disabled={pageState.savingItem || !pageState.newItemTitle.trim()}
                        className="rounded-lg bg-rose-600 hover:bg-rose-500 px-3 py-2 text-sm text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {pageState.savingItem ? "..." : "Adaugă"}
                      </button>
                      <button
                        type="button"
                        onClick={() => dispatch({ type: "CANCEL_ADD_ITEM" })}
                        className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-400 hover:text-white transition-colors"
                      >
                        Anulează
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-800/60">
                      <button
                        type="button"
                        onClick={() =>
                          dispatch({ type: "START_ADD_ITEM", categoryId: category.id })
                        }
                        className="text-sm text-neutral-500 hover:text-rose-400 transition-colors"
                      >
                        + Task nou
                      </button>
                      {!category.isDefault && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(category.id)}
                          disabled={pageState.deletingCategoryId === category.id}
                          className="text-xs text-neutral-600 hover:text-red-400 transition-colors disabled:opacity-40"
                        >
                          {pageState.deletingCategoryId === category.id
                            ? "Se șterge..."
                            : "Șterge categorie"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add category */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50">
        {pageState.addingCategory ? (
          <div className="flex items-center gap-2 p-4">
            <input
              ref={newCategoryInputRef}
              type="text"
              value={pageState.newCategoryName}
              onChange={(event) =>
                dispatch({ type: "SET_NEW_CATEGORY_NAME", name: event.target.value })
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") handleAddCategory();
                if (event.key === "Escape") dispatch({ type: "TOGGLE_ADD_CATEGORY" });
              }}
              placeholder="Nume categorie nouă..."
              className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500"
              disabled={pageState.savingCategory}
            />
            <button
              type="button"
              onClick={handleAddCategory}
              disabled={pageState.savingCategory || !pageState.newCategoryName.trim()}
              className="rounded-lg bg-rose-600 hover:bg-rose-500 px-3 py-2 text-sm text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {pageState.savingCategory ? "..." : "Creează"}
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "TOGGLE_ADD_CATEGORY" })}
              className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-400 hover:text-white transition-colors"
            >
              Anulează
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => dispatch({ type: "TOGGLE_ADD_CATEGORY" })}
            className="w-full px-5 py-4 text-left text-sm text-neutral-500 hover:text-rose-400 transition-colors"
          >
            + Adaugă categorie nouă
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Export — self-contained with provider ────────────────────────────────────

export default function ChecklistPage() {
  return (
    <ChecklistProvider>
      <ChecklistPageContent />
    </ChecklistProvider>
  );
}
