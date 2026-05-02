import React, { useReducer, useState } from "react";
import { useWeddingHubAuth } from "../context/WeddingHubAuthContext";
import type { WeddingGuest } from "../types";
import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";

interface AddGuestModalProps {
  onClose: () => void;
  onGuestAdded: (guest: WeddingGuest) => void;
}

type ImportedGuestRow = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  notes: string;
};

type FormState = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  notes: string;
  adultsCount: number;
  childrenCount: number;
  isSubmitting: boolean;
  errorMessage: string | null;
};

type FormAction =
  | { type: "SET_FIELD"; field: keyof Pick<FormState, "firstName" | "lastName" | "phone" | "email" | "notes">; value: string }
  | { type: "SET_ADULTS"; value: number }
  | { type: "SET_CHILDREN"; value: number }
  | { type: "SET_SUBMITTING"; value: boolean }
  | { type: "SET_ERROR"; value: string | null };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_FIELD": return { ...state, [action.field]: action.value };
    case "SET_ADULTS": return { ...state, adultsCount: action.value };
    case "SET_CHILDREN": return { ...state, childrenCount: action.value };
    case "SET_SUBMITTING": return { ...state, isSubmitting: action.value };
    case "SET_ERROR": return { ...state, errorMessage: action.value, isSubmitting: false };
    default: return state;
  }
}

