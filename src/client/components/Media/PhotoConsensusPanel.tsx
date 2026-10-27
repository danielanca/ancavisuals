import { useMemo, useState } from "react";
import PhotoReviewImage from "./PhotoReviewImage";
import { buildPhotoConsensus, compareByScore, consensusScore, consensusVoters, photoSeenBy, reviewerName,
  type AlbumCoverage, type PhotoDestination, type PhotoReviewer, type PhotoReviewerId, type PhotoVote } from "../../../shared/media/proposalConsensus";

type Props = {
  proposals: PhotoVote[];
  reviewers?: readonly PhotoReviewer[];
  coverage?: AlbumCoverage;
  onRefresh?: () => void;
  loading?: boolean;
  initialDestination?: PhotoDestination | "all";
  onModerate?: (ids: string[], status: "accepted" | "rejected") => Promise<void>;
  busyKey?: string | null;
};
/** none = album order · top = best score first · a number = exactly that many votes. */
type View = "none" | "top" | number;
type StatusFilter = "all" | "pending" | "accepted" | "rejected";

// One star per person who chose the photo.
const starsLabel = (count: number) => `${"★".repeat(Math.min(count, 5))}${count > 5 ? "+" : ""} ${count === 1 ? "1 stea" : `${count} stele`}`;
const chip = (active: boolean) => `px-3 py-2 rounded-lg text-xs border ${active ? "bg-emerald-950 border-emerald-700 text-emerald-300" : "border-neutral-700 text-neutral-400"}`;

