export type EventStatus = "lead" | "tentativ" | "confirmat" | "finalizat" | "anulat";

export type EventType = "Nuntă" | "Botez" | "Logodnă" | "Aniversare" | "Altele";

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
}

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
