import React from "react";
import { appendDictation, useSpeechToText } from "../../../../hooks/useSpeechToText";

/**
 * Câmp cu buton de microfon: textul dictat se adaugă la valoarea existentă.
 * Dacă browserul nu suportă dictarea (ex. Firefox), butonul nu apare.
 */
export default function DictateField({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  const valueRef = React.useRef(value);
  valueRef.current = value;
  const { supported, listening, interim, error, toggle } = useSpeechToText((text) => {
    const next = appendDictation(valueRef.current, text);
    valueRef.current = next;
    onChange(next);
  });

  return (
    <div className="space-y-1">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">{children}</div>
        {supported && (
          <button
            type="button"
            onClick={toggle}
            aria-pressed={listening}
            aria-label={listening ? "Oprește dictarea" : "Dictează"}
            title={listening ? "Oprește dictarea" : "Dictează (vorbește în română)"}
            className={`shrink-0 h-[38px] w-[38px] rounded-lg border flex items-center justify-center transition-colors ${
              listening
                ? "border-red-500 bg-red-500/20 text-red-300 animate-pulse"
                : "border-neutral-700 bg-neutral-900 text-neutral-400 hover:text-white hover:border-neutral-500"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0" />
              <line x1="12" y1="17" x2="12" y2="22" />
            </svg>
          </button>
        )}
      </div>
      {listening && (
        <p className="text-xs text-red-300" aria-live="polite">
          Te ascult… {interim && <span className="text-neutral-400 italic">{interim}</span>}
        </p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
