import { firestore } from "../firestore";

export class FeedbackPublicationError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// One public review per private message, even when the owner submits twice.
export async function publishFeedbackReview(sourceId: string, review: Record<string, unknown>) {
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(sourceId)) throw new FeedbackPublicationError(400, "Feedback invalid.");
  const db = firestore();
  const feedbackRef = db.collection("clientFeedback").doc(sourceId);
  const reviewRef = db.collection("siteReviews").doc(`feedback-${sourceId}`);
  await db.runTransaction(async tx => {
    const feedback = await tx.get(feedbackRef);
    const existing = await tx.get(reviewRef);
    if (!feedback.exists) throw new FeedbackPublicationError(404, "Feedback-ul nu există.");
    if (existing.exists || feedback.data()?.publishedReviewId) throw new FeedbackPublicationError(409, "Feedback-ul este deja publicat. Editează recenzia existentă.");
    tx.set(reviewRef, { ...review, sourceFeedbackId: sourceId });
    tx.update(feedbackRef, { publishedReviewId: reviewRef.id, read: true });
  });
  return reviewRef;
}

export async function deletePublicReview(id: string) {
  const db = firestore();
  const ref = db.collection("siteReviews").doc(id);
  await db.runTransaction(async tx => {
    const review = await tx.get(ref);
    const source = review.data()?.sourceFeedbackId;
    const feedbackRef = typeof source === "string" ? db.collection("clientFeedback").doc(source) : null;
    const feedback = feedbackRef ? await tx.get(feedbackRef) : null;
    if (feedbackRef && feedback?.exists && feedback.data()?.publishedReviewId === id) {
      tx.update(feedbackRef, { publishedReviewId: null });
    }
    tx.delete(ref);
  });
}
