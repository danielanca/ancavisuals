import cron from "node-cron";
import { sendDueBankTransferEmails } from "../services/contractBankTransfer";

/** Every minute: the payment-details emails due 4 minutes after a contract was signed. */
export function startContractBankTransferCron() {
  cron.schedule("* * * * *", () => {
    void sendDueBankTransferEmails().catch((error) => console.error("[contract bank transfer cron]", error));
  });
}
