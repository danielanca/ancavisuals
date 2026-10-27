/*
 * Purpose: profiles of the people who help choose photos (Daniel, Estera, Salomeea, …):
 * name + email + phone, so selection links can be assigned to them and reminders reach them.
 * Saved profiles override the built-in defaults with the same id.
 */
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { normalizeRomanianPhoneNumber } from "../notifications/sms";
import { isValidEmail } from "../../shared/albumUpdates";
import { linkVisitorReviewer, PHOTO_REVIEWERS, reviewerIdFromName, type AlbumCoverage, type PhotoReviewer } from "../../shared/media/proposalConsensus";

const COLLECTION = "photoReviewers";
const MAX_NAME_LENGTH = 60;

export async function listPhotoReviewers(): Promise<PhotoReviewer[]> {
  const snapshot = await firestore().collection(COLLECTION).get();
  const saved = new Map(snapshot.docs.map(doc => {
    const data = doc.data();
    return [doc.id, { id: doc.id, name: String(data.name ?? doc.id), email: String(data.email ?? ""), phone: String(data.phone ?? "") }];
  }));
  const defaults = PHOTO_REVIEWERS.map(reviewer => ({ phone: "", ...reviewer, ...saved.get(reviewer.id) }));
  const extra = [...saved.values()].filter(reviewer => !PHOTO_REVIEWERS.some(item => item.id === reviewer.id));
  return [...defaults, ...extra.sort((a, b) => a.name.localeCompare(b.name, "ro"))];
}

export type ReviewerInput = { name?: unknown; email?: unknown; phone?: unknown };

/** Validated fields, or an error message in Romanian for the admin form. */
export function cleanReviewerInput(input: ReviewerInput): { name: string; email: string; phone: string } | { error: string } {
  const name = String(input.name ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH);
  const email = String(input.email ?? "").trim().toLowerCase();
  const rawPhone = String(input.phone ?? "").trim();
  if (!name) return { error: "Scrie numele persoanei." };
  if (email && !isValidEmail(email)) return { error: "Emailul nu pare corect." };
  const phone = rawPhone ? normalizeRomanianPhoneNumber(rawPhone) : "";
  if (phone === null) return { error: "Numărul de telefon nu pare corect." };
  return { name, email, phone };
}

/** Creates a profile (id from the name) or updates an existing one. */
export async function savePhotoReviewer(id: string | null, input: ReviewerInput): Promise<PhotoReviewer | { error: string }> {
  const clean = cleanReviewerInput(input);
  if ("error" in clean) return clean;
  const reviewers = await listPhotoReviewers();
  let reviewerId = id;
  if (!reviewerId) {
    const base = reviewerIdFromName(clean.name) || "persoana";
    reviewerId = base;
    for (let n = 2; reviewers.some(reviewer => reviewer.id === reviewerId); n++) reviewerId = `${base}-${n}`;
  } else if (!reviewers.some(reviewer => reviewer.id === reviewerId)) {
    return { error: "Persoana nu există." };
  }
  await firestore().collection(COLLECTION).doc(reviewerId).set({ ...clean, updatedAt: Timestamp.now() }, { merge: true });
  return { id: reviewerId, ...clean };
}

type LinkProgress = {
  reviewerId?: string;
  visitors?: Record<string, { name?: string; viewedCount?: number; completedAt?: unknown }>;
};

/**
 * How far each reviewer got through an album: the furthest photo seen on their personal links
 * (all of them once they pressed „Am terminat”). Votes from an account aren't tracked while
 * scrolling, so those reviewers count as having seen the whole album.
 */
export function albumCoverage(total: number, links: LinkProgress[], accountReviewers: string[], reviewers: readonly PhotoReviewer[] = PHOTO_REVIEWERS): AlbumCoverage {
  const seen: Record<string, number> = {};
  for (const link of links) {
    for (const visitor of Object.values(link.visitors ?? {})) {
      const reviewer = linkVisitorReviewer(link.reviewerId, visitor.name, reviewers);
      if (!reviewer) continue;
      const count = visitor.completedAt ? total : Math.min(total, visitor.viewedCount ?? 0);
      seen[reviewer] = Math.max(seen[reviewer] ?? 0, count);
    }
  }
  for (const reviewer of accountReviewers) seen[reviewer] = total;
  return { total, seen };
}
