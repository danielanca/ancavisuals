import React, { useEffect, useReducer } from "react";
import { useWeddingHub } from "../context/WeddingHubContext";
import { useWeddingHubAuth } from "../context/WeddingHubAuthContext";
import { useWeddingHubTheme } from "../context/WeddingHubThemeContext";
import Loader from "../../../components/UI/Loader";

type PageState = {
  emailNotificationsEnabled: boolean;
  notifyOnAccept: boolean;
  notifyOnDecline: boolean;
  venueName: string;
  venueAddress: string;
  isSaving: boolean;
  savedMessage: string | null;
  errorMessage: string | null;
};

type PageAction =
  | { type: "SET_MASTER_TOGGLE"; value: boolean }
  | { type: "SET_ACCEPT_TOGGLE"; value: boolean }
  | { type: "SET_DECLINE_TOGGLE"; value: boolean }
  | { type: "SET_VENUE_NAME"; value: string }
  | { type: "SET_VENUE_ADDRESS"; value: string }
  | { type: "SET_SAVING"; value: boolean }
  | { type: "SET_ERROR"; value: string | null }
  | { type: "SET_SAVED"; value: string | null }
  | { type: "SYNC_FROM_PROFILE"; value: { emailNotificationsEnabled: boolean; notifyOnAccept: boolean; notifyOnDecline: boolean; venueName: string; venueAddress: string } };

function pageReducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case "SET_MASTER_TOGGLE":
      return { ...state, emailNotificationsEnabled: action.value, savedMessage: null, errorMessage: null };
    case "SET_ACCEPT_TOGGLE":
      return { ...state, notifyOnAccept: action.value, savedMessage: null, errorMessage: null };
    case "SET_DECLINE_TOGGLE":
      return { ...state, notifyOnDecline: action.value, savedMessage: null, errorMessage: null };
    case "SET_VENUE_NAME":
      return { ...state, venueName: action.value, savedMessage: null, errorMessage: null };
    case "SET_VENUE_ADDRESS":
      return { ...state, venueAddress: action.value, savedMessage: null, errorMessage: null };
    case "SET_SAVING":
      return { ...state, isSaving: action.value };
    case "SET_ERROR":
      return { ...state, errorMessage: action.value, isSaving: false, savedMessage: null };
    case "SET_SAVED":
      return { ...state, savedMessage: action.value, isSaving: false, errorMessage: null };
    case "SYNC_FROM_PROFILE":
      return {
        ...state,
        emailNotificationsEnabled: action.value.emailNotificationsEnabled,
        notifyOnAccept: action.value.notifyOnAccept,
        notifyOnDecline: action.value.notifyOnDecline,
        venueName: action.value.venueName,
        venueAddress: action.value.venueAddress,
      };
    default:
      return state;
  }
}

