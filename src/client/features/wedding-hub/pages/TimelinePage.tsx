import React, { useEffect, useReducer } from "react";
import { TimelineProvider, useTimeline } from "../context/TimelineContext";
import type { TimelineCategory, TimelineMoment } from "../context/TimelineContext";
import { useWeddingHubAuth } from "../context/WeddingHubAuthContext";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { value: TimelineCategory; label: string }[] = [
  { value: "civil", label: "Cununie Civilă" },
  { value: "church", label: "Cununie Religioasă" },
  { value: "photos", label: "Fotografii" },
  { value: "restaurant", label: "Restaurant" },
  { value: "party", label: "Petrecere" },
  { value: "other", label: "Altele" },
];

const CATEGORY_STYLES: Record<TimelineCategory, string> = {
  civil: "bg-blue-900/30 border border-blue-800/40 text-blue-300",
  church: "bg-purple-900/30 border border-purple-800/40 text-purple-300",
  photos: "bg-rose-900/20 border border-rose-800/40 text-rose-300",
  restaurant: "bg-amber-900/30 border border-amber-800/40 text-amber-300",
  party: "bg-green-900/20 border border-green-800/40 text-green-300",
  other: "bg-neutral-800 border border-neutral-700 text-neutral-400",
};

function categoryLabel(category: TimelineCategory): string {
  return CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

// ─── Empty form ───────────────────────────────────────────────────────────────

type MomentForm = {
  title: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
  category: TimelineCategory;
};

const emptyForm: MomentForm = {
  title: "",
  startTime: "",
  endTime: "",
  location: "",
  notes: "",
  category: "other",
};

function formFromMoment(moment: TimelineMoment): MomentForm {
  return {
    title: moment.title,
    startTime: moment.startTime,
    endTime: moment.endTime,
    location: moment.location,
    notes: moment.notes,
    category: moment.category,
  };
}

// ─── Page state ───────────────────────────────────────────────────────────────

type PageState = {
  showAddForm: boolean;
  editingMomentId: string | null;
  deletingMomentId: string | null;
  confirmTemplate: boolean;
  applyingTemplate: boolean;
  savingForm: boolean;
  formError: string | null;
  pageError: string | null;
  form: MomentForm;
};

type PageAction =
  | { type: "SHOW_ADD_FORM" }
  | { type: "HIDE_ADD_FORM" }
  | { type: "START_EDIT"; moment: TimelineMoment }
  | { type: "CANCEL_EDIT" }
  | { type: "SET_FORM_FIELD"; field: keyof MomentForm; value: string }
  | { type: "SET_SAVING"; saving: boolean }
  | { type: "FORM_DONE" }
  | { type: "SET_DELETING"; momentId: string | null }
  | { type: "CONFIRM_TEMPLATE" }
  | { type: "CANCEL_TEMPLATE" }
  | { type: "SET_APPLYING_TEMPLATE"; applying: boolean }
  | { type: "TEMPLATE_DONE" }
  | { type: "SET_FORM_ERROR"; error: string | null }
  | { type: "SET_PAGE_ERROR"; error: string | null };

const initialPageState: PageState = {
  showAddForm: false,
  editingMomentId: null,
  deletingMomentId: null,
  confirmTemplate: false,
  applyingTemplate: false,
  savingForm: false,
  formError: null,
  pageError: null,
  form: emptyForm,
};

function pageReducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case "SHOW_ADD_FORM":
      return { ...state, showAddForm: true, editingMomentId: null, form: emptyForm, formError: null };
    case "HIDE_ADD_FORM":
      return { ...state, showAddForm: false, form: emptyForm, formError: null };
    case "START_EDIT":
      return {
        ...state,
        editingMomentId: action.moment.id,
        showAddForm: false,
        form: formFromMoment(action.moment),
        formError: null,
      };
    case "CANCEL_EDIT":
      return { ...state, editingMomentId: null, form: emptyForm, formError: null };
    case "SET_FORM_FIELD":
      return { ...state, form: { ...state.form, [action.field]: action.value } };
    case "SET_SAVING":
      return { ...state, savingForm: action.saving };
    case "FORM_DONE":
      return {
        ...state,
        showAddForm: false,
        editingMomentId: null,
        savingForm: false,
        form: emptyForm,
        formError: null,
      };
    case "SET_DELETING":
      return { ...state, deletingMomentId: action.momentId };
    case "CONFIRM_TEMPLATE":
      return { ...state, confirmTemplate: true };
    case "CANCEL_TEMPLATE":
      return { ...state, confirmTemplate: false };
    case "SET_APPLYING_TEMPLATE":
      return { ...state, applyingTemplate: action.applying };
    case "TEMPLATE_DONE":
      return { ...state, confirmTemplate: false, applyingTemplate: false };
    case "SET_FORM_ERROR":
      return { ...state, formError: action.error, savingForm: false };
    case "SET_PAGE_ERROR":
      return { ...state, pageError: action.error };
    default:
      return state;
  }
}

