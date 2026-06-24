import React, { useEffect, useRef, useState } from "react";
import useAuth from "../auth/useAuth";

interface EquipmentItem {
  id: string;
  name: string;
}

interface EquipmentCategory {
  id: string;
  name: string;
  serviceTag: string;
  color: string;
  items: EquipmentItem[];
  order: number;
}

const SERVICE_TAG_OPTIONS = [
  { value: "general", label: "General (mereu afișat)" },
  { value: "foto", label: "Fotografie" },
  { value: "video", label: "Videografie" },
  { value: "fotocabina", label: "Fotocabină" },
  { value: "videobooth", label: "Videobooth" },
  { value: "transport", label: "Transport" },
  { value: "altul", label: "Altul" },
];

const COLOR_PALETTE = [
  "#60a5fa", "#34d399", "#f472b6", "#fb923c",
  "#a78bfa", "#fbbf24", "#f87171", "#94a3b8",
  "#4ade80", "#38bdf8", "#e879f9", "#ff6b6b",
];

const BLANK_CATEGORY = { name: "", serviceTag: "foto", color: COLOR_PALETTE[0] };

function Spinner() {
  return (
    <svg className="animate-spin text-neutral-500" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" strokeOpacity=".25" /><path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {COLOR_PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={`w-6 h-6 rounded-full transition-all border-2 ${value === color ? "border-white scale-110" : "border-transparent"}`}
          style={{ background: color }}
          aria-label={color}
        />
      ))}
    </div>
  );
}

