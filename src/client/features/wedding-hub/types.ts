export type RsvpStatus = "asteptare" | "confirmat" | "refuzat";
export type MenuPreference = "carne" | "vegetarian" | "vegan" | "mixt";
export type WeddingDeclineReason =
  | "nu-suntem-in-tara"
  | "suntem-plecati"
  | "avem-alt-eveniment"
  | "motive-personale"
  | "probleme-sanatate"
  | "nu-putem-confirma";

export interface WeddingEmailSettings {
  emailNotificationsEnabled: boolean;
  notifyOnAccept: boolean;
  notifyOnDecline: boolean;
}

export interface WeddingProfile {
  id: string;
  brideFirstName: string;
  groomFirstName: string;
  weddingDate: string;
  city: string;
  venueName: string;
  venueAddress: string;
  coupleEmail: string;
  coupleUid: string;
  createdAt: string;
  emailSettings: WeddingEmailSettings;
}

export interface WeddingGuest {
  id: string;
  weddingId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  tableId: string | null;
  rsvpStatus: RsvpStatus;
  menuPreference: MenuPreference | null;
  childrenMenuPreference: MenuPreference | null;
  adultsCount: number;
  childrenCount: number;
  accompanyingAdultNames?: string[];
  childrenNames?: string[];
  sameTableWithFamily?: boolean;
  inviteToken: string;
  notes: string;
  declineReasons?: WeddingDeclineReason[];
  declineReasonDetails?: string;
  inviteSentAt?: string | null;
  inviteLastSentChannel?: "sms" | "share" | null;
  createdAt: string;
  rsvpSubmittedAt: string | null;
}

export interface WeddingTable {
  id: string;
  weddingId: string;
  tableName: string;
  tableAlias: string | null;
  capacity: number;
  createdAt: string;
}

export interface WeddingHubState {
  weddingProfile: WeddingProfile | null;
  guests: WeddingGuest[];
  tables: WeddingTable[];
  loadingProfile: boolean;
  loadingGuests: boolean;
  loadingTables: boolean;
  errorMessage: string | null;
}

export type WeddingHubAction =
  | { type: "SET_PROFILE"; payload: WeddingProfile }
  | { type: "SET_GUESTS"; payload: WeddingGuest[] }
  | { type: "ADD_GUEST"; payload: WeddingGuest }
  | { type: "UPDATE_GUEST"; payload: WeddingGuest }
  | { type: "REMOVE_GUEST"; payload: string }
  | { type: "SET_TABLES"; payload: WeddingTable[] }
  | { type: "ADD_TABLE"; payload: WeddingTable }
  | { type: "UPDATE_TABLE"; payload: WeddingTable }
  | { type: "REMOVE_TABLE"; payload: string }
  | { type: "SET_LOADING"; payload: Partial<Pick<WeddingHubState, "loadingProfile" | "loadingGuests" | "loadingTables">> }
  | { type: "SET_ERROR"; payload: string | null };
