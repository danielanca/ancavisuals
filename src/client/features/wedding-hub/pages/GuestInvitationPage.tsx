import React, { useReducer, useEffect } from "react";
import { useParams } from "react-router-dom";

type MenuPreferenceOption = "carne" | "vegetarian" | "vegan" | "mixt";
type DeclineReasonOption =
  | "nu-suntem-in-tara"
  | "suntem-plecati"
  | "avem-alt-eveniment"
  | "motive-personale"
  | "probleme-sanatate"
  | "nu-putem-confirma";

const MENU_LABELS: Record<MenuPreferenceOption, string> = {
  carne: "Carne",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  mixt: "Mixt",
};

const DECLINE_REASON_LABELS: Record<DeclineReasonOption, string> = {
  "nu-suntem-in-tara": "Nu suntem în țară",
  "suntem-plecati": "Suntem plecați în perioada aceea",
  "avem-alt-eveniment": "Avem deja un alt eveniment",
  "motive-personale": "Motive personale",
  "probleme-sanatate": "Probleme de sănătate",
  "nu-putem-confirma": "Nu putem confirma prezența",
};

const DECLINE_REASON_OPTIONS: DeclineReasonOption[] = [
  "nu-suntem-in-tara",
  "suntem-plecati",
  "avem-alt-eveniment",
  "motive-personale",
  "probleme-sanatate",
  "nu-putem-confirma",
];

interface InvitationData {
  guestId: string;
  guestFirstName: string;
  guestLastName: string;
  rsvpStatus: "asteptare" | "confirmat" | "refuzat";
  menuPreference: MenuPreferenceOption | null;
  childrenMenuPreference: MenuPreferenceOption | null;
  adultsCount: number;
  childrenCount: number;
  accompanyingAdultNames?: string[];
  childrenNames?: string[];
  sameTableWithFamily?: boolean;
  declineReasons?: DeclineReasonOption[];
  declineReasonDetails?: string;
  acceptanceMessage?: string;
  rsvpSubmittedAt: string | null;
  wedding: {
    brideFirstName: string;
    groomFirstName: string;
    weddingDate: string;
    city: string;
  };
}

type PageState = {
  invitationData: InvitationData | null;
  isLoading: boolean;
  loadError: string | null;
  selectedRsvp: "confirmat" | "refuzat" | null;
  selectedMenu: MenuPreferenceOption | null;
  selectedChildrenMenu: MenuPreferenceOption | null;
  adultsCount: number;
  childrenCount: number;
  accompanyingAdultNames: string[];
  childrenNames: string[];
  sameTableWithFamily: boolean;
  selectedDeclineReasons: DeclineReasonOption[];
  declineReasonDetails: string;
  acceptanceMessage: string;
  isSubmitting: boolean;
  submitError: string | null;
  hasSubmitted: boolean;
  finalStatus: "confirmat" | "refuzat" | null;
};

type PageAction =
  | { type: "LOAD_SUCCESS"; data: InvitationData }
  | { type: "LOAD_ERROR"; message: string }
  | { type: "SELECT_RSVP"; status: "confirmat" | "refuzat" }
  | { type: "SELECT_MENU"; preference: MenuPreferenceOption }
  | { type: "SELECT_CHILDREN_MENU"; preference: MenuPreferenceOption }
  | { type: "SET_ADULTS"; count: number }
  | { type: "SET_CHILDREN"; count: number }
  | { type: "SET_ADULT_NAME"; index: number; value: string }
  | { type: "SET_CHILD_NAME"; index: number; value: string }
  | { type: "SET_SAME_TABLE_WITH_FAMILY"; value: boolean }
  | { type: "TOGGLE_DECLINE_REASON"; reason: DeclineReasonOption }
  | { type: "SET_DECLINE_DETAILS"; value: string }
  | { type: "SET_ACCEPTANCE_MESSAGE"; value: string }
  | { type: "APPEND_ACCEPTANCE_EMOJI"; value: string }
  | { type: "SET_SUBMITTING"; value: boolean }
  | { type: "SUBMIT_ERROR"; message: string }
  | { type: "SUBMIT_SUCCESS"; status: "confirmat" | "refuzat" };

function pageReducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case "LOAD_SUCCESS":
      return {
        ...state,
        invitationData: action.data,
        isLoading: false,
        selectedRsvp: action.data.rsvpStatus !== "asteptare" ? action.data.rsvpStatus : null,
        selectedMenu: action.data.menuPreference,
        selectedChildrenMenu: action.data.childrenMenuPreference,
        adultsCount: action.data.adultsCount,
        childrenCount: action.data.childrenCount,
        accompanyingAdultNames: resizeNameArray(action.data.accompanyingAdultNames ?? [], Math.max(0, action.data.adultsCount - 1)),
        childrenNames: resizeNameArray(action.data.childrenNames ?? [], action.data.childrenCount),
        sameTableWithFamily: Boolean(action.data.sameTableWithFamily),
        selectedDeclineReasons: action.data.declineReasons ?? [],
        declineReasonDetails: action.data.declineReasonDetails ?? "",
        acceptanceMessage: action.data.acceptanceMessage ?? "",
        hasSubmitted: action.data.rsvpStatus !== "asteptare",
        finalStatus: action.data.rsvpStatus !== "asteptare" ? action.data.rsvpStatus : null,
      };
    case "LOAD_ERROR":
      return { ...state, isLoading: false, loadError: action.message };
    case "SELECT_RSVP":
      return { ...state, selectedRsvp: action.status };
    case "SELECT_MENU":
      return { ...state, selectedMenu: action.preference };
    case "SELECT_CHILDREN_MENU":
      return { ...state, selectedChildrenMenu: action.preference };
    case "SET_ADULTS":
      return {
        ...state,
        adultsCount: action.count,
        accompanyingAdultNames: resizeNameArray(state.accompanyingAdultNames, Math.max(0, action.count - 1)),
      };
    case "SET_CHILDREN":
      return {
        ...state,
        childrenCount: action.count,
        childrenNames: resizeNameArray(state.childrenNames, action.count),
      };
    case "SET_ADULT_NAME":
      return {
        ...state,
        accompanyingAdultNames: state.accompanyingAdultNames.map((name, index) => (index === action.index ? action.value : name)),
      };
    case "SET_CHILD_NAME":
      return {
        ...state,
        childrenNames: state.childrenNames.map((name, index) => (index === action.index ? action.value : name)),
      };
    case "SET_SAME_TABLE_WITH_FAMILY":
      return { ...state, sameTableWithFamily: action.value };
    case "TOGGLE_DECLINE_REASON":
      return state.selectedDeclineReasons.includes(action.reason)
        ? {
            ...state,
            selectedDeclineReasons: state.selectedDeclineReasons.filter((reason) => reason !== action.reason),
          }
        : {
            ...state,
            selectedDeclineReasons: [...state.selectedDeclineReasons, action.reason],
          };
    case "SET_DECLINE_DETAILS":
      return { ...state, declineReasonDetails: action.value };
    case "SET_ACCEPTANCE_MESSAGE":
      return { ...state, acceptanceMessage: action.value };
    case "APPEND_ACCEPTANCE_EMOJI":
      return {
        ...state,
        acceptanceMessage: `${state.acceptanceMessage}${state.acceptanceMessage.trim() ? " " : ""}${action.value}`,
      };
    case "SET_SUBMITTING":
      return { ...state, isSubmitting: action.value };
    case "SUBMIT_ERROR":
      return { ...state, submitError: action.message, isSubmitting: false };
    case "SUBMIT_SUCCESS":
      return { ...state, hasSubmitted: true, finalStatus: action.status, isSubmitting: false };
    default:
      return state;
  }
}

function formatWeddingDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString("ro-RO", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

function resizeNameArray(names: string[], size: number): string[] {
  if (size <= 0) return [];
  return Array.from({ length: size }, (_, index) => names[index] ?? "");
}

const GuestInvitationPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  const [pageState, dispatch] = useReducer(pageReducer, {
    invitationData: null,
    isLoading: true,
    loadError: null,
    selectedRsvp: null,
    selectedMenu: null,
    selectedChildrenMenu: null,
    adultsCount: 1,
    childrenCount: 0,
    accompanyingAdultNames: [],
    childrenNames: [],
    sameTableWithFamily: false,
    selectedDeclineReasons: [],
    declineReasonDetails: "",
    acceptanceMessage: "",
    isSubmitting: false,
    submitError: null,
    hasSubmitted: false,
    finalStatus: null,
  });

  useEffect(() => {
    if (!token) return;
    fetch(`/api/wedding-hub/invite/${token}`)
      .then((response) => {
        if (!response.ok) throw new Error("Invitația nu a fost găsită.");
        return response.json();
      })
      .then((data) => dispatch({ type: "LOAD_SUCCESS", data }))
      .catch((error: Error) => dispatch({ type: "LOAD_ERROR", message: error.message }));
  }, [token]);

  const handleSubmitRsvp = async () => {
    if (!pageState.selectedRsvp) return;

    if (pageState.selectedRsvp === "confirmat") {
      const missingAdultNames = pageState.adultsCount > 1
        ? pageState.accompanyingAdultNames.slice(0, pageState.adultsCount - 1).some((name) => !name.trim())
        : false;
      const missingChildNames = pageState.childrenCount > 0
        ? pageState.childrenNames.slice(0, pageState.childrenCount).some((name) => !name.trim())
        : false;
      if (missingAdultNames || missingChildNames) {
        dispatch({ type: "SUBMIT_ERROR", message: "Completează numele adulților și copiilor care vin cu tine." });
        return;
      }
    }

    dispatch({ type: "SET_SUBMITTING", value: true });

    try {
      const response = await fetch(`/api/wedding-hub/invite/${token}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rsvpStatus: pageState.selectedRsvp,
            menuPreference: pageState.selectedRsvp === "confirmat" ? pageState.selectedMenu : null,
            childrenMenuPreference: pageState.selectedRsvp === "confirmat" && pageState.childrenCount > 0 ? pageState.selectedChildrenMenu : null,
            adultsCount: pageState.adultsCount,
            childrenCount: pageState.childrenCount,
            accompanyingAdultNames: pageState.selectedRsvp === "confirmat" ? pageState.accompanyingAdultNames.slice(0, Math.max(0, pageState.adultsCount - 1)) : [],
            childrenNames: pageState.selectedRsvp === "confirmat" ? pageState.childrenNames.slice(0, pageState.childrenCount) : [],
            sameTableWithFamily: pageState.selectedRsvp === "confirmat" ? pageState.sameTableWithFamily : false,
            declineReasons: pageState.selectedRsvp === "refuzat" ? pageState.selectedDeclineReasons : [],
            declineReasonDetails: pageState.selectedRsvp === "refuzat" ? pageState.declineReasonDetails.trim() : "",
            acceptanceMessage: pageState.selectedRsvp === "confirmat" ? pageState.acceptanceMessage.trim() : "",
          }),
        });

      if (!response.ok) throw new Error("Eroare la salvarea răspunsului.");
      dispatch({ type: "SUBMIT_SUCCESS", status: pageState.selectedRsvp });
    } catch (error: unknown) {
      dispatch({ type: "SUBMIT_ERROR", message: (error as Error).message });
    }
  };

  if (pageState.isLoading) {
    return (
      <div className="min-h-screen bg-rose-950/20 flex items-center justify-center">
        <div className="text-rose-300 text-sm animate-pulse">Se încarcă invitația...</div>
      </div>
    );
  }

  if (pageState.loadError || !pageState.invitationData) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-neutral-400 text-lg mb-2">Invitație negăsită</p>
          <p className="text-neutral-600 text-sm">{pageState.loadError ?? "Link-ul este invalid sau a expirat."}</p>
        </div>
      </div>
    );
  }

  const { invitationData } = pageState;
  const { wedding } = invitationData;

  if (pageState.hasSubmitted && pageState.finalStatus) {
    const isConfirmed = pageState.finalStatus === "confirmat";

    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "linear-gradient(135deg, #1a0a0a 0%, #2d0f0f 50%, #1a0a0a 100%)" }}>
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: isConfirmed ? "rgba(220,38,38,0.2)" : "rgba(100,100,100,0.2)", border: `1px solid ${isConfirmed ? "rgba(220,38,38,0.4)" : "rgba(100,100,100,0.3)"}` }}>
            <span className="text-2xl">{isConfirmed ? "♥" : "✕"}</span>
          </div>
          <h2 className="text-2xl font-light text-white mb-3">
            {isConfirmed ? "Ne bucurăm că vii!" : "Îți mulțumim pentru răspuns"}
          </h2>
          <p className="text-rose-200/60 text-sm leading-relaxed">
            {isConfirmed
              ? `Te așteptăm cu drag la nunta lui ${wedding.brideFirstName} & ${wedding.groomFirstName} pe ${formatWeddingDate(wedding.weddingDate)}.`
              : `Răspunsul tău a fost înregistrat. Îți mulțumim că ai anunțat.`}
          </p>
          {isConfirmed && wedding.city && (
            <p className="text-rose-300/50 text-xs mt-3">{wedding.city}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ background: "linear-gradient(135deg, #1a0a0a 0%, #2d0f0f 50%, #1a0a0a 100%)" }}>
      <div className="w-full max-w-md">
        {/* Invitation card */}
        <div className="relative rounded-2xl overflow-hidden mb-8" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(220,38,38,0.2)", boxShadow: "0 25px 60px rgba(0,0,0,0.5)" }}>
          {/* Decorative top border */}
          <div className="h-1" style={{ background: "linear-gradient(90deg, transparent, rgba(220,38,38,0.6), transparent)" }} />

          <div className="px-8 py-10 text-center">
            <p className="text-rose-400/70 text-xs tracking-[0.3em] uppercase mb-6">Invitație de nuntă</p>

            <div className="mb-6">
              <p className="text-rose-200/50 text-sm tracking-wide mb-1">Dragă</p>
              <p className="text-white text-2xl font-light tracking-wide">
                {invitationData.guestFirstName} {invitationData.guestLastName}
              </p>
            </div>

            <div className="w-8 h-px mx-auto mb-6" style={{ background: "rgba(220,38,38,0.4)" }} />

            <p className="text-rose-100/50 text-sm leading-relaxed mb-6">
              Avem bucuria de a vă invita să fiți alături de noi în ziua în care vom deveni familie
            </p>

            <div className="mb-8">
              <h1 className="text-3xl font-light text-white tracking-widest">
                {wedding.brideFirstName}
                <span className="text-rose-400 mx-3 font-thin">&</span>
                {wedding.groomFirstName}
              </h1>
            </div>

            <div className="bg-rose-950/30 rounded-xl px-6 py-4 border border-rose-900/20">
              <p className="text-rose-200 text-sm font-medium">{formatWeddingDate(wedding.weddingDate)}</p>
              {wedding.city && (
                <p className="text-rose-300/50 text-xs mt-1 tracking-wide">{wedding.city}</p>
              )}
            </div>
          </div>

          <div className="h-px mx-8" style={{ background: "rgba(220,38,38,0.1)" }} />

          {/* RSVP section */}
          <div className="px-8 py-8">
            <p className="text-center text-rose-200/60 text-sm mb-5 tracking-wide">
              Vă rugăm să confirmați participarea
            </p>

            <div className="flex gap-3 mb-5">
              <button
                onClick={() => dispatch({ type: "SELECT_RSVP", status: "confirmat" })}
                className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                  pageState.selectedRsvp === "confirmat"
                    ? "bg-rose-600 text-white shadow-lg shadow-rose-900/40"
                    : "border border-rose-900/40 text-rose-300/60 hover:border-rose-600/60 hover:text-rose-200"
                }`}
              >
                ♥ Particip cu drag
              </button>
              <button
                onClick={() => dispatch({ type: "SELECT_RSVP", status: "refuzat" })}
                className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                  pageState.selectedRsvp === "refuzat"
                    ? "bg-neutral-700 text-white"
                    : "border border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-400"
                }`}
              >
                Nu pot participa
              </button>
            </div>

            {pageState.selectedRsvp === "confirmat" && (
              <div className="space-y-4 mb-5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-rose-200/40 text-xs uppercase tracking-wide mb-1 block text-center">Adulți</label>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => dispatch({ type: "SET_ADULTS", count: Math.max(1, pageState.adultsCount - 1) })}
                        className="w-7 h-7 rounded-full border border-neutral-700 text-neutral-400 hover:border-rose-600 hover:text-rose-400 transition-colors text-sm"
                      >
                        −
                      </button>
                      <span className="text-white text-lg w-6 text-center">{pageState.adultsCount}</span>
                      <button
                        onClick={() => dispatch({ type: "SET_ADULTS", count: Math.min(20, pageState.adultsCount + 1) })}
                        className="w-7 h-7 rounded-full border border-neutral-700 text-neutral-400 hover:border-rose-600 hover:text-rose-400 transition-colors text-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-rose-200/40 text-xs uppercase tracking-wide mb-1 block text-center">Copii</label>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => dispatch({ type: "SET_CHILDREN", count: Math.max(0, pageState.childrenCount - 1) })}
                        className="w-7 h-7 rounded-full border border-neutral-700 text-neutral-400 hover:border-rose-600 hover:text-rose-400 transition-colors text-sm"
                      >
                        −
                      </button>
                      <span className="text-white text-lg w-6 text-center">{pageState.childrenCount}</span>
                      <button
                        onClick={() => dispatch({ type: "SET_CHILDREN", count: Math.min(20, pageState.childrenCount + 1) })}
                        className="w-7 h-7 rounded-full border border-neutral-700 text-neutral-400 hover:border-rose-600 hover:text-rose-400 transition-colors text-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {(pageState.adultsCount > 1 || pageState.childrenCount > 0) && (
                  <label className="flex items-start gap-3 rounded-xl border border-rose-900/30 bg-rose-950/20 px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={pageState.sameTableWithFamily}
                      onChange={(event) => dispatch({ type: "SET_SAME_TABLE_WITH_FAMILY", value: event.target.checked })}
                      className="mt-1 h-4 w-4 rounded border-rose-700/60 bg-transparent text-rose-500 focus:ring-rose-500"
                    />
                    <span>
                      <span className="block text-sm text-rose-100">
                        Vrem să fim toți împreună la aceeași masă
                      </span>
                      <span className="block text-xs text-rose-200/50 mt-1 leading-relaxed">
                        Este doar o preferință. Nu îi așezăm automat împreună, dar ne ajută la organizarea meselor.
                      </span>
                    </span>
                  </label>
                )}

                {pageState.adultsCount > 1 && (
                  <div>
                    <p className="text-rose-200/50 text-xs uppercase tracking-wide mb-2 text-center">
                      Numele adulților care vin cu voi
                    </p>
                    <div className="space-y-2">
                      {pageState.accompanyingAdultNames.slice(0, Math.max(0, pageState.adultsCount - 1)).map((name, index) => (
                        <input
                          key={`adult-${index}`}
                          type="text"
                          value={name}
                          onChange={(event) => dispatch({ type: "SET_ADULT_NAME", index, value: event.target.value })}
                          placeholder={`Adult ${index + 2}`}
                          className="w-full rounded-lg border border-neutral-800 bg-black/10 px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:border-rose-600 focus:outline-none"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {pageState.childrenCount > 0 && (
                  <div>
                    <p className="text-rose-200/50 text-xs uppercase tracking-wide mb-2 text-center">
                      Numele copiilor care vin cu voi
                    </p>
                    <div className="space-y-2">
                      {pageState.childrenNames.slice(0, pageState.childrenCount).map((name, index) => (
                        <input
                          key={`child-${index}`}
                          type="text"
                          value={name}
                          onChange={(event) => dispatch({ type: "SET_CHILD_NAME", index, value: event.target.value })}
                          placeholder={`Copil ${index + 1}`}
                          className="w-full rounded-lg border border-neutral-800 bg-black/10 px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:border-rose-600 focus:outline-none"
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-rose-200/50 text-xs uppercase tracking-wide mb-2 text-center">
                    Preferință meniu {pageState.childrenCount > 0 ? "adulți" : ""}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.entries(MENU_LABELS) as [MenuPreferenceOption, string][]).map(([value, label]) => (
                      <button
                        key={value}
                        onClick={() => dispatch({ type: "SELECT_MENU", preference: value })}
                        className={`py-2 rounded-lg text-sm transition-all ${
                          pageState.selectedMenu === value
                            ? "bg-rose-900/60 border border-rose-700/60 text-rose-200"
                            : "border border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-neutral-400"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {pageState.childrenCount > 0 && (
                  <div>
                    <p className="text-rose-200/50 text-xs uppercase tracking-wide mb-2 text-center">
                      Preferință meniu copii ({pageState.childrenCount} {pageState.childrenCount === 1 ? "copil" : "copii"})
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.entries(MENU_LABELS) as [MenuPreferenceOption, string][]).map(([value, label]) => (
                        <button
                          key={value}
                          onClick={() => dispatch({ type: "SELECT_CHILDREN_MENU", preference: value })}
                          className={`py-2 rounded-lg text-sm transition-all ${
                            pageState.selectedChildrenMenu === value
                              ? "bg-rose-900/60 border border-rose-700/60 text-rose-200"
                              : "border border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-neutral-400"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-rose-200/60 text-xs uppercase tracking-wide mb-2 block">
                    Mesaj pentru miri
                  </label>
                  <textarea
                    value={pageState.acceptanceMessage}
                    onChange={(event) => dispatch({ type: "SET_ACCEPTANCE_MESSAGE", value: event.target.value })}
                    rows={3}
                    placeholder="Abia aștept să vin la nuntă!"
                    className="w-full rounded-xl border border-neutral-800 bg-black/10 px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-rose-600 resize-none"
                  />
                  <p className="mt-2 text-[11px] text-rose-200/45">
                    Opțional. Poți scrie liber, iar dacă vrei poți insera și un emoji.
                  </p>

                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-rose-200/45 mb-2">
                        Sugestii de text
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          "Abia aștept să vin la nuntă!",
                          "Ne vedem cu drag! 🤍",
                          "Suntem încântați să fim alături de voi 🥂",
                          "Vă îmbrățișăm cu drag ✨",
                        ].map((text) => (
                          <button
                            key={text}
                            type="button"
                            onClick={() => dispatch({ type: "SET_ACCEPTANCE_MESSAGE", value: text })}
                            className="rounded-full border border-neutral-800 bg-neutral-950/40 px-3 py-1.5 text-[11px] text-rose-100/80 transition-colors hover:border-rose-600 hover:text-white"
                          >
                            {text}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-rose-200/45 mb-2">
                        Emoji rapide
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {["🤍", "🥂", "✨", "🎉", "💃", "🕺", "🙏", "❤️"].map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => dispatch({ type: "APPEND_ACCEPTANCE_EMOJI", value: emoji })}
                            className="h-9 min-w-9 rounded-full border border-neutral-800 bg-neutral-950/40 px-3 text-sm transition-colors hover:border-rose-600 hover:text-white"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {pageState.selectedRsvp === "refuzat" && (
              <div className="space-y-4 mb-5">
                <div>
                  <p className="text-rose-200/60 text-xs uppercase tracking-wide mb-3">
                    Dacă doriți, ne puteți spune motivul
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {DECLINE_REASON_OPTIONS.map((reason) => {
                      const isSelected = pageState.selectedDeclineReasons.includes(reason);
                      return (
                        <button
                          key={reason}
                          type="button"
                          onClick={() => dispatch({ type: "TOGGLE_DECLINE_REASON", reason })}
                          className={`rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                            isSelected
                              ? "border-rose-500 bg-rose-900/30 text-rose-100"
                              : "border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200"
                          }`}
                        >
                          {DECLINE_REASON_LABELS[reason]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-rose-200/60 text-xs uppercase tracking-wide mb-2 block">
                    Alte detalii
                  </label>
                  <textarea
                    value={pageState.declineReasonDetails}
                    onChange={(event) => dispatch({ type: "SET_DECLINE_DETAILS", value: event.target.value })}
                    rows={3}
                    placeholder="Dacă doriți, puteți lăsa un mesaj scurt pentru miri"
                    className="w-full rounded-xl border border-neutral-800 bg-black/10 px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-rose-600 resize-none"
                  />
                </div>
              </div>
            )}

            {pageState.submitError && (
              <div className="bg-red-900/30 border border-red-800 text-red-300 text-xs rounded-lg px-3 py-2 mb-4 text-center">
                {pageState.submitError}
              </div>
            )}

            <button
              onClick={handleSubmitRsvp}
              disabled={!pageState.selectedRsvp || pageState.isSubmitting}
              className="w-full py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: pageState.selectedRsvp ? "linear-gradient(135deg, #9f1239, #be123c)" : "rgba(100,100,100,0.2)",
                color: pageState.selectedRsvp ? "white" : "rgba(200,200,200,0.4)",
              }}
            >
              {pageState.isSubmitting
                ? "Se trimite..."
                : pageState.selectedRsvp
                  ? "Trimite răspunsul"
                  : "Selectează răspunsul mai sus"}
            </button>
          </div>

          <div className="h-1" style={{ background: "linear-gradient(90deg, transparent, rgba(220,38,38,0.3), transparent)" }} />
        </div>

        <p className="text-center text-rose-900/50 text-xs">
          Cu drag,{" "}
          <span className="text-rose-700/70">{wedding.brideFirstName} & {wedding.groomFirstName}</span>
        </p>
      </div>
    </div>
  );
};

export default GuestInvitationPage;
