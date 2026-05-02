import React, { useReducer } from "react";
import { useWeddingHubAuth } from "../context/WeddingHubAuthContext";
import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";
import type { WeddingGuest, RsvpStatus, MenuPreference } from "../types";

interface EditGuestModalProps {
  guest: WeddingGuest;
  onClose: () => void;
  onSaved: (guest: WeddingGuest) => void;
}

type FormState = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  notes: string;
  adultsCount: number;
  childrenCount: number;
  rsvpStatus: RsvpStatus;
  menuPreference: MenuPreference | "";
  childrenMenuPreference: MenuPreference | "";
  isSubmitting: boolean;
  errorMessage: string | null;
};

type FormAction =
  | { type: "SET_FIELD"; field: keyof Pick<FormState, "firstName" | "lastName" | "phone" | "email" | "notes">; value: string }
  | { type: "SET_ADULTS"; value: number }
  | { type: "SET_CHILDREN"; value: number }
  | { type: "SET_RSVP"; value: RsvpStatus }
  | { type: "SET_MENU"; value: MenuPreference | "" }
  | { type: "SET_CHILDREN_MENU"; value: MenuPreference | "" }
  | { type: "SET_SUBMITTING"; value: boolean }
  | { type: "SET_ERROR"; value: string | null };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_FIELD": return { ...state, [action.field]: action.value };
    case "SET_ADULTS": return { ...state, adultsCount: action.value };
    case "SET_CHILDREN": return { ...state, childrenCount: action.value };
    case "SET_RSVP": return { ...state, rsvpStatus: action.value };
    case "SET_MENU": return { ...state, menuPreference: action.value };
    case "SET_CHILDREN_MENU": return { ...state, childrenMenuPreference: action.value };
    case "SET_SUBMITTING": return { ...state, isSubmitting: action.value };
    case "SET_ERROR": return { ...state, errorMessage: action.value, isSubmitting: false };
    default: return state;
  }
}

const MENU_OPTIONS: { value: MenuPreference; label: string }[] = [
  { value: "carne", label: "Carne" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "mixt", label: "Mixt" },
];

const RSVP_OPTIONS: { value: RsvpStatus; label: string }[] = [
  { value: "asteptare", label: "În așteptare" },
  { value: "confirmat", label: "Confirmat" },
  { value: "refuzat", label: "Refuzat" },
];

const EditGuestModal: React.FC<EditGuestModalProps> = ({ guest, onClose, onSaved }) => {
  useBodyScrollLock(true);
  const { coupleAuth } = useWeddingHubAuth();

  const [formState, dispatch] = useReducer(formReducer, {
    firstName: guest.firstName,
    lastName: guest.lastName,
    phone: guest.phone,
    email: guest.email,
    notes: guest.notes,
    adultsCount: guest.adultsCount,
    childrenCount: guest.childrenCount,
    rsvpStatus: guest.rsvpStatus,
    menuPreference: guest.menuPreference ?? "",
    childrenMenuPreference: guest.childrenMenuPreference ?? "",
    isSubmitting: false,
    errorMessage: null,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.firstName.trim() || !formState.lastName.trim()) return;

    dispatch({ type: "SET_SUBMITTING", value: true });
    dispatch({ type: "SET_ERROR", value: null });

    try {
      const response = await fetch(`/api/wedding-hub/guests/${guest.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${coupleAuth.coupleAccessToken}`,
        },
        body: JSON.stringify({
          firstName: formState.firstName.trim(),
          lastName: formState.lastName.trim(),
          phone: formState.phone.trim(),
          email: formState.email.trim(),
          notes: formState.notes.trim(),
          adultsCount: formState.adultsCount,
          childrenCount: formState.childrenCount,
          rsvpStatus: formState.rsvpStatus,
          menuPreference: formState.menuPreference || null,
          childrenMenuPreference: formState.childrenCount > 0 ? (formState.childrenMenuPreference || null) : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error ?? "Nu s-a putut salva invitatul.");
      }

      const updatedGuest = await response.json() as WeddingGuest;
      onSaved(updatedGuest);
      onClose();
    } catch (error: unknown) {
      dispatch({ type: "SET_ERROR", value: (error as Error).message });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 sticky top-0 bg-neutral-900">
          <h2 className="text-white font-medium">Editează invitat</h2>
          <button onClick={onClose} aria-label="Închide" className="text-neutral-400 hover:text-white transition-colors">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formState.errorMessage && (
            <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3">
              {formState.errorMessage}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-neutral-400 text-xs uppercase tracking-wide">Prenume *</label>
              <input
                type="text"
                value={formState.firstName}
                onChange={(e) => dispatch({ type: "SET_FIELD", field: "firstName", value: e.target.value })}
                required
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-neutral-400 text-xs uppercase tracking-wide">Nume *</label>
              <input
                type="text"
                value={formState.lastName}
                onChange={(e) => dispatch({ type: "SET_FIELD", field: "lastName", value: e.target.value })}
                required
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-neutral-400 text-xs uppercase tracking-wide">Telefon</label>
            <input
              type="tel"
              value={formState.phone}
              onChange={(e) => dispatch({ type: "SET_FIELD", field: "phone", value: e.target.value })}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors"
              placeholder="07xx xxx xxx"
            />
          </div>

          <div className="space-y-1">
            <label className="text-neutral-400 text-xs uppercase tracking-wide">Email</label>
            <input
              type="email"
              value={formState.email}
              onChange={(e) => dispatch({ type: "SET_FIELD", field: "email", value: e.target.value })}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-neutral-400 text-xs uppercase tracking-wide">Adulți</label>
              <input
                type="number"
                min={1}
                max={20}
                value={formState.adultsCount}
                onChange={(e) => dispatch({ type: "SET_ADULTS", value: Number(e.target.value) })}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-neutral-400 text-xs uppercase tracking-wide">Copii</label>
              <input
                type="number"
                min={0}
                max={20}
                value={formState.childrenCount}
                onChange={(e) => dispatch({ type: "SET_CHILDREN", value: Number(e.target.value) })}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-neutral-400 text-xs uppercase tracking-wide">Status RSVP</label>
            <select
              value={formState.rsvpStatus}
              onChange={(e) => dispatch({ type: "SET_RSVP", value: e.target.value as RsvpStatus })}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors"
            >
              {RSVP_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-neutral-400 text-xs uppercase tracking-wide">Meniu adulți</label>
            <select
              value={formState.menuPreference}
              onChange={(e) => dispatch({ type: "SET_MENU", value: e.target.value as MenuPreference | "" })}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors"
            >
              <option value="">Nespecificat</option>
              {MENU_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {formState.childrenCount > 0 && (
            <div className="space-y-1">
              <label className="text-neutral-400 text-xs uppercase tracking-wide">Meniu copii</label>
              <select
                value={formState.childrenMenuPreference}
                onChange={(e) => dispatch({ type: "SET_CHILDREN_MENU", value: e.target.value as MenuPreference | "" })}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors"
              >
                <option value="">Nespecificat</option>
                {MENU_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-neutral-400 text-xs uppercase tracking-wide">Observații</label>
            <textarea
              value={formState.notes}
              onChange={(e) => dispatch({ type: "SET_FIELD", field: "notes", value: e.target.value })}
              rows={3}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors resize-none"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 py-2.5 rounded-lg text-sm transition-colors"
            >
              Anulează
            </button>
            <button
              type="submit"
              disabled={formState.isSubmitting}
              className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              {formState.isSubmitting ? "Se salvează..." : "Salvează"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditGuestModal;
