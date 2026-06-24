import { useState, useEffect, useCallback } from "react";
import type { ClientEvent } from "../types";
import useAuth from "../auth/useAuth";

interface ChecklistItem {
  id: string;
  label: string;
}

interface ChecklistCategory {
  id: string;
  label: string;
  color: string;
  serviceTag: string;
  items: ChecklistItem[];
}

// Always shown, not stored in DB — administrative items not equipment
const CATEGORY_GENERAL: ChecklistCategory = {
  id: "general",
  label: "General",
  color: "#a78bfa",
  serviceTag: "general",
  items: [
    { id: "contract_signed", label: "Contract semnat de client" },
    { id: "advance_paid", label: "Avans încasat" },
    { id: "location_confirmed", label: "Locație confirmată" },
    { id: "schedule_confirmed", label: "Program eveniment confirmat cu clientul" },
    { id: "guests_count", label: "Număr invitați confirmat" },
  ],
};

const SERVICE_TAG_KEYWORDS: Record<string, string[]> = {
  foto: ["foto", "fotograf", "photo", "portret", "sedinta"],
  video: ["video", "film", "cinematic", "reels"],
  fotocabina: ["fotocabin", "photo booth", "photobooth", "cabina foto"],
  videobooth: ["videobooth", "video booth", "video-booth"],
  transport: ["transport", "deplasare"],
};

function matchesServiceTag(serviceTag: string, serviceNames: string[]): boolean {
  if (serviceTag === "general") return true;
  const keywords = SERVICE_TAG_KEYWORDS[serviceTag] ?? [serviceTag.toLowerCase()];
  return serviceNames.some((name) => keywords.some((keyword) => name.includes(keyword)));
}

function getNextEvent(events: ClientEvent[]): ClientEvent | null {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return events
    .filter((event) => {
      if (event.status === "anulat" || event.status === "lead") return false;
      if (!event.eventDate) return false;
      const date = new Date(event.eventDate);
      date.setHours(0, 0, 0, 0);
      return date >= now;
    })
    .sort((a, b) => new Date(a.eventDate!).getTime() - new Date(b.eventDate!).getTime())[0] ?? null;
}

function detectRelevantCategories(event: ClientEvent, dbCategories: ChecklistCategory[]): ChecklistCategory[] {
  const serviceNames = event.services.map((service) => service.name.toLowerCase());
  const matched = dbCategories.filter((cat) => matchesServiceTag(cat.serviceTag, serviceNames));
  return [CATEGORY_GENERAL, ...matched];
}

