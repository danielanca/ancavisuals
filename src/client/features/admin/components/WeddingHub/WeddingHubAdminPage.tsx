import React, { useReducer, useEffect, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../../auth/useAuth";
import type { WeddingProfile } from "../../../wedding-hub/types";
import Breadcrumb from "../Breadcrumb";
import { useWeddingHubAuth } from "../../../wedding-hub/context/WeddingHubAuthContext";

type CreateFormData = {
  brideFirstName: string;
  groomFirstName: string;
  weddingDate: string;
  city: string;
  coupleEmail: string;
  tempPassword: string;
};

type PageState = {
  weddings: WeddingProfile[];
  isLoading: boolean;
  loadError: string | null;
  showCreateForm: boolean;
  createForm: CreateFormData;
  isSaving: boolean;
  saveError: string | null;
  saveSuccess: boolean;
  deletingWeddingId: string | null;
  changingPasswordForId: string | null;
  newPassword: string;
  passwordSaving: boolean;
  passwordError: string | null;
  passwordSuccess: boolean;
  testEmailMode: boolean;
  testTransportAvailable: boolean;
  emailModeToggling: boolean;
};

type PageAction =
  | { type: "LOAD_SUCCESS"; weddings: WeddingProfile[] }
  | { type: "LOAD_ERROR"; message: string }
  | { type: "TOGGLE_CREATE_FORM" }
  | { type: "SET_FORM_FIELD"; field: keyof CreateFormData; value: string }
  | { type: "SET_SAVING"; value: boolean }
  | { type: "SAVE_ERROR"; message: string }
  | { type: "SAVE_SUCCESS"; wedding: WeddingProfile }
  | { type: "SET_DELETING"; weddingId: string | null }
  | { type: "DELETE_SUCCESS"; weddingId: string }
  | { type: "OPEN_PASSWORD_FORM"; weddingId: string }
  | { type: "CLOSE_PASSWORD_FORM" }
  | { type: "SET_NEW_PASSWORD"; value: string }
  | { type: "SET_PASSWORD_SAVING"; value: boolean }
  | { type: "PASSWORD_ERROR"; message: string }
  | { type: "PASSWORD_SUCCESS" }
  | { type: "SET_EMAIL_MODE"; testEmailMode: boolean; testTransportAvailable: boolean }
  | { type: "SET_EMAIL_MODE_TOGGLING"; value: boolean };

const emptyCreateForm: CreateFormData = {
  brideFirstName: "",
  groomFirstName: "",
  weddingDate: "",
  city: "",
  coupleEmail: "",
  tempPassword: "",
};

function pageReducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case "LOAD_SUCCESS":
      return { ...state, isLoading: false, weddings: action.weddings };
    case "LOAD_ERROR":
      return { ...state, isLoading: false, loadError: action.message };
    case "TOGGLE_CREATE_FORM":
      return { ...state, showCreateForm: !state.showCreateForm, saveError: null, saveSuccess: false, createForm: emptyCreateForm };
    case "SET_FORM_FIELD":
      return { ...state, createForm: { ...state.createForm, [action.field]: action.value } };
    case "SET_SAVING":
      return { ...state, isSaving: action.value };
    case "SAVE_ERROR":
      return { ...state, saveError: action.message, isSaving: false };
    case "SAVE_SUCCESS":
      return {
        ...state,
        isSaving: false,
        saveSuccess: true,
        saveError: null,
        showCreateForm: false,
        createForm: emptyCreateForm,
        weddings: [...state.weddings, action.wedding].sort(
          (firstWedding, secondWedding) =>
            new Date(firstWedding.weddingDate).getTime() - new Date(secondWedding.weddingDate).getTime(),
        ),
      };
    case "SET_DELETING":
      return { ...state, deletingWeddingId: action.weddingId };
    case "DELETE_SUCCESS":
      return {
        ...state,
        deletingWeddingId: null,
        weddings: state.weddings.filter((wedding) => wedding.id !== action.weddingId),
      };
    case "OPEN_PASSWORD_FORM":
      return { ...state, changingPasswordForId: action.weddingId, newPassword: "", passwordError: null, passwordSuccess: false };
    case "CLOSE_PASSWORD_FORM":
      return { ...state, changingPasswordForId: null, newPassword: "", passwordError: null, passwordSuccess: false };
    case "SET_NEW_PASSWORD":
      return { ...state, newPassword: action.value };
    case "SET_PASSWORD_SAVING":
      return { ...state, passwordSaving: action.value };
    case "PASSWORD_ERROR":
      return { ...state, passwordError: action.message, passwordSaving: false };
    case "PASSWORD_SUCCESS":
      return { ...state, passwordSuccess: true, passwordSaving: false, passwordError: null };
    case "SET_EMAIL_MODE":
      return { ...state, testEmailMode: action.testEmailMode, testTransportAvailable: action.testTransportAvailable, emailModeToggling: false };
    case "SET_EMAIL_MODE_TOGGLING":
      return { ...state, emailModeToggling: action.value };
    default:
      return state;
  }
}

