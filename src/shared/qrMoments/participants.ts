export type QrParticipant = {
  id: string;
  name: string;
  email: string;
  eventSlug: string;
  eventLabel: string;
  albumSlugs: string[];
  uploadCount: number;
  emailConsent: boolean;
  createdAt: string | null;
  firstUploadAt: string | null;
  lastUploadAt: string | null;
};
