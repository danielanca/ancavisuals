// src/booking/utils/normalize.ts
import type { PkgInfo } from '../types';

export function normalizePackages(rawList: any[]): PkgInfo[] {
  const out = (rawList || []).map(raw => {
    const id = String(raw.id ?? raw.key ?? raw.slug ?? raw.code ?? raw.title ?? raw.label).trim();
    const title = String(raw.title ?? raw.label ?? raw.name ?? id).trim();
    const priceNum = Number(raw.price ?? raw.amount ?? raw.cost ?? 0);
    const price = Number.isFinite(priceNum) ? priceNum : 0;
    const note = (raw.note ?? raw.description ?? raw.details ?? '') as string | undefined;
    const recommended = Boolean(raw.recommended ?? raw.isRecommended ?? raw.featured);
    return { id, title, price, note, recommended };
  });

  const seen = new Set<string>();
  for (const p of out) {
    if (seen.has(p.id)) throw new Error(`[PackageTiles] id duplicat: ${p.id}`);
    seen.add(p.id);
  }
  return out;
}
