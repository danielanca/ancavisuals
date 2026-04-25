import cron from "node-cron";
import { firestore } from "../firestore";
import { Timestamp } from "firebase-admin/firestore";
import { sendEmail } from "../notifications/mailer";
import { ERRORS_COLLECTION } from "../monitoring/serverMonitor";

const ADMIN_EMAIL = "ancadaniel1994@gmail.com";

export async function sendErrorsDigest(): Promise<void> {
  try {
    const snapshot = await firestore()
      .collection(ERRORS_COLLECTION)
      .where("seen", "==", false)
      .orderBy("capturedAt", "desc")
      .limit(50)
      .get();

    if (snapshot.empty) {
      console.log("[errors cron] Nicio eroare nevăzută, email nu s-a trimis.");
      return;
    }

    const errors = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        message: data.message as string,
        source: data.source as string,
        severity: data.severity as string,
        page: data.page as string,
        capturedAt: (data.capturedAt as Timestamp)?.toDate(),
      };
    });

    const errorCount = errors.filter((e) => e.severity === "error").length;
    const warnCount = errors.filter((e) => e.severity === "warn").length;
    const serverCount = errors.filter((e) => e.source === "server").length;
    const clientCount = errors.filter((e) => e.source === "client").length;
    const total = snapshot.size;

    const rowsHtml = errors.slice(0, 20).map((error) => {
      const severityColor = error.severity === "error" ? "#dc2626" : "#d97706";
      const sourceColor = error.source === "client" ? "#3b82f6" : "#8b5cf6";
      const time = error.capturedAt
        ? error.capturedAt.toLocaleString("ro-RO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
        : "-";
      const safeMessage = (error.message ?? "").slice(0, 120)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

      return `
        <tr style="border-bottom:1px solid #1f2937;">
          <td style="padding:8px;white-space:nowrap;vertical-align:top;">
            <span style="color:${severityColor};font-weight:700;font-size:11px;text-transform:uppercase;">${error.severity}</span>
          </td>
          <td style="padding:8px;white-space:nowrap;vertical-align:top;">
            <span style="color:${sourceColor};font-size:11px;text-transform:uppercase;">${error.source}</span>
          </td>
          <td style="padding:8px;font-size:12px;font-family:monospace;color:#d1d5db;word-break:break-word;vertical-align:top;">${safeMessage}</td>
          <td style="padding:8px;white-space:nowrap;font-size:11px;color:#6b7280;vertical-align:top;">${time}</td>
        </tr>`;
    }).join("");

    await sendEmail({
      to: ADMIN_EMAIL,
      subject: `[AncaVisuals] ${errorCount > 0 ? "🔴" : "🟡"} ${total} erori nevăzute pe server`,
      html: `
        <div style="font-family:sans-serif;max-width:720px;margin:0 auto;padding:24px;background:#0f0f0f;color:#e5e7eb;">
          <h2 style="color:${errorCount > 0 ? "#dc2626" : "#d97706"};margin:0 0 4px;">
            ${errorCount > 0 ? "🔴" : "🟡"} Erori nevăzute — AncaVisuals
          </h2>
          <p style="color:#6b7280;font-size:13px;margin:0 0 24px;">
            Ai ${total} erori nevăzute. Intră în <strong>/admin/errors</strong> pentru a le marca ca văzute.
          </p>

          <div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;">
            <div style="background:#1f1f1f;border:1px solid #2d2d2d;border-radius:10px;padding:12px 20px;text-align:center;min-width:80px;">
              <div style="font-size:22px;font-weight:700;color:#dc2626;">${errorCount}</div>
              <div style="color:#9ca3af;font-size:11px;margin-top:2px;">Errors</div>
            </div>
            <div style="background:#1f1f1f;border:1px solid #2d2d2d;border-radius:10px;padding:12px 20px;text-align:center;min-width:80px;">
              <div style="font-size:22px;font-weight:700;color:#d97706;">${warnCount}</div>
              <div style="color:#9ca3af;font-size:11px;margin-top:2px;">Warnings</div>
            </div>
            <div style="background:#1f1f1f;border:1px solid #2d2d2d;border-radius:10px;padding:12px 20px;text-align:center;min-width:80px;">
              <div style="font-size:22px;font-weight:700;color:#8b5cf6;">${serverCount}</div>
              <div style="color:#9ca3af;font-size:11px;margin-top:2px;">Server</div>
            </div>
            <div style="background:#1f1f1f;border:1px solid #2d2d2d;border-radius:10px;padding:12px 20px;text-align:center;min-width:80px;">
              <div style="font-size:22px;font-weight:700;color:#3b82f6;">${clientCount}</div>
              <div style="color:#9ca3af;font-size:11px;margin-top:2px;">Client</div>
            </div>
          </div>

          <table style="border-collapse:collapse;width:100%;margin-bottom:24px;">
            <thead>
              <tr style="background:#1f1f1f;">
                <th style="padding:8px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;">Nivel</th>
                <th style="padding:8px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;">Sursă</th>
                <th style="padding:8px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;">Mesaj</th>
                <th style="padding:8px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;">Când</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>

          ${total > 20 ? `<p style="color:#6b7280;font-size:12px;">... și încă ${total - 20} erori. Vezi toate în /admin/errors.</p>` : ""}

          <p style="color:#4b5563;font-size:11px;border-top:1px solid #1f2937;padding-top:16px;margin:0;">
            Emailul se trimite o dată la 3 zile dacă există erori nevăzute. Marchează-le ca văzute în admin pentru a opri notificările.
          </p>
        </div>
      `,
    });

    console.log(`[errors cron] Digest trimis: ${total} erori nevăzute`);
  } catch (error) {
    console.error("[errors cron] Eroare:", error);
  }
}

export function startErrorsCron(): void {
  // La fiecare 3 zile la 09:00 (zilele 1, 4, 7, 10...)
  cron.schedule("0 9 */3 * *", sendErrorsDigest);
  console.log("[errors cron] Pornit — la fiecare 3 zile 09:00");
}
