import React, { useEffect, useReducer } from "react";
import useAuth from "../auth/useAuth";
import Breadcrumb from "./Breadcrumb";

type Offer = {
  id: string;
  slug: string;
  clientName: string;
  title: string;
  description: string;
  pdfUrl: string;
  price: string;
  packageName: string;
  validUntil: string;
  active: boolean;
  viewCount: number;
  downloadCount: number;
  createdAt: string;
};

type FormData = {
  slug: string;
  clientName: string;
  title: string;
  description: string;
  pdfUrl: string;
  price: string;
  packageName: string;
  validUntil: string;
};

const emptyForm: FormData = {
  slug: "",
  clientName: "",
  title: "",
  description: "",
  pdfUrl: "",
  price: "",
  packageName: "",
  validUntil: "",
};

type State = {
  offers: Offer[];
  loading: boolean;
  loadError: string | null;
  showForm: boolean;
  form: FormData;
  saving: boolean;
  saveError: string | null;
  deletingId: string | null;
  copied: string | null;
};

type Action =
  | { type: "LOAD_OK"; offers: Offer[] }
  | { type: "LOAD_ERR"; error: string }
  | { type: "OPEN_FORM" }
  | { type: "CLOSE_FORM" }
  | { type: "SET_FIELD"; field: keyof FormData; value: string }
  | { type: "SAVING" }
  | { type: "SAVE_OK"; offer: Offer }
  | { type: "SAVE_ERR"; error: string }
  | { type: "SET_DELETING"; id: string | null }
  | { type: "DELETE_OK"; id: string }
  | { type: "SET_COPIED"; id: string | null }
  | { type: "TOGGLE_ACTIVE"; id: string; active: boolean };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOAD_OK": return { ...state, loading: false, offers: action.offers };
    case "LOAD_ERR": return { ...state, loading: false, loadError: action.error };
    case "OPEN_FORM": return { ...state, showForm: true, form: emptyForm, saveError: null };
    case "CLOSE_FORM": return { ...state, showForm: false, form: emptyForm, saveError: null };
    case "SET_FIELD": return { ...state, form: { ...state.form, [action.field]: action.value } };
    case "SAVING": return { ...state, saving: true, saveError: null };
    case "SAVE_OK": return { ...state, saving: false, showForm: false, form: emptyForm, offers: [action.offer, ...state.offers] };
    case "SAVE_ERR": return { ...state, saving: false, saveError: action.error };
    case "SET_DELETING": return { ...state, deletingId: action.id };
    case "DELETE_OK": return { ...state, deletingId: null, offers: state.offers.filter((o) => o.id !== action.id) };
    case "SET_COPIED": return { ...state, copied: action.id };
    case "TOGGLE_ACTIVE":
      return { ...state, offers: state.offers.map((o) => o.id === action.id ? { ...o, active: action.active } : o) };
    default: return state;
  }
}

const BASE_URL = typeof window !== "undefined" ? window.location.origin : "https://ancavisuals.ro";

