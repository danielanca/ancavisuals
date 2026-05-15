import { useEffect, useReducer } from "react";
import { Link } from "react-router-dom";
import useAuth from "../auth/useAuth";
import Breadcrumb from "./Breadcrumb";
import { OFFER_SERVICES } from "../../../../shared/offers/offerServices";

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
  selectedServices: string[];
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
  selectedServices: string[];
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
  selectedServices: [],
};

function offerToForm(offer: Offer): FormData {
  return {
    slug: offer.slug,
    clientName: offer.clientName,
    title: offer.title,
    description: offer.description,
    pdfUrl: offer.pdfUrl,
    price: offer.price,
    packageName: offer.packageName,
    validUntil: offer.validUntil,
    selectedServices: Array.isArray(offer.selectedServices) ? offer.selectedServices : [],
  };
}

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
  editingId: string | null;
  editForm: FormData;
  editSaving: boolean;
  editError: string | null;
  resettingId: string | null;
};

type Action =
  | { type: "LOAD_OK"; offers: Offer[] }
  | { type: "LOAD_ERR"; error: string }
  | { type: "OPEN_FORM" }
  | { type: "CLOSE_FORM" }
  | { type: "SET_FIELD"; field: keyof FormData; value: string }
  | { type: "TOGGLE_SERVICE"; serviceId: string }
  | { type: "SAVING" }
  | { type: "SAVE_OK"; offer: Offer }
  | { type: "SAVE_ERR"; error: string }
  | { type: "SET_DELETING"; id: string | null }
  | { type: "DELETE_OK"; id: string }
  | { type: "SET_COPIED"; id: string | null }
  | { type: "TOGGLE_ACTIVE"; id: string; active: boolean }
  | { type: "OPEN_EDIT"; offer: Offer }
  | { type: "CLOSE_EDIT" }
  | { type: "EDIT_FIELD"; field: keyof FormData; value: string }
  | { type: "EDIT_TOGGLE_SERVICE"; serviceId: string }
  | { type: "EDIT_SAVING" }
  | { type: "EDIT_OK"; offer: Offer }
  | { type: "EDIT_ERR"; error: string }
  | { type: "SET_RESETTING"; id: string | null }
  | { type: "RESET_STATS_OK"; id: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOAD_OK": return { ...state, loading: false, offers: action.offers };
    case "LOAD_ERR": return { ...state, loading: false, loadError: action.error };
    case "OPEN_FORM": return { ...state, showForm: true, form: emptyForm, saveError: null };
    case "CLOSE_FORM": return { ...state, showForm: false, form: emptyForm, saveError: null };
    case "SET_FIELD": return { ...state, form: { ...state.form, [action.field]: action.value } };
    case "TOGGLE_SERVICE":
      return {
        ...state,
        form: {
          ...state.form,
          selectedServices: state.form.selectedServices.includes(action.serviceId)
            ? state.form.selectedServices.filter(id => id !== action.serviceId)
            : [...state.form.selectedServices, action.serviceId],
        },
      };
    case "SAVING": return { ...state, saving: true, saveError: null };
    case "SAVE_OK": return { ...state, saving: false, showForm: false, form: emptyForm, offers: [action.offer, ...state.offers] };
    case "SAVE_ERR": return { ...state, saving: false, saveError: action.error };
    case "SET_DELETING": return { ...state, deletingId: action.id };
    case "DELETE_OK": return { ...state, deletingId: null, offers: state.offers.filter((o) => o.id !== action.id) };
    case "SET_COPIED": return { ...state, copied: action.id };
    case "TOGGLE_ACTIVE":
      return { ...state, offers: state.offers.map((o) => o.id === action.id ? { ...o, active: action.active } : o) };
    case "OPEN_EDIT":
      return { ...state, editingId: action.offer.id, editForm: offerToForm(action.offer), editError: null };
    case "CLOSE_EDIT":
      return { ...state, editingId: null, editForm: emptyForm, editError: null };
    case "EDIT_FIELD":
      return { ...state, editForm: { ...state.editForm, [action.field]: action.value } };
    case "EDIT_TOGGLE_SERVICE":
      return {
        ...state,
        editForm: {
          ...state.editForm,
          selectedServices: state.editForm.selectedServices.includes(action.serviceId)
            ? state.editForm.selectedServices.filter(id => id !== action.serviceId)
            : [...state.editForm.selectedServices, action.serviceId],
        },
      };
    case "EDIT_SAVING":
      return { ...state, editSaving: true, editError: null };
    case "EDIT_OK":
      return {
        ...state,
        editSaving: false,
        editingId: null,
        editForm: emptyForm,
        offers: state.offers.map((o) => o.id === action.offer.id ? action.offer : o),
      };
    case "EDIT_ERR":
      return { ...state, editSaving: false, editError: action.error };
    case "SET_RESETTING":
      return { ...state, resettingId: action.id };
    case "RESET_STATS_OK":
      return {
        ...state,
        resettingId: null,
        offers: state.offers.map((o) => o.id === action.id ? { ...o, viewCount: 0, downloadCount: 0 } : o),
      };
    default: return state;
  }
}

