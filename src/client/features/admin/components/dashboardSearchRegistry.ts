import { useEffect } from "react";

// Registru runtime pentru căutarea din dashboard — separat de lista statică curatoriată
// (SEARCH_ITEMS din DashboardSearch.tsx). Orice pagină/tab poate să se "anunțe" aici cu
// useSearchable(...), fără să mai fie nevoie să editezi un fișier central de fiecare dată
// când adaugi un feature nou care nu are propria rută (ex. un tab dintr-o pagină existentă).
export type SearchableItem = { label: string; path: string; category: string; icon: string; keywords?: string };

type Listener = () => void;

const registry = new Map<string, SearchableItem>();
const listeners = new Set<Listener>();
// useSyncExternalStore cere ca getSnapshot() să întoarcă aceeași referință atâta timp cât
// nimic nu s-a schimbat — altfel React o consideră "schimbată" la fiecare verificare și
// re-randează la infinit (exact ce a înghețat pagina). De-aia cache-uim array-ul și îl
// recalculăm DOAR când chiar se schimbă registrul, nu la fiecare citire.
let snapshot: SearchableItem[] = [];

function recomputeSnapshot(): void {
  snapshot = Array.from(registry.values());
}

function notify(): void {
  recomputeSnapshot();
  listeners.forEach((listener) => listener());
}

export function registerSearchable(item: SearchableItem): () => void {
  const key = `${item.path}::${item.label}`;
  registry.set(key, item);
  notify();
  return () => {
    registry.delete(key);
    notify();
  };
}

export function getRegisteredSearchables(): SearchableItem[] {
  return snapshot;
}

export function subscribeSearchables(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Chemi asta o dată, în componenta tab-ului/secțiunii pe care vrei să o găsești din căutare.
// Exemplu: useSearchable({ label: "TVA Taxare Inversă", path: "/admin/financial", category: "Financiar", icon: "🧾", keywords: "tva taxare inversa d301 decont" });
export function useSearchable(item: SearchableItem): void {
  const { label, path, category, icon, keywords } = item;
  useEffect(() => {
    return registerSearchable({ label, path, category, icon, keywords });
  }, [label, path, category, icon, keywords]);
}