// One album at a time (owner, 2026-10-27): the best photos of each wedding, by how many of the
// people who SAW a photo chose it — someone who never reached photo 900 can't vote against it.
export default function PhotoConsensusPanel({ proposals, reviewers, coverage, onRefresh, loading, initialDestination = "all", onModerate, busyKey }: Props) {
  const [selectionEnabled, setSelectionEnabled] = useState(false);
  const [view, setView] = useState<View>("none");
  const [destination, setDestination] = useState<PhotoDestination | "all">(initialDestination);
  const [person, setPerson] = useState<PhotoReviewerId | "all">("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const groups = useMemo(() => buildPhotoConsensus(proposals, reviewers), [proposals, reviewers]);
  const nameOf = (id: PhotoReviewerId) => reviewerName(id, reviewers);

  const statusOf = (ids: string[]) => {
    const statuses = proposals.filter(proposal => ids.includes(proposal.id)).map(proposal => proposal.status);
    if (statuses.length && statuses.every(value => value === "accepted")) return "accepted";
    if (statuses.length && statuses.every(value => value === "rejected")) return "rejected";
    return "pending";
  };

  const scored = useMemo(() => groups
    .map(group => ({ group, ...consensusScore(group, destination, coverage), photoIndex: group.photoIndex }))
    .filter(item => item.votes > 0)
    .sort((a, b) => (a.photoIndex ?? Infinity) - (b.photoIndex ?? Infinity) || a.group.fileName.localeCompare(b.group.fileName)),
  [groups, destination, coverage]);

  const people = useMemo(() => {
    const ids = new Set<PhotoReviewerId>([...Object.keys(coverage?.seen ?? {}), ...groups.flatMap(group => group.voters)]);
    return [...ids].sort((a, b) => reviewerName(a, reviewers).localeCompare(reviewerName(b, reviewers), "ro"));
  }, [groups, coverage, reviewers]);

  const base = scored.filter(item =>
    (person === "all" || consensusVoters(item.group, destination).includes(person))
    && (status === "all" || statusOf(item.group.ids) === status));
  const voteCounts = [...new Set(base.map(item => item.votes))].sort((a, b) => a - b);
  const visible = view === "top" ? [...base].sort(compareByScore)
    : typeof view === "number" ? base.filter(item => item.votes === view)
    : base;

  return (
    <section aria-label="Selecția comună de poze" className="text-neutral-200 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Selecția comună de poze</h2>
          <p className="text-xs text-neutral-400 mt-1">Scorul unei poze = câți au ales-o, din cei care au ajuns la ea în album.</p>
        </div>
        {onRefresh && <button type="button" onClick={onRefresh} disabled={loading} className="px-3 py-2 rounded-lg border border-neutral-700 text-xs disabled:opacity-40">{loading ? "Se actualizează..." : "Actualizează voturile"}</button>}
      </div>

      {coverage && coverage.total > 0 && Object.keys(coverage.seen).length > 0 && (
        <div aria-label="Cât a parcurs fiecare" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {Object.entries(coverage.seen).sort(([a], [b]) => nameOf(a).localeCompare(nameOf(b), "ro")).map(([id, seen]) => (
            <div key={id} className="border border-neutral-800 rounded-lg px-3 py-2 text-xs">
              <p className="truncate"><strong className="text-white">{nameOf(id)}</strong> · {seen >= coverage.total ? `${coverage.total}/${coverage.total} ✓` : `${seen}/${coverage.total}`}</p>
              <div className="mt-1.5 h-1 bg-neutral-800 rounded"><div className={`h-1 rounded ${seen >= coverage.total ? "bg-emerald-500" : "bg-amber-400"}`} style={{ width: `${Math.min(100, seen / coverage.total * 100)}%` }} /></div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 flex-wrap" role="group" aria-label="Filtru după stele">
        <button type="button" aria-pressed={view === "none"} onClick={() => setView("none")} className={chip(view === "none")}>Toate, în ordinea din album ({base.length})</button>
        <button type="button" aria-pressed={view === "top"} onClick={() => setView("top")} className={chip(view === "top")}>🏆 Top</button>
        {voteCounts.map(count => (
          <button key={count} type="button" aria-pressed={view === count} onClick={() => setView(count)} className={chip(view === count)}>
            {starsLabel(count)} ({base.filter(item => item.votes === count).length})
          </button>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        <select aria-label="Destinația voturilor" value={destination} onChange={event => setDestination(event.target.value as PhotoDestination | "all")} className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs">
          <option value="all">Instagram / Media Assets</option><option value="instagram">Instagram</option><option value="media_assets">Media Assets</option>
        </select>
        <select aria-label="Persoana care a votat" value={person} onChange={event => setPerson(event.target.value)} className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs">
          <option value="all">Oricine</option>{people.map(id => <option key={id} value={id}>{nameOf(id)}</option>)}
        </select>
        <select aria-label="Decizia" value={status} onChange={event => setStatus(event.target.value as StatusFilter)} className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs">
          <option value="all">Orice decizie</option><option value="pending">De decis</option><option value="accepted">Acceptate</option><option value="rejected">Respinse</option>
        </select>
      </div>
      {onModerate && (
        <button type="button" role="switch" aria-checked={selectionEnabled} onClick={() => setSelectionEnabled(enabled => !enabled)} className={`px-4 py-2 rounded-lg text-sm border ${selectionEnabled ? "border-emerald-700 bg-emerald-950 text-emerald-300" : "border-neutral-700 text-neutral-300"}`}>
          {selectionEnabled ? "Dezactivează acceptarea" : "Activează acceptarea"}
        </button>
      )}
      {!loading && visible.length === 0 && <p className="py-6 text-sm text-neutral-500">{groups.length ? "Nicio fotografie nu corespunde filtrelor alese." : "Nu sunt voturi încă pentru acest album. Creează câte un link personal din album → „Link unic de selecție poze”."}</p>}
      {/* A grid, not the masonry columns: photos read left to right, so album order and Top ranks stay in order. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 items-start">
        {visible.map((item, rank) => {
          const { group } = item;
          const voters = consensusVoters(group, destination);
          const seenBy = photoSeenBy(group, coverage);
          const noVote = seenBy.filter(id => !voters.includes(id));
          const notYet = Object.keys(coverage?.seen ?? {}).filter(id => !seenBy.includes(id));
          const decision = statusOf(group.ids);
          return (
            <article key={group.key} className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden">
              <PhotoReviewImage src={group.previewPhotoUrl ?? group.photoUrl} original={group.originalPhotoUrl ?? group.photoUrl}
                alt={group.fileName} enabled={selectionEnabled} busy={Boolean(busyKey)}
                onAccept={onModerate ? () => void onModerate(group.ids, "accepted") : undefined}
                onReject={onModerate ? () => void onModerate(group.ids, "rejected") : undefined} />
              <div className="p-3 space-y-1.5 text-xs">
                {decision === "accepted" && <p className="text-emerald-300">Acceptată</p>}
                {decision === "rejected" && <p className="text-red-400">Respinsă</p>}
                <p className="text-emerald-300 font-semibold">
                  {view === "top" && <span className="text-white">#{rank + 1} · </span>}
                  <span aria-hidden="true" className="tracking-widest text-amber-300">{"★".repeat(item.votes)}<span className="text-neutral-600">{"☆".repeat(item.seenBy - item.votes)}</span></span>{" "}
                  {item.votes} din {item.seenBy} · {Math.round(item.ratio * 100)}%
                </p>
                <p>{voters.map(nameOf).join(", ")}</p>
                {noVote.length > 0 && <p className="text-neutral-500">Au văzut-o, n-au ales-o: {noVote.map(nameOf).join(", ")}</p>}
                {notYet.length > 0 && <p className="text-neutral-500">N-au ajuns încă la ea: {notYet.map(nameOf).join(", ")}</p>}
                <p className="text-neutral-400">Instagram: {group.destinationVoters.instagram.length} · Media Assets: {group.destinationVoters.media_assets.length}</p>
                <p className="truncate text-neutral-500" title={group.fileName}>{group.photoIndex !== undefined ? `Poza ${group.photoIndex + 1} · ` : ""}{group.fileName}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
