/*
 * Purpose: the "Persoane" view of /admin/instagram-proposals — who proposed photos, in which
 * albums and how many, so the owner can follow each person (team member or someone who got a
 * public proposal link) instead of only album by album.
 */

type ProposalStatus = "pending" | "accepted" | "archived" | "rejected";

export type PersonProposal = {
  albumSlug: string;
  proposedBy: string;
  proposedByUid?: string;
  proposedAt: string;
  status: ProposalStatus;
};

export type PersonAlbum = {
  albumSlug: string;
  total: number;
  byStatus: Record<ProposalStatus, number>;
  lastAt: string;
};

export type ProposalPerson = {
  key: string;
  label: string;
  /** Proposed through a public /propune link (a guest), not from a team account. */
  viaLink: boolean;
  total: number;
  byStatus: Record<ProposalStatus, number>;
  lastAt: string;
  albums: PersonAlbum[];
};

const emptyCounts = (): Record<ProposalStatus, number> => ({ pending: 0, accepted: 0, archived: 0, rejected: 0 });

/** One key per person: the same name or email, whatever the casing, is the same person. */
export const personKey = (proposedBy: string) => proposedBy.trim().toLowerCase() || "necunoscut";

/** "ana@ancavisuals.ro" → "ana"; a name typed on a proposal link stays as typed. */
export const personLabel = (proposedBy: string) => {
  const value = proposedBy.trim();
  if (!value) return "Necunoscut";
  return value.includes("@") ? value.split("@")[0] : value;
};

/** People with the most recent activity first; each one's albums newest first. */
export function proposalsByPerson(proposals: PersonProposal[]): ProposalPerson[] {
  const people = new Map<string, ProposalPerson & { albumMap: Map<string, PersonAlbum> }>();
  for (const proposal of proposals) {
    const key = personKey(proposal.proposedBy);
    let person = people.get(key);
    if (!person) {
      person = {
        key,
        label: personLabel(proposal.proposedBy),
        viaLink: false,
        total: 0,
        byStatus: emptyCounts(),
        lastAt: proposal.proposedAt,
        albums: [],
        albumMap: new Map(),
      };
      people.set(key, person);
    }
    if (proposal.proposedByUid?.startsWith("link:")) person.viaLink = true;
    person.total += 1;
    person.byStatus[proposal.status] += 1;
    if (proposal.proposedAt > person.lastAt) person.lastAt = proposal.proposedAt;

    let album = person.albumMap.get(proposal.albumSlug);
    if (!album) {
      album = { albumSlug: proposal.albumSlug, total: 0, byStatus: emptyCounts(), lastAt: proposal.proposedAt };
      person.albumMap.set(proposal.albumSlug, album);
    }
    album.total += 1;
    album.byStatus[proposal.status] += 1;
    if (proposal.proposedAt > album.lastAt) album.lastAt = proposal.proposedAt;
  }

  return Array.from(people.values())
    .map(({ albumMap, ...person }) => ({
      ...person,
      albums: Array.from(albumMap.values()).sort((a, b) => b.lastAt.localeCompare(a.lastAt)),
    }))
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

const shortDateFormatter = new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "short", timeZone: "Europe/Bucharest" });

/** "21 oct." — when a person last proposed something. */
export const formatDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : shortDateFormatter.format(date);
};
