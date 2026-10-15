import cron from "node-cron";
import { firestore } from "../firestore";
import { adminUser } from "../constants/credentials";
import { APP_BASE_URL } from "../constants/domain";
import { blockEmail, sendViaFunnel } from "../notifications/emailFunnel";
import { createTaskEmailActionToken, TASK_EMAIL_ACTIONS } from "../services/clientTaskEmailActions";
import { logActivityOnce } from "../services/activity.service";

const OVERDUE_GRACE_MS = 2 * 60 * 60_000;

const clock = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Bucharest", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

// Compare wall-clock minutes, just like the timeline, including blocks across days/DST.
export function overdueSchedule(data: Record<string, unknown>, now: Date) {
  if (data.status !== "todo" && data.status !== "doing") return null;
  if (Number(data.timelineReminderSnoozedUntil ?? 0) > now.getTime()) return null;
  const { plannedFor, scheduledStart } = data;
  if (typeof plannedFor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(plannedFor) ||
      typeof scheduledStart !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(scheduledStart)) return null;
  const duration = data.durationMin ?? 60;
  if (typeof duration !== "number" || !Number.isInteger(duration) || duration < 5 || duration > 10080) return null;
  const start = new Date(`${plannedFor}T${scheduledStart}:00Z`);
  if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== plannedFor) return null;
  const parts = Object.fromEntries(clock.formatToParts(now).map(p => [p.type, p.value]));
  const wallNow = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`);
  const end = new Date(start.getTime() + duration * 60_000);
  if (wallNow < end.getTime() + OVERDUE_GRACE_MS) return null;
  return { key: `${plannedFor}/${scheduledStart}/${duration}`, end: end.toISOString().slice(0, 16).replace("T", " ") };
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function checkOverdueClientTasks(now = new Date()) {
  const db = firestore();
  const snapshot = await db.collection("clientTasks").where("status", "in", ["todo", "doing"]).get();
  for (const doc of snapshot.docs) {
    const initial = doc.data();
    const schedule = overdueSchedule(initial, now);
    // Already delivered schedules are not pending notifications.
    if (!schedule || initial.timelineReminderSentKey === schedule.key) continue;
    const email = {
      kind: "notification" as const, to: adminUser.email, source: "client-task-overdue",
      subject: `⏰ Task nefăcut: ${String(initial.title ?? "Task")}`,
    };
    try {
      const actionToken = createTaskEmailActionToken(schedule.key, now);
      // Re-read before sending; the transaction also coordinates multiple server processes.
      const claimed = await db.runTransaction(async tx => {
        const fresh = await tx.get(doc.ref);
        const data = fresh.data();
        if (!data || overdueSchedule(data, now)?.key !== schedule.key ||
            data.timelineReminderSentKey === schedule.key ||
            Number(data.timelineReminderLeaseUntil ?? 0) > now.getTime()) return null;
        tx.update(doc.ref, { timelineReminderLeaseUntil: now.getTime() + 5 * 60_000, ...actionToken.fields });
        return data;
      });
      if (!claimed) {
        await blockEmail(email, "duplicate", "Task actualizat sau notificare preluată de alt proces.");
        continue;
      }
      await sendViaFunnel({
        ...email, subject: `⏰ Task nefăcut: ${String(claimed.title ?? "Task")}`,
        html: `<div style="font-family:sans-serif;max-width:560px;margin:auto;padding:24px">
          <h2>Task rămas nefăcut</h2>
          <p>Au trecut cel puțin 2 ore de la sfârșitul intervalului din timeline, dar taskul nu este bifat ca făcut.</p>
          <h3>${escapeHtml(claimed.title)}</h3>
          ${claimed.clientName ? `<p>Client: ${escapeHtml(claimed.clientName)}</p>` : ""}
          <p>Programat: ${escapeHtml(claimed.plannedFor)} ${escapeHtml(claimed.scheduledStart)}<br>
          Sfârșit: ${schedule.end} (ora Bucureștiului)</p>
          ${Object.entries(TASK_EMAIL_ACTIONS).map(([action, label]) => `<p><a style="display:inline-block;background:${action === "done" ? "#15803d" : "#171717"};color:white;padding:14px 20px;border-radius:8px;text-decoration:none" href="${escapeHtml(APP_BASE_URL)}/api/task-email-actions/${encodeURIComponent(doc.id)}/${action}?token=${actionToken.token}">${label}</a></p>`).join("")}
          <p><a href="${escapeHtml(APP_BASE_URL)}/admin/taskuri">Deschide taskurile clienților</a></p>
        </div>`,
      });
      // The email may already have been acted on while SMTP was completing.
      await db.runTransaction(async tx => {
        const fresh = await tx.get(doc.ref);
        if (fresh.data()?.timelineActionTokenHash === actionToken.fields.timelineActionTokenHash) {
          tx.update(doc.ref, { timelineReminderSentKey: schedule.key, timelineReminderSentAt: now.toISOString(), timelineReminderLeaseUntil: 0 });
        }
      });
      await logActivityOnce(`task-overdue:${doc.id}:${schedule.key}`, {
        type: "task_overdue",
        title: `Task întârziat: ${String(claimed.title ?? "Task")}`,
        description: `${String(claimed.clientName ?? "Fără client")} · programat ${schedule.end}`,
        metadata: { taskId: doc.id, route: "/admin/taskuri" },
        emailSent: true,
      });
    } catch (error) {
      // A failed send is retried after the lease expires; one failure must not block other tasks.
      console.error(`[client tasks cron] ${doc.id}:`, error);
    }
  }
}

export function startClientTasksCron() {
  cron.schedule("* * * * *", () => {
    void checkOverdueClientTasks().catch(error => console.error("[client tasks cron]", error));
  });
}
