import { useCallback, useEffect, useRef, useState } from "react";

// Coadă de încărcări pentru admin (ex. acceptarea propunerilor → Media Assets): rulează câte
// `concurrency` deodată, ține minte cât a durat fiecare ca să estimeze așteptarea și curăță
// singură ce s-a terminat. Erorile rămân în listă până sunt închise sau reîncercate.

export type UploadStatus = "queued" | "uploading" | "done" | "error";

export interface UploadItem {
  key: string;
  label: string;
  thumbUrl?: string;
  status: UploadStatus;
  startedAt?: number;
  finishedAt?: number;
  error?: string;
}

type Task = () => Promise<void>;

// Până nu s-a terminat nicio încărcare, estimarea pornește de la atât (descărcare + încărcare + WebP).
export const DEFAULT_UPLOAD_MS = 6000;
export const DONE_VISIBLE_MS = 3000;

/** Câte secunde mai are de așteptat toată coada, din durata medie a încărcărilor terminate. */
export function estimateRemainingMs(items: UploadItem[], concurrency: number, averageMs: number, now: number): number {
  const queued = items.filter(item => item.status === "queued").length;
  const uploadingLeft = items
    .filter(item => item.status === "uploading")
    .map(item => Math.max(averageMs * 0.15, averageMs - (now - (item.startedAt ?? now))));
  const current = uploadingLeft.length ? Math.max(...uploadingLeft) : 0;
  return current + Math.ceil(queued / concurrency) * averageMs;
}

export function useUploadQueue(concurrency = 2) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [averageMs, setAverageMs] = useState(DEFAULT_UPLOAD_MS);
  const tasks = useRef(new Map<string, Task>());
  const running = useRef(new Set<string>());
  const durations = useRef<number[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const patch = useCallback((key: string, changes: Partial<UploadItem>) => {
    setItems(prev => prev.map(item => (item.key === key ? { ...item, ...changes } : item)));
  }, []);

  // Pornește următoarele din coadă cât timp sunt locuri libere.
  const pump = useCallback(() => {
    const waiting = itemsRef.current.filter(item => item.status === "queued" && !running.current.has(item.key));
    for (const item of waiting) {
      if (running.current.size >= concurrency) break;
      const task = tasks.current.get(item.key);
      if (!task) continue;
      running.current.add(item.key);
      const startedAt = Date.now();
      itemsRef.current = itemsRef.current.map(i => (i.key === item.key ? { ...i, status: "uploading" as const, startedAt } : i));
      patch(item.key, { status: "uploading", startedAt, error: undefined });
      task()
        .then(() => {
          const finishedAt = Date.now();
          durations.current = [...durations.current.slice(-9), finishedAt - startedAt];
          setAverageMs(durations.current.reduce((sum, ms) => sum + ms, 0) / durations.current.length);
          tasks.current.delete(item.key);
          patch(item.key, { status: "done", finishedAt });
        })
        .catch((error: unknown) => {
          patch(item.key, { status: "error", finishedAt: Date.now(), error: error instanceof Error ? error.message : String(error) });
        })
        .finally(() => {
          running.current.delete(item.key);
          setTimeout(pump, 0);
        });
    }
  }, [concurrency, patch]);

  useEffect(() => { pump(); }, [items, pump]);

  // Cele terminate cu succes dispar din listă după câteva secunde.
  useEffect(() => {
    const done = items.filter(item => item.status === "done");
    if (!done.length) return;
    const timer = setTimeout(() => {
      const cutoff = Date.now() - DONE_VISIBLE_MS;
      setItems(prev => prev.filter(item => item.status !== "done" || (item.finishedAt ?? 0) > cutoff));
    }, DONE_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [items]);

  // Cât timp mai sunt încărcări neterminate, browserul cere confirmare la închidere/reîncărcare —
  // altfel cele încă în coadă nu s-ar mai salva, deși pe ecran apar deja acceptate.
  const hasPending = items.some(item => item.status === "queued" || item.status === "uploading");
  useEffect(() => {
    if (!hasPending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasPending]);

  const enqueue = useCallback((item: { key: string; label: string; thumbUrl?: string }, task: Task) => {
    if (running.current.has(item.key)) return;
    tasks.current.set(item.key, task);
    setItems(prev => [...prev.filter(existing => existing.key !== item.key), { ...item, status: "queued" }]);
  }, []);

  const retry = useCallback((key: string) => {
    if (!tasks.current.has(key)) return;
    patch(key, { status: "queued", error: undefined, finishedAt: undefined, startedAt: undefined });
  }, [patch]);

  const dismiss = useCallback((key: string) => {
    tasks.current.delete(key);
    setItems(prev => prev.filter(item => item.key !== key));
  }, []);

  return { items, averageMs, enqueue, retry, dismiss, concurrency };
}
