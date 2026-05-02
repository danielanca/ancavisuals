import React, { useReducer, useMemo } from "react";
import { useWeddingHub } from "../context/WeddingHubContext";
import { useWeddingHubAuth } from "../context/WeddingHubAuthContext";
import { useWeddingHubTheme } from "../context/WeddingHubThemeContext";
import AddGuestModal from "../components/AddGuestModal";
import EditGuestModal from "../components/EditGuestModal";
import type { WeddingGuest, RsvpStatus } from "../types";
import Loader from "../../../components/UI/Loader";

const RSVP_LABELS: Record<RsvpStatus, string> = {
  asteptare: "În așteptare",
  confirmat: "Confirmat",
  refuzat: "Refuzat",
};

const RSVP_COLORS: Record<RsvpStatus, string> = {
  asteptare: "bg-yellow-900/40 text-yellow-300 border border-yellow-800/40",
  confirmat: "bg-green-900/40 text-green-300 border border-green-800/40",
  refuzat: "bg-red-900/40 text-red-300 border border-red-800/40",
};

const RSVP_ACCENT_CLASSES: Record<RsvpStatus, string> = {
  asteptare: "ring-1 ring-inset ring-yellow-400/40",
  confirmat: "ring-1 ring-inset ring-green-400/40",
  refuzat: "ring-1 ring-inset ring-red-400/40",
};

const MENU_LABELS: Record<string, string> = {
  carne: "Carne",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  mixt: "Mixt",
};

const CARD_TONES = [
  "bg-[#151515] border-neutral-800",
  "bg-[#191919] border-neutral-800",
  "bg-[#1c1c1c] border-neutral-700/90",
  "bg-[#202020] border-neutral-700",
];

const LIGHT_CARD_TONES = [
  "bg-[#fffaf4] border-[#e4d6c7]",
  "bg-[#fcf6ef] border-[#e1d2c1]",
  "bg-[#f9f0e6] border-[#ddccb8]",
  "bg-[#fffdf9] border-[#e8dccc]",
];

