import React from "react";

type Accent = "emerald" | "sky" | "amber";

// Literal, fully-written class names — Tailwind's JIT scanner needs these
// to appear verbatim in the source to generate the corresponding CSS.
const ACCENT_CLASSES: Record<Accent, string> = {
  emerald: "peer-checked:border-emerald-500 peer-checked:bg-emerald-500 peer-checked:text-white peer-focus-visible:ring-emerald-400/50",
  sky: "peer-checked:border-sky-500 peer-checked:bg-sky-500 peer-checked:text-white peer-focus-visible:ring-sky-400/50",
  amber: "peer-checked:border-amber-500 peer-checked:bg-amber-500 peer-checked:text-white peer-focus-visible:ring-amber-400/50",
};

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  accent?: Accent;
  className?: string;
  "aria-label"?: string;
}

/**
 * Custom checkbox with a visible unchecked state (native checkboxes on dark
 * backgrounds render an almost-invisible outline on iOS/Safari). The real
 * input stays functional and accessible (sr-only), a styled sibling <span>
 * carries the visible box + checkmark via peer-checked.
 */
export default function Checkbox({ checked, onChange, accent = "emerald", className = "", ...aria }: CheckboxProps) {
  return (
    <span className={`relative inline-flex h-4 w-4 shrink-0 ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
        {...aria}
      />
      <span
        className={`pointer-events-none flex h-4 w-4 items-center justify-center rounded border-2 border-neutral-500 bg-neutral-800 text-transparent transition-colors peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-neutral-950 ${ACCENT_CLASSES[accent]}`}
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-2.5 w-2.5">
          <path d="M13.7 4.3a1 1 0 0 1 0 1.4l-6 6a1 1 0 0 1-1.4 0l-3-3a1 1 0 1 1 1.4-1.4L7 9.6l5.3-5.3a1 1 0 0 1 1.4 0z" />
        </svg>
      </span>
    </span>
  );
}
