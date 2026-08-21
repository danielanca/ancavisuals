import catalog from "../../../data/imageAltCatalog.json";

type CatalogRecord = { key: string; alt: string; status: string };

const catalogByKey = new Map((catalog as CatalogRecord[]).map(record => [record.key, record]));

function catalogKey(value: string): string {
  try {
    const url = new URL(value, typeof window !== "undefined" ? window.location.origin : "https://www.ancavisuals.ro");
    for (const parameter of ["width", "height", "quality", "format", "sharpen"]) {
      url.searchParams.delete(parameter);
    }
    return url.toString();
  } catch {
    return value;
  }
}

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

export function getCatalogImageAlt(src: string, fallback: string): string {
  const record = catalogByKey.get(catalogKey(src));
  return record?.status === "generated" && record.alt ? record.alt : fallback;
}