function normalizeSearchValue(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinDistance(source: string, target: string): number {
  if (source === target) return 0;
  if (source.length === 0) return target.length;
  if (target.length === 0) return source.length;

  const previousRow = Array.from({ length: target.length + 1 }, (_, index) => index);

  for (let sourceIndex = 0; sourceIndex < source.length; sourceIndex += 1) {
    let previousDiagonal = previousRow[0];
    previousRow[0] = sourceIndex + 1;

    for (let targetIndex = 0; targetIndex < target.length; targetIndex += 1) {
      const temp = previousRow[targetIndex + 1];
      const cost = source[sourceIndex] === target[targetIndex] ? 0 : 1;

      previousRow[targetIndex + 1] = Math.min(
        previousRow[targetIndex + 1] + 1,
        previousRow[targetIndex] + 1,
        previousDiagonal + cost,
      );

      previousDiagonal = temp;
    }
  }

  return previousRow[target.length];
}

function similarityScore(source: string, target: string): number {
  if (!source || !target) return 0;
  const maxLength = Math.max(source.length, target.length);
  if (maxLength === 0) return 1;
  return 1 - (levenshteinDistance(source, target) / maxLength);
}

function getGuestSearchTerms(guest: WeddingGuest): string[] {
  return [
    `${guest.firstName} ${guest.lastName}`,
    guest.phone,
    guest.email,
    guest.notes,
    ...(guest.accompanyingAdultNames ?? []),
    ...(guest.childrenNames ?? []),
  ].filter((value): value is string => Boolean(value && value.trim()));
}

function getGuestFamilySummary(guest: WeddingGuest): string | null {
  const familyMembers = [
    ...(guest.accompanyingAdultNames ?? []).map((name) => name.trim()).filter(Boolean),
    ...(guest.childrenNames ?? []).map((name) => name.trim()).filter(Boolean),
  ];

  if (familyMembers.length === 0) return guest.sameTableWithFamily ? "Vrea să stea împreună cu familia" : null;

  const preview = familyMembers.slice(0, 3).join(", ");
  const suffix = familyMembers.length > 3 ? ` +${familyMembers.length - 3}` : "";
  return `${preview}${suffix}`;
}

type PageState = {
  showAddModal: boolean;
  editingGuest: WeddingGuest | null;
  filterStatus: RsvpStatus | "all";
  searchInput: string;
  deletingGuestId: string | null;
  copiedGuestId: string | null;
  expandedGuestIds: string[];
};

type PageAction =
  | { type: "OPEN_ADD_MODAL" }
  | { type: "CLOSE_ADD_MODAL" }
  | { type: "OPEN_EDIT_MODAL"; guest: WeddingGuest }
  | { type: "CLOSE_EDIT_MODAL" }
  | { type: "SET_FILTER"; status: RsvpStatus | "all" }
  | { type: "SET_SEARCH"; value: string }
  | { type: "SET_DELETING"; guestId: string | null }
  | { type: "SET_COPIED"; guestId: string | null }
  | { type: "TOGGLE_EXPANDED"; guestId: string };

function pageReducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case "OPEN_ADD_MODAL": return { ...state, showAddModal: true };
    case "CLOSE_ADD_MODAL": return { ...state, showAddModal: false };
    case "OPEN_EDIT_MODAL": return { ...state, editingGuest: action.guest };
    case "CLOSE_EDIT_MODAL": return { ...state, editingGuest: null };
    case "SET_FILTER": return { ...state, filterStatus: action.status };
    case "SET_SEARCH": return { ...state, searchInput: action.value };
    case "SET_DELETING": return { ...state, deletingGuestId: action.guestId };
    case "SET_COPIED": return { ...state, copiedGuestId: action.guestId };
    case "TOGGLE_EXPANDED":
      return state.expandedGuestIds.includes(action.guestId)
        ? { ...state, expandedGuestIds: state.expandedGuestIds.filter((guestId) => guestId !== action.guestId) }
        : { ...state, expandedGuestIds: [...state.expandedGuestIds, action.guestId] };
    default: return state;
  }
}

