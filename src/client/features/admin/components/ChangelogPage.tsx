/*
 * Purpose: /admin/updates — "Update-uri": everything added to the site, newest first, grouped by day.
 * Each entry is its own coloured box (neighbours never share a colour) so one change is easy to tell
 * from the next. Data: src/shared/adminChangelog.ts (an entry is added with every shipped change).
 */
import { Link } from "react-router-dom";
import Breadcrumb from "./Breadcrumb";
import { ADMIN_CHANGELOG, type ChangelogEntry } from "../../../../shared/adminChangelog";

// Distinct hues, each with a tinted header, a strong edge and readable text on the dark admin.
const PALETTE = [
  { edge: "border-sky-400", head: "bg-sky-500/15", title: "text-sky-200", chip: "border-sky-400/60 text-sky-200 hover:bg-sky-500/20" },
  { edge: "border-amber-400", head: "bg-amber-500/15", title: "text-amber-200", chip: "border-amber-400/60 text-amber-200 hover:bg-amber-500/20" },
  { edge: "border-emerald-400", head: "bg-emerald-500/15", title: "text-emerald-200", chip: "border-emerald-400/60 text-emerald-200 hover:bg-emerald-500/20" },
  { edge: "border-fuchsia-400", head: "bg-fuchsia-500/15", title: "text-fuchsia-200", chip: "border-fuchsia-400/60 text-fuchsia-200 hover:bg-fuchsia-500/20" },
  { edge: "border-orange-400", head: "bg-orange-500/15", title: "text-orange-200", chip: "border-orange-400/60 text-orange-200 hover:bg-orange-500/20" },
  { edge: "border-cyan-400", head: "bg-cyan-500/15", title: "text-cyan-200", chip: "border-cyan-400/60 text-cyan-200 hover:bg-cyan-500/20" },
  { edge: "border-rose-400", head: "bg-rose-500/15", title: "text-rose-200", chip: "border-rose-400/60 text-rose-200 hover:bg-rose-500/20" },
  { edge: "border-lime-400", head: "bg-lime-500/15", title: "text-lime-200", chip: "border-lime-400/60 text-lime-200 hover:bg-lime-500/20" },
  { edge: "border-violet-400", head: "bg-violet-500/15", title: "text-violet-200", chip: "border-violet-400/60 text-violet-200 hover:bg-violet-500/20" },
];

const dayOf = (at: string) => at.slice(0, 10);
const timeOf = (at: string) => (at.length > 10 ? at.slice(11, 16) : null);
const formatDay = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** Newest first (by `at`, then by position in the file), grouped by day. */
export function changelogByDay(entries: readonly ChangelogEntry[]): { day: string; entries: ChangelogEntry[] }[] {
  const sorted = entries.map((entry, index) => ({ entry, index })).sort((a, b) => b.entry.at.localeCompare(a.entry.at) || a.index - b.index).map(({ entry }) => entry);
  const days: { day: string; entries: ChangelogEntry[] }[] = [];
  for (const entry of sorted) {
    const day = dayOf(entry.at);
    if (days[days.length - 1]?.day !== day) days.push({ day, entries: [] });
    days[days.length - 1].entries.push(entry);
  }
  return days;
}

export default function ChangelogPage() {
  const days = changelogByDay(ADMIN_CHANGELOG);
  let colorIndex = 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <Breadcrumb />
      <div>
        <h1 className="text-2xl font-light tracking-tight text-white">Update-uri</h1>
        <p className="mt-1 text-sm text-neutral-400">Tot ce am adăugat sau schimbat pe site, cel mai nou sus. Fiecare chenar colorat e o schimbare separată.</p>
      </div>

      {days.map(({ day, entries }) => (
        <section key={day} aria-label={formatDay(day)} className="space-y-3">
          <h2 className="sticky top-0 z-10 bg-neutral-950/95 py-2 text-xs font-bold uppercase tracking-wider text-neutral-400 backdrop-blur">
            {formatDay(day)}
          </h2>
          {entries.map((entry) => {
            const color = PALETTE[colorIndex++ % PALETTE.length];
            const time = timeOf(entry.at);
            return (
              <article key={entry.id} aria-label={entry.title} className={`border border-l-4 border-neutral-800 bg-neutral-900 ${color.edge}`}>
                <header className={`flex items-start gap-3 px-4 py-3 ${color.head}`}>
                  <span className="text-xl leading-none" aria-hidden="true">{entry.emoji}</span>
                  <h3 className={`min-w-0 flex-1 text-base font-semibold ${color.title}`}>{entry.title}</h3>
                  <time dateTime={entry.at} className="shrink-0 font-mono text-xs text-neutral-300">{time ?? "—"}</time>
                </header>
                <div className="space-y-2 px-4 py-3 text-sm leading-relaxed text-neutral-200">
                  <p>{entry.summary}</p>
                  {entry.details && entry.details.length > 0 && (
                    <ul className="list-disc space-y-1 pl-5 text-neutral-300">
                      {entry.details.map((detail) => <li key={detail}>{detail}</li>)}
                    </ul>
                  )}
                  {entry.links && entry.links.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {entry.links.map((link) => (
                        <Link key={link.path} to={link.path} className={`border px-2.5 py-1 text-xs font-semibold transition-colors ${color.chip}`}>
                          {link.label} →
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}
