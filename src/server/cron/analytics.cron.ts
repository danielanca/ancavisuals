import cron from "node-cron";
import { firestore } from "../firestore";
import { Timestamp } from "firebase-admin/firestore";
import { sendEmail } from "../notifications/mailer";

const ADMIN_EMAIL = "ancadaniel1994@gmail.com";

function parseDevice(ua: string): string {
  if (!ua) return "Necunoscut";
  const mobile = /android|iphone|ipad|mobile/i.test(ua);
  if (/chrome/i.test(ua)) return mobile ? "Chrome Mobile" : "Chrome Desktop";
  if (/firefox/i.test(ua)) return mobile ? "Firefox Mobile" : "Firefox Desktop";
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return mobile ? "Safari Mobile" : "Safari Desktop";
  if (/edg/i.test(ua)) return "Edge";
  return mobile ? "Mobile" : "Desktop";
}

export async function sendWeeklyAnalyticsSummary() {
  try {
    const db = firestore();
    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const snapshot = await db
      .collection("siteVisits")
      .where("timestamp", ">=", Timestamp.fromDate(weekStart))
      .get();

    if (snapshot.empty) {
      console.log("[analytics cron] Nicio vizită săptămâna aceasta, email nu s-a trimis.");
      return;
    }

    const visits = snapshot.docs.map((d) => d.data());
    const totalViews = visits.length;
    const uniqueSessions = new Set(visits.map((v) => v.sessionId)).size;

    // Top pagini
    const pageCount: Record<string, number> = {};
    visits.forEach((v) => {
      pageCount[v.page] = (pageCount[v.page] ?? 0) + 1;
    });
    const topPages = Object.entries(pageCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 7);

    // Top orașe
    const cityCount: Record<string, number> = {};
    visits.forEach((v) => {
      const city = [v.city, v.country].filter(Boolean).join(", ");
      if (city) cityCount[city] = (cityCount[city] ?? 0) + 1;
    });
    const topCities = Object.entries(cityCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    // Device breakdown
    const deviceCount: Record<string, number> = {};
    visits.forEach((v) => {
      const device = parseDevice(v.userAgent ?? "");
      deviceCount[device] = (deviceCount[device] ?? 0) + 1;
    });

    const weekLabel = `${weekStart.toLocaleDateString("ro-RO", { day: "2-digit", month: "short" })} – ${now.toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric" })}`;

    const pagesHtml = topPages
      .map(([page, count], i) => `
        <tr>
          <td style="padding:8px 0;color:#e5e7eb;font-family:monospace;font-size:13px;">${i + 1}. ${page}</td>
          <td style="padding:8px 0;text-align:right;color:#a78bfa;font-weight:600;">${count}</td>
        </tr>`)
      .join("");

    const citiesHtml = topCities
      .map(([city, count]) => `
        <tr>
          <td style="padding:6px 0;color:#e5e7eb;font-size:13px;">${city}</td>
          <td style="padding:6px 0;text-align:right;color:#6b7280;font-size:13px;">${count} vizite</td>
        </tr>`)
      .join("");

    const devicesHtml = Object.entries(deviceCount)
      .sort(([, a], [, b]) => b - a)
      .map(([device, count]) => `
        <tr>
          <td style="padding:6px 0;color:#e5e7eb;font-size:13px;">${device}</td>
          <td style="padding:6px 0;text-align:right;color:#6b7280;font-size:13px;">${count}</td>
        </tr>`)
      .join("");

    await sendEmail({
      to: ADMIN_EMAIL,
      subject: `📊 Raport săptămânal AncaVisuals — ${weekLabel}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#111;color:#e5e7eb;">
          <h2 style="color:#a78bfa;margin:0 0 4px;">📊 Raport Săptămânal</h2>
          <p style="color:#6b7280;font-size:13px;margin:0 0 24px;">${weekLabel}</p>

          <div style="display:flex;gap:16px;margin-bottom:28px;">
            <div style="flex:1;background:#1f1f1f;border:1px solid #2d2d2d;border-radius:12px;padding:16px;text-align:center;">
              <div style="font-size:28px;font-weight:700;color:#a78bfa;">${totalViews}</div>
              <div style="color:#9ca3af;font-size:12px;margin-top:4px;">Page Views</div>
            </div>
            <div style="flex:1;background:#1f1f1f;border:1px solid #2d2d2d;border-radius:12px;padding:16px;text-align:center;">
              <div style="font-size:28px;font-weight:700;color:#34d399;">${uniqueSessions}</div>
              <div style="color:#9ca3af;font-size:12px;margin-top:4px;">Vizitatori Unici</div>
            </div>
          </div>

          <h3 style="color:#f3f4f6;font-size:14px;font-weight:600;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.05em;">Top Pagini</h3>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            ${pagesHtml}
          </table>

          <h3 style="color:#f3f4f6;font-size:14px;font-weight:600;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.05em;">Top Orașe</h3>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            ${citiesHtml}
          </table>

          <h3 style="color:#f3f4f6;font-size:14px;font-weight:600;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.05em;">Dispozitive</h3>
          <table style="width:100%;border-collapse:collapse;margin-bottom:32px;">
            ${devicesHtml}
          </table>

          <p style="color:#4b5563;font-size:12px;border-top:1px solid #1f2937;padding-top:16px;margin:0;">
            AncaVisuals Admin · Raport generat automat în fiecare luni la 09:00
          </p>
        </div>
      `,
    });

    console.log(`[analytics cron] Weekly summary trimis: ${totalViews} views, ${uniqueSessions} sesiuni`);
  } catch (error) {
    console.error("[analytics cron] Eroare:", error);
  }
}

export function startAnalyticsCron() {
  // Luni dimineața la 09:00
  cron.schedule("0 9 * * 1", sendWeeklyAnalyticsSummary);
  console.log("[analytics cron] Pornit — luni 09:00");
}