function loadChecklist(eventId: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(`checklist-${eventId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveChecklist(eventId: string, checked: Record<string, boolean>) {
  try {
    localStorage.setItem(`checklist-${eventId}`, JSON.stringify(checked));
  } catch {
    // ignore
  }
}

export default function NextEventChecklist({ events }: { events: ClientEvent[] }) {
  const { auth } = useAuth();
  const nextEvent = getNextEvent(events);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const [dbCategories, setDbCategories] = useState<ChecklistCategory[]>([]);

  useEffect(() => {
    if (!auth.accessToken) return;
    fetch("/api/admin/equipment", { headers: { Authorization: `Bearer ${auth.accessToken}` } })
      .then((response) => response.json())
      .then((data: { categories: Array<{ id: string; name: string; color: string; serviceTag: string; items: Array<{ id: string; name: string }> }> }) => {
        const mapped: ChecklistCategory[] = (data.categories ?? []).map((cat) => ({
          id: cat.id,
          label: cat.name,
          color: cat.color,
          serviceTag: cat.serviceTag,
          items: cat.items.map((item) => ({ id: item.id, label: item.name })),
        }));
        setDbCategories(mapped);
      })
      .catch(() => {});
  }, [auth.accessToken]);

  useEffect(() => {
    if (!nextEvent) return;
    const saved = loadChecklist(nextEvent.id);
    setChecked(saved);
    const categories = detectRelevantCategories(nextEvent, dbCategories);
    setOpenCategories(new Set(categories.map((cat) => cat.id)));
  }, [nextEvent?.id, dbCategories]);

  const toggle = useCallback((itemId: string) => {
    if (!nextEvent) return;
    setChecked((prev) => {
      const next = { ...prev, [itemId]: !prev[itemId] };
      saveChecklist(nextEvent.id, next);
      return next;
    });
  }, [nextEvent?.id]);

  const toggleCategory = (categoryId: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const resetCategory = (category: ChecklistCategory) => {
    if (!nextEvent) return;
    setChecked((prev) => {
      const next = { ...prev };
      for (const item of category.items) next[item.id] = false;
      saveChecklist(nextEvent.id, next);
      return next;
    });
  };

  if (!nextEvent) return null;

  const categories = detectRelevantCategories(nextEvent, dbCategories);
  const totalItems = categories.reduce((sum, cat) => sum + cat.items.length, 0);
  const totalChecked = categories.reduce(
    (sum, cat) => sum + cat.items.filter((item) => checked[item.id]).length,
    0
  );
  const overallProgress = totalItems > 0 ? Math.round((totalChecked / totalItems) * 100) : 0;
  const allDone = totalItems > 0 && totalChecked === totalItems;

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-neutral-800">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-white font-semibold text-sm">Checklist eveniment</p>
            <p className="text-neutral-500 text-xs mt-0.5">
              {nextEvent.client?.fullName || nextEvent.typeLabel || nextEvent.type}
            </p>
          </div>
          <div className="text-right">
            <p className={`text-lg font-bold tabular-nums ${allDone ? "text-emerald-400" : "text-white"}`}>
              {totalChecked}<span className="text-neutral-600 font-normal text-sm">/{totalItems}</span>
            </p>
            <p className="text-neutral-500 text-xs">{overallProgress}% gata</p>
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="mt-3 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${allDone ? "bg-emerald-500" : "bg-violet-500"}`}
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* Categories */}
      <div className="divide-y divide-neutral-800/60">
        {categories.map((category) => {
          const categoryChecked = category.items.filter((item) => checked[item.id]).length;
          const categoryDone = category.items.length > 0 && categoryChecked === category.items.length;
          const isOpen = openCategories.has(category.id);

          return (
            <div key={category.id}>
              {/* Category header */}
              <button
                type="button"
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-neutral-800/40 transition-colors text-left"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: category.color }} />
                <span className="flex-1 text-sm font-medium text-neutral-200">{category.label}</span>
                <span className={`text-xs tabular-nums ${categoryDone ? "text-emerald-400" : "text-neutral-500"}`}>
                  {categoryChecked}/{category.items.length}
                </span>
                {categoryChecked > 0 && !categoryDone && (
                  <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); resetCategory(category); }}
                    className="text-neutral-600 hover:text-neutral-400 text-[10px] px-1.5 py-0.5 rounded border border-neutral-700 hover:border-neutral-600 transition-colors"
                  >
                    reset
                  </button>
                )}
                {categoryDone && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={`text-neutral-600 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Items */}
              {isOpen && (
                <div className="pb-2">
                  {category.items.length === 0 ? (
                    <p className="px-5 py-2 text-xs text-neutral-600 italic">
                      Niciun echipament — adaugă din{" "}
                      <a href="/admin/echipamente" className="underline hover:text-neutral-400">Profil echipamente</a>
                    </p>
                  ) : category.items.map((item) => {
                    const isChecked = !!checked[item.id];
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggle(item.id)}
                        className="w-full flex items-center gap-3 px-5 py-2 hover:bg-neutral-800/30 transition-colors text-left group"
                      >
                        <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all ${
                          isChecked ? "bg-emerald-500 border-emerald-500" : "border-neutral-700 group-hover:border-neutral-500"
                        }`}>
                          {isChecked && (
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </span>
                        <span className={`text-xs transition-colors ${
                          isChecked ? "line-through text-neutral-600" : "text-neutral-300 group-hover:text-white"
                        }`}>
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {allDone && (
        <div className="px-5 py-3 border-t border-neutral-800 text-center">
          <p className="text-emerald-400 text-xs font-medium">✓ Tot echipamentul e pregătit!</p>
        </div>
      )}
    </div>
  );
}
