/*
 * Purpose: emptying the whole album-photo selection (often 100 photos picked over many pages)
 * can't be undone, so it needs more than one tap: the client must type the confirmation phrase.
 * Diacritics, case and extra spaces are ignored ("resetez toata selectia" works on any keyboard).
 */
import { useEffect, useRef, useState } from "react";

export const RESET_CONFIRM_PHRASE = "resetez toată selecția";

const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim().toLowerCase();

export const isResetConfirmed = (value: string) => normalize(value) === normalize(RESET_CONFIRM_PHRASE);

type Props = { count: number; onCancel: () => void; onConfirm: () => void };

export default function ResetPrintModal({ count, onCancel, onConfirm }: Props) {
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const ok = isResetConfirmed(typed);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/85 p-4" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reset-print-title"
        aria-describedby="reset-print-text"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md border border-red-500/70 bg-[#140708] p-4 sm:p-5"
      >
        <h2 id="reset-print-title" className="text-base font-bold text-red-300 sm:text-lg">Ștergi toată selecția pentru album?</h2>
        <p id="reset-print-text" className="mt-2 text-sm leading-snug text-neutral-300">
          Toate cele <strong className="text-white">{count}</strong> poze alese pentru album vor fi scoase din selecție.
          Pozele rămân în album, dar va trebui să le alegi din nou, una câte una. <strong className="text-white">Nu se poate anula.</strong>
        </p>
        <form
          onSubmit={(event) => { event.preventDefault(); if (ok) onConfirm(); }}
          className="mt-4"
        >
          <label htmlFor="reset-print-input" className="text-xs text-neutral-400">
            Ca să confirmi, scrie <strong className="text-white">„{RESET_CONFIRM_PHRASE}”</strong> (cu sau fără diacritice)
          </label>
          <input
            id="reset-print-input"
            ref={inputRef}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={RESET_CONFIRM_PHRASE}
            className="mt-1.5 w-full border border-neutral-700 bg-black px-3 py-2.5 text-sm text-white outline-none placeholder:text-neutral-700 focus:border-red-400"
          />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={onCancel} className="border border-neutral-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-neutral-900">
              Anulează
            </button>
            <button type="submit" disabled={!ok} className="bg-red-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-red-500 disabled:bg-red-950 disabled:text-red-300/50">
              Resetează tot
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