// ─── Moment form component ────────────────────────────────────────────────────

function MomentForm({
  form,
  formError,
  saving,
  submitLabel,
  onFieldChange,
  onSubmit,
  onCancel,
}: {
  form: MomentForm;
  formError: string | null;
  saving: boolean;
  submitLabel: string;
  onFieldChange: (field: keyof MomentForm, value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-5 space-y-4">
      {formError && (
        <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
          {formError}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs uppercase tracking-wide text-neutral-500 mb-1.5">
            Titlu moment
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(event) => onFieldChange("title", event.target.value)}
            placeholder="ex. Cununie Civilă"
            disabled={saving}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 disabled:opacity-40"
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wide text-neutral-500 mb-1.5">
            Ora start
          </label>
          <input
            type="time"
            value={form.startTime}
            onChange={(event) => onFieldChange("startTime", event.target.value)}
            disabled={saving}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500 disabled:opacity-40"
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wide text-neutral-500 mb-1.5">
            Ora final
          </label>
          <input
            type="time"
            value={form.endTime}
            onChange={(event) => onFieldChange("endTime", event.target.value)}
            disabled={saving}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500 disabled:opacity-40"
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wide text-neutral-500 mb-1.5">
            Categorie
          </label>
          <select
            value={form.category}
            onChange={(event) => onFieldChange("category", event.target.value)}
            disabled={saving}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500 disabled:opacity-40"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wide text-neutral-500 mb-1.5">
            Locație
          </label>
          <input
            type="text"
            value={form.location}
            onChange={(event) => onFieldChange("location", event.target.value)}
            placeholder="ex. Starea Civilă"
            disabled={saving}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 disabled:opacity-40"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs uppercase tracking-wide text-neutral-500 mb-1.5">
            Notițe
          </label>
          <textarea
            value={form.notes}
            onChange={(event) => onFieldChange("notes", event.target.value)}
            placeholder="Detalii suplimentare..."
            rows={2}
            disabled={saving}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 disabled:opacity-40 resize-none"
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors disabled:opacity-40"
        >
          Anulează
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={saving || !form.title.trim() || !form.startTime || !form.endTime}
          className="rounded-lg bg-rose-600 hover:bg-rose-500 px-4 py-2 text-sm text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Se salvează..." : submitLabel}
        </button>
      </div>
    </div>
  );
}

// ─── Inner page ───────────────────────────────────────────────────────────────

function TimelinePageContent() {
  const { moments, loading, error, setMoments, addMoment, addMoments, updateMoment, removeMoment } =
    useTimeline();
  const { coupleAuth } = useWeddingHubAuth();
  const [pageState, dispatch] = useReducer(pageReducer, initialPageState);

  // ─── Fetch ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!coupleAuth.coupleAccessToken) return;

    (async () => {
      try {
        const response = await fetch("/api/wedding-hub/timeline", {
          headers: { Authorization: `Bearer ${coupleAuth.coupleAccessToken}` },
        });
        if (!response.ok) throw new Error("fetch failed");
        const data = await response.json();
        setMoments(data.moments);
      } catch {
        dispatch({ type: "SET_PAGE_ERROR", error: "Nu s-a putut încărca timeline-ul." });
      }
    })();
  }, [coupleAuth.coupleAccessToken, setMoments]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleAddMoment = async () => {
    dispatch({ type: "SET_SAVING", saving: true });
    try {
      const response = await fetch("/api/wedding-hub/timeline", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${coupleAuth.coupleAccessToken}`,
        },
        body: JSON.stringify(pageState.form),
      });
      const data = await response.json();
      if (!response.ok) {
        dispatch({ type: "SET_FORM_ERROR", error: data.error ?? "Eroare necunoscută." });
        return;
      }
      addMoment(data);
      dispatch({ type: "FORM_DONE" });
    } catch {
      dispatch({ type: "SET_FORM_ERROR", error: "Nu s-a putut adăuga momentul." });
    }
  };

  const handleEditMoment = async () => {
    if (!pageState.editingMomentId) return;
    dispatch({ type: "SET_SAVING", saving: true });
    try {
      const response = await fetch(
        `/api/wedding-hub/timeline/${pageState.editingMomentId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${coupleAuth.coupleAccessToken}`,
          },
          body: JSON.stringify(pageState.form),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        dispatch({ type: "SET_FORM_ERROR", error: data.error ?? "Eroare necunoscută." });
        return;
      }
      updateMoment(data);
      dispatch({ type: "FORM_DONE" });
    } catch {
      dispatch({ type: "SET_FORM_ERROR", error: "Nu s-a putut salva momentul." });
    }
  };

  const handleDeleteMoment = async (momentId: string) => {
    if (pageState.deletingMomentId === momentId) return;
    dispatch({ type: "SET_DELETING", momentId });
    try {
      const response = await fetch(`/api/wedding-hub/timeline/${momentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${coupleAuth.coupleAccessToken}` },
      });
      if (!response.ok) throw new Error("delete failed");
      removeMoment(momentId);
    } catch {
      dispatch({ type: "SET_PAGE_ERROR", error: "Nu s-a putut șterge momentul." });
    } finally {
      dispatch({ type: "SET_DELETING", momentId: null });
    }
  };

  const handleApplyTemplate = async () => {
    dispatch({ type: "SET_APPLYING_TEMPLATE", applying: true });
    try {
      const response = await fetch("/api/wedding-hub/timeline/apply-template", {
        method: "POST",
        headers: { Authorization: `Bearer ${coupleAuth.coupleAccessToken}` },
      });
      if (!response.ok) throw new Error("template failed");
      const data = await response.json();
      addMoments(data.moments);
      dispatch({ type: "TEMPLATE_DONE" });
    } catch {
      dispatch({ type: "SET_PAGE_ERROR", error: "Nu s-a putut aplica șablonul." });
      dispatch({ type: "TEMPLATE_DONE" });
    }
  };

  // ─── Loading / Error ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-light text-white">Timeline Ziua Nunții</h1>
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 animate-pulse rounded-xl bg-neutral-900 border border-neutral-800" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-light text-white">Timeline Ziua Nunții</h1>
        <div className="rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300">{error}</div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-light text-white">Timeline Ziua Nunții</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Planifică orarul detaliat al zilei tale
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!pageState.confirmTemplate && (
            <button
              type="button"
              onClick={() => dispatch({ type: "CONFIRM_TEMPLATE" })}
              className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
            >
              Aplică șablon
            </button>
          )}
          {!pageState.showAddForm && !pageState.editingMomentId && (
            <button
              type="button"
              onClick={() => dispatch({ type: "SHOW_ADD_FORM" })}
              className="rounded-lg bg-rose-600 hover:bg-rose-500 px-3 py-2 text-sm text-white transition-colors"
            >
              + Moment nou
            </button>
          )}
        </div>
      </div>

      {/* Page error */}
      {pageState.pageError && (
        <div className="flex items-center justify-between rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300">
          <span>{pageState.pageError}</span>
          <button
            type="button"
            onClick={() => dispatch({ type: "SET_PAGE_ERROR", error: null })}
            className="ml-4 text-red-400 hover:text-red-200 transition-colors"
          >
            ×
          </button>
        </div>
      )}

      {/* Template confirmation banner */}
      {pageState.confirmTemplate && (
        <div className="rounded-xl border border-amber-800/40 bg-amber-900/20 px-5 py-4">
          <p className="text-sm text-amber-300 font-medium mb-1">Aplică șablonul „Nuntă Tradițională Românească"</p>
          <p className="text-xs text-amber-400/70 mb-4">
            Vor fi adăugate 10 momente standard. Poți edita sau șterge orice moment după aplicare.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleApplyTemplate}
              disabled={pageState.applyingTemplate}
              className="rounded-lg bg-rose-600 hover:bg-rose-500 px-4 py-2 text-sm text-white transition-colors disabled:opacity-40"
            >
              {pageState.applyingTemplate ? "Se aplică..." : "Aplică"}
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "CANCEL_TEMPLATE" })}
              disabled={pageState.applyingTemplate}
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors disabled:opacity-40"
            >
              Anulează
            </button>
          </div>
        </div>
      )}

      {/* Add form */}
      {pageState.showAddForm && (
        <MomentForm
          form={pageState.form}
          formError={pageState.formError}
          saving={pageState.savingForm}
          submitLabel="Adaugă moment"
          onFieldChange={(field, value) =>
            dispatch({ type: "SET_FORM_FIELD", field, value: value as string })
          }
          onSubmit={handleAddMoment}
          onCancel={() => dispatch({ type: "HIDE_ADD_FORM" })}
        />
      )}

      {/* Empty state */}
      {moments.length === 0 && !pageState.showAddForm && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 py-16 text-center">
          <p className="text-neutral-500 text-sm">Timeline-ul este gol.</p>
          <p className="mt-1 text-neutral-600 text-xs">
            Adaugă momente manual sau aplică șablonul românesc.
          </p>
        </div>
      )}

      {/* Timeline list */}
      {moments.length > 0 && (
        <div className="space-y-3">
          {moments.map((moment) => {
            const isEditing = pageState.editingMomentId === moment.id;
            const isDeleting = pageState.deletingMomentId === moment.id;

            if (isEditing) {
              return (
                <MomentForm
                  key={moment.id}
                  form={pageState.form}
                  formError={pageState.formError}
                  saving={pageState.savingForm}
                  submitLabel="Salvează"
                  onFieldChange={(field, value) =>
                    dispatch({ type: "SET_FORM_FIELD", field, value: value as string })
                  }
                  onSubmit={handleEditMoment}
                  onCancel={() => dispatch({ type: "CANCEL_EDIT" })}
                />
              );
            }

            return (
              <div
                key={moment.id}
                className="group rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden"
              >
                <div className="flex items-start gap-4 px-5 py-4">
                  {/* Time column */}
                  <div className="flex-shrink-0 text-center min-w-[72px]">
                    <p className="text-sm font-medium text-white tabular-nums">{moment.startTime}</p>
                    <div className="my-1 h-px bg-neutral-700 w-6 mx-auto" />
                    <p className="text-sm text-neutral-500 tabular-nums">{moment.endTime}</p>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${CATEGORY_STYLES[moment.category]}`}
                      >
                        {categoryLabel(moment.category)}
                      </span>
                      {moment.isFromTemplate && (
                        <span className="text-[11px] text-neutral-600">șablon</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-white">{moment.title}</p>
                    {moment.location && (
                      <p className="mt-0.5 text-xs text-neutral-500">📍 {moment.location}</p>
                    )}
                    {moment.notes && (
                      <p className="mt-1 text-xs text-neutral-400 leading-relaxed">{moment.notes}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "START_EDIT", moment })}
                      disabled={!!pageState.editingMomentId || pageState.showAddForm}
                      className="text-xs text-neutral-500 hover:text-white transition-colors disabled:opacity-30"
                    >
                      Editează
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMoment(moment.id)}
                      disabled={isDeleting}
                      className="text-xs text-neutral-600 hover:text-red-400 transition-colors disabled:opacity-40"
                    >
                      {isDeleting ? "..." : "×"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function TimelinePage() {
  return (
    <TimelineProvider>
      <TimelinePageContent />
    </TimelineProvider>
  );
}
