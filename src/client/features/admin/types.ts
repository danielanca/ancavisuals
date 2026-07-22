export type EventStatus = "lead" | "tentativ" | "confirmat" | "finalizat" | "anulat";

export type EventType = "Nuntă" | "Botez" | "Cununie civilă" | "Logodnă" | "Majorat" | "Altele";

export interface EventService {
  name: string;
  price: number;
}

export interface EventExpense {
  id: string;
  label: string;
  amount: number;
}

export interface EventDelivery {
  photoSessionEdited?: boolean;
  allPhotosEdited?: boolean;
  shortVideoEdited?: boolean;
  longVideoEdited?: boolean;
  albumDelivered?: boolean;
  albumCreated?: boolean;
  albumSentToClient?: boolean;
  physicalDelivery?: boolean;
}

export interface ClientEvent {
  id: string;
  type: EventType;
  status: EventStatus;
  fiscalized: boolean;
  createdAt: Date;
  eventDate: Date | null;
  client: {
    fullName: string;
    phone: string;
    email: string;
  };
  services: EventService[];
  pricing: {
    total: number;
    advanceAmount: number;
    advancePaid: boolean;
    remainingAmount: number;
  };
  eventEndDate?: Date | null;
  typeLabel?: string;
  contractId?: string;
  handoverId?: string;
  notes?: string;
  contractUrl?: string;
  invoiceUrl?: string;
  attachmentUrls?: string[];
  templateUrls?: string[];
  albumSlug?: string;
  albumPin?: string;
  expenses?: EventExpense[];
  postEventBackupConfirmedAt?: Date | null;
  postEventBackupReminderSentAt?: Date | null;
  postEventBackupReminderDueAt?: Date | null;
  postEventBackupConfirmationToken?: string | null;
  postEventBackupProofUrl?: string | null;
  postEventBackupProofName?: string | null;
  delivery?: EventDelivery;
  progress?: EventProgress;
}

export type EventProgressStatus = "not_started" | "in_progress" | "done" | "blocked";

export interface EventProgressStep {
  status: EventProgressStatus;
}

export interface EventProgress {
  shooting?: EventProgressStep;
  photoEditing?: EventProgressStep;
  videoEditing?: EventProgressStep;
  deliverPhoto?: EventProgressStep;
  deliverVideo?: EventProgressStep;
  physicalAlbum?: EventProgressStep;
}

export const PROGRESS_STEPS: { key: keyof EventProgress; label: string }[] = [
  { key: "shooting", label: "Fotografiere" },
  { key: "photoEditing", label: "Editare foto" },
  { key: "videoEditing", label: "Editare video" },
  { key: "deliverPhoto", label: "Livrare foto" },
  { key: "deliverVideo", label: "Livrare video" },
  { key: "physicalAlbum", label: "Album fizic" },
];

export const PROGRESS_STATUS_LABELS: Record<EventProgressStatus, string> = {
  not_started: "Neînceput",
  in_progress: "În progres",
  done: "Finalizat",
  blocked: "Blocat",
};

export interface Goal {
  targetRevenue: number;
  startDate: string;
  endDate: string;
}

export interface BankProfile {
  id: string;
  label: string;
  beneficiaryName: string;
  iban: string;
}

export interface AdminSettings {
  goals: {
    sixMonths: Goal;
    oneYear: Goal;
  };
  currency: "EUR";
  exchangeRate: number;
  bankDetails: {
    beneficiaryName: string;
    iban: string;
  };
  bankProfiles: BankProfile[];
}