const GuestManagerPage: React.FC = () => {
  const { state, addGuest, updateGuest, removeGuest } = useWeddingHub();
  const { coupleAuth } = useWeddingHubAuth();
  const { theme } = useWeddingHubTheme();
  const { guests, loadingGuests } = state;

  const [pageState, dispatch] = useReducer(pageReducer, {
    showAddModal: false,
    editingGuest: null,
    filterStatus: "all",
    searchInput: "",
    deletingGuestId: null,
    copiedGuestId: null,
    expandedGuestIds: [],
  });

  const filteredGuests = useMemo(() => {
    let filtered = guests;
    if (pageState.filterStatus !== "all") {
      filtered = filtered.filter((g) => g.rsvpStatus === pageState.filterStatus);
    }
    const normalizedSearch = normalizeSearchValue(pageState.searchInput);
    if (normalizedSearch) {
      filtered = filtered.filter((g) =>
        getGuestSearchTerms(g).some((term) => {
          const normalizedTerm = normalizeSearchValue(term);
          return (
            normalizedTerm.includes(normalizedSearch) ||
            normalizedSearch.includes(normalizedTerm) ||
            similarityScore(normalizedSearch, normalizedTerm) >= 0.82
          );
        }),
      );
    }
    return filtered;
  }, [guests, pageState.filterStatus, pageState.searchInput]);

  const counts = useMemo(() => ({
    all: guests.length,
    asteptare: guests.filter((g) => g.rsvpStatus === "asteptare").length,
    confirmat: guests.filter((g) => g.rsvpStatus === "confirmat").length,
    refuzat: guests.filter((g) => g.rsvpStatus === "refuzat").length,
  }), [guests]);

  const handleCopyInviteLink = async (guest: WeddingGuest) => {
    const inviteLink = `${window.location.origin}/invite/${guest.inviteToken}`;
    try {
      await navigator.clipboard.writeText(inviteLink);
      dispatch({ type: "SET_COPIED", guestId: guest.id });
      setTimeout(() => dispatch({ type: "SET_COPIED", guestId: null }), 2000);
    } catch {
      dispatch({ type: "SET_COPIED", guestId: null });
    }
  };

  const handleDeleteGuest = async (guestId: string) => {
    dispatch({ type: "SET_DELETING", guestId });
    try {
      const response = await fetch(`/api/wedding-hub/guests/${guestId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${coupleAuth.coupleAccessToken}` },
      });
      if (!response.ok) throw new Error();
      removeGuest(guestId);
    } catch {
      // keep guest in list on failure
    } finally {
      dispatch({ type: "SET_DELETING", guestId: null });
    }
  };

  if (loadingGuests) return <Loader variant="fullscreen" />;

  return (
    <div className="space-y-4 pb-24 sm:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-light text-white">Invitați</h1>
          <p className="text-neutral-500 text-sm">{guests.length} total</p>
        </div>
        <button
          onClick={() => dispatch({ type: "OPEN_ADD_MODAL" })}
          className="hidden bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors sm:inline-flex sm:items-center sm:justify-center"
        >
          + Adaugă
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatPill label="Toți" value={counts.all} />
        <StatPill label="În așteptare" value={counts.asteptare} />
        <StatPill label="Confirmați" value={counts.confirmat} />
        <StatPill label="Refuzați" value={counts.refuzat} />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-[11px] text-neutral-500">
        <span className="text-neutral-400">Legendă RSVP:</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
          Confirmat
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
          În așteptare
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          Refuzat
        </span>
      </div>

      <input
        type="text"
        placeholder="Caută după nume, telefon sau email..."
        value={pageState.searchInput}
        onChange={(e) => dispatch({ type: "SET_SEARCH", value: e.target.value })}
        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors placeholder:text-neutral-500"
      />

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {(["all", "asteptare", "confirmat", "refuzat"] as const).map((status) => (
          <button
            key={status}
            onClick={() => dispatch({ type: "SET_FILTER", status })}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
              pageState.filterStatus === status
                ? "bg-rose-600 text-white"
                : "bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white"
            }`}
          >
            <span>{status === "all" ? "Toți" : RSVP_LABELS[status]}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              pageState.filterStatus === status ? "bg-rose-700 text-rose-200" : "bg-neutral-800 text-neutral-500"
            }`}>
              {counts[status]}
            </span>
          </button>
        ))}
      </div>

      {filteredGuests.length === 0 ? (
        <div className="text-center py-16 text-neutral-500 text-sm bg-neutral-900/40 border border-dashed border-neutral-800 rounded-xl">
          {guests.length === 0
            ? "Nu ai adăugat încă niciun invitat."
            : "Niciun invitat pentru filtrele selectate."}
        </div>
      ) : (
        <div className="max-h-[58vh] overflow-y-auto pr-1 space-y-2">
          {filteredGuests.map((guest, index) => {
            const isExpanded = pageState.expandedGuestIds.includes(guest.id);
            const toneClass = (theme === "light" ? LIGHT_CARD_TONES : CARD_TONES)[index % CARD_TONES.length];

            return (
              <div
                key={guest.id}
                className={`${toneClass} ${RSVP_ACCENT_CLASSES[guest.rsvpStatus]} rounded-xl`}
              >
                <button
                  type="button"
                  onClick={() => dispatch({ type: "TOGGLE_EXPANDED", guestId: guest.id })}
                  aria-expanded={isExpanded}
                  className="w-full flex items-center justify-between gap-3 p-4 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-white font-medium text-sm leading-snug">
                      {guest.firstName} {guest.lastName}
                    </p>
                    {getGuestFamilySummary(guest) && (
                      <p className="mt-1 text-[11px] text-rose-200/70">
                        {guest.sameTableWithFamily ? "Familie · " : ""}
                        {getGuestFamilySummary(guest)}
                      </p>
                    )}
                    {isExpanded ? (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                        {(guest.adultsCount > 1 || guest.childrenCount > 0) && (
                          <span className="text-neutral-500 text-xs">
                            {guest.adultsCount}A{guest.childrenCount > 0 ? ` · ${guest.childrenCount}C` : ""}
                          </span>
                        )}
                        {guest.sameTableWithFamily && (
                          <span className="text-rose-300 text-xs">
                            Împreună la masă
                          </span>
                        )}
                        {guest.menuPreference && (
                          <span className="text-neutral-600 text-xs">
                            {MENU_LABELS[guest.menuPreference]}
                          </span>
                        )}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap ${RSVP_COLORS[guest.rsvpStatus]}`}>
                      {RSVP_LABELS[guest.rsvpStatus]}
                    </span>
                    <span className="text-neutral-500 text-xs" aria-hidden="true">
                      {isExpanded ? "Ascunde" : "Detalii"}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4">
                    {(guest.phone || guest.email) && (
                      <div className="space-y-0.5 pb-3">
                        {guest.phone && (
                          <p className="text-neutral-500 text-xs">{guest.phone}</p>
                        )}
                        {guest.email && (
                          <p className="text-neutral-600 text-xs truncate">{guest.email}</p>
                        )}
                      </div>
                    )}
                    {guest.notes && (
                      <p className="pb-3 text-xs text-neutral-500 line-clamp-2">{guest.notes}</p>
                    )}

                    {getGuestFamilySummary(guest) && (
                      <p className="pb-3 text-xs text-neutral-400">
                        <span className="text-neutral-500">Familie:</span> {getGuestFamilySummary(guest)}
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-3 border-t border-neutral-800">
                      <button
                        onClick={() => handleCopyInviteLink(guest)}
                        className="flex-1 min-h-10 text-center text-xs text-neutral-400 hover:text-rose-400 active:text-rose-500 transition-colors px-2"
                      >
                        {pageState.copiedGuestId === guest.id ? "Copiat" : "Copiază link"}
                      </button>
                      <div className="w-px h-4 bg-neutral-700" />
                      <button
                        onClick={() => dispatch({ type: "OPEN_EDIT_MODAL", guest })}
                        className="flex-1 min-h-10 text-center text-xs text-neutral-400 hover:text-white active:text-neutral-200 transition-colors px-2"
                      >
                        Editează
                      </button>
                      <div className="w-px h-4 bg-neutral-700" />
                      <button
                        onClick={() => handleDeleteGuest(guest.id)}
                        disabled={pageState.deletingGuestId === guest.id}
                        className="flex-1 min-h-10 text-center text-xs text-neutral-600 hover:text-red-400 active:text-red-500 transition-colors px-2 disabled:opacity-40"
                      >
                        {pageState.deletingGuestId === guest.id ? "..." : "Șterge"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-4 z-30 px-4 sm:hidden">
        <button
          onClick={() => dispatch({ type: "OPEN_ADD_MODAL" })}
          className="mx-auto flex min-h-12 w-full max-w-sm items-center justify-center rounded-full bg-rose-600 px-5 py-3 text-sm font-medium text-white shadow-lg transition hover:bg-rose-500"
        >
          + Adaugă invitat
        </button>
      </div>

      {pageState.showAddModal && (
        <AddGuestModal
          onClose={() => dispatch({ type: "CLOSE_ADD_MODAL" })}
          onGuestAdded={(guest) => {
            addGuest(guest);
            dispatch({ type: "CLOSE_ADD_MODAL" });
          }}
        />
      )}

      {pageState.editingGuest && (
        <EditGuestModal
          guest={pageState.editingGuest}
          onClose={() => dispatch({ type: "CLOSE_EDIT_MODAL" })}
          onSaved={(updatedGuest) => {
            updateGuest(updatedGuest);
            dispatch({ type: "CLOSE_EDIT_MODAL" });
          }}
        />
      )}
    </div>
  );
};

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-3">
      <p className="text-lg font-light text-white">{value}</p>
      <p className="text-[11px] text-neutral-500 mt-0.5">{label}</p>
    </div>
  );
}

export default GuestManagerPage;