function formatDate(dateString: string): string {
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

const WeddingHubAdminPage: React.FC = () => {
  const { auth } = useAuth();
  const { signInWithToken } = useWeddingHubAuth();
  const navigate = useNavigate();
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  const [pageState, dispatch] = useReducer(pageReducer, {
    weddings: [],
    isLoading: true,
    loadError: null,
    showCreateForm: false,
    createForm: emptyCreateForm,
    isSaving: false,
    saveError: null,
    saveSuccess: false,
    deletingWeddingId: null,
    changingPasswordForId: null,
    newPassword: "",
    passwordSaving: false,
    passwordError: null,
    passwordSuccess: false,
    testEmailMode: false,
    testTransportAvailable: false,
    emailModeToggling: false,
  });

  useEffect(() => {
    fetch("/api/wedding-hub/admin/email-mode", {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
      .then((response) => response.json())
      .then((data: { testEmailMode: boolean; testTransportAvailable: boolean }) =>
        dispatch({ type: "SET_EMAIL_MODE", testEmailMode: data.testEmailMode, testTransportAvailable: data.testTransportAvailable })
      )
      .catch(() => {});
  }, [auth.accessToken]);

  useEffect(() => {
    fetch("/api/wedding-hub/admin/weddings", {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
      .then((response) => {
        if (!response.ok) throw new Error("Nu s-au putut încărca nunțile.");
        return response.json();
      })
      .then((data) => dispatch({ type: "LOAD_SUCCESS", weddings: data.weddings }))
      .catch((error: Error) => dispatch({ type: "LOAD_ERROR", message: error.message }));
  }, [auth.accessToken]);

  const handleCreateWedding = async (event: React.FormEvent) => {
    event.preventDefault();
    dispatch({ type: "SET_SAVING", value: true });

    try {
      const response = await fetch("/api/wedding-hub/admin/weddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.accessToken}`,
        },
        body: JSON.stringify(pageState.createForm),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error ?? "Nu s-a putut crea nunta.");
      }

      const newWedding = await response.json();
      dispatch({ type: "SAVE_SUCCESS", wedding: newWedding });
    } catch (error: unknown) {
      dispatch({ type: "SAVE_ERROR", message: (error as Error).message });
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pageState.changingPasswordForId) return;
    dispatch({ type: "SET_PASSWORD_SAVING", value: true });
    try {
      const response = await fetch(`/api/wedding-hub/admin/weddings/${pageState.changingPasswordForId}/password`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.accessToken}`,
        },
        body: JSON.stringify({ newPassword: pageState.newPassword }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error ?? "Nu s-a putut schimba parola.");
      }
      dispatch({ type: "PASSWORD_SUCCESS" });
      setTimeout(() => dispatch({ type: "CLOSE_PASSWORD_FORM" }), 1500);
    } catch (error: unknown) {
      dispatch({ type: "PASSWORD_ERROR", message: (error as Error).message });
    }
  };

  const handleDeleteWedding = async (weddingId: string) => {
    if (!confirm("Ești sigur? Se vor șterge și toți invitații și mesele asociate.")) return;

    dispatch({ type: "SET_DELETING", weddingId });
    try {
      const response = await fetch(`/api/wedding-hub/admin/weddings/${weddingId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      if (!response.ok) throw new Error("Eroare la ștergere.");
      dispatch({ type: "DELETE_SUCCESS", weddingId });
    } catch {
      dispatch({ type: "SET_DELETING", weddingId: null });
    }
  };

  const handleImpersonate = useCallback(async (weddingId: string) => {
    setImpersonatingId(weddingId);
    try {
      const response = await fetch(`/api/wedding-hub/admin/weddings/${weddingId}/impersonate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      if (!response.ok) throw new Error("Eroare la generarea tokenului.");
      const { customToken } = await response.json() as { customToken: string };
      await signInWithToken(customToken);
      navigate("/wedding-hub/dashboard");
    } catch {
      alert("Nu s-a putut intra în contul cuplului.");
    } finally {
      setImpersonatingId(null);
    }
  }, [auth.accessToken, signInWithToken, navigate]);

  const handleToggleEmailMode = async () => {
    dispatch({ type: "SET_EMAIL_MODE_TOGGLING", value: true });
    try {
      const response = await fetch("/api/wedding-hub/admin/email-mode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.accessToken}`,
        },
        body: JSON.stringify({ enabled: !pageState.testEmailMode }),
      });
      const data = await response.json() as { testEmailMode?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Eroare.");
      dispatch({ type: "SET_EMAIL_MODE", testEmailMode: data.testEmailMode ?? false, testTransportAvailable: pageState.testTransportAvailable });
    } catch {
      dispatch({ type: "SET_EMAIL_MODE_TOGGLING", value: false });
    }
  };

  return (
    <div>
      <Breadcrumb />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-light text-white">Wedding Hub</h1>
            <p className="text-neutral-500 text-sm">{pageState.weddings.length} nunți înregistrate</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleEmailMode}
              disabled={pageState.emailModeToggling || !pageState.testTransportAvailable}
              title={!pageState.testTransportAvailable ? "SMTP_TEST_HOST nu e configurat în .env" : undefined}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                pageState.testEmailMode
                  ? "border-amber-500/60 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                  : "border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${pageState.testEmailMode ? "bg-amber-400" : "bg-neutral-600"}`} />
              {pageState.emailModeToggling
                ? "..."
                : pageState.testEmailMode
                  ? "Fake emails ON"
                  : "Fake emails OFF"}
            </button>
            <button
              onClick={() => dispatch({ type: "TOGGLE_CREATE_FORM" })}
              className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {pageState.showCreateForm ? "Anulează" : "+ Nuntă nouă"}
            </button>
          </div>
        </div>

        {pageState.showCreateForm && (
          <form
            onSubmit={handleCreateWedding}
            className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4"
          >
            <h2 className="text-white font-medium">Creare nuntă nouă</h2>

            {pageState.saveError && (
              <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3">
                {pageState.saveError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Prenume mireasă *"
                value={pageState.createForm.brideFirstName}
                onChange={(value) => dispatch({ type: "SET_FORM_FIELD", field: "brideFirstName", value })}
                placeholder="Ana"
                required
              />
              <Field
                label="Prenume mire *"
                value={pageState.createForm.groomFirstName}
                onChange={(value) => dispatch({ type: "SET_FORM_FIELD", field: "groomFirstName", value })}
                placeholder="Mihai"
                required
              />
              <Field
                label="Data nunții *"
                type="date"
                value={pageState.createForm.weddingDate}
                onChange={(value) => dispatch({ type: "SET_FORM_FIELD", field: "weddingDate", value })}
                required
              />
              <Field
                label="Oraș"
                value={pageState.createForm.city}
                onChange={(value) => dispatch({ type: "SET_FORM_FIELD", field: "city", value })}
                placeholder="Cluj-Napoca"
              />
              <Field
                label="Email cuplu *"
                type="email"
                value={pageState.createForm.coupleEmail}
                onChange={(value) => dispatch({ type: "SET_FORM_FIELD", field: "coupleEmail", value })}
                placeholder="ana.mihai@email.com"
                required
              />
              <Field
                label="Parolă temporară *"
                type="password"
                value={pageState.createForm.tempPassword}
                onChange={(value) => dispatch({ type: "SET_FORM_FIELD", field: "tempPassword", value })}
                placeholder="min. 6 caractere"
                required
              />
            </div>

            <p className="text-neutral-600 text-xs">
              Se va crea un cont Firebase Auth pentru cuplul menționat. Transmite emailul și parola cuplului.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => dispatch({ type: "TOGGLE_CREATE_FORM" })}
                className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 py-2.5 rounded-lg text-sm transition-colors"
              >
                Anulează
              </button>
              <button
                type="submit"
                disabled={pageState.isSaving}
                className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
              >
                {pageState.isSaving ? "Se creează..." : "Creează nunta"}
              </button>
            </div>
          </form>
        )}

        {pageState.saveSuccess && (
          <div className="bg-green-900/30 border border-green-800 text-green-300 text-sm rounded-lg px-4 py-3">
            Nunta a fost creată cu succes! Transmite credențialele cuplului.
          </div>
        )}

        {pageState.isLoading && (
          <div className="text-neutral-500 text-sm text-center py-8">Se încarcă...</div>
        )}

        {pageState.loadError && (
          <div className="text-red-400 text-sm text-center py-8">{pageState.loadError}</div>
        )}

        {!pageState.isLoading && pageState.weddings.length === 0 && (
          <div className="text-center py-16 text-neutral-500">
            Nu ai adăugat încă nicio nuntă.
          </div>
        )}

        {pageState.weddings.length > 0 && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="text-left px-4 py-3 text-neutral-500 text-xs font-medium uppercase tracking-wide">Cuplu</th>
                  <th className="text-left px-4 py-3 text-neutral-500 text-xs font-medium uppercase tracking-wide hidden sm:table-cell">Data</th>
                  <th className="text-left px-4 py-3 text-neutral-500 text-xs font-medium uppercase tracking-wide hidden md:table-cell">Email</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {pageState.weddings.map((wedding, index) => (
                  <tr
                    key={wedding.id}
                    className={`border-b border-neutral-800/50 hover:bg-neutral-800/20 transition-colors ${
                      index === pageState.weddings.length - 1 ? "border-b-0" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="text-white text-sm">
                        {wedding.brideFirstName} & {wedding.groomFirstName}
                      </p>
                      {wedding.city && (
                        <p className="text-neutral-500 text-xs">{wedding.city}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <p className="text-neutral-300 text-sm">{formatDate(wedding.weddingDate)}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-neutral-400 text-sm">{wedding.coupleEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => handleImpersonate(wedding.id)}
                          disabled={impersonatingId === wedding.id}
                          className="text-neutral-500 hover:text-rose-400 text-xs transition-colors disabled:opacity-50"
                        >
                          {impersonatingId === wedding.id ? "..." : "Intră ca"}
                        </button>
                        <button
                          onClick={() => dispatch({ type: "OPEN_PASSWORD_FORM", weddingId: wedding.id })}
                          className="text-neutral-500 hover:text-blue-400 text-xs transition-colors"
                        >
                          Parolă
                        </button>
                        <button
                          onClick={() => handleDeleteWedding(wedding.id)}
                          disabled={pageState.deletingWeddingId === wedding.id}
                          className="text-neutral-600 hover:text-red-400 text-xs transition-colors disabled:opacity-50"
                        >
                          {pageState.deletingWeddingId === wedding.id ? "..." : "Șterge"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pageState.changingPasswordForId && (() => {
        const targetWedding = pageState.weddings.find((wedding) => wedding.id === pageState.changingPasswordForId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-white font-medium text-sm">
                  Schimbă parola — {targetWedding?.brideFirstName} & {targetWedding?.groomFirstName}
                </h2>
                <button
                  onClick={() => dispatch({ type: "CLOSE_PASSWORD_FORM" })}
                  className="text-neutral-500 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>

              {pageState.passwordError && (
                <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3">
                  {pageState.passwordError}
                </div>
              )}

              {pageState.passwordSuccess ? (
                <div className="bg-green-900/30 border border-green-800 text-green-300 text-sm rounded-lg px-4 py-3">
                  Parola a fost schimbată cu succes.
                </div>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <Field
                    label="Parolă nouă *"
                    type="password"
                    value={pageState.newPassword}
                    onChange={(value) => dispatch({ type: "SET_NEW_PASSWORD", value })}
                    placeholder="min. 6 caractere"
                    required
                  />
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "CLOSE_PASSWORD_FORM" })}
                      className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 py-2.5 rounded-lg text-sm transition-colors"
                    >
                      Anulează
                    </button>
                    <button
                      type="submit"
                      disabled={pageState.passwordSaving}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
                    >
                      {pageState.passwordSaving ? "Se salvează..." : "Salvează"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-neutral-400 text-xs uppercase tracking-wide">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors"
      />
    </div>
  );
}

export default WeddingHubAdminPage;
