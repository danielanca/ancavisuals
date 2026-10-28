/*
 * Purpose: which albums don't have enough photos proposed for Instagram and for Media Assets
 * (/admin/instagram-proposals/albume). Counts distinct photos per album and destination (the same
 * photo proposed by 3 people counts once; rejected proposals don't count), against the minimums
 * chosen on the page.
 */
import { photoVoteKey } from "./proposalConsensus";

export type ProposalForCoverage = {
  albumSlug: string;
  fileName: string;
  destinations?: string[];
  status?: string;
  /** Who proposed it (reviewer id or email), to show who already went through the album. */
  by?: string;
  proposedAt?: string;
};

export type AlbumForCoverage = { slug: string; name: string; eventDate: string | null };

export type AlbumProposalCoverage = AlbumForCoverage & {
  instagram: number;
  mediaAssets: number;
  accepted: number;
  people: string[];
  lastProposedAt: string | null;
};

export type CoverageMinimums = { instagram: number; mediaAssets: number };
export const DEFAULT_COVERAGE_MINIMUMS: CoverageMinimums = { instagram: 10, mediaAssets: 10 };

export function albumProposalCoverage(albums: readonly AlbumForCoverage[], proposals: readonly ProposalForCoverage[]): AlbumProposalCoverage[] {
  const bySlug = new Map<string, { instagram: Set<string>; media: Set<string>; accepted: Set<string>; people: Set<string>; last: string | null }>();
  for (const proposal of proposals) {
    if (!proposal.albumSlug || !proposal.fileName || proposal.status === "rejected") continue;
    const entry = bySlug.get(proposal.albumSlug) ?? { instagram: new Set(), media: new Set(), accepted: new Set(), people: new Set(), last: null };
    const key = photoVoteKey(proposal.albumSlug, proposal.fileName);
    const destinations = proposal.destinations?.length ? proposal.destinations : ["instagram"];
    if (destinations.includes("instagram")) entry.instagram.add(key);
    if (destinations.includes("media_assets")) entry.media.add(key);
    if (proposal.status === "accepted") entry.accepted.add(key);
    if (proposal.by) entry.people.add(proposal.by);
    if (proposal.proposedAt && (!entry.last || proposal.proposedAt > entry.last)) entry.last = proposal.proposedAt;
    bySlug.set(proposal.albumSlug, entry);
  }
  return albums.map((album) => {
    const entry = bySlug.get(album.slug);
    return {
      ...album,
      instagram: entry?.instagram.size ?? 0,
      mediaAssets: entry?.media.size ?? 0,
      accepted: entry?.accepted.size ?? 0,
      people: entry ? [...entry.people].sort() : [],
      lastProposedAt: entry?.last ?? null,
    };
  });
}

/** Albums under either minimum, the emptiest first (then the most recent event). */
export function albumsNeedingProposals(coverage: readonly AlbumProposalCoverage[], minimums: CoverageMinimums): AlbumProposalCoverage[] {
  const missing = (album: AlbumProposalCoverage) =>
    Math.max(0, minimums.instagram - album.instagram) + Math.max(0, minimums.mediaAssets - album.mediaAssets);
  return coverage
    .filter((album) => album.instagram < minimums.instagram || album.mediaAssets < minimums.mediaAssets)
    .sort((a, b) => missing(b) - missing(a) || String(b.eventDate ?? "").localeCompare(String(a.eventDate ?? "")));
}