function CategoryForm({
  initial,
  onSave,
  onCancel,
  saving,
  saveLabel,
}: {
  initial: typeof BLANK_CATEGORY;
  onSave: (form: typeof BLANK_CATEGORY) => void;
  onCancel: () => void;
  saving: boolean;
  saveLabel: string;
}) {
  const [form, setForm] = useState(initial);
  return (
    <div className="space-y-3 p-4 rounded-xl border border-neutral-700 bg-neutral-850">
      <div>
        <label className="text-[11px] text-neutral-400 uppercase tracking-wide block mb-1">Denumire categorie</label>
        <input
          autoFocus
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="ex: Fotografie, Videobooth..."
          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500"
        />
      </div>
      <div>
        <label className="text-[11px] text-neutral-400 uppercase tracking-wide block mb-1">Serviciu asociat</label>
        <select
          value={form.serviceTag}
          onChange={(event) => setForm({ ...form, serviceTag: event.target.value })}
          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-500"
        >
          {SERVICE_TAG_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <p className="text-[10px] text-neutral-600 mt-1">Categoria apare în checklist doar la evenimentele cu serviciul respectiv</p>
      </div>
      <div>
        <label className="text-[11px] text-neutral-400 uppercase tracking-wide block mb-1">Culoare</label>
        <ColorPicker value={form.color} onChange={(color) => setForm({ ...form, color })} />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={!form.name.trim() || saving}
          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
        >
          {saving ? "Se salvează..." : saveLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-neutral-700 text-neutral-400 hover:text-white text-sm transition-colors"
        >
          Anulează
        </button>
      </div>
    </div>
  );
}

export default function EquipmentAdminPage() {
  const { auth } = useAuth();
  const [categories, setCategories] = useState<EquipmentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [addCategorySaving, setAddCategorySaving] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategorySaving, setEditCategorySaving] = useState(false);
  const [editCategoryInitial, setEditCategoryInitial] = useState(BLANK_CATEGORY);
  const [addItemVisible, setAddItemVisible] = useState<Record<string, boolean>>({});
  const [addItemText, setAddItemText] = useState<Record<string, string>>({});
  const [addItemSaving, setAddItemSaving] = useState<Record<string, boolean>>({});
  const [editingItem, setEditingItem] = useState<{ categoryId: string; itemId: string; name: string } | null>(null);
  const [editItemSaving, setEditItemSaving] = useState(false);
  const editItemRef = useRef<HTMLInputElement>(null);

  const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${auth.accessToken}`,
  });

  useEffect(() => {
    if (!auth.accessToken) return;
    fetch("/api/admin/equipment", { headers: { Authorization: `Bearer ${auth.accessToken}` } })
      .then((response) => response.json())
      .then((data: { categories: EquipmentCategory[] }) => setCategories(data.categories ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [auth.accessToken]);

  useEffect(() => {
    if (editingItem) editItemRef.current?.focus();
  }, [editingItem?.itemId]);

  async function handleAddCategory(form: typeof BLANK_CATEGORY) {
    if (!form.name.trim()) return;
    setAddCategorySaving(true);
    try {
      const response = await fetch("/api/admin/equipment", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(form),
      });
      const data = await response.json() as { category: EquipmentCategory };
      setCategories((prev) => [...prev, data.category]);
      setShowAddCategory(false);
    } catch {
      // ignore
    } finally {
      setAddCategorySaving(false);
    }
  }

  async function handleUpdateCategory(id: string, form: typeof BLANK_CATEGORY) {
    setEditCategorySaving(true);
    try {
      await fetch(`/api/admin/equipment/${id}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify(form),
      });
      setCategories((prev) =>
        prev.map((cat) => (cat.id === id ? { ...cat, name: form.name, serviceTag: form.serviceTag, color: form.color } : cat))
      );
      setEditingCategoryId(null);
    } catch {
      // ignore
    } finally {
      setEditCategorySaving(false);
    }
  }

  async function handleDeleteCategory(id: string) {
    if (!window.confirm("Stergi această categorie? Toate echipamentele din ea vor fi șterse.")) return;
    try {
      await fetch(`/api/admin/equipment/${id}`, { method: "DELETE", headers: headers() });
      setCategories((prev) => prev.filter((cat) => cat.id !== id));
    } catch {
      // ignore
    }
  }

  async function handleAddItem(categoryId: string) {
    const name = (addItemText[categoryId] ?? "").trim();
    if (!name) return;
    setAddItemSaving((prev) => ({ ...prev, [categoryId]: true }));
    try {
      const response = await fetch(`/api/admin/equipment/${categoryId}/items`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ name }),
      });
      const data = await response.json() as { item: EquipmentItem };
      setCategories((prev) =>
        prev.map((cat) => (cat.id === categoryId ? { ...cat, items: [...cat.items, data.item] } : cat))
      );
      setAddItemText((prev) => ({ ...prev, [categoryId]: "" }));
      setAddItemVisible((prev) => ({ ...prev, [categoryId]: false }));
    } catch {
      // ignore
    } finally {
      setAddItemSaving((prev) => ({ ...prev, [categoryId]: false }));
    }
  }

  async function handleUpdateItem() {
    if (!editingItem) return;
    const name = editingItem.name.trim();
    if (!name) return;
    setEditItemSaving(true);
    try {
      await fetch(`/api/admin/equipment/${editingItem.categoryId}/items/${editingItem.itemId}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ name }),
      });
      setCategories((prev) =>
        prev.map((cat) =>
          cat.id === editingItem.categoryId
            ? { ...cat, items: cat.items.map((item) => (item.id === editingItem.itemId ? { ...item, name } : item)) }
            : cat
        )
      );
      setEditingItem(null);
    } catch {
      // ignore
    } finally {
      setEditItemSaving(false);
    }
  }

  async function handleDeleteItem(categoryId: string, itemId: string) {
    try {
      await fetch(`/api/admin/equipment/${categoryId}/items/${itemId}`, { method: "DELETE", headers: headers() });
      setCategories((prev) =>
        prev.map((cat) =>
          cat.id === categoryId ? { ...cat, items: cat.items.filter((item) => item.id !== itemId) } : cat
        )
      );
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Echipamente</h1>
            <p className="text-neutral-500 text-sm mt-0.5">Categorii și echipamente pentru checklist eveniment</p>
          </div>
          {!showAddCategory && (
            <button
              type="button"
              onClick={() => setShowAddCategory(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
            >
              <span>＋</span> Categorie nouă
            </button>
          )}
        </div>

        {/* Add category form */}
        {showAddCategory && (
          <CategoryForm
            initial={BLANK_CATEGORY}
            onSave={handleAddCategory}
            onCancel={() => setShowAddCategory(false)}
            saving={addCategorySaving}
            saveLabel="Creează categorie"
          />
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        )}

        {/* Empty state */}
        {!loading && categories.length === 0 && !showAddCategory && (
          <div className="text-center py-16 text-neutral-600">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-sm">Nicio categorie de echipamente. Creează prima categorie.</p>
          </div>
        )}

        {/* Category cards */}
        <div className="grid gap-4 md:grid-cols-2">
          {categories.map((category) => {
            const isEditing = editingCategoryId === category.id;
            const isAddItemOpen = !!addItemVisible[category.id];
            const serviceLabel = SERVICE_TAG_OPTIONS.find((opt) => opt.value === category.serviceTag)?.label ?? category.serviceTag;

            return (
              <div key={category.id} className="rounded-2xl border border-neutral-800 bg-neutral-900 overflow-hidden">
                {/* Card header */}
                {isEditing ? (
                  <div className="p-4">
                    <CategoryForm
                      initial={editCategoryInitial}
                      onSave={(form) => handleUpdateCategory(category.id, form)}
                      onCancel={() => setEditingCategoryId(null)}
                      saving={editCategorySaving}
                      saveLabel="Salvează"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: category.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{category.name}</p>
                      <p className="text-[10px] text-neutral-500">{serviceLabel}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditCategoryInitial({ name: category.name, serviceTag: category.serviceTag, color: category.color });
                          setEditingCategoryId(category.id);
                        }}
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors"
                        aria-label="Editează categorie"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(category.id)}
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                        aria-label="Șterge categorie"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                {/* Items list */}
                <div className="divide-y divide-neutral-800/50">
                  {category.items.length === 0 && (
                    <p className="px-4 py-3 text-xs text-neutral-600 italic">Niciun echipament adăugat</p>
                  )}
                  {category.items.map((item) => {
                    const isEditingThisItem = editingItem?.categoryId === category.id && editingItem?.itemId === item.id;
                    return (
                      <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 group">
                        <span className="w-1 h-1 rounded-full bg-neutral-600 shrink-0" />
                        {isEditingThisItem ? (
                          <input
                            ref={editItemRef}
                            value={editingItem.name}
                            onChange={(event) => setEditingItem({ ...editingItem, name: event.target.value })}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") handleUpdateItem();
                              if (event.key === "Escape") setEditingItem(null);
                            }}
                            className="flex-1 bg-neutral-800 border border-neutral-600 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-neutral-400"
                          />
                        ) : (
                          <span className="flex-1 text-xs text-neutral-300">{item.name}</span>
                        )}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isEditingThisItem ? (
                            <>
                              <button
                                type="button"
                                onClick={handleUpdateItem}
                                disabled={editItemSaving}
                                className="p-1 rounded text-emerald-400 hover:bg-neutral-800 transition-colors"
                                aria-label="Salvează"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingItem(null)}
                                className="p-1 rounded text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors"
                                aria-label="Anulează"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setEditingItem({ categoryId: category.id, itemId: item.id, name: item.name })}
                                className="p-1 rounded text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors"
                                aria-label="Editează"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(category.id, item.id)}
                                className="p-1 rounded text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                                aria-label="Șterge"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add item */}
                <div className="px-4 pb-3 pt-2">
                  {isAddItemOpen ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={addItemText[category.id] ?? ""}
                        onChange={(event) => setAddItemText((prev) => ({ ...prev, [category.id]: event.target.value }))}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") handleAddItem(category.id);
                          if (event.key === "Escape") setAddItemVisible((prev) => ({ ...prev, [category.id]: false }));
                        }}
                        placeholder="Denumire echipament..."
                        className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddItem(category.id)}
                        disabled={addItemSaving[category.id]}
                        className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-medium transition-colors"
                      >
                        {addItemSaving[category.id] ? "..." : "Adaugă"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddItemVisible((prev) => ({ ...prev, [category.id]: false }))}
                        className="px-2 py-1.5 rounded-lg text-neutral-500 hover:text-white text-xs transition-colors"
                      >
                        Anulează
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddItemVisible((prev) => ({ ...prev, [category.id]: true }))}
                      className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors flex items-center gap-1"
                    >
                      <span>＋</span> Adaugă echipament
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Info footer */}
        {!loading && categories.length > 0 && (
          <p className="text-[11px] text-neutral-600 text-center">
            Categoriile marcate „General" apar la toate evenimentele. Celelalte apar doar la evenimentele cu serviciul asociat.
          </p>
        )}
      </div>
    </div>
  );
}
