/*
 * Purpose: the "received" half of /admin/email-log. Every few minutes the site's mailbox
 * (Zoho, same account and app password as SMTP, IMAP) is read and only the REPLIES to emails the
 * site sent are copied into `emailLog` (direction "in"): a message that answers one of our
 * Message-IDs, or comes from an address the site has written to. Everything else in the inbox is
 * left alone (owner's choice: "doar ce trimite și primește site-ul").
 */
import { createHash } from "node:crypto";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { firestore } from "../firestore";
import { emailAuth } from "../constants/credentials";
import { EMAIL_LOG } from "./emailLog.service";

const IMAP_HOST = process.env.IMAP_HOST || "imappro.zoho.eu";
const IMAP_PORT = Number(process.env.IMAP_PORT || 993);
const stateDoc = () => firestore().collection("emailInboxSync").doc("inbox");
/** The first sync only looks this far back. */
const FIRST_SYNC_DAYS = 30;
const MAX_HTML = 200_000;
const MAX_TEXT = 20_000;
/** Our own addresses: a message from these is never "a reply from someone the site wrote to". */
const OWN_ADDRESSES = new Set(["ancadaniel1994@gmail.com"]);

export type InboxSyncResult = { checked: number; saved: number; skipped: number };

type StoredState = { uidValidity?: string; lastUid?: number; lastSyncAt?: string; lastError?: string | null };

const normalizeAddress = (value: string) => value.trim().toLowerCase();
const stripBrackets = (id: string) => id.trim().replace(/^<|>$/g, "");

/** Same Message-ID → same document: a message synced twice is stored once. */
export const inboxDocId = (messageId: string) => `in-${createHash("sha1").update(stripBrackets(messageId)).digest("hex").slice(0, 24)}`;

/** The emailLog id of the email this one answers (In-Reply-To first, then References), if the site sent it. */
async function findRepliedLogId(messageIds: string[]): Promise<string | null> {
  for (const id of messageIds) {
    const bare = stripBrackets(id);
    if (!bare) continue;
    for (const candidate of [`<${bare}>`, bare]) {
      const snapshot = await firestore().collection(EMAIL_LOG).where("messageId", "==", candidate).limit(1).get();
      if (!snapshot.empty) return snapshot.docs[0].id;
    }
  }
  return null;
}

async function siteHasWrittenTo(address: string): Promise<boolean> {
  if (!address || OWN_ADDRESSES.has(address) || address === normalizeAddress(emailAuth.email)) return false;
  const snapshot = await firestore().collection(EMAIL_LOG).where("to", "==", address).limit(1).get();
  return !snapshot.empty;
}

export async function syncEmailInbox(): Promise<InboxSyncResult> {
  if (!emailAuth.email || !emailAuth.password) throw new Error("SMTP_SENDER_EMAIL / SMTP_APP_PASSWORD lipsesc.");
  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: { user: emailAuth.email, pass: emailAuth.password },
    logger: false,
  });
  const result: InboxSyncResult = { checked: 0, saved: 0, skipped: 0 };
  const state = ((await stateDoc().get()).data() ?? {}) as StoredState;

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const mailbox = client.mailbox;
      const uidValidity = mailbox ? String(mailbox.uidValidity) : "";
      const sameMailbox = state.uidValidity === uidValidity && typeof state.lastUid === "number";
      const uids = sameMailbox
        ? ((await client.search({ uid: `${state.lastUid! + 1}:*` }, { uid: true })) || []).filter((uid) => uid > state.lastUid!)
        : (await client.search({ since: new Date(Date.now() - FIRST_SYNC_DAYS * 86_400_000) }, { uid: true })) || [];

      let lastUid = sameMailbox ? state.lastUid! : 0;
      for (const uid of uids) {
        lastUid = Math.max(lastUid, uid);
        result.checked += 1;
        const message = await client.fetchOne(String(uid), { source: true }, { uid: true });
        if (!message || !message.source) { result.skipped += 1; continue; }
        const parsed = await simpleParser(message.source);
        const from = normalizeAddress(parsed.from?.value[0]?.address ?? "");
        const messageId = parsed.messageId ?? `uid-${uidValidity}-${uid}`;
        const references = [
          ...(parsed.inReplyTo ? [parsed.inReplyTo] : []),
          ...(Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : []),
        ];
        const repliedLogId = await findRepliedLogId(references);
        if (!repliedLogId && !(await siteHasWrittenTo(from))) { result.skipped += 1; continue; }

        const toAddresses = (Array.isArray(parsed.to) ? parsed.to : parsed.to ? [parsed.to] : [])
          .flatMap((group) => group.value.map((entry) => entry.address ?? ""))
          .filter(Boolean);
        await firestore().collection(EMAIL_LOG).doc(inboxDocId(messageId)).set({
          direction: "in",
          status: "received",
          severity: "ok",
          source: "reply",
          from,
          to: toAddresses.join(", ") || emailAuth.email,
          subject: parsed.subject ?? "(fără subiect)",
          html: (typeof parsed.html === "string" ? parsed.html : "").slice(0, MAX_HTML),
          text: (parsed.text ?? "").slice(0, MAX_TEXT),
          attachments: parsed.attachments.map((attachment) => attachment.filename ?? "fișier"),
          messageId,
          inReplyToLogId: repliedLogId,
          createdAt: (parsed.date ?? new Date()).toISOString(),
          syncedAt: new Date().toISOString(),
        }, { merge: true });
        result.saved += 1;
      }
      await stateDoc().set({ uidValidity, lastUid, lastSyncAt: new Date().toISOString(), lastError: null }, { merge: true });
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (error) {
    await stateDoc().set({ lastError: error instanceof Error ? error.message : String(error), lastErrorAt: new Date().toISOString() }, { merge: true }).catch(() => {});
    client.close();
    throw error;
  }
  return result;
}

export async function getInboxSyncState(): Promise<StoredState> {
  return ((await stateDoc().get()).data() ?? {}) as StoredState;
}
