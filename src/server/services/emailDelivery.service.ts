import { firestore } from "../firestore";

export const EMAIL_DELIVERIES = "emailDeliveries";
export type EmailDeliveryStatus = "pending" | "accepted" | "failed" | "unknown";

// Never persist SMTP responses, credentials or message bodies in the dashboard.
export function describeEmailError(error: unknown): string {
  const e = error as { code?: string; responseCode?: number } | null;
  if (e?.code === "EAUTH" || e?.responseCode === 535) return "Autentificare SMTP refuzată. Verifică adresa expeditorului și parola de aplicație pe server.";
  if (e?.responseCode && e.responseCode >= 400 && e.responseCode < 500) return "Serverul de email a refuzat temporar mesajul.";
  if (e?.responseCode && e.responseCode >= 500) return "Serverul de email a respins mesajul sau destinatarul.";
  if (e?.code === "ETIMEDOUT" || e?.code === "ECONNECTION" || e?.code === "ESOCKET") return "Conexiunea SMTP a fost întreruptă. Acceptarea mesajului nu este confirmată.";
  return "Trimiterea emailului nu a putut fi confirmată. Verifică configurația SMTP și logul serverului.";
}

export function canRetryEmail(error: unknown): boolean {
  const e = error as { responseCode?: number; code?: string } | null;
  return e?.code !== "EAUTH" && typeof e?.responseCode === "number" && e.responseCode >= 400 && e.responseCode < 500;
}

export async function recordEmailDelivery(id: string, data: Record<string, unknown>): Promise<void> {
  try {
    await firestore().collection(EMAIL_DELIVERIES).doc(id).set({ ...data, updatedAt: new Date().toISOString() }, { merge: true });
  } catch {
    // A history outage must never turn an SMTP success into a retry/duplicate.
    console.error("[email-history] Could not persist delivery status", id);
  }
}

export async function getEmailDeliveries() {
  const snapshot = await firestore().collection(EMAIL_DELIVERIES).orderBy("createdAt", "desc").limit(30).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export type EmailAlert = { id: string; occurredAt: string; error: string; subject: string; to: string; diagnostic?: string };
let memoryAlert: EmailAlert | null = null;
const alertRef = () => firestore().collection("admin_settings").doc("email_alert");

export async function raiseEmailAlert(input: Omit<EmailAlert, "occurredAt">): Promise<void> {
  const alert = { ...input, occurredAt: new Date().toISOString() };
  memoryAlert = alert;
  try { await alertRef().set({ alert }); }
  catch { console.error("[email-alert] Persistent storage unavailable; alert retained in this process"); }
}

export async function getEmailAlert(): Promise<EmailAlert | null> {
  try {
    const snapshot = await alertRef().get();
    const saved = snapshot.data()?.alert as EmailAlert | null | undefined;
    if (memoryAlert && (!saved || memoryAlert.occurredAt > saved.occurredAt)) return memoryAlert;
    return saved ?? null;
  } catch (error) {
    if (memoryAlert) return memoryAlert;
    throw error;
  }
}

export async function acknowledgeEmailAlert(id: string): Promise<void> {
  await firestore().runTransaction(async transaction => {
    const ref = alertRef();
    const snapshot = await transaction.get(ref);
    if (snapshot.data()?.alert?.id === id) transaction.set(ref, { alert: null });
  });
  if (memoryAlert?.id === id) memoryAlert = null;
}


/** Admin-only diagnostics, scrubbed before persistence. */
export function emailErrorDiagnostic(error: unknown): string {
  const e = error as { name?: string; message?: string; code?: string; responseCode?: number; command?: string; response?: string; stack?: string } | null;
  let text = [
    `name: ${e?.name ?? "Error"}`, `message: ${e?.message ?? "SMTP failure"}`,
    `code: ${e?.code ?? ""}`, `responseCode: ${e?.responseCode ?? ""}`,
    `command: ${e?.command ?? ""}`, `response: ${e?.response ?? ""}`,
    e?.stack ?? "Stack trace indisponibil.",
  ].join("\n");
  for (const [key, value] of Object.entries(process.env)) {
    if (!/password|secret|token|credential|private|api.?key|service_account/i.test(key) || !value || value.length < 4) continue;
    for (const secret of [value, value.replace(/\s+/g, "")]) {
      if (secret.length >= 4) text = text.split(secret).join("[REDACTED]");
    }
  }
  text = text.replace(/(AUTH\s+(?:PLAIN|LOGIN|XOAUTH2))[^\r\n]*/gi, "$1 [REDACTED]")
    .replace(/(Bearer\s+)\S+/gi, "$1[REDACTED]")
    .replace(/((?:password|passwd|token|secret|api[_-]?key)\s*[=:]\s*)[^\s&,;]+/gi, "$1[REDACTED]")
    .replace(/(smtps?:\/\/)[^@\s]+@/gi, "$1[REDACTED]@");
  return text.slice(0, 12000);
}
