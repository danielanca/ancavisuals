import { firestore } from "../firestore";
import { sendBankTransferEmail } from "../notifications/templates/contractEmail";
import { getBnrLatestRate } from "./bnrExchangeRate.service";

// Owner (2026-10-28): after a client signs a contract paid by bank transfer, they — and the owner,
// as a copy — get an email with where and what to pay, 4 minutes after the signed-contract email.
// Signing sets `bankTransferEmailDueAt`; the contractBankTransfer cron sends what is due.

export const BANK_TRANSFER = "Transfer bancar";
export const BANK_TRANSFER_EMAIL_DELAY_MS = 4 * 60_000;
const LEASE_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;

export function paysByBankTransfer(contract: Record<string, unknown>): boolean {
  return (contract.paymentMethod ?? BANK_TRANSFER) === BANK_TRANSFER;
}

async function getAdminBankDetails() {
  const settingsDoc = await firestore().collection("settings").doc("admin").get();
  const bankDetails = settingsDoc.data()?.bankDetails as Record<string, unknown> | undefined;
  return {
    beneficiaryName: String(bankDetails?.beneficiaryName ?? "").trim(),
    iban: String(bankDetails?.iban ?? "").trim(),
  };
}

/** Sends the email (client + copy to the owner). False when there is nothing to send (cash, no IBAN, no amount). */
export async function sendBankTransferDetails(contract: Record<string, unknown>): Promise<boolean> {
  if (!paysByBankTransfer(contract) || !contract.clientEmail) return false;
  const settings = await getAdminBankDetails();
  // The account picked when the contract was made; the one in settings otherwise.
  const iban = String(contract.bankIban ?? "").trim() || settings.iban;
  const beneficiaryName = String(contract.bankBeneficiaryName ?? "").trim() || settings.beneficiaryName;
  if (!iban || !beneficiaryName) return false;

  const isAdvance = contract.noAdvance !== true && Number(contract.priceAdvance) > 0;
  const amount = isAdvance ? Number(contract.priceAdvance) : Number(contract.priceTotal ?? 0);
  if (!(amount > 0)) return false;
  const currency = String(contract.currency ?? "RON");
  // Today's BNR rate (the latest published one); without it the email simply skips the lei line.
  const bnr = currency.toUpperCase() === "EUR" ? await getBnrLatestRate("EUR").catch(() => undefined) : undefined;

  await sendBankTransferEmail({
    to: String(contract.clientEmail),
    clientName: String(contract.clientName ?? ""),
    eventType: String(contract.eventType ?? ""),
    eventDate: String(contract.eventDate ?? ""),
    beneficiaryName,
    iban,
    amount,
    currency,
    isAdvance,
    dueDate: String((isAdvance ? contract.advancePaidAt : contract.restPaidAt) ?? "").trim() || undefined,
    eurRate: bnr?.rate,
    eurRateDate: bnr?.date,
  });
  return true;
}

/** Sends every bank-transfer email that is due. One process claims each contract (lease). */
export async function sendDueBankTransferEmails(now = new Date()): Promise<void> {
  const db = firestore();
  const due = await db.collection("contracts").where("bankTransferEmailDueAt", "<=", now.toISOString()).get();
  for (const doc of due.docs) {
    try {
      const claimed = await db.runTransaction(async (tx) => {
        const fresh = await tx.get(doc.ref);
        const data = fresh.data();
        if (!data?.bankTransferEmailDueAt || Number(data.bankTransferEmailLeaseUntil ?? 0) > now.getTime()) return null;
        tx.update(doc.ref, { bankTransferEmailLeaseUntil: now.getTime() + LEASE_MS });
        return data;
      });
      if (!claimed) continue;

      // A contract un-signed or switched to cash in the meantime: drop it quietly.
      const sent = claimed.status === "signed" ? await sendBankTransferDetails({ id: doc.id, ...claimed }) : false;
      await doc.ref.update({
        bankTransferEmailDueAt: null,
        bankTransferEmailLeaseUntil: 0,
        ...(sent ? { bankTransferEmailSentAt: now.toISOString() } : {}),
      });
    } catch (error) {
      // Retried after the lease; a few failures in a row give up instead of retrying forever.
      console.error(`[contract bank transfer] ${doc.id}:`, error);
      const attempts = Number(doc.data().bankTransferEmailAttempts ?? 0) + 1;
      await doc.ref
        .update(attempts >= MAX_ATTEMPTS
          ? { bankTransferEmailDueAt: null, bankTransferEmailAttempts: attempts, bankTransferEmailFailedAt: now.toISOString() }
          : { bankTransferEmailAttempts: attempts })
        .catch(() => undefined);
    }
  }
}