const BASE_URL = typeof window !== "undefined" ? window.location.origin : "https://ancavisuals.ro";

const inputClass = "w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors";

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
    editingId: null,
    editForm: emptyForm,
    editSaving: false,
    editError: null,
    resettingId: null,
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

  const handleEdit = async (event: React.FormEvent, id: string) => {
    event.preventDefault();
    dispatch({ type: "EDIT_SAVING" });
    try {
      const response = await fetch(`/api/oferte/admin/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify(state.editForm),
      });
      const data = await response.json() as Offer & { error?: string };
      if (!response.ok) { dispatch({ type: "EDIT_ERR", error: data.error ?? "Eroare." }); return; }
      dispatch({ type: "EDIT_OK", offer: data });
    } catch (error: unknown) {
      dispatch({ type: "EDIT_ERR", error: String(error) });
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

  const handleResetStats = async (id: string) => {
    if (!confirm("Resetezi contoarele la 0?")) return;
    dispatch({ type: "SET_RESETTING", id });
    try {
      await fetch(`/api/oferte/admin/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({ viewCount: 0, downloadCount: 0 }),
      });
      dispatch({ type: "RESET_STATS_OK", id });
    } catch {
      dispatch({ type: "SET_RESETTING", id: null });
    }
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
          <div className="flex items-center gap-3">
            <Link
              to="/admin/template-oferte"
              className="border border-neutral-700 hover:border-neutral-500 text-neutral-300 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Template Oferte
            </Link>
            <button
              onClick={() => dispatch({ type: state.showForm ? "CLOSE_FORM" : "OPEN_FORM" })}
              className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {state.showForm ? "Anulează" : "+ Ofertă nouă"}
            </button>
          </div>
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
                  className={inputClass}
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-neutral-400 text-xs uppercase tracking-wide">Titlu ofertă</label>
                <input
                  value={state.form.title}
                  onChange={(e) => dispatch({ type: "SET_FIELD", field: "title", value: e.target.value })}
                  placeholder="Pachet foto-video nuntă 2027"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <label className="text-neutral-400 text-xs uppercase tracking-wide">Servicii incluse</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {OFFER_SERVICES.map((service) => {
                    const checked = state.form.selectedServices.includes(service.id);
                    return (
                      <label
                        key={service.id}
                        className={`flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
                          checked ? "border-violet-500 bg-violet-500/10" : "border-neutral-800 bg-neutral-950/60 hover:border-neutral-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => dispatch({ type: "TOGGLE_SERVICE", serviceId: service.id })}
                          className="mt-1 h-4 w-4 accent-violet-500"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm text-white">{service.label}</span>
                          <span className="block text-xs text-neutral-500 mt-1">{service.description}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-neutral-400 text-xs uppercase tracking-wide">Pachet</label>
                <input
                  value={state.form.packageName}
                  onChange={(e) => dispatch({ type: "SET_FIELD", field: "packageName", value: e.target.value })}
                  placeholder="Pachet Complet"
                  className={inputClass}
                />
              </div>

              <div className="space-y-1">
                <label className="text-neutral-400 text-xs uppercase tracking-wide">Preț</label>
                <input
                  value={state.form.price}
                  onChange={(e) => dispatch({ type: "SET_FIELD", field: "price", value: e.target.value })}
                  placeholder="2.500 EUR"
                  className={inputClass}
                />
              </div>

              <div className="space-y-1">
                <label className="text-neutral-400 text-xs uppercase tracking-wide">Valabilă până la</label>
                <input
                  type="date"
                  value={state.form.validUntil}
                  onChange={(e) => dispatch({ type: "SET_FIELD", field: "validUntil", value: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1">
                <label className="text-neutral-400 text-xs uppercase tracking-wide">URL PDF</label>
                <input
                  value={state.form.pdfUrl}
                  onChange={(e) => dispatch({ type: "SET_FIELD", field: "pdfUrl", value: e.target.value })}
                  placeholder="https://..."
                  className={inputClass}
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-neutral-400 text-xs uppercase tracking-wide">Descriere / detalii</label>
                <textarea
                  value={state.form.description}
                  onChange={(e) => dispatch({ type: "SET_FIELD", field: "description", value: e.target.value })}
                  placeholder="Ce include pachetul, condiții speciale..."
                  rows={4}
                  className={`${inputClass} resize-none`}
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
                    <div className="flex items-center gap-4 text-xs flex-wrap">
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
                      <button
                        onClick={() => handleResetStats(offer.id)}
                        disabled={state.resettingId === offer.id}
                        className="text-neutral-600 hover:text-amber-400 transition-colors disabled:opacity-40"
                      >
                        {state.resettingId === offer.id ? "..." : "Resetează stats"}
                      </button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button
                      onClick={() =>
                        state.editingId === offer.id
                          ? dispatch({ type: "CLOSE_EDIT" })
                          : dispatch({ type: "OPEN_EDIT", offer })
                      }
                      className="text-xs text-neutral-500 hover:text-white transition-colors"
                    >
                      {state.editingId === offer.id ? "Anulează" : "Editează"}
                    </button>
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

                {/* Inline edit form */}
                {state.editingId === offer.id && (
                  <form
                    onSubmit={(e) => handleEdit(e, offer.id)}
                    className="mt-5 pt-5 border-t border-neutral-800 space-y-4"
                  >
                    {state.editError && (
                      <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3">
                        {state.editError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-neutral-400 text-xs uppercase tracking-wide">Slug (URL)</label>
                        <input
                          value={state.editForm.slug}
                          onChange={(e) => dispatch({ type: "EDIT_FIELD", field: "slug", value: e.target.value })}
                          required
                          className={inputClass}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-neutral-400 text-xs uppercase tracking-wide">URL PDF</label>
                        <input
                          value={state.editForm.pdfUrl}
                          onChange={(e) => dispatch({ type: "EDIT_FIELD", field: "pdfUrl", value: e.target.value })}
                          placeholder="https://..."
                          className={inputClass}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-neutral-400 text-xs uppercase tracking-wide">Nume client <span className="normal-case text-neutral-600">(opțional)</span></label>
                        <input
                          value={state.editForm.clientName}
                          onChange={(e) => dispatch({ type: "EDIT_FIELD", field: "clientName", value: e.target.value })}
                          placeholder="Ana și Mihai"
                          className={inputClass}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-neutral-400 text-xs uppercase tracking-wide">Titlu</label>
                        <input
                          value={state.editForm.title}
                          onChange={(e) => dispatch({ type: "EDIT_FIELD", field: "title", value: e.target.value })}
                          className={inputClass}
                        />
                      </div>

                      <div className="space-y-2 sm:col-span-2">
                        <label className="text-neutral-400 text-xs uppercase tracking-wide">Servicii incluse</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {OFFER_SERVICES.map((service) => {
                            const checked = state.editForm.selectedServices.includes(service.id);
                            return (
                              <label
                                key={service.id}
                                className={`flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
                                  checked ? "border-violet-500 bg-violet-500/10" : "border-neutral-800 bg-neutral-950/60 hover:border-neutral-700"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => dispatch({ type: "EDIT_TOGGLE_SERVICE", serviceId: service.id })}
                                  className="mt-1 h-4 w-4 accent-violet-500"
                                />
                                <span className="min-w-0">
                                  <span className="block text-sm text-white">{service.label}</span>
                                  <span className="block text-xs text-neutral-500 mt-1">{service.description}</span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-neutral-400 text-xs uppercase tracking-wide">Pachet</label>
                        <input
                          value={state.editForm.packageName}
                          onChange={(e) => dispatch({ type: "EDIT_FIELD", field: "packageName", value: e.target.value })}
                          className={inputClass}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-neutral-400 text-xs uppercase tracking-wide">Preț</label>
                        <input
                          value={state.editForm.price}
                          onChange={(e) => dispatch({ type: "EDIT_FIELD", field: "price", value: e.target.value })}
                          className={inputClass}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-neutral-400 text-xs uppercase tracking-wide">Valabilă până la</label>
                        <input
                          type="date"
                          value={state.editForm.validUntil}
                          onChange={(e) => dispatch({ type: "EDIT_FIELD", field: "validUntil", value: e.target.value })}
                          className={inputClass}
                        />
                      </div>

                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-neutral-400 text-xs uppercase tracking-wide">Descriere</label>
                        <textarea
                          value={state.editForm.description}
                          onChange={(e) => dispatch({ type: "EDIT_FIELD", field: "description", value: e.target.value })}
                          rows={3}
                          className={`${inputClass} resize-none`}
                        />
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => dispatch({ type: "CLOSE_EDIT" })}
                        className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 py-2.5 rounded-lg text-sm transition-colors"
                      >
                        Anulează
                      </button>
                      <button
                        type="submit"
                        disabled={state.editSaving}
                        className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
                      >
                        {state.editSaving ? "Se salvează..." : "Salvează"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
