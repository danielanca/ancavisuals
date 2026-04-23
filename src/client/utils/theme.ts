// Main accent colors for the Anca Visuals site
// Use these constants instead of writing Tailwind classes directly

export const ACCENT = {
  // Text
  text: "text-amber-200",
  textMuted: "text-amber-200/70",
  textSubtle: "text-amber-200/50",

  // Background
  bg: "bg-amber-200",
  bgHover: "hover:bg-amber-100",
  bgSubtle: "bg-amber-200/10",
  bgSubtleHover: "hover:bg-amber-200/15",

  // Border
  border: "border-amber-200/30",
  borderHover: "hover:border-amber-200/60",
  borderStrong: "border-amber-200/50",
} as const;
