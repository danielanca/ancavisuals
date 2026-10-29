import { useEffect, useState } from "react";

// Real, fixed promo deadline — does not reset per visit/session, unlike the
// old spin-the-wheel countdown. Honest scarcity: shared end date for everyone.
export const PROMO_DEADLINE = new Date("2026-10-30T23:59:59").getTime();

/**
 * Owner, 2026-10-29: the free photo booth / videobooth offer is off for now (both cost 200 €).
 * Off = no "gratuit" badge or note, no list of contracts signed with it, nothing fetched.
 * Turn it back on here (with a new PROMO_DEADLINE) when the offer returns.
 */
export const FREE_PHOTOBOOTH_PROMO_ON = false;

export interface FreePhotoboothReservation { maskedName: string; city: string; signedAt: string }

export interface FreePhotoboothOffer {
  /** null while loading or after an error. */
  contracts: FreePhotoboothReservation[] | null;
  totalSlots: number | null;
  /** Computed by the server from the same contract list, so the page can never show "2 left" next to 5 names. */
  remaining: number | null;
  failed: boolean;
  retry: () => void;
}

const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

export function useFreePhotoboothOffer(): FreePhotoboothOffer {
  const [data, setData] = useState<{ contracts: FreePhotoboothReservation[]; totalSlots: number; remaining: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!FREE_PHOTOBOOTH_PROMO_ON) return;
    const controller = new AbortController();
    setFailed(false);
    fetch("/api/campaign/olx/free-photobooth-contracts", { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error("Unavailable");
        return response.json();
      })
      .then(body => {
        if (!Array.isArray(body.contracts) || !body.contracts.every((item: FreePhotoboothReservation) =>
          item && typeof item.maskedName === "string" && typeof item.city === "string" &&
          typeof item.signedAt === "string" && Number.isFinite(new Date(item.signedAt).getTime()))) {
          throw new Error("Invalid reservations");
        }
        if (!isCount(body.totalSlots) || !isCount(body.remaining)) throw new Error("Invalid slots");
        if (!controller.signal.aborted) setData({ contracts: body.contracts, totalSlots: body.totalSlots, remaining: body.remaining });
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [attempt]);
  return {
    contracts: data?.contracts ?? null,
    totalSlots: data?.totalSlots ?? null,
    remaining: data?.remaining ?? null,
    failed,
    retry: () => setAttempt(value => value + 1),
  };
}

/** The public promo is on only while the deadline hasn't passed AND the server confirms free slots are left. */
export function isPromoOpen(offer: Pick<FreePhotoboothOffer, "remaining">, now: number): boolean {
  return FREE_PHOTOBOOTH_PROMO_ON && now < PROMO_DEADLINE && (offer.remaining ?? 0) > 0;
}

export function remainingSlotsNote(offer: Pick<FreePhotoboothOffer, "remaining" | "totalSlots">): string {
  return `Până pe 30 octombrie · Locuri rămase: ${offer.remaining} din ${offer.totalSlots}`;
}
