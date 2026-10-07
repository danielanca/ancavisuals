import { useMemo, useState } from "react";
import PhotoReviewImage from "./PhotoReviewImage";
import galleryStyles from "./PhotoReviewGallery.module.scss";
import { buildPhotoConsensus, consensusVoters, matchesConsensus, PHOTO_REVIEWERS,
  type ConsensusFilter, type PhotoDestination, type PhotoReviewerId, type PhotoVote } from "../../../shared/media/proposalConsensus";

type Props = { proposals: PhotoVote[]; onRefresh?: () => void; loading?: boolean; singleAlbum?: boolean; initialDestination?: PhotoDestination | "all"; onModerate?: (ids: string[], status: "accepted" | "rejected") => Promise<void>; busyKey?: string | null };
const FILTERS: { id: ConsensusFilter; label: string }[] = [
  { id: "three", label: "Toți 3" }, { id: "two", label: "Cel puțin 2" },
  { id: "one", label: "O singură persoană" }, { id: "all", label: "Toate votate" },
];
const reviewerName = (id: PhotoReviewerId) => PHOTO_REVIEWERS.find(person => person.id === id)!.name;

export default function PhotoConsensusPanel({ proposals, onRefresh, loading, singleAlbum, initialDestination = "all", onModerate, busyKey }: Props) {
  const [selectionEnabled, setSelectionEnabled] = useState(false);
  const [filter, setFilter] = useState<ConsensusFilter>("three");
  const [destination, setDestination] = useState<PhotoDestination | "all">(initialDestination);
  const [album, setAlbum] = useState("all");
  const [person, setPerson] = useState<PhotoReviewerId | "all">("all");
  const groups = useMemo(() => buildPhotoConsensus(proposals), [proposals]);
  const albums = useMemo(() => [...new Set(groups.map(group => group.albumSlug))].sort(), [groups]);
  const albumGroups = groups.filter(group => album === "all" || group.albumSlug === album);
  const visible = albumGroups.filter(group => {
    const voters = consensusVoters(group, destination);
    return matchesConsensus(voters.length, filter) && (person === "all" || voters.includes(person));
  });
  return (
    <section aria-label="Selecția comună de poze" className="text-neutral-200 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Selecția comună de poze</h2>
          <p className="text-xs text-neutral-400 mt-1">Daniel · Estera · Salomeea — fiecare persoană are un singur vot pe fotografie.</p>
        </div>
        {onRefresh && <button type="button" onClick={onRefresh} disabled={loading} className="px-3 py-2 rounded-lg border border-neutral-700 text-xs disabled:opacity-40">{loading ? "Se actualizează..." : "Actualizează voturile"}</button>}
      </div>
      <p className="text-xs text-neutral-400">Votați din contul propriu sau din linkul personal de selecție. Rezultatele se actualizează pe măsură ce trimiteți alegerile.</p>
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(item => {
          const count = albumGroups.filter(group => matchesConsensus(consensusVoters(group, destination).length, item.id)).length;
          return <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)} className={`px-3 py-2 rounded-lg text-xs border ${filter === item.id ? "bg-emerald-950 border-emerald-700 text-emerald-300" : "border-neutral-700 text-neutral-400"}`}>{item.label} ({count})</button>;
        })}
      </div>
      <div className="flex gap-2 flex-wrap">
        <select aria-label="Destinația voturilor" value={destination} onChange={event => setDestination(event.target.value as PhotoDestination | "all")} className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs">
          <option value="all">Instagram / Media Assets</option><option value="instagram">Instagram</option><option value="media_assets">Media Assets</option>
        </select>
        {!singleAlbum && <select aria-label="Albumul voturilor" value={album} onChange={event => setAlbum(event.target.value)} className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs">
          <option value="all">Toate albumele</option>{albums.map(slug => <option key={slug} value={slug}>{slug}</option>)}
        </select>}
        <select aria-label="Persoana care a votat" value={person} onChange={event => setPerson(event.target.value as PhotoReviewerId | "all")} className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs">
          <option value="all">Oricare dintre voi</option>{PHOTO_REVIEWERS.map(reviewer => <option key={reviewer.id} value={reviewer.id}>{reviewer.name}</option>)}
        </select>
      </div>
      <button type="button" role="switch" aria-checked={selectionEnabled} onClick={() => setSelectionEnabled(enabled => !enabled)} className={`px-4 py-2 rounded-lg text-sm border ${selectionEnabled ? "border-emerald-700 bg-emerald-950 text-emerald-300" : "border-neutral-700 text-neutral-300"}`}>
        {selectionEnabled ? "Dezactivează selectarea" : "Activează selectarea"}
      </button>
      {!loading && visible.length === 0 && <p className="py-6 text-sm text-neutral-500">{groups.length ? "Nicio fotografie nu corespunde filtrelor alese încă." : "Nu sunt voturi ale echipei încă. În album, creează câte un link personal pentru Daniel, Estera și Salomeea din „Link unic de selecție poze”."}</p>}
      <div className={galleryStyles.masonry}>
        {visible.map(group => {
          const voters = consensusVoters(group, destination);
          const missing = PHOTO_REVIEWERS.filter(reviewer => !voters.includes(reviewer.id));
          return (
            <article key={group.key} className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden">
              <PhotoReviewImage src={group.previewPhotoUrl ?? group.photoUrl} original={group.originalPhotoUrl ?? group.photoUrl}
                alt={group.fileName} enabled={selectionEnabled} busy={Boolean(busyKey)}
                onAccept={onModerate ? () => void onModerate(group.ids, "accepted") : undefined}
                onReject={onModerate ? () => void onModerate(group.ids, "rejected") : undefined} />
              <div className="p-3 space-y-2 text-xs">
                {(() => {
                  const statuses = proposals.filter(proposal => group.ids.includes(proposal.id)).map(proposal => proposal.status);
                  return statuses.every(status => status === "accepted") ? <p className="text-emerald-300">Acceptată</p>
                    : statuses.every(status => status === "rejected") ? <p className="text-red-400">Respinsă</p> : null;
                })()}
                <p className="text-emerald-300 font-semibold">{voters.length}/3 · {Math.round(voters.length / 3 * 100)}% acord</p>
                <p>{voters.map(reviewerName).join(", ")}</p>
                {missing.length > 0 && <p className="text-neutral-500">Fără vot: {missing.map(reviewer => reviewer.name).join(", ")}</p>}
                <p className="text-neutral-400">Instagram: {group.destinationVoters.instagram.length}/3<br />Media Assets: {group.destinationVoters.media_assets.length}/3</p>
                <p className="truncate text-neutral-500" title={group.fileName}>{group.fileName}</p>
                {!singleAlbum && <a href={`/media/${encodeURIComponent(group.albumSlug)}`} className="block text-indigo-300 truncate">{group.albumSlug} ↗</a>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
