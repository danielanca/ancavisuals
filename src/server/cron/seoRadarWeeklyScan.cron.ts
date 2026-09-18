import cron from "node-cron";
import { firestore } from "../firestore";
import { runSeoScan } from "../routes/seoRadar.routes";
import type { SearchProvider } from "../routes/seoRadar.routes";

const LINKED_COLLECTION = "seoRadarLinkedPosts";

// Rescanează automat toate cuvintele cheie legate de cel puțin un articol publicat, ca
// graficul de evoluție a poziției să se completeze singur, fără rescanare manuală din UI.
async function runWeeklyScan(): Promise<void> {
  const snapshot = await firestore().collection(LINKED_COLLECTION).get();

  const targets = new Map<string, { keyword: string; city: string; provider: SearchProvider }>();
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const key = String(data.queryKey ?? "");
    const keyword = String(data.keyword ?? "").trim();
    if (!key || !keyword || targets.has(key)) return;
    targets.set(key, {
      keyword,
      city: String(data.city ?? "").trim(),
      provider: data.provider === "dataforseo" ? "dataforseo" : "serpapi",
    });
  });

  for (const { keyword, city, provider } of targets.values()) {
    try {
      await runSeoScan(keyword, city, provider);
    } catch (error) {
      console.error(`[seo-radar-weekly-scan] failed for "${keyword}" (${city || "—"}, ${provider}):`, error);
    }
    // Pauză între cereri ca să nu lovim limitele de rată ale providerului API.
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

export function startSeoRadarWeeklyScanCron(): void {
  // În fiecare luni la 06:00.
  cron.schedule("0 6 * * 1", () => {
    runWeeklyScan().catch((error) => console.error("[seo-radar-weekly-scan] run failed:", error));
  });
}