export default function OferteAdminPage() {
  const { auth } = useAuth();
  const [state, dispatch] = useReducer(reducer, {
    offers: [],
    loading: true,
    loadError: null,
    showForm: false,
    form: emptyForm,
    saving: false,
    saveError: null,
    deletingId: null,
    copied: null,
  });

  useEffect(() => {
    if (!auth.accessToken) return;
    fetch("/api/oferte/admin/list", {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
      .then((r) => r.json())
      .then((data: { offers?: Offer[]; error?: string }) => {
        if (data.offers) dispatch({ type: "LOAD_OK", offers: data.offers });
        else dispatch({ type: "LOAD_ERR", error: data.error ?? "Eroare." });
      })
      .catch((error: unknown) => dispatch({ type: "LOAD_ERR", error: String(error) }));
  }, [auth.accessToken]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    dispatch({ type: "SAVING" });
    try {
      const response = await fetch("/api/oferte/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify(state.form),
      });
      const data = await response.json() as Offer & { error?: string };
      if (!response.ok) { dispatch({ type: "SAVE_ERR", error: data.error ?? "Eroare." }); return; }
      dispatch({ type: "SAVE_OK", offer: data });
    } catch (error: unknown) {
      dispatch({ type: "SAVE_ERR", error: String(error) });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Ștergi această ofertă?")) return;
    dispatch({ type: "SET_DELETING", id });
    try {
      await fetch(`/api/oferte/admin/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      dispatch({ type: "DELETE_OK", id });
    } catch {
      dispatch({ type: "SET_DELETING", id: null });
    }
  };

  const handleToggleActive = async (offer: Offer) => {
    const newActive = !offer.active;
    dispatch({ type: "TOGGLE_ACTIVE", id: offer.id, active: newActive });
    await fetch(`/api/oferte/admin/${offer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
      body: JSON.stringify({ active: newActive }),
    }).catch(() => {
      dispatch({ type: "TOGGLE_ACTIVE", id: offer.id, active: offer.active });
    });
  };

  const copyLink = (slug: string, id: string) => {
    navigator.clipboard.writeText(`${BASE_URL}/oferta/${slug}`);
    dispatch({ type: "SET_COPIED", id });
    setTimeout(() => dispatch({ type: "SET_COPIED", id: null }), 2000);
  };

  return (
    <div>
      <Breadcrumb />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-light text-white">Oferte</h1>
            <p className="text-neutral-500 text-sm">{state.offers.length} oferte create</p>
          </div>
          <button
            onClick={() => dispatch({ type: state.showForm ? "CLOSE_FORM" : "OPEN_FORM" })}
            className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {state.showForm ? "Anulează" : "+ Ofertă nouă"}
          </button>
        </div>

        {/* Create form */}
        {state.showForm && (
          <form
            onSubmit={handleCreate}
            className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-5"
          >
            <h2 className="text-white font-medium">Ofertă nouă</h2>

            {state.saveError && (
              <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3">
                {state.saveError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-neutral-400 text-xs uppercase tracking-wide">Slug * <span className="normal-case text-neutral-600">(apare în URL: /oferta/<strong>28aprilie</strong>)</span></label>
                <input
                  value={state.form.slug}
                  onChange={(e) => dispatch({ type: "SET_FIELD", field: "slug", value: e.target.value })}
                  placeholder="28aprilie"
                  required
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-neutral-400 text-xs uppercase tracking-wide">Nume client</label>
                <input
                  value={state.form.clientName}
                  onChange={(e) => dispatch({ type: "SET_FIELD", field: "clientName", value: e.target.value })}
                  placeholder="Ana și Mihai"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-neutral-400 text-xs uppercase tracking-wide">Titlu ofertă</label>
                <input
                  value={state.form.title}
                  onChange={(e) => dispatch({ type: "SET_FIELD", field: "title", value: e.target.value })}
                  placeholder="Pachet foto-video nuntă 2027"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-neutral-400 text-xs uppercase tracking-wide">Pachet</label>
                <input
                  value={state.form.packageName}
                  onChange={(e) => dispatch({ type: "SET_FIELD", field: "packageName", value: e.target.value })}
                  placeholder="Pachet Complet"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-neutral-400 text-xs uppercase tracking-wide">Preț</label>
                <input
                  value={state.form.price}
                  onChange={(e) => dispatch({ type: "SET_FIELD", field: "price", value: e.target.value })}
                  placeholder="2.500 EUR"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-neutral-400 text-xs uppercase tracking-wide">Valabilă până la</label>
                <input
                  type="date"
                  value={state.form.validUntil}
                  onChange={(e) => dispatch({ type: "SET_FIELD", field: "validUntil", value: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-neutral-400 text-xs uppercase tracking-wide">URL PDF</label>
                <input
                  value={state.form.pdfUrl}
                  onChange={(e) => dispatch({ type: "SET_FIELD", field: "pdfUrl", value: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-neutral-400 text-xs uppercase tracking-wide">Descriere / detalii</label>
                <textarea
                  value={state.form.description}
                  onChange={(e) => dispatch({ type: "SET_FIELD", field: "description", value: e.target.value })}
                  placeholder="Ce include pachetul, condiții speciale..."
                  rows={4}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => dispatch({ type: "CLOSE_FORM" })}
                className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 py-2.5 rounded-lg text-sm transition-colors"
              >
                Anulează
              </button>
              <button
                type="submit"
                disabled={state.saving || !state.form.slug.trim()}
                className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
              >
                {state.saving ? "Se creează..." : "Creează oferta"}
              </button>
            </div>
          </form>
        )}

        {/* Errors / loading */}
        {state.loadError && (
          <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3">
            {state.loadError}
          </div>
        )}

        {state.loading && (
          <div className="text-neutral-500 text-sm text-center py-10">Se încarcă...</div>
        )}

        {!state.loading && state.offers.length === 0 && (
          <div className="text-center py-16 text-neutral-600 text-sm">
            Nicio ofertă creată. Folosește butonul de mai sus.
          </div>
        )}

        {/* Offers list */}
        {state.offers.length > 0 && (
          <div className="space-y-3">
            {state.offers.map((offer) => (
              <div
                key={offer.id}
                className={`bg-neutral-900 border rounded-xl p-5 transition-colors ${
                  offer.active ? "border-neutral-800" : "border-neutral-800/40 opacity-60"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-white font-medium text-sm">
                        {offer.title || offer.slug}
                      </span>
                      {!offer.active && (
                        <span className="text-[10px] bg-neutral-800 text-neutral-500 px-2 py-0.5 rounded-full">
                          Inactiv
                        </span>
                      )}
                    </div>
                    {offer.clientName && (
                      <p className="text-neutral-500 text-xs mb-2">{offer.clientName}</p>
                    )}

                    {/* URL */}
                    <div className="flex items-center gap-2 mb-3">
                      <code className="text-violet-400 text-xs bg-violet-900/20 px-2 py-1 rounded-md">
                        /oferta/{offer.slug}
                      </code>
                      <button
                        onClick={() => copyLink(offer.slug, offer.id)}
                        className="text-xs text-neutral-500 hover:text-white transition-colors"
                      >
                        {state.copied === offer.id ? "✓ Copiat" : "Copiază link"}
                      </button>
                      <a
                        href={`/oferta/${offer.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-neutral-500 hover:text-violet-400 transition-colors"
                      >
                        Deschide ↗
                      </a>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-xs">
                      <span className="flex items-center gap-1 text-neutral-400">
                        <span>👁</span>
                        <span className="font-semibold text-white">{offer.viewCount ?? 0}</span>
                        <span className="text-neutral-600">vizualizări</span>
                      </span>
                      <span className="flex items-center gap-1 text-neutral-400">
                        <span>⬇️</span>
                        <span className="font-semibold text-white">{offer.downloadCount ?? 0}</span>
                        <span className="text-neutral-600">descărcări</span>
                      </span>
                      {offer.price && (
                        <span className="text-violet-400 font-medium">{offer.price}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button
                      onClick={() => handleToggleActive(offer)}
                      className="text-xs text-neutral-500 hover:text-white transition-colors"
                    >
                      {offer.active ? "Dezactivează" : "Activează"}
                    </button>
                    <button
                      onClick={() => handleDelete(offer.id)}
                      disabled={state.deletingId === offer.id}
                      className="text-xs text-neutral-600 hover:text-red-400 transition-colors disabled:opacity-40"
                    >
                      {state.deletingId === offer.id ? "..." : "Șterge"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
