export const FEEDBACK_MESSAGE_LIMIT = 3000;
export const FEEDBACK_NAME_LIMIT = 100;
export const FEEDBACK_VARIANT_COUNT = 7;
export const isFeedbackSlug = (slug: string) => /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(slug);
export const feedbackPath = (slug: string) => `/media/${encodeURIComponent(slug)}/feedback`;

export interface ClientFeedback {
  id: string;
  albumSlug: string;
  name: string;
  message: string;
  createdAt: string;
  read: boolean;
}
