export type EventStatus = "lead" | "tentativ" | "confirmat" | "finalizat" | "anulat";

export type EventType = "Nuntă" | "Botez" | "Logodnă" | "Aniversare";

export interface EventService {
  name: string;
  price: number;
}

export interface ClientEvent {
  id: string;
  type: EventType;
  status: EventStatus;
  createdAt: Date;
  eventDate: Date;
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
  contractId?: string;
  notes?: string;
  contractUrl?: string;
  invoiceUrl?: string;
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
}
