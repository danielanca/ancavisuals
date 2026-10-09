// Kilometres are the total distance, including the return trip.
export function estimateContractTransport(
  km: number,
  fuelPrice: number,
  currency: string,
  eurRate: number,
): number | null {
  if (!Number.isFinite(km) || km < 0 || !Number.isFinite(fuelPrice) || fuelPrice <= 0) return null;
  const costRon = km * 6 / 100 * fuelPrice;
  if (currency === "RON") return Math.ceil(costRon);
  if (currency === "EUR" && Number.isFinite(eurRate) && eurRate > 0) return Math.ceil(costRon / eurRate);
  return null;
}
