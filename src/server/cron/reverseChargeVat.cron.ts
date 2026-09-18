import cron from "node-cron";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { sendEmail } from "../notifications/mailer";
import { adminUser } from "../constants/credentials";
import { buildReverseChargeVatHtml, buildReverseChargeVatSubject } from "../notifications/templates/reverseChargeVatTemplate";
import { isReverseChargeSupplier, STANDARD_VAT_RATE } from "../../shared/finance/reverseChargeSuppliers";

const EXPENSES_COLLECTION = "expenses";
const SETTINGS_DOC = "reverseChargeVatReminders";
// Decontul special de TVA (D301) e scadent pe 25 ale lunii următoare celei în care
// a fost primit serviciul — trimitem reminder-ul într-o fereastră înainte de termen,
// nu în fiecare zi, ca să nu spamăm și să lăsăm timp de reacție.
const REMINDER_WINDOW_START_DAY = 18;
const REMINDER_WINDOW_END_DAY = 25;

const MONTHS_RO = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];

function periodKeyFor(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

async function checkAndSendReverseChargeVatReminder(): Promise<void> {
  try {
    const now = new Date();
    const day = now.getDate();
    if (day < REMINDER_WINDOW_START_DAY || day > REMINDER_WINDOW_END_DAY) return;

    // Perioada care trebuie declarată e luna anterioară celei curente.
    const periodDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const periodKey = periodKeyFor(periodDate);

    const db = firestore();
    const settingsRef = db.collection("settings").doc(SETTINGS_DOC);
    const settingsDoc = await settingsRef.get();
    if (settingsDoc.exists && settingsDoc.data()?.lastSentPeriod === periodKey) return; // deja verificat/trimis pentru luna asta

    const startDate = new Date(periodDate.getFullYear(), periodDate.getMonth(), 1);
    const endDate = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 1);

    const [expensesSnap, adminSettingsDoc] = await Promise.all([
      db.collection(EXPENSES_COLLECTION)
        .where("date", ">=", Timestamp.fromDate(startDate))
        .where("date", "<", Timestamp.fromDate(endDate))
        .get(),
      db.collection("settings").doc("admin").get(),
    ]);

    const exchangeRate = Number(adminSettingsDoc.data()?.exchangeRate) || 5;

    const lines: { date: string; supplier: string; amountRon: number }[] = [];
    const skippedLines: { date: string; supplier: string; amount: number; currency: string }[] = [];
    for (const doc of expensesSnap.docs) {
      const data = doc.data();
      const supplier = String(data.supplier ?? "");
      if (!isReverseChargeSupplier(supplier)) continue;
      const amount = Number(data.amount ?? 0);
      const currency = String(data.currency ?? "RON");
      const date = data.date instanceof Timestamp ? data.date.toDate() : new Date();
      // Cheltuielile ar trebui să fie deja în RON sau EUR (USD se convertește la RON
      // la introducere) — dacă găsim altă monedă, nu ghicim cursul, o semnalăm separat.
      if (currency !== "RON" && currency !== "EUR") {
        skippedLines.push({ date: date.toLocaleDateString("ro-RO"), supplier, amount, currency });
        continue;
      }
      const amountRon = currency === "EUR" ? amount * exchangeRate : amount;
      lines.push({ date: date.toLocaleDateString("ro-RO"), supplier, amountRon });
    }

    if (lines.length === 0 && skippedLines.length === 0) {
      await settingsRef.set({ lastSentPeriod: periodKey, lastCheckedAt: Timestamp.now(), hadExpenses: false }, { merge: true });
      return;
    }

    const taxableBaseRon = Math.round(lines.reduce((sum, l) => sum + l.amountRon, 0) * 100) / 100;
    const vatAmountRon = Math.round(taxableBaseRon * STANDARD_VAT_RATE * 100) / 100;
    const periodLabel = `${MONTHS_RO[periodDate.getMonth()]} ${periodDate.getFullYear()}`;
    const deadlineLabel = `25 ${MONTHS_RO[now.getMonth()]} ${now.getFullYear()}`;

    if (!adminUser.email) {
      console.error("[reverse-charge vat cron] ADMIN_NOTIFICATION_EMAIL nu e setat — nu pot trimite reminder-ul.");
      return;
    }

    const emailData = { periodLabel, deadlineLabel, taxableBaseRon, vatRate: STANDARD_VAT_RATE, vatAmountRon, lines, skippedLines };
    await sendEmail({
      to: adminUser.email,
      subject: buildReverseChargeVatSubject(emailData),
      html: buildReverseChargeVatHtml(emailData),
    });

    await settingsRef.set({ lastSentPeriod: periodKey, lastSentAt: Timestamp.now(), hadExpenses: true, taxableBaseRon, vatAmountRon }, { merge: true });
    console.log(`[reverse-charge vat cron] Reminder sent for ${periodLabel} — base ${taxableBaseRon} RON, VAT ${vatAmountRon} RON`);
  } catch (error) {
    console.error("[reverse-charge vat cron] Fatal error:", error);
  }
}

export function startReverseChargeVatCron(): void {
  cron.schedule("0 9 * * *", () => {
    void checkAndSendReverseChargeVatReminder();
  });
  console.log("[reverse-charge vat cron] Started - daily at 09:00, reminder window: 18-25 of each month");
}
