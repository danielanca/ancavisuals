/** Stable reviewer identities shared by account votes and personal selection links. */
export const PHOTO_REVIEWERS = [
  { id: "daniel", name: "Daniel", email: "ancadaniel1994@gmail.com" },
  { id: "estera", name: "Estera", email: "estera.pop97@gmail.com" },
  { id: "salomeea", name: "Salomeea", email: "" },
] as const;
export type PhotoReviewerId = typeof PHOTO_REVIEWERS[number]["id"];
export type PhotoDestination = "instagram" | "media_assets";
export type ConsensusFilter = "all" | "three" | "two" | "one";

export function isPhotoReviewerId(value: unknown): value is PhotoReviewerId {
  return PHOTO_REVIEWERS.some(reviewer => reviewer.id === value);
}

export function reviewerFromEmail(email: string): PhotoReviewerId | undefined {
  return PHOTO_REVIEWERS.find(reviewer => reviewer.email && reviewer.email === email.trim().toLowerCase())?.id;
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
};

export function photoVoteKey(albumSlug: string, fileName: string): string {
  // The original JPG and its WebP preview represent the same photo.
  return `${albumSlug}::${fileName.replace(/\.[^.]+$/, "")}`;
}

function voteReviewer(vote: PhotoVote): PhotoReviewerId | undefined {
  if (isPhotoReviewerId(vote.reviewerId)) return vote.reviewerId;
  const accountReviewer = reviewerFromEmail(vote.proposedBy);
  if (accountReviewer && vote.proposedVia !== "link") return accountReviewer;
  // Legacy personal links can be identified by their admin-assigned label, never by a visitor's free-text name.
  if (vote.proposedVia === "link") {
    return PHOTO_REVIEWERS.find(reviewer => reviewer.name.toLowerCase() === vote.proposalLinkLabel?.trim().toLowerCase())?.id;
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
  ids: string[];
  voters: PhotoReviewerId[];
  destinationVoters: Record<PhotoDestination, PhotoReviewerId[]>;
};

export function buildPhotoConsensus(votes: PhotoVote[]): ConsensusPhoto[] {
  const groups = new Map<string, ConsensusPhoto>();
  for (const vote of votes) {
    const reviewer = voteReviewer(vote);
    if (!reviewer) continue;
    const key = photoVoteKey(vote.albumSlug, vote.fileName);
    let group = groups.get(key);
    if (!group) {
      group = { key, albumSlug: vote.albumSlug, fileName: vote.fileName, photoUrl: vote.photoUrl,
        previewPhotoUrl: vote.previewPhotoUrl, originalPhotoUrl: vote.originalPhotoUrl,
        ids: [], voters: [], destinationVoters: { instagram: [], media_assets: [] } };
      groups.set(key, group);
    }
    if (!group.ids.includes(vote.id)) group.ids.push(vote.id);
    if (!group.voters.includes(reviewer)) group.voters.push(reviewer);
    group.previewPhotoUrl ??= vote.previewPhotoUrl;
    group.originalPhotoUrl ??= vote.originalPhotoUrl;
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

export function matchesConsensus(count: number, filter: ConsensusFilter): boolean {
  if (filter === "three") return count === 3;
  if (filter === "two") return count >= 2;
  if (filter === "one") return count === 1;
  return count > 0;
}
