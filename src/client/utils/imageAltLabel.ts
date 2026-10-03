export function normalizeAltLabel(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildSeoImageAlt(baseLabel: string, index?: number): string {
  const normalized = normalizeAltLabel(baseLabel);
  if (typeof index === "number") {
    return `${normalized} ${index + 1}`;
  }
  return normalized;
}
