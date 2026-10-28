/*
 * Purpose: the two actions under each "Deadline livrare" bar on the event card: ☐ Livrat (marks the
 * photos / long video as delivered, the same flag the deadline already reads) and, when the deadline
 * is passed, ⏰ Reminder: "peste câte zile?" → an email to the owner that day. The reminder is a
 * memento (POST /api/admin/mementos, emailed by the mementos cron, also listed in /admin/mementos);
 * it is saved on the event as `deliveryReminders[kind]` so the card shows it, and closed on delivery.
 */
import { useState } from "react";

export type DeliveryKind = "photo" | "video";
export type DeliveryReminder = { at: string; mementoId: string };

const QUICK_DAYS = [1, 2, 3, 7];
const KIND_LABEL: Record<DeliveryKind, string> = { photo: "pozele", video: "videoclipul" };

/** `day` (YYYY-MM-DD) at `hour`:00 Romania time, as an ISO instant (DST-safe). */
export function romaniaTime(day: string, hour: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hour);
  const shown = new Date(guess).toLocaleString("sv-SE", { timeZone: "Europe/Bucharest", hour12: false }).replace(" ", "T");
  return new Date(guess - (Date.parse(`${shown}Z`) - guess)).toISOString();
}

export function daysFromToday(days: number, now = new Date()): string {
  const today = now.toLocaleDateString("sv-SE", { timeZone: "Europe/Bucharest" });
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Bucharest" });

export default function DeliveryDeadlineActions({ kind, done, overdue, eventName, eventDate, reminder, onToggleDone, onReminderSaved }: {
  kind: DeliveryKind;
  done: boolean;
  overdue: boolean;
  /** "Ana & Ion · Nuntă" — goes into the email. */
  eventName: string;
  eventDate: string;
  reminder?: DeliveryReminder;
  onToggleDone: () => void;
  onReminderSaved: (reminder: DeliveryReminder | null) => void;
}) {
  const [asking, setAsking] = useState(false);
  const [days, setDays] = useState("2");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = reminder && Date.parse(reminder.at) > Date.now() - 6 * 3_600_000 ? reminder : undefined;

  const setReminder = async (count: number) => {
    if (!Number.isInteger(count) || count < 1 || count > 90) {
      setError("Alege între 1 și 90 de zile.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // 10:00 Romania: inside the mementos cron window whether the server runs in UTC or Romania time.
      const at = romaniaTime(daysFromToday(count), 10);
      const res = await fetch("/api/admin/mementos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Livrare ${kind === "photo" ? "foto" : "video"}: ${eventName}`,
          description: `Deadline-ul pentru ${KIND_LABEL[kind]} evenimentului din ${new Date(eventDate).toLocaleDateString("ro-RO")} e depășit. Livrează și bifează „Livrat” pe cardul evenimentului.`,
          dueDate: at,
          category: "ancavisuals",
          reminderMinutesBefore: 240,
          recurring: "none",
        }),
      });
      const data = await res.json().catch(() => ({})) as { id?: string; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error ?? "Reminderul nu a putut fi salvat.");
      if (active) await closeMemento(active.mementoId);
      onReminderSaved({ at, mementoId: data.id });
      setAsking(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reminderul nu a putut fi salvat.");
    } finally {
      setBusy(false);
    }
  };

  const closeMemento = (id: string) =>
    fetch(`/api/admin/mementos/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed: true }) }).catch(() => undefined);

  const toggleDone = () => {
    // Delivered: the reminder is no longer needed.
    if (!done && active) {
      void closeMemento(active.mementoId);
      onReminderSaved(null);
    }
    onToggleDone();
  };

  const chip = "rounded-lg border px-2.5 py-1 text-xs transition-colors disabled:opacity-50";

  return (
    <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-2">
        <label className={`${chip} inline-flex cursor-pointer items-center gap-1.5 ${done ? "border-emerald-800 bg-emerald-950 text-emerald-300" : "border-neutral-700 text-neutral-300 hover:border-neutral-500"}`}>
          <input type="checkbox" checked={done} onChange={toggleDone} className="h-3.5 w-3.5 accent-emerald-500" />
          Livrat
        </label>
        {overdue && !done && (
          <button
            type="button"
            onClick={() => { setAsking((value) => !value); setError(null); }}
            disabled={busy}
            className={`${chip} ${active ? "border-amber-700 bg-amber-950 text-amber-300" : "border-neutral-700 text-neutral-300 hover:border-neutral-500"}`}
          >
            ⏰ {active ? `Reminder ${formatDay(active.at)}` : "Reminder"}
          </button>
        )}
      </div>
      {asking && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-950 p-2 text-xs">
          <span className="text-neutral-400">Peste câte zile îți trimit emailul?</span>
          {QUICK_DAYS.map((count) => (
            <button key={count} type="button" disabled={busy} onClick={() => void setReminder(count)} className={`${chip} border-neutral-700 text-neutral-200 hover:border-white`}>
              {count === 1 ? "mâine" : `${count} zile`}
            </button>
          ))}
          <input
            type="number"
            min={1}
            max={90}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            aria-label="Număr de zile"
            className="w-14 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1 text-white"
          />
          <button type="button" disabled={busy} onClick={() => void setReminder(Number(days))} className={`${chip} border-white bg-white text-neutral-950`}>
            {busy ? "Se salvează…" : "Setează"}
          </button>
        </div>
      )}
      {active && !asking && !done && <p className="text-[11px] text-amber-300/80">Primești email {formatDay(active.at)} dimineața.</p>}
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
}
