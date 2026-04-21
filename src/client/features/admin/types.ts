export type EventStatus = "lead" | "tentativ" | "confirmat" | "finalizat" | "anulat";

export type EventType = "Nuntă" | "Botez" | "Logodnă" | "Aniversare" | "Altele";

export interface EventService {
  name: string;
  price: number;
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
}

export interface Goal {
  targetRevenue: number;
  startDate: string;
  endDate: string;
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
}