const AddGuestModal: React.FC<AddGuestModalProps> = ({ onClose, onGuestAdded }) => {
  useBodyScrollLock(true);
  const { coupleAuth } = useWeddingHubAuth();
  const [showExample, setShowExample] = useState(false);
  const [showImportSection, setShowImportSection] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRows, setImportRows] = useState<ImportedGuestRow[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [extractingFromImage, setExtractingFromImage] = useState(false);
  const [importingRows, setImportingRows] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const [formState, dispatch] = useReducer(formReducer, {
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    notes: "",
    adultsCount: 1,
    childrenCount: 0,
    isSubmitting: false,
    errorMessage: null,
  });

  const readFileAsBase64 = (file: File): Promise<{ base64: string; mediaType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        const base64 = result.includes(",") ? result.split(",")[1] : "";
        if (!base64) {
          reject(new Error("Nu s-a putut citi imaginea."));
          return;
        }
        resolve({ base64, mediaType: file.type || "image/jpeg" });
      };
      reader.onerror = () => reject(new Error("Nu s-a putut citi imaginea."));
      reader.readAsDataURL(file);
    });
  };

  const normalizeImportedRows = (rows: ImportedGuestRow[]) =>
    rows
      .map((row) => ({
        ...row,
        firstName: row.firstName.trim(),
        lastName: row.lastName.trim(),
        phone: row.phone.trim(),
        email: row.email.trim(),
        notes: row.notes.trim(),
      }))
      .filter((row) => row.firstName || row.lastName || row.phone);

  const updateImportRow = (rowId: string, field: keyof ImportedGuestRow, value: string) => {
    setImportRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)),
    );
  };

  const handleExtractFromImage = async () => {
    if (!importFile) {
      setImportError("Alege o imagine înainte de extragere.");
      return;
    }

    if (!importFile.type.startsWith("image/")) {
      setImportError("Sunt acceptate doar imagini.");
      return;
    }

    setImportError(null);
    setImportSuccess(null);
    setExtractingFromImage(true);

    try {
      const { base64, mediaType } = await readFileAsBase64(importFile);
      const response = await fetch("/api/wedding-hub/guests/extract-from-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${coupleAuth.coupleAccessToken}`,
        },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error ?? "Nu s-au putut extrage invitații.");
      }

      const data = await response.json() as {
        guests?: Array<{ firstName: string; lastName: string; phone: string; email: string; notes: string }>;
      };

      const normalized = (data.guests ?? [])
        .map((guest, index) => ({
          id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
          firstName: guest.firstName ?? "",
          lastName: guest.lastName ?? "",
          phone: guest.phone ?? "",
          email: guest.email ?? "",
          notes: guest.notes ?? "",
        }))
        .filter((guest) => guest.firstName.trim() || guest.lastName.trim() || guest.phone.trim());

      setImportRows(normalized);
      setShowImportSection(true);

      if (normalized.length === 0) {
        setImportError("Nu am găsit invitați clari în imagine.");
      }
    } catch (error: unknown) {
      setImportError((error as Error).message);
    } finally {
      setExtractingFromImage(false);
    }
  };

  const handleBulkImport = async () => {
    const rows = normalizeImportedRows(importRows);
    if (rows.length === 0) {
      setImportError("Nu există invitați validați pentru import.");
      return;
    }

    setImportError(null);
    setImportSuccess(null);
    setImportingRows(true);

    try {
      const response = await fetch("/api/wedding-hub/guests/bulk-create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${coupleAuth.coupleAccessToken}`,
        },
        body: JSON.stringify({ guests: rows }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error ?? "Nu s-au putut importa invitații.");
      }

      const data = await response.json() as {
        createdGuests?: WeddingGuest[];
        skippedGuests?: Array<{ firstName: string; lastName: string; reason: string }>;
      };

      (data.createdGuests ?? []).forEach((guest) => onGuestAdded(guest));
      setImportSuccess(
        `${data.createdGuests?.length ?? 0} invitați importați${data.skippedGuests?.length ? `, ${data.skippedGuests.length} săriți` : ""}.`,
      );
      setImportRows([]);
      setImportFile(null);
      onClose();
    } catch (error: unknown) {
      setImportError((error as Error).message);
    } finally {
      setImportingRows(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formState.firstName.trim() || !formState.lastName.trim()) return;

    dispatch({ type: "SET_SUBMITTING", value: true });
    dispatch({ type: "SET_ERROR", value: null });

    try {
      const response = await fetch("/api/wedding-hub/guests", {
        method: "POST",
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
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error ?? "Nu s-a putut adăuga invitatul.");
      }

      const addedGuest = await response.json();
      onGuestAdded(addedGuest);
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
          <h2 className="text-white font-medium">Adaugă invitat</h2>
          <button onClick={onClose} aria-label="Închide" className="text-neutral-400 hover:text-white transition-colors">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formState.errorMessage && (
            <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3">
              {formState.errorMessage}
            </div>
          )}

          <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-neutral-200">Import din poză</p>
                <p className="text-xs text-neutral-500 mt-1">
                  Încarci o captură clară cu nume și telefon, noi extragem și poți importa lista în bulk.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowImportSection((value) => !value)}
                className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:border-rose-500 hover:text-white"
              >
                {showImportSection ? "Ascunde" : "Deschide"}
              </button>
            </div>

            {showImportSection && (
              <div className="space-y-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setImportFile(file);
                    setImportError(null);
                    setImportSuccess(null);
                  }}
                  className="block w-full text-xs text-neutral-400 file:mr-3 file:rounded-lg file:border-0 file:bg-rose-600 file:px-3 file:py-2 file:text-white file:transition-colors hover:file:bg-rose-500"
                />

                {importFile && (
                  <p className="text-[11px] text-neutral-500">
                    Fișier selectat: {importFile.name}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleExtractFromImage}
                    disabled={extractingFromImage || !importFile}
                    className="flex-1 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:opacity-40"
                  >
                    {extractingFromImage ? "Se extrage..." : "Extrage din poză"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImportFile(null);
                      setImportRows([]);
                      setImportError(null);
                      setImportSuccess(null);
                    }}
                    className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300 transition-colors hover:text-white"
                    >
                      Reset
                    </button>
                </div>

                {extractingFromImage && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-400 animate-pulse" />
                      <p className="text-xs text-rose-100">
                        Extrag numele și telefoanele din imagine. Durează câteva secunde.
                      </p>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-800">
                      <div className="h-full w-1/2 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-rose-500 via-pink-400 to-rose-500" />
                    </div>
                  </div>
                )}

                {importingRows && (
                  <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-green-400 animate-pulse" />
                      <p className="text-xs text-green-100">Import invitații în curs...</p>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-800">
                      <div className="h-full w-2/3 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-green-500 via-emerald-400 to-green-500" />
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setShowImportSection(false);
                    setImportError(null);
                  }}
                  className="text-xs text-neutral-400 transition-colors hover:text-neutral-200"
                >
                  Treci la adăugare manuală
                </button>

                {importError && (
                  <div className="rounded-lg border border-red-800 bg-red-900/30 px-3 py-2 text-sm text-red-300">
                    {importError}
                  </div>
                )}

                {importSuccess && (
                  <div className="rounded-lg border border-green-800 bg-green-900/20 px-3 py-2 text-sm text-green-200">
                    {importSuccess}
                  </div>
                )}

                {importRows.length > 0 && (
                  <div className="space-y-3 rounded-xl border border-neutral-800 bg-black/10 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-wide text-neutral-500">
                        Preview invitați ({importRows.length})
                      </p>
                      <button
                        type="button"
                        onClick={handleBulkImport}
                        disabled={importingRows}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-500 disabled:opacity-40"
                      >
                        {importingRows ? "Se importă..." : "Importă toți"}
                      </button>
                    </div>

                    <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                      {normalizeImportedRows(importRows).map((row) => (
                        <div key={row.id} className="rounded-lg border border-neutral-800 bg-neutral-950/70 p-3">
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <input
                              type="text"
                              value={row.firstName}
                              onChange={(event) => updateImportRow(row.id, "firstName", event.target.value)}
                              placeholder="Prenume"
                              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-rose-500 focus:outline-none"
                            />
                            <input
                              type="text"
                              value={row.lastName}
                              onChange={(event) => updateImportRow(row.id, "lastName", event.target.value)}
                              placeholder="Nume"
                              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-rose-500 focus:outline-none"
                            />
                            <input
                              type="text"
                              value={row.phone}
                              onChange={(event) => updateImportRow(row.id, "phone", event.target.value)}
                              placeholder="Telefon"
                              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-rose-500 focus:outline-none sm:col-span-2"
                            />
                            <input
                              type="text"
                              value={row.email}
                              onChange={(event) => updateImportRow(row.id, "email", event.target.value)}
                              placeholder="Email opțional"
                              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-rose-500 focus:outline-none sm:col-span-2"
                            />
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <p className="text-[11px] text-neutral-500">Poți corecta înainte de import.</p>
                            <button
                              type="button"
                              onClick={() => setImportRows((current) => current.filter((candidate) => candidate.id !== row.id))}
                              className="text-xs text-red-400 transition-colors hover:text-red-300"
                            >
                              Elimină
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {!showImportSection && (
            <>
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-200">Format recomandat</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      Un invitat pe linie, ca să fie ușor de importat sau verificat manual.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowExample((value) => !value)}
                    className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:border-rose-500 hover:text-white"
                  >
                    {showExample ? "Ascunde exemplul" : "Vezi exemplu"}
                  </button>
                </div>

                {showExample && (
                  <div className="mt-3 rounded-lg border border-neutral-800 bg-black/20 px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 mb-2">
                      Prenume Nume - Telefon
                    </p>
                    <pre className="whitespace-pre-wrap text-xs leading-6 text-neutral-200">
{`Estera Pop - 0722 123 456
Nicoleta Ciobanu - 0744 987 654
Andrei Ionescu - 0765 111 222`}
                    </pre>
                    <p className="mt-3 text-[11px] leading-relaxed text-neutral-500">
                      Dacă mai târziu încărcăm o poză sau un screenshot, acesta e formatul pe care îl vom citi cel mai bine.
                    </p>
                  </div>
                )}
              </div>

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
                  {formState.isSubmitting ? "Se adaugă..." : "Adaugă invitat"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

export default AddGuestModal;
