/**
 * Who chose which photo, and how much the people who actually SAW a photo agree on it.
 * Reviewers are dynamic profiles (owner, 2026-10-27: more people may vote); these three are the
 * defaults, always present even before anything is saved in Firestore (`photoReviewers`).
 */
export type PhotoReviewer = { id: string; name: string; email?: string; phone?: string };
export const PHOTO_REVIEWERS: readonly PhotoReviewer[] = [
  { id: "daniel", name: "Daniel", email: "ancadaniel1994@gmail.com" },
  { id: "estera", name: "Estera", email: "estera.pop97@gmail.com" },
  { id: "salomeea", name: "Salomeea", email: "" },
];
export type PhotoReviewerId = string;
export type PhotoDestination = "instagram" | "media_assets";

/** „salomeea”, „Salomeea ” and „Sălomeea” are the same name. */
export const nameKey = (name: string) => name.trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** URL-safe id for a new profile: „Ana Maria” → „ana-maria”. */
export const reviewerIdFromName = (name: string) => nameKey(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

/**
 * Who a visitor on a link really is: on a personal link, typing another profile's name means it's
 * that person (Estera opening Salomeea's link); otherwise the link's person. Generic links: nobody.
 */
export function linkVisitorReviewer(linkReviewerId: string | undefined, visitorName: string | undefined, reviewers: readonly PhotoReviewer[]): PhotoReviewerId | undefined {
  if (!linkReviewerId) return undefined;
  const key = nameKey(visitorName ?? "");
  return (key && reviewers.find(reviewer => nameKey(reviewer.name) === key)?.id) || linkReviewerId;
}

export function isPhotoReviewerId(value: unknown, reviewers: readonly PhotoReviewer[] = PHOTO_REVIEWERS): value is PhotoReviewerId {
  return reviewers.some(reviewer => reviewer.id === value);
}

export function reviewerFromEmail(email: string, reviewers: readonly PhotoReviewer[] = PHOTO_REVIEWERS): PhotoReviewerId | undefined {
  const clean = email.trim().toLowerCase();
  return reviewers.find(reviewer => reviewer.email && reviewer.email.toLowerCase() === clean)?.id;
}

export function reviewerName(id: PhotoReviewerId, reviewers: readonly PhotoReviewer[] = PHOTO_REVIEWERS): string {
  return reviewers.find(reviewer => reviewer.id === id)?.name ?? id;
}

export type PhotoVote = {
  id: string;
  albumSlug: string;
  fileName: string;
  photoUrl: string;
  previewPhotoUrl?: string;
  originalPhotoUrl?: string;
  proposedBy: string;
  status?: "pending" | "accepted" | "archived" | "rejected";
  proposedByUid?: string;
  proposedVia?: string;
  proposalLinkLabel?: string;
  reviewerId?: PhotoReviewerId;
  destinations?: PhotoDestination[];
  selectionDestinations?: PhotoDestination[];
  /** Position of the photo in the album (0-based), added by the server — compared with how far each reviewer got. */
  photoIndex?: number;
};

export function photoVoteKey(albumSlug: string, fileName: string): string {
  // The original JPG and its WebP preview represent the same photo.
  return `${albumSlug}::${fileName.replace(/\.[^.]+$/, "")}`;
}

function voteReviewer(vote: PhotoVote, reviewers: readonly PhotoReviewer[]): PhotoReviewerId | undefined {
  // Assigned by the admin on the link (or from the account) — never taken from what a visitor typed.
  if (vote.reviewerId) return vote.reviewerId;
  const accountReviewer = reviewerFromEmail(vote.proposedBy, reviewers);
  if (accountReviewer && vote.proposedVia !== "link") return accountReviewer;
  // Legacy personal links can be identified by their admin-assigned label, never by a visitor's free-text name.
  if (vote.proposedVia === "link" && vote.proposalLinkLabel) {
    const label = nameKey(vote.proposalLinkLabel);
    return reviewers.find(reviewer => nameKey(reviewer.name) === label)?.id;
  }
  return undefined;
}

export type ConsensusPhoto = {
  key: string;
  albumSlug: string;
  fileName: string;
  photoUrl: string;
  previewPhotoUrl?: string;
  originalPhotoUrl?: string;
  photoIndex?: number;
  ids: string[];
  voters: PhotoReviewerId[];
  destinationVoters: Record<PhotoDestination, PhotoReviewerId[]>;
};

export function buildPhotoConsensus(votes: PhotoVote[], reviewers: readonly PhotoReviewer[] = PHOTO_REVIEWERS): ConsensusPhoto[] {
  const groups = new Map<string, ConsensusPhoto>();
  for (const vote of votes) {
    const reviewer = voteReviewer(vote, reviewers);
    if (!reviewer) continue;
    const key = photoVoteKey(vote.albumSlug, vote.fileName);
    let group = groups.get(key);
    if (!group) {
      group = { key, albumSlug: vote.albumSlug, fileName: vote.fileName, photoUrl: vote.photoUrl,
        previewPhotoUrl: vote.previewPhotoUrl, originalPhotoUrl: vote.originalPhotoUrl, photoIndex: vote.photoIndex,
        ids: [], voters: [], destinationVoters: { instagram: [], media_assets: [] } };
      groups.set(key, group);
    }
    if (!group.ids.includes(vote.id)) group.ids.push(vote.id);
    if (!group.voters.includes(reviewer)) group.voters.push(reviewer);
    group.previewPhotoUrl ??= vote.previewPhotoUrl;
    group.originalPhotoUrl ??= vote.originalPhotoUrl;
    group.photoIndex ??= vote.photoIndex;
    for (const destination of vote.selectionDestinations ?? vote.destinations ?? ["instagram"]) {
      if (destination !== "instagram" && destination !== "media_assets") continue;
      if (!group.destinationVoters[destination].includes(reviewer)) group.destinationVoters[destination].push(reviewer);
    }
  }
  return [...groups.values()].sort((a, b) => b.voters.length - a.voters.length || a.albumSlug.localeCompare(b.albumSlug) || a.fileName.localeCompare(b.fileName));
}

export function consensusVoters(photo: ConsensusPhoto, destination: PhotoDestination | "all"): PhotoReviewerId[] {
  return destination === "all" ? photo.voters : photo.destinationVoters[destination];
}

/** How far each reviewer got through an album: photos seen (= total once they finished). */
export type AlbumCoverage = { total: number; seen: Record<PhotoReviewerId, number> };

/**
 * People who saw this photo: the ones who chose it, plus everyone who scrolled past it.
 * Without the photo's position we can't tell, so everyone who took part in the album counts.
 */
export function photoSeenBy(photo: ConsensusPhoto, coverage?: AlbumCoverage): PhotoReviewerId[] {
  const seen = new Set(photo.voters);
  for (const [reviewer, count] of Object.entries(coverage?.seen ?? {})) {
    if (photo.photoIndex === undefined || count > photo.photoIndex) seen.add(reviewer);
  }
  return [...seen];
}

export type ConsensusScore = { votes: number; seenBy: number; ratio: number };

export function consensusScore(photo: ConsensusPhoto, destination: PhotoDestination | "all", coverage?: AlbumCoverage): ConsensusScore {
  const votes = consensusVoters(photo, destination).length;
  const seenBy = Math.max(votes, photoSeenBy(photo, coverage).length);
  return { votes, seenBy, ratio: seenBy ? votes / seenBy : 0 };
}

/**
 * Best first: liked by the most people (stars), then by the largest share of those who saw it,
 * then album order. 3 of 4 beats 2 of 2 — the goal is photos that more people like.
 */
export function compareByScore(a: ConsensusScore & { photoIndex?: number }, b: ConsensusScore & { photoIndex?: number }): number {
  return b.votes - a.votes || b.ratio - a.ratio || (a.photoIndex ?? Infinity) - (b.photoIndex ?? Infinity);
}