const WeddingSettingsPage: React.FC = () => {
  const { state, setProfile } = useWeddingHub();
  const { coupleAuth } = useWeddingHubAuth();
  const { theme, themePreference, setThemePreference } = useWeddingHubTheme();
  const { weddingProfile, loadingProfile } = state;

  const [pageState, dispatch] = useReducer(pageReducer, {
    emailNotificationsEnabled: false,
    notifyOnAccept: true,
    notifyOnDecline: true,
    venueName: "",
    venueAddress: "",
    isSaving: false,
    savedMessage: null,
    errorMessage: null,
  });

  useEffect(() => {
    if (weddingProfile) {
      dispatch({
        type: "SYNC_FROM_PROFILE",
        value: {
          emailNotificationsEnabled: weddingProfile.emailSettings.emailNotificationsEnabled,
          notifyOnAccept: weddingProfile.emailSettings.notifyOnAccept,
          notifyOnDecline: weddingProfile.emailSettings.notifyOnDecline,
          venueName: weddingProfile.venueName,
          venueAddress: weddingProfile.venueAddress,
        },
      });
    }
  }, [weddingProfile]);

  const handleSave = async () => {
    if (!weddingProfile) return;

    dispatch({ type: "SET_SAVING", value: true });
    dispatch({ type: "SET_ERROR", value: null });

    try {
      const response = await fetch("/api/wedding-hub/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${coupleAuth.coupleAccessToken}`,
        },
        body: JSON.stringify({
          emailNotificationsEnabled: pageState.emailNotificationsEnabled,
          notifyOnAccept: pageState.notifyOnAccept,
          notifyOnDecline: pageState.notifyOnDecline,
          venueName: pageState.venueName,
          venueAddress: pageState.venueAddress,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error ?? "Nu s-au putut salva setările.");
      }

      const data = await response.json() as { weddingProfile: typeof weddingProfile };
      setProfile(data.weddingProfile);
      dispatch({ type: "SET_SAVED", value: "Setările au fost salvate." });
    } catch (error: unknown) {
      dispatch({ type: "SET_ERROR", value: (error as Error).message });
    }
  };

  if (loadingProfile) return <Loader variant="fullscreen" />;

  if (!weddingProfile) {
    return <div className="py-16 text-center text-neutral-500">Nu s-au putut încărca setările.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-light text-white">Setări</h1>
        <p className="mt-1 text-sm text-neutral-500">Controlezi dacă primești email când invitații răspund la RSVP.</p>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-800 pb-5">
          <div className="space-y-1">
            <h2 className="text-sm font-medium text-white">Tema interfeței</h2>
            <p className="text-sm text-neutral-400">
              Implicit urmează preferința browserului, dar o poți suprascrie manual oricând.
            </p>
          </div>

          <div className="flex rounded-xl border border-neutral-800 bg-neutral-950/70 p-1">
            <button
              type="button"
              onClick={() => setThemePreference("system")}
              className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                themePreference === "system"
                  ? "bg-rose-600 text-white"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              System
            </button>
            <button
              type="button"
              onClick={() => setThemePreference("light")}
              className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                themePreference === "light"
                  ? "bg-rose-600 text-white"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Light
            </button>
            <button
              type="button"
              onClick={() => setThemePreference("dark")}
              className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                themePreference === "dark"
                  ? "bg-rose-600 text-white"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Dark
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          Tema activă acum: <span className="text-neutral-300">{theme === "dark" ? "Dark" : "Light"}</span>
        </p>

        <div className="pt-5 border-t border-neutral-800">
          <h2 className="text-sm font-medium text-white mb-1">Locație eveniment</h2>
          <p className="text-sm text-neutral-400 mb-3">
            Invitații confirmați vor vedea aceste detalii pe pagina de invitație, împreună cu o hartă Google Maps.
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-xs uppercase tracking-wide text-neutral-500 mb-1 block">Numele locației</label>
              <input
                type="text"
                value={pageState.venueName}
                onChange={(e) => dispatch({ type: "SET_VENUE_NAME", value: e.target.value })}
                placeholder="ex: Palazzo Brancoveanu"
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-rose-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-neutral-500 mb-1 block">Adresa completă (pentru Google Maps)</label>
              <input
                type="text"
                value={pageState.venueAddress}
                onChange={(e) => dispatch({ type: "SET_VENUE_ADDRESS", value: e.target.value })}
                placeholder="ex: Calea Floreasca 167, București"
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-rose-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-medium text-white">Setări Email</h2>
            <p className="text-sm text-neutral-400">
              Primește email pe <span className="text-neutral-200">{weddingProfile.coupleEmail}</span> când un invitat acceptă sau refuză invitația.
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={pageState.emailNotificationsEnabled}
            onClick={() => dispatch({ type: "SET_MASTER_TOGGLE", value: !pageState.emailNotificationsEnabled })}
            className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full border transition-colors ${
              pageState.emailNotificationsEnabled
                ? "border-green-500 bg-green-600"
                : "border-red-500 bg-red-600/25"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                pageState.emailNotificationsEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-950/70 px-4 py-3 text-sm text-neutral-400">
          {pageState.emailNotificationsEnabled
            ? "Notificările pe email sunt active. Poți alege separat dacă vrei email pentru acceptări și pentru refuzuri."
            : "Notificările pe email sunt oprite. RSVP-urile se salvează în Wedding Hub, dar nu se trimite niciun email."}
        </div>

        <div className="mt-4 space-y-3">
          <NotificationRow
            title="Email la accept"
            description="Primești email când un invitat confirmă participarea."
            checked={pageState.notifyOnAccept}
            disabled={!pageState.emailNotificationsEnabled}
            onToggle={() => dispatch({ type: "SET_ACCEPT_TOGGLE", value: !pageState.notifyOnAccept })}
          />
          <NotificationRow
            title="Email la refuz"
            description="Primești email când un invitat refuză invitația."
            checked={pageState.notifyOnDecline}
            disabled={!pageState.emailNotificationsEnabled}
            onToggle={() => dispatch({ type: "SET_DECLINE_TOGGLE", value: !pageState.notifyOnDecline })}
          />
        </div>

        {pageState.errorMessage && (
          <div className="mt-4 rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-300">
            {pageState.errorMessage}
          </div>
        )}

        {pageState.savedMessage && (
          <div className="mt-4 rounded-lg border border-green-800 bg-green-900/20 px-4 py-3 text-sm text-green-300">
            {pageState.savedMessage}
          </div>
        )}

        <div className="mt-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={pageState.isSaving}
            className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:bg-neutral-700 disabled:text-neutral-500"
          >
            {pageState.isSaving ? "Se salvează..." : "Salvează setările"}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
};

function NotificationRow({
  title,
  description,
  checked,
  disabled,
  onToggle,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`flex items-start justify-between gap-4 rounded-lg border px-4 py-3 ${
      disabled
        ? "border-neutral-800 bg-neutral-950/40 opacity-60"
        : checked
          ? "border-green-600/70 bg-green-950/10"
          : "border-red-600/70 bg-red-950/10"
    }`}>
      <div className="space-y-1">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-sm text-neutral-400">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        disabled={disabled}
        className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full border transition-colors ${
          checked
            ? "border-green-500 bg-green-600"
            : "border-red-500 bg-red-600/25"
        } disabled:cursor-not-allowed`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

export default WeddingSettingsPage;
