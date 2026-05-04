import { Router } from "express";
import type { Request, Response } from "express";
import { getAuth } from "firebase-admin/auth";
import { Timestamp } from "firebase-admin/firestore";
import Anthropic from "@anthropic-ai/sdk";
import heicConvert from "heic-convert";
import { jsonrepair } from "jsonrepair";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import { firestore } from "../firestore";
import { sendEmail, getTestEmailMode, setTestEmailMode, isTestTransportAvailable } from "../notifications/mailer";
import { isSmsConfigured, normalizeRomanianPhoneNumber, sendSms } from "../notifications/sms";
import {
  requireFirebaseAuth,
  requireSupremeAdmin,
  requireCoupleAuth,
} from "../middleware/requireFirebaseAuth";
import type {
  AuthenticatedRequest,
  CoupleAuthenticatedRequest,
} from "../middleware/requireFirebaseAuth";
import { seedChecklistDefaults, seedReminderDefaults } from "../utils/seedWeddingDefaults";

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const RSVP_STATUSES = new Set(["asteptare", "confirmat", "refuzat"]);
const MENU_PREFERENCES = new Set(["carne", "vegetarian", "vegan", "mixt"]);
const DECLINE_REASONS = new Set([
  "nu-suntem-in-tara",
  "suntem-plecati",
  "avem-alt-eveniment",
  "motive-personale",
  "probleme-sanatate",
  "nu-putem-confirma",
]);

const DECLINE_REASON_LABELS: Record<string, string> = {
  "nu-suntem-in-tara": "Nu sunt în țară",
  "suntem-plecati": "Sunt plecat în perioada aceea",
  "avem-alt-eveniment": "Am deja un alt eveniment",
  "motive-personale": "Motive personale",
  "probleme-sanatate": "Probleme de sănătate",
  "nu-putem-confirma": "Nu pot confirma prezența",
};

type MessageAudience = "all" | "without-table" | "with-table" | "email-only" | "phone-only" | "both" | "no-contact";

type MessageTemplate = {
  id: string;
  title: string;
  subject: string;
  body: string;
};

type BroadcastFilters = {
  audience: MessageAudience;
  tableId: string | null;
};

type BroadcastStatus = "queued" | "processing" | "sent" | "partial" | "failed";
type BroadcastDeliveryStatus = "sent" | "failed" | "skipped";
type BroadcastChannel = "email" | "sms";
type BroadcastRecipientPlan = {
  guestId: string;
  guestName: string;
  guest: SerializedGuest;
  channels: Array<{
    channel: BroadcastChannel;
    recipient: string;
    fallbackFrom?: BroadcastChannel;
  }>;
  reason?: string;
};

const DEFAULT_MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: "reminder",
    title: "Reminder RSVP",
    subject: "Reminder RSVP",
    body: "Salut! Ne poți confirma dacă vei participa la nuntă? Ne ajută mult pentru organizarea finală.",
  },
  {
    id: "program",
    title: "Program eveniment",
    subject: "Programul pentru ziua nunții",
    body: "Îți trimitem programul pe scurt pentru ziua nunții: ora sosirii, momentul mesei și detaliile importante.",
  },
  {
    id: "dress-code",
    title: "Dress code",
    subject: "Dress code pentru nuntă",
    body: "Un mic reminder despre dress code-ul evenimentului: te rugăm să ții cont de tema aleasă de noi.",
  },
  {
    id: "seating",
    title: "Confirmare masă",
    subject: "Detalii despre masa ta",
    body: "Am actualizat planul de mese și vrem să te ținem la curent cu detaliile alocării tale.",
  },
  {
    id: "follow-up",
    title: "Ultimul follow-up",
    subject: "Ultimul follow-up înainte de eveniment",
    body: "Ne apropiem de eveniment și vrem să ne asigurăm că avem toate detaliile corecte. Mulțumim!",
  },
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMultilineText(value: string): string {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function buildGuestBroadcastEmailHtml(args: {
  guestName: string;
  weddingName: string;
  subject: string;
  message: string;
}): string {
  return `
    <div style="font-family:Arial,sans-serif;background:#111;padding:24px;color:#f5f5f5;">
      <div style="max-width:620px;margin:0 auto;border:1px solid #262626;border-radius:16px;padding:24px;background:#171717;">
        <p style="margin:0 0 6px;color:#fb7185;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;">Wedding Hub</p>
        <h1 style="margin:0 0 18px;font-size:24px;font-weight:400;color:#fff;">${escapeHtml(args.subject)}</h1>
        <p style="margin:0 0 16px;color:#e5e5e5;">Salut, ${escapeHtml(args.guestName)}.</p>
        <div style="border-left:3px solid #fb7185;padding-left:14px;color:#f5f5f5;font-size:15px;line-height:1.7;white-space:normal;">
          ${renderMultilineText(args.message)}
        </div>
        <p style="margin:20px 0 0;color:#737373;font-size:13px;">${escapeHtml(args.weddingName)}</p>
      </div>
    </div>
  `;
}

function buildGuestBroadcastSmsBody(args: { guestName: string; message: string; weddingName: string }): string {
  const trimmedMessage = args.message.trim();
  return `${args.guestName ? `Salut, ${args.guestName}.\n\n` : ""}${trimmedMessage}\n\n${args.weddingName}`;
}

function normalizeMessageTemplate(template: unknown, fallback: MessageTemplate): MessageTemplate {
  if (!template || typeof template !== "object") return fallback;
  const candidate = template as Partial<MessageTemplate>;
  return {
    id: typeof candidate.id === "string" && candidate.id.trim() ? candidate.id.trim() : fallback.id,
    title: typeof candidate.title === "string" && candidate.title.trim() ? candidate.title.trim() : fallback.title,
    subject: typeof candidate.subject === "string" && candidate.subject.trim() ? candidate.subject.trim() : fallback.subject,
    body: typeof candidate.body === "string" && candidate.body.trim() ? candidate.body.trim() : fallback.body,
  };
}

function getWeddingMessageTemplates(weddingData: FirebaseFirestore.DocumentData): MessageTemplate[] {
  const savedTemplates = Array.isArray(weddingData.settings?.messageTemplates)
    ? weddingData.settings.messageTemplates
    : null;

  if (!savedTemplates || savedTemplates.length === 0) {
    return DEFAULT_MESSAGE_TEMPLATES;
  }

  const normalizedSavedTemplates = savedTemplates as unknown[];
  return normalizedSavedTemplates
    .map((template: unknown, index: number) => normalizeMessageTemplate(template, DEFAULT_MESSAGE_TEMPLATES[index] ?? DEFAULT_MESSAGE_TEMPLATES[0]))
    .filter((template): template is MessageTemplate => Boolean(template.id && template.title && template.subject && template.body));
}

function matchesBroadcastAudience(guest: SerializedGuest, filters: BroadcastFilters): boolean {
  if (filters.tableId) {
    return guest.tableId === filters.tableId;
  }

  switch (filters.audience) {
    case "without-table":
      return guest.tableId === null;
    case "with-table":
      return guest.tableId !== null;
    case "email-only":
      return Boolean(guest.email) && !guest.phone;
    case "phone-only":
      return Boolean(guest.phone) && !guest.email;
    case "both":
      return Boolean(guest.email) && Boolean(guest.phone);
    case "no-contact":
      return !guest.email && !guest.phone;
    case "all":
    default:
      return true;
  }
}

function getBroadcastChannels(args: {
  guest: SerializedGuest;
  sendEmailToGuests: boolean;
  sendSmsToGuests: boolean;
  smsConfigured: boolean;
}): Array<{
  channel: "email" | "sms";
  recipient: string;
  fallbackFrom?: "email" | "sms";
}> {
  const { guest, sendEmailToGuests, sendSmsToGuests, smsConfigured } = args;
  const channels: Array<{ channel: "email" | "sms"; recipient: string; fallbackFrom?: "email" | "sms" }> = [];
  const normalizedPhone = guest.phone ? normalizeRomanianPhoneNumber(guest.phone) : null;

  const canSendEmail = sendEmailToGuests && Boolean(guest.email);
  const canSendSms = sendSmsToGuests && smsConfigured && Boolean(normalizedPhone);

  if (canSendEmail) {
    channels.push({ channel: "email", recipient: guest.email });
  }
  if (canSendSms && normalizedPhone) {
    channels.push({ channel: "sms", recipient: normalizedPhone });
  }

  if (channels.length === 0) {
    if (sendEmailToGuests && !guest.email && normalizedPhone && smsConfigured) {
      channels.push({ channel: "sms", recipient: normalizedPhone, fallbackFrom: "email" });
    } else if (sendSmsToGuests && (!normalizedPhone || !smsConfigured) && guest.email) {
      channels.push({ channel: "email", recipient: guest.email, fallbackFrom: "sms" });
    }
  }

  return channels;
}

function buildBroadcastRecipientPlans(args: {
  guests: SerializedGuest[];
  filters: BroadcastFilters;
  sendEmailToGuests: boolean;
  sendSmsToGuests: boolean;
  smsConfigured: boolean;
}): {
  plans: BroadcastRecipientPlan[];
  fallbackWarnings: Array<{ guestName: string; fromChannel: BroadcastChannel; toChannel: BroadcastChannel }>;
} {
  const { guests, filters, sendEmailToGuests, sendSmsToGuests, smsConfigured } = args;
  const plans: BroadcastRecipientPlan[] = [];
  const fallbackWarnings: Array<{ guestName: string; fromChannel: BroadcastChannel; toChannel: BroadcastChannel }> = [];

  for (const guest of guests) {
    if (guest.rsvpStatus !== "confirmat" || !matchesBroadcastAudience(guest, filters)) continue;

    const guestName = `${guest.firstName} ${guest.lastName}`.trim();
    const channels = getBroadcastChannels({ guest, sendEmailToGuests, sendSmsToGuests, smsConfigured });

    channels.forEach((channelInfo) => {
      if (channelInfo.fallbackFrom) {
        fallbackWarnings.push({
          guestName,
          fromChannel: channelInfo.fallbackFrom,
          toChannel: channelInfo.channel,
        });
      }
    });

    plans.push({
      guestId: guest.id,
      guestName,
      guest,
      channels,
      reason: channels.length === 0
        ? guest.email || guest.phone
          ? "Nu există canal disponibil conform selecției curente."
          : "Invitatul nu are date de contact."
        : undefined,
    });
  }

  return { plans, fallbackWarnings };
}

async function writeBroadcastDeliveryLog(
  database: FirebaseFirestore.Firestore,
  args: {
    broadcastId: string;
    weddingId: string;
    guestId: string;
    guestName: string;
    channel: BroadcastChannel;
    recipient: string;
    status: BroadcastDeliveryStatus;
    fallbackFrom?: BroadcastChannel;
    errorMessage?: string | null;
  },
): Promise<void> {
  await database.collection("wh_message_delivery_logs").add({
    broadcastId: args.broadcastId,
    weddingId: args.weddingId,
    guestId: args.guestId,
    guestName: args.guestName,
    channel: args.channel,
    recipient: args.recipient,
    status: args.status,
    fallbackFrom: args.fallbackFrom ?? null,
    errorMessage: args.errorMessage ?? null,
    createdAt: Timestamp.now(),
  });
}

function serializeBroadcast(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot) {
  const data = doc.data();
  if (!data) return null;

  return {
    id: doc.id,
    weddingId: data.weddingId,
    subject: data.subject,
    message: data.message,
    sendEmailToGuests: Boolean(data.sendEmailToGuests),
    sendSmsToGuests: Boolean(data.sendSmsToGuests),
    filters: {
      audience: data.filters?.audience ?? "all",
      tableId: data.filters?.tableId ?? null,
    },
    templateId: data.templateId ?? null,
    status: data.status ?? "queued",
    recipientCount: data.recipientCount ?? 0,
    emailCount: data.emailCount ?? 0,
    smsCount: data.smsCount ?? 0,
    emailSent: data.emailSent ?? 0,
    smsSent: data.smsSent ?? 0,
    emailFailed: data.emailFailed ?? 0,
    smsFailed: data.smsFailed ?? 0,
    emailSkipped: data.emailSkipped ?? 0,
    smsSkipped: data.smsSkipped ?? 0,
    fallbackCount: data.fallbackCount ?? 0,
    createdAt: serializeTimestamp(data.createdAt),
    startedAt: serializeTimestamp(data.startedAt),
    completedAt: serializeTimestamp(data.completedAt),
    errorMessage: data.errorMessage ?? null,
    fallbackWarnings: Array.isArray(data.fallbackWarnings) ? data.fallbackWarnings : [],
    failures: Array.isArray(data.failures) ? data.failures : [],
    skipped: Array.isArray(data.skipped) ? data.skipped : [],
  };
}

async function processBroadcastJob(args: {
  database: FirebaseFirestore.Firestore;
  broadcastRef: FirebaseFirestore.DocumentReference;
  weddingId: string;
  weddingName: string;
  guests: SerializedGuest[];
  subject: string;
  message: string;
  sendEmailToGuests: boolean;
  sendSmsToGuests: boolean;
  filters: BroadcastFilters;
  smsConfigured: boolean;
}) {
  const {
    database,
    broadcastRef,
    weddingId,
    weddingName,
    guests,
    subject,
    message,
    sendEmailToGuests,
    sendSmsToGuests,
    filters,
    smsConfigured,
  } = args;

  try {
    await broadcastRef.update({
      status: "processing" satisfies BroadcastStatus,
      startedAt: Timestamp.now(),
    });

    const { plans, fallbackWarnings } = buildBroadcastRecipientPlans({
      guests,
      filters,
      sendEmailToGuests,
      sendSmsToGuests,
      smsConfigured,
    });
    const recipients = plans.filter((plan) => plan.channels.length > 0);
    let emailSent = 0;
    let smsSent = 0;
    let emailFailed = 0;
    let smsFailed = 0;
    let emailSkipped = 0;
    let smsSkipped = 0;
    const failures: Array<{ channel: "email" | "sms"; guestName: string; recipient: string; reason: string }> = [];
    const skipped: Array<{ channel: "email" | "sms"; guestName: string; recipient: string; reason: string }> = [];

    for (const plan of plans) {
      if (plan.channels.length === 0) {
        if (sendEmailToGuests) emailSkipped += 1;
        if (sendSmsToGuests) smsSkipped += 1;
        skipped.push({
          channel: sendEmailToGuests ? "email" : "sms",
          guestName: plan.guestName,
          recipient: plan.guest.email || plan.guest.phone || "",
          reason: plan.reason ?? "Nu există canal disponibil.",
        });
        await writeBroadcastDeliveryLog(database, {
          broadcastId: broadcastRef.id,
          weddingId,
          guestId: plan.guestId,
          guestName: plan.guestName,
          channel: sendEmailToGuests ? "email" : "sms",
          recipient: plan.guest.email || plan.guest.phone || "",
          status: "skipped",
          errorMessage: plan.reason ?? "Nu există canal disponibil.",
        });
        continue;
      }

      for (const channelInfo of plan.channels) {
        if (channelInfo.channel === "email") {
          try {
            await sendEmail({
              to: channelInfo.recipient,
              subject,
              html: buildGuestBroadcastEmailHtml({
                guestName: plan.guestName,
                weddingName,
                subject,
                message,
              }),
            });
            emailSent += 1;
            await writeBroadcastDeliveryLog(database, {
              broadcastId: broadcastRef.id,
              weddingId,
              guestId: plan.guestId,
              guestName: plan.guestName,
              channel: "email",
              recipient: channelInfo.recipient,
              status: "sent",
              fallbackFrom: channelInfo.fallbackFrom,
            });
          } catch (error) {
            emailFailed += 1;
            failures.push({
              channel: "email",
              guestName: plan.guestName,
              recipient: channelInfo.recipient,
              reason: error instanceof Error ? error.message : "Eroare la trimiterea emailului.",
            });
            await writeBroadcastDeliveryLog(database, {
              broadcastId: broadcastRef.id,
              weddingId,
              guestId: plan.guestId,
              guestName: plan.guestName,
              channel: "email",
              recipient: channelInfo.recipient,
              status: "failed",
              fallbackFrom: channelInfo.fallbackFrom,
              errorMessage: error instanceof Error ? error.message : "Eroare la trimiterea emailului.",
            });
          }
        } else {
          try {
            await sendSms({
              to: channelInfo.recipient,
              body: buildGuestBroadcastSmsBody({
                guestName: plan.guestName,
                weddingName,
                message,
              }),
            });
            smsSent += 1;
            await writeBroadcastDeliveryLog(database, {
              broadcastId: broadcastRef.id,
              weddingId,
              guestId: plan.guestId,
              guestName: plan.guestName,
              channel: "sms",
              recipient: channelInfo.recipient,
              status: "sent",
              fallbackFrom: channelInfo.fallbackFrom,
            });
          } catch (error) {
            smsFailed += 1;
            failures.push({
              channel: "sms",
              guestName: plan.guestName,
              recipient: channelInfo.recipient,
              reason: error instanceof Error ? error.message : "Eroare la trimiterea SMS-ului.",
            });
            await writeBroadcastDeliveryLog(database, {
              broadcastId: broadcastRef.id,
              weddingId,
              guestId: plan.guestId,
              guestName: plan.guestName,
              channel: "sms",
              recipient: channelInfo.recipient,
              status: "failed",
              fallbackFrom: channelInfo.fallbackFrom,
              errorMessage: error instanceof Error ? error.message : "Eroare la trimiterea SMS-ului.",
            });
          }
        }
      }
    }

    const totalFailures = emailFailed + smsFailed;
    const totalSent = emailSent + smsSent;
    const status: BroadcastStatus = totalFailures > 0
      ? (totalSent > 0 ? "partial" : "failed")
      : "sent";

    await broadcastRef.update({
      status,
      completedAt: Timestamp.now(),
      recipientCount: plans.length,
      emailCount: plans.filter((plan) => Boolean(plan.guest.email)).length,
      smsCount: plans.filter((plan) => Boolean(plan.guest.phone)).length,
      emailSent,
      smsSent,
      emailFailed,
      smsFailed,
      emailSkipped,
      smsSkipped,
      fallbackCount: fallbackWarnings.length,
      fallbackWarnings,
      failures,
      skipped,
      errorMessage: status === "failed" && totalSent === 0
        ? "Trimiterea a eșuat pentru toți destinatarii."
        : totalFailures > 0
          ? "Unele mesaje au eșuat."
          : null,
    });
  } catch (error) {
    await broadcastRef.update({
      status: "failed" satisfies BroadcastStatus,
      completedAt: Timestamp.now(),
      errorMessage: error instanceof Error ? error.message : "Eroare necunoscută.",
    });
  }
}

function buildWeddingProfile(doc: FirebaseFirestore.DocumentSnapshot) {
  const data = doc.data();
  if (!data) return null;
  const emailNotificationsEnabled = Boolean(data.settings?.emailNotificationsEnabled);
  const notifyOnAccept = data.settings?.notifyOnAccept ?? emailNotificationsEnabled;
  const notifyOnDecline = data.settings?.notifyOnDecline ?? emailNotificationsEnabled;

  return {
    id: doc.id,
    brideFirstName: data.brideFirstName,
    groomFirstName: data.groomFirstName,
    weddingDate: data.weddingDate,
    city: data.city,
    venueName: data.venueName ?? "",
    venueAddress: data.venueAddress ?? "",
    coupleEmail: data.coupleEmail,
    coupleUid: data.coupleUid,
    createdAt: serializeTimestamp(data.createdAt),
    emailSettings: {
      emailNotificationsEnabled,
      notifyOnAccept: Boolean(notifyOnAccept),
      notifyOnDecline: Boolean(notifyOnDecline),
    },
  };
}

function serializeTimestamp(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return null;
}

function sanitizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePhoneNumber(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const compact = trimmed.replace(/[^\d+]/g, "");
  const digits = compact.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return compact;
}

function normalizeImageMediaType(
  value: unknown,
): "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "image/heic" | "image/heif" | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();

  switch (normalized) {
    case "image/jpg":
    case "image/jpeg":
      return "image/jpeg";
    case "image/png":
      return "image/png";
    case "image/gif":
      return "image/gif";
    case "image/webp":
      return "image/webp";
    case "image/heic":
      return "image/heic";
    case "image/heif":
      return "image/heif";
    default:
      return null;
  }
}

async function normalizeImageForExtraction(args: {
  imageBase64: string;
  mediaType: string;
}): Promise<{ imageBase64: string; mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" }> {
  const { imageBase64, mediaType } = args;
  const inputBuffer = Buffer.from(imageBase64, "base64");

  if (mediaType === "image/heic" || mediaType === "image/heif") {
    try {
      const convertedBuffer = Buffer.from(await heicConvert({
        buffer: inputBuffer,
        format: "JPEG",
        quality: 0.9,
      }));

      if (convertedBuffer.length > 0) {
        return {
          imageBase64: convertedBuffer.toString("base64"),
          mediaType: "image/jpeg",
        };
      }
    } catch (error) {
      console.warn("[wedding-hub] HEIC convert fallback via heic-convert failed, retrying with sharp:", error);
    }

    const sharpConvertedBuffer = await sharp(inputBuffer).jpeg({ quality: 90 }).toBuffer();
    return {
      imageBase64: sharpConvertedBuffer.toString("base64"),
      mediaType: "image/jpeg",
    };
  }

  return {
    imageBase64,
    mediaType: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
  };
}

function extractLooseJsonBlock(raw: string): string | null {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch?.[1]?.trim() ?? trimmed;
  const startIndex = candidate.indexOf("{");
  const endIndex = candidate.lastIndexOf("}");

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return null;
  }

  return candidate.slice(startIndex, endIndex + 1);
}

function parseAiJsonResponse(raw: string): Record<string, unknown> {
  const jsonBlock = extractLooseJsonBlock(raw);
  if (!jsonBlock) return {};

  try {
    return JSON.parse(jsonBlock) as Record<string, unknown>;
  } catch {
    try {
      return JSON.parse(jsonrepair(jsonBlock)) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}

function splitFullName(fullName: string): { firstName: string; lastName: string } | null {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function normalizeImportedGuest(value: unknown): {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  notes: string;
} | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const firstName = sanitizeText(candidate.firstName);
  const lastName = sanitizeText(candidate.lastName);
  const fullName = sanitizeText(candidate.fullName);
  const names = firstName && lastName
    ? { firstName, lastName }
    : fullName
      ? splitFullName(fullName)
      : null;

  if (!names) return null;

  const phone = normalizePhoneNumber(candidate.phone) ?? "";
  const email = sanitizeText(candidate.email) ?? "";
  const notes = sanitizeText(candidate.notes) ?? "";

  return {
    firstName: names.firstName,
    lastName: names.lastName,
    phone,
    email,
    notes,
  };
}

function normalizeGuestDedupKey(args: { firstName: string; lastName: string; phone?: string; email?: string }): string {
  return [
    args.firstName.trim().toLowerCase(),
    args.lastName.trim().toLowerCase(),
    (args.phone ?? "").trim().replace(/\D/g, ""),
    (args.email ?? "").trim().toLowerCase(),
  ].join("|");
}

function sanitizeNameList(value: unknown, expectedLength: number): string[] {
  if (!Array.isArray(value) || !Number.isFinite(expectedLength) || expectedLength <= 0) return [];
  return Array.from({ length: Math.floor(expectedLength) }, (_, index) => {
    const candidate = value[index];
    return typeof candidate === "string" ? candidate.trim() : "";
  });
}

function serializeGuest(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot) {
  const data = doc.data();
  if (!data) return null;

  return {
    id: doc.id,
    weddingId: data.weddingId,
    firstName: data.firstName,
    lastName: data.lastName,
    phone: data.phone ?? "",
    email: data.email ?? "",
    tableId: data.tableId ?? null,
    rsvpStatus: data.rsvpStatus,
    menuPreference: data.menuPreference ?? null,
    childrenMenuPreference: data.childrenMenuPreference ?? null,
    adultsCount: data.adultsCount ?? 1,
    childrenCount: data.childrenCount ?? 0,
    accompanyingAdultNames: Array.isArray(data.accompanyingAdultNames) ? data.accompanyingAdultNames : [],
    childrenNames: Array.isArray(data.childrenNames) ? data.childrenNames : [],
    sameTableWithFamily: Boolean(data.sameTableWithFamily),
    inviteToken: data.inviteToken,
    notes: data.notes ?? "",
    declineReasons: Array.isArray(data.declineReasons) ? data.declineReasons : [],
    declineReasonDetails: data.declineReasonDetails ?? "",
    acceptanceMessage: data.acceptanceMessage ?? "",
    createdAt: serializeTimestamp(data.createdAt),
    rsvpSubmittedAt: serializeTimestamp(data.rsvpSubmittedAt),
  };
}

type SerializedGuest = NonNullable<ReturnType<typeof serializeGuest>>;
type BulkGuestUpdateEntry = {
  guestId: string;
  payload: Record<string, unknown> & { tableId?: string | null };
};

// ─── ADMIN ENDPOINTS ─────────────────────────────────────────────────────────

// POST /api/wedding-hub/admin/weddings — create wedding + couple Firebase Auth user
router.post(
  "/admin/weddings",
  requireFirebaseAuth,
  requireSupremeAdmin,
  async (req: Request, res: Response) => {
    try {
      const database = firestore();
      const {
        brideFirstName,
        groomFirstName,
        weddingDate,
        city,
        coupleEmail,
        tempPassword,
      } = req.body;

      if (!brideFirstName?.trim() || !groomFirstName?.trim()) {
        return res.status(400).json({ error: "Prenumele miresei și mirelui sunt obligatorii." });
      }
      if (!weddingDate) {
        return res.status(400).json({ error: "Data nunții este obligatorie." });
      }
      if (!coupleEmail?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(coupleEmail.trim())) {
        return res.status(400).json({ error: "Emailul cuplului trebuie să fie valid." });
      }
      if (!tempPassword || tempPassword.length < 6) {
        return res.status(400).json({ error: "Parola temporară trebuie să aibă cel puțin 6 caractere." });
      }

      const existingSnapshot = await database
        .collection("wh_weddings")
        .where("coupleEmail", "==", coupleEmail.trim().toLowerCase())
        .limit(1)
        .get();
      if (!existingSnapshot.empty) {
        return res.status(409).json({ error: "Există deja o nuntă pentru acest email." });
      }

      let coupleUid: string;
      try {
        const newUser = await getAuth().createUser({
          email: coupleEmail.trim().toLowerCase(),
          password: tempPassword,
          emailVerified: false,
          displayName: `${brideFirstName.trim()} & ${groomFirstName.trim()}`,
        });
        coupleUid = newUser.uid;
      } catch (firebaseAuthError: unknown) {
        const authError = firebaseAuthError as { code?: string; message?: string };
        if (authError.code === "auth/email-already-exists") {
          const existingUser = await getAuth().getUserByEmail(coupleEmail.trim().toLowerCase());
          coupleUid = existingUser.uid;
          await getAuth().updateUser(coupleUid, { password: tempPassword });
        } else {
          throw firebaseAuthError;
        }
      }

      const weddingDoc = {
        brideFirstName: brideFirstName.trim(),
        groomFirstName: groomFirstName.trim(),
        weddingDate,
        city: city?.trim() ?? "",
        coupleEmail: coupleEmail.trim().toLowerCase(),
        coupleUid,
        createdAt: Timestamp.now(),
        settings: {
          emailNotificationsEnabled: false,
          notifyOnAccept: false,
          notifyOnDecline: false,
        },
      };

      const docRef = await database.collection("wh_weddings").add(weddingDoc);

      try {
        await seedChecklistDefaults(docRef.id);
      } catch (seedError) {
        console.error("[wedding-hub] Failed to seed checklist defaults:", seedError);
      }

      try {
        await seedReminderDefaults(docRef.id, coupleEmail.trim().toLowerCase());
      } catch (seedError) {
        console.error("[wedding-hub] Failed to seed reminder defaults:", seedError);
      }

      res.status(201).json({
        id: docRef.id,
        ...weddingDoc,
        createdAt: weddingDoc.createdAt.toDate().toISOString(),
      });
    } catch (error) {
      console.error("[wedding-hub] POST /admin/weddings failed:", error);
      res.status(500).json({ error: "Nu s-a putut crea nunta." });
    }
  },
);

// GET /api/wedding-hub/admin/weddings — list all weddings (admin)
router.get(
  "/admin/weddings",
  requireFirebaseAuth,
  requireSupremeAdmin,
  async (_req: Request, res: Response) => {
    try {
      const database = firestore();
      const snapshot = await database
        .collection("wh_weddings")
        .orderBy("weddingDate", "asc")
        .get();

      const weddings = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          brideFirstName: data.brideFirstName,
          groomFirstName: data.groomFirstName,
          weddingDate: data.weddingDate,
          city: data.city,
          coupleEmail: data.coupleEmail,
          coupleUid: data.coupleUid,
          createdAt: serializeTimestamp(data.createdAt),
        };
      });

      res.json({ weddings });
    } catch (error) {
      console.error("[wedding-hub] GET /admin/weddings failed:", error);
      res.status(500).json({ error: "Nu s-au putut încărca nunțile." });
    }
  },
);

// DELETE /api/wedding-hub/admin/weddings/:weddingId — delete wedding + Firebase Auth user
router.delete(
  "/admin/weddings/:weddingId",
  requireFirebaseAuth,
  requireSupremeAdmin,
  async (req: Request, res: Response) => {
    try {
      const database = firestore();
      const { weddingId } = req.params;

      const weddingDoc = await database.collection("wh_weddings").doc(weddingId).get();
      if (!weddingDoc.exists) {
        return res.status(404).json({ error: "Nunta nu a fost găsită." });
      }

      const weddingData = weddingDoc.data()!;
      const batch = database.batch();

      const guestsSnapshot = await database
        .collection("wh_guests")
        .where("weddingId", "==", weddingId)
        .get();
      guestsSnapshot.docs.forEach((guestDoc) => batch.delete(guestDoc.ref));

      const tablesSnapshot = await database
        .collection("wh_tables")
        .where("weddingId", "==", weddingId)
        .get();
      tablesSnapshot.docs.forEach((tableDoc) => batch.delete(tableDoc.ref));

      batch.delete(weddingDoc.ref);
      await batch.commit();

      try {
        await getAuth().deleteUser(weddingData.coupleUid);
      } catch {
        // User may have been deleted already — not a fatal error
      }

      res.json({ ok: true });
    } catch (error) {
      console.error("[wedding-hub] DELETE /admin/weddings/:weddingId failed:", error);
      res.status(500).json({ error: "Nu s-a putut șterge nunta." });
    }
  },
);

// GET /api/wedding-hub/admin/email-mode — get current test email mode state
router.get(
  "/admin/email-mode",
  requireFirebaseAuth,
  requireSupremeAdmin,
  (_req: Request, res: Response) => {
    res.json({
      testEmailMode: getTestEmailMode(),
      testTransportAvailable: isTestTransportAvailable(),
    });
  },
);

// POST /api/wedding-hub/admin/email-mode — toggle test email mode
router.post(
  "/admin/email-mode",
  requireFirebaseAuth,
  requireSupremeAdmin,
  (req: Request, res: Response) => {
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
      return res.status(400).json({ error: "enabled trebuie să fie boolean." });
    }
    if (enabled && !isTestTransportAvailable()) {
      return res.status(400).json({ error: "SMTP_TEST_HOST nu este configurat în .env." });
    }
    setTestEmailMode(enabled);
    res.json({ testEmailMode: getTestEmailMode() });
  },
);

// PATCH /api/wedding-hub/admin/weddings/:weddingId/password — reset couple password
router.patch(
  "/admin/weddings/:weddingId/password",
  requireFirebaseAuth,
  requireSupremeAdmin,
  async (req: Request, res: Response) => {
    try {
      const { weddingId } = req.params;
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: "Parola trebuie să aibă cel puțin 6 caractere." });
      }

      const database = firestore();
      const weddingDoc = await database.collection("wh_weddings").doc(weddingId).get();
      if (!weddingDoc.exists) {
        return res.status(404).json({ error: "Nunta nu a fost găsită." });
      }

      const coupleUid = weddingDoc.data()!.coupleUid as string;
      await getAuth().updateUser(coupleUid, { password: newPassword });

      res.json({ ok: true });
    } catch (error) {
      console.error("[wedding-hub] PATCH /admin/weddings/:id/password failed:", error);
      res.status(500).json({ error: "Nu s-a putut schimba parola." });
    }
  },
);

// POST /api/wedding-hub/admin/weddings/:weddingId/impersonate — generate custom token for couple
router.post(
  "/admin/weddings/:weddingId/impersonate",
  requireFirebaseAuth,
  requireSupremeAdmin,
  async (req: Request, res: Response) => {
    try {
      const { weddingId } = req.params;
      const database = firestore();
      const weddingDoc = await database.collection("wh_weddings").doc(weddingId).get();
      if (!weddingDoc.exists) {
        return res.status(404).json({ error: "Nunta nu a fost găsită." });
      }
      const coupleUid = weddingDoc.data()!.coupleUid as string;
      const customToken = await getAuth().createCustomToken(coupleUid);
      res.json({ customToken });
    } catch (error) {
      console.error("[wedding-hub] POST /admin/weddings/:id/impersonate failed:", error);
      res.status(500).json({ error: "Nu s-a putut genera tokenul." });
    }
  },
);

// ─── COUPLE ENDPOINTS ────────────────────────────────────────────────────────

// GET /api/wedding-hub/me — fetch full wedding data (profile + guests + tables)
router.get("/me", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const database = firestore();
    const coupleReq = req as CoupleAuthenticatedRequest;
    const { weddingId } = coupleReq;

    const [weddingDoc, guestsSnapshot, tablesSnapshot] = await Promise.all([
      database.collection("wh_weddings").doc(weddingId).get(),
      database.collection("wh_guests").where("weddingId", "==", weddingId).get(),
      database.collection("wh_tables").where("weddingId", "==", weddingId).get(),
    ]);

    if (!weddingDoc.exists) {
      return res.status(404).json({ error: "Nunta nu a fost găsită." });
    }

    const weddingData = weddingDoc.data()!;
    const weddingProfile = buildWeddingProfile(weddingDoc);
    if (!weddingProfile) {
      return res.status(404).json({ error: "Nunta nu a fost găsită." });
    }

    const guests = guestsSnapshot.docs
      .map((doc) => serializeGuest(doc))
      .filter((guest): guest is SerializedGuest => guest !== null)
      .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));

    const tables = tablesSnapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          weddingId: data.weddingId,
          tableName: data.tableName,
          tableAlias: data.tableAlias ?? null,
          capacity: data.capacity,
          createdAt: serializeTimestamp(data.createdAt),
        };
      })
      .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));

    res.json({ weddingProfile, guests, tables });
  } catch (error) {
    console.error("[wedding-hub] GET /me failed:", error);
    res.status(500).json({ error: "Nu s-au putut încărca datele." });
  }
});

// PATCH /api/wedding-hub/settings — update wedding hub settings
router.patch("/settings", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const database = firestore();
    const coupleReq = req as CoupleAuthenticatedRequest;
    const { weddingId } = coupleReq;

    const weddingRef = database.collection("wh_weddings").doc(weddingId);
    const weddingDoc = await weddingRef.get();
    if (!weddingDoc.exists) {
      return res.status(404).json({ error: "Nunta nu a fost găsită." });
    }

    const updates: Record<string, unknown> = {};
    if (req.body.emailNotificationsEnabled !== undefined) {
      updates["settings.emailNotificationsEnabled"] = Boolean(req.body.emailNotificationsEnabled);
    }
    if (req.body.notifyOnAccept !== undefined) {
      updates["settings.notifyOnAccept"] = Boolean(req.body.notifyOnAccept);
    }
    if (req.body.notifyOnDecline !== undefined) {
      updates["settings.notifyOnDecline"] = Boolean(req.body.notifyOnDecline);
    }
    if (typeof req.body.venueName === "string") {
      updates["venueName"] = req.body.venueName.trim();
    }
    if (typeof req.body.venueAddress === "string") {
      updates["venueAddress"] = req.body.venueAddress.trim();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "Nu există setări de actualizat." });
    }

    await weddingRef.update(updates);
    const updatedWeddingDoc = await weddingRef.get();
    const weddingProfile = buildWeddingProfile(updatedWeddingDoc);
    if (!weddingProfile) {
      return res.status(404).json({ error: "Nunta nu a fost găsită." });
    }

    res.json({ ok: true, weddingProfile });
  } catch (error) {
    console.error("[wedding-hub] PATCH /settings failed:", error);
    res.status(500).json({ error: "Nu s-au putut salva setările." });
  }
});

// GET /api/wedding-hub/messages/templates — fetch saved message templates
router.get("/messages/templates", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const database = firestore();
    const coupleReq = req as CoupleAuthenticatedRequest;
    const weddingDoc = await database.collection("wh_weddings").doc(coupleReq.weddingId).get();
    if (!weddingDoc.exists) {
      return res.status(404).json({ error: "Nunta nu a fost găsită." });
    }

    const templates = getWeddingMessageTemplates(weddingDoc.data()!);
    res.json({ templates });
  } catch (error) {
    console.error("[wedding-hub] GET /messages/templates failed:", error);
    res.status(500).json({ error: "Nu s-au putut încărca șabloanele." });
  }
});

// PATCH /api/wedding-hub/messages/templates — save custom message templates
router.patch("/messages/templates", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const database = firestore();
    const coupleReq = req as CoupleAuthenticatedRequest;
    const { templates } = req.body as { templates?: MessageTemplate[] };

    if (!Array.isArray(templates) || templates.length === 0) {
      return res.status(400).json({ error: "Trimite cel puțin un șablon." });
    }

    const normalizedTemplates = templates
      .map((template, index) => normalizeMessageTemplate(template, DEFAULT_MESSAGE_TEMPLATES[index] ?? DEFAULT_MESSAGE_TEMPLATES[0]))
      .filter((template) => template.id && template.title && template.subject && template.body);

    if (normalizedTemplates.length === 0) {
      return res.status(400).json({ error: "Șabloanele nu sunt valide." });
    }

    await database.collection("wh_weddings").doc(coupleReq.weddingId).update({
      "settings.messageTemplates": normalizedTemplates,
    });

    res.json({ ok: true, templates: normalizedTemplates });
  } catch (error) {
    console.error("[wedding-hub] PATCH /messages/templates failed:", error);
    res.status(500).json({ error: "Nu s-au putut salva șabloanele." });
  }
});

// GET /api/wedding-hub/messages/broadcasts — fetch message history (paginated)
// Query params: limit (default 20, max 100), cursor (last document ID from previous page)
router.get("/messages/broadcasts", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const database = firestore();
    const coupleReq = req as CoupleAuthenticatedRequest;
    const pageLimit = Math.min(Number(req.query.limit) || 20, 100);
    const cursorId = typeof req.query.cursor === "string" ? req.query.cursor.trim() : null;

    let query = database
      .collection("wh_message_broadcasts")
      .where("weddingId", "==", coupleReq.weddingId)
      .orderBy("createdAt", "desc")
      .limit(pageLimit + 1);

    if (cursorId) {
      const cursorDoc = await database.collection("wh_message_broadcasts").doc(cursorId).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const snapshot = await query.get();
    const hasMore = snapshot.docs.length > pageLimit;
    const pageDocs = snapshot.docs.slice(0, pageLimit);

    const broadcasts = pageDocs
      .map((doc) => serializeBroadcast(doc))
      .filter((broadcast): broadcast is NonNullable<ReturnType<typeof serializeBroadcast>> => broadcast !== null);

    const nextCursor = hasMore && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;

    res.json({ broadcasts, hasMore, nextCursor });
  } catch (error) {
    console.error("[wedding-hub] GET /messages/broadcasts failed:", error);
    res.status(500).json({ error: "Nu s-a putut încărca istoricul." });
  }
});

// GET /api/wedding-hub/messages/broadcasts/:broadcastId/deliveries — fetch per-broadcast delivery logs
router.get("/messages/broadcasts/:broadcastId/deliveries", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const database = firestore();
    const coupleReq = req as CoupleAuthenticatedRequest;
    const { broadcastId } = req.params;

    const broadcastDoc = await database.collection("wh_message_broadcasts").doc(broadcastId).get();
    if (!broadcastDoc.exists || broadcastDoc.data()?.weddingId !== coupleReq.weddingId) {
      return res.status(404).json({ error: "Broadcast-ul nu a fost găsit." });
    }

    const pageLimit = Math.min(Number(req.query.limit) || 100, 500);
    const cursorId = typeof req.query.cursor === "string" ? req.query.cursor.trim() : null;

    let deliveriesQuery = database
      .collection("wh_message_delivery_logs")
      .where("broadcastId", "==", broadcastId)
      .orderBy("createdAt", "desc")
      .limit(pageLimit + 1);

    if (cursorId) {
      const cursorDoc = await database.collection("wh_message_delivery_logs").doc(cursorId).get();
      if (cursorDoc.exists) {
        deliveriesQuery = deliveriesQuery.startAfter(cursorDoc);
      }
    }

    const snapshot = await deliveriesQuery.get();
    const hasMore = snapshot.docs.length > pageLimit;
    const pageDocs = snapshot.docs.slice(0, pageLimit);

    const deliveries = pageDocs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        guestId: data.guestId,
        guestName: data.guestName,
        channel: data.channel,
        recipient: data.recipient,
        status: data.status,
        fallbackFrom: data.fallbackFrom ?? null,
        errorMessage: data.errorMessage ?? null,
        createdAt: serializeTimestamp(data.createdAt),
      };
    });

    const nextCursor = hasMore && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;

    res.json({ deliveries, hasMore, nextCursor });
  } catch (error) {
    console.error("[wedding-hub] GET /messages/broadcasts/:broadcastId/deliveries failed:", error);
    res.status(500).json({ error: "Nu s-au putut încărca livrările." });
  }
});

// GET /api/wedding-hub/messages/deliveries?guestId=... — history per guest
router.get("/messages/deliveries", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const database = firestore();
    const coupleReq = req as CoupleAuthenticatedRequest;
    const guestId = typeof req.query.guestId === "string" ? req.query.guestId.trim() : "";

    if (!guestId) {
      return res.status(400).json({ error: "guestId este obligatoriu." });
    }

    const guestDoc = await database.collection("wh_guests").doc(guestId).get();
    if (!guestDoc.exists || guestDoc.data()?.weddingId !== coupleReq.weddingId) {
      return res.status(404).json({ error: "Invitatul nu a fost găsit." });
    }

    const snapshot = await database
      .collection("wh_message_delivery_logs")
      .where("guestId", "==", guestId)
      .get();

    const deliveries = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          broadcastId: data.broadcastId,
          guestId: data.guestId,
          guestName: data.guestName,
          channel: data.channel,
          recipient: data.recipient,
          status: data.status,
          fallbackFrom: data.fallbackFrom ?? null,
          errorMessage: data.errorMessage ?? null,
          createdAt: serializeTimestamp(data.createdAt),
        };
      })
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

    res.json({ deliveries });
  } catch (error) {
    console.error("[wedding-hub] GET /messages/deliveries failed:", error);
    res.status(500).json({ error: "Nu s-a putut încărca istoricul destinatarului." });
  }
});

// POST /api/wedding-hub/messages/broadcasts/preview — build dry-run preview
router.post("/messages/broadcasts/preview", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const database = firestore();
    const coupleReq = req as CoupleAuthenticatedRequest;
    const { weddingId } = coupleReq;
    const {
      subject,
      message,
      sendEmailToGuests = true,
      sendSmsToGuests = true,
      filters,
      sendAt = null,
    } = req.body as {
      subject?: string;
      message?: string;
      sendEmailToGuests?: boolean;
      sendSmsToGuests?: boolean;
      filters?: BroadcastFilters;
      sendAt?: string | null;
    };

    const normalizedSubject = typeof subject === "string" ? subject.trim() : "";
    const normalizedMessage = typeof message === "string" ? message.trim() : "";
    const normalizedFilters: BroadcastFilters = {
      audience: filters?.audience ?? "all",
      tableId: typeof filters?.tableId === "string" && filters.tableId.trim() ? filters.tableId.trim() : null,
    };

    if (!normalizedSubject || !normalizedMessage) {
      return res.status(400).json({ error: "Subiectul și mesajul sunt obligatorii." });
    }

    const [weddingDoc, guestsSnapshot] = await Promise.all([
      database.collection("wh_weddings").doc(weddingId).get(),
      database.collection("wh_guests").where("weddingId", "==", weddingId).get(),
    ]);

    if (!weddingDoc.exists) {
      return res.status(404).json({ error: "Nunta nu a fost găsită." });
    }

    const templates = getWeddingMessageTemplates(weddingDoc.data()!);
    const targetSendAt = typeof sendAt === "string" && sendAt.trim() ? new Date(sendAt).toISOString() : null;
    const guests = guestsSnapshot.docs
      .map((doc) => serializeGuest(doc))
      .filter((guest): guest is SerializedGuest => guest !== null);
    const { plans, fallbackWarnings } = buildBroadcastRecipientPlans({
      guests,
      filters: normalizedFilters,
      sendEmailToGuests,
      sendSmsToGuests,
      smsConfigured: isSmsConfigured(),
    });

    res.json({
      ok: true,
      preview: {
        subject: normalizedSubject,
        message: normalizedMessage,
        sendAt: targetSendAt,
        recipientCount: plans.length,
        emailCount: plans.filter((plan) => plan.channels.some((channel) => channel.channel === "email")).length,
        smsCount: plans.filter((plan) => plan.channels.some((channel) => channel.channel === "sms")).length,
        fallbackCount: fallbackWarnings.length,
        fallbackWarnings: fallbackWarnings.slice(0, 20),
        recipients: plans.slice(0, 50).map((plan) => ({
          guestId: plan.guestId,
          guestName: plan.guestName,
          tableId: plan.guest.tableId,
          email: plan.guest.email || null,
          phone: plan.guest.phone || null,
          channels: plan.channels,
          reason: plan.reason ?? null,
        })),
        templates,
      },
    });
  } catch (error) {
    console.error("[wedding-hub] POST /messages/broadcasts/preview failed:", error);
    res.status(500).json({ error: "Nu s-a putut face previzualizarea." });
  }
});

// POST /api/wedding-hub/messages/broadcasts — queue a bulk message to confirmed guests
router.post("/messages/broadcasts", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const database = firestore();
    const coupleReq = req as CoupleAuthenticatedRequest;
    const { weddingId } = coupleReq;
    const {
      subject,
      message,
      sendEmailToGuests = true,
      sendSmsToGuests = true,
      filters,
      templateId = null,
    } = req.body as {
      subject?: string;
      message?: string;
      sendEmailToGuests?: boolean;
      sendSmsToGuests?: boolean;
      filters?: BroadcastFilters;
      templateId?: string | null;
    };

    const normalizedSubject = typeof subject === "string" ? subject.trim() : "";
    const normalizedMessage = typeof message === "string" ? message.trim() : "";
    const normalizedFilters: BroadcastFilters = {
      audience: filters?.audience ?? "all",
      tableId: typeof filters?.tableId === "string" && filters.tableId.trim() ? filters.tableId.trim() : null,
    };

    if (!normalizedSubject || !normalizedMessage) {
      return res.status(400).json({ error: "Subiectul și mesajul sunt obligatorii." });
    }
    if (!sendEmailToGuests && !sendSmsToGuests) {
      return res.status(400).json({ error: "Alege cel puțin un canal de trimitere." });
    }

    const [weddingDoc, guestsSnapshot] = await Promise.all([
      database.collection("wh_weddings").doc(weddingId).get(),
      database.collection("wh_guests").where("weddingId", "==", weddingId).get(),
    ]);

    if (!weddingDoc.exists) {
      return res.status(404).json({ error: "Nunta nu a fost găsită." });
    }

    const weddingData = weddingDoc.data()!;
    const weddingName = `${weddingData.brideFirstName} & ${weddingData.groomFirstName}`;
    const confirmedGuests = guestsSnapshot.docs
      .map((doc) => serializeGuest(doc))
      .filter((guest): guest is SerializedGuest => guest !== null && guest.rsvpStatus === "confirmat" && matchesBroadcastAudience(guest, normalizedFilters));

    const broadcastRef = database.collection("wh_message_broadcasts").doc();
    const fallbackWarnings = confirmedGuests.flatMap((guest) => {
      const channels = getBroadcastChannels({
        guest,
        sendEmailToGuests,
        sendSmsToGuests,
        smsConfigured: isSmsConfigured(),
      });
      return channels
        .filter((channel) => Boolean(channel.fallbackFrom))
        .map((channel) => ({
          guestName: `${guest.firstName} ${guest.lastName}`.trim(),
          fromChannel: channel.fallbackFrom as "email" | "sms",
          toChannel: channel.channel,
        }));
    });

    await broadcastRef.set({
      weddingId,
      subject: normalizedSubject,
      message: normalizedMessage,
      sendEmailToGuests,
      sendSmsToGuests,
      filters: normalizedFilters,
      templateId,
      status: "queued",
      recipientCount: confirmedGuests.length,
      createdAt: Timestamp.now(),
      startedAt: null,
      completedAt: null,
      emailSent: 0,
      smsSent: 0,
      emailFailed: 0,
      smsFailed: 0,
      emailSkipped: 0,
      smsSkipped: 0,
      fallbackCount: 0,
      fallbackWarnings: [],
      failures: [],
      skipped: [],
      errorMessage: null,
    });

    processBroadcastJob({
      database,
      broadcastRef,
      weddingId,
      weddingName,
      guests: confirmedGuests,
      subject: normalizedSubject,
      message: normalizedMessage,
      sendEmailToGuests,
      sendSmsToGuests,
      filters: normalizedFilters,
      smsConfigured: isSmsConfigured(),
    }).catch(async (error) => {
      console.error("[wedding-hub] processBroadcastJob crashed:", error);
      try {
        await broadcastRef.update({
          status: "failed" satisfies BroadcastStatus,
          errorMessage: String(error),
          completedAt: Timestamp.now(),
        });
      } catch {
        // ignore secondary failure
      }
    });

    res.status(202).json({
      ok: true,
      broadcastId: broadcastRef.id,
      status: "queued",
      confirmedGuests: confirmedGuests.length,
      channels: {
        emailConfigured: true,
        smsConfigured: isSmsConfigured(),
      },
      summary: {
        emailSent: 0,
        smsSent: 0,
        emailFailed: 0,
        smsFailed: 0,
        emailSkipped: 0,
        smsSkipped: 0,
        failures: [],
        skipped: [],
      },
      warnings: {
        fallbackCount: fallbackWarnings.length,
        fallbacks: fallbackWarnings.slice(0, 10),
      },
      message: "Mesajul a fost pus în coadă și se trimite în fundal.",
    });
  } catch (error) {
    console.error("[wedding-hub] POST /messages/broadcasts failed:", error);
    res.status(500).json({ error: "Nu s-a putut pune mesajul în coadă." });
  }
});

// POST /api/wedding-hub/guests — add guest
router.post("/guests", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const database = firestore();
    const coupleReq = req as CoupleAuthenticatedRequest;
    const { weddingId } = coupleReq;
    const { firstName, lastName, phone, email, notes, adultsCount, childrenCount } = req.body;

    if (!firstName?.trim() || !lastName?.trim()) {
      return res.status(400).json({ error: "Prenumele și numele sunt obligatorii." });
    }

    const guestDoc = {
      weddingId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone?.trim() ?? "",
      email: email?.trim() ?? "",
      tableId: null,
      rsvpStatus: "asteptare",
      menuPreference: null,
      childrenMenuPreference: null,
      adultsCount: Number(adultsCount) || 1,
      childrenCount: Number(childrenCount) || 0,
      accompanyingAdultNames: [],
      childrenNames: [],
      sameTableWithFamily: false,
      inviteToken: uuidv4(),
      notes: notes?.trim() ?? "",
      acceptanceMessage: "",
      inviteSentAt: null,
      inviteLastSentChannel: null,
      createdAt: Timestamp.now(),
      rsvpSubmittedAt: null,
    };

    const docRef = await database.collection("wh_guests").add(guestDoc);

    res.status(201).json({
      id: docRef.id,
      ...guestDoc,
      createdAt: guestDoc.createdAt.toDate().toISOString(),
      rsvpSubmittedAt: null,
    });
  } catch (error) {
    console.error("[wedding-hub] POST /guests failed:", error);
    res.status(500).json({ error: "Nu s-a putut adăuga invitatul." });
  }
});

// POST /api/wedding-hub/guests/extract-from-image — OCR/AI extract guests from a screenshot
router.post("/guests/extract-from-image", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const { imageBase64, mediaType } = req.body as { imageBase64?: string; mediaType?: string };

    if (!imageBase64 || !mediaType) {
      return res.status(400).json({ error: "imageBase64 și mediaType sunt obligatorii." });
    }

    const normalizedMediaType = normalizeImageMediaType(mediaType);

    if (!normalizedMediaType) {
      if (typeof mediaType === "string" && (mediaType.toLowerCase() === "image/heic" || mediaType.toLowerCase() === "image/heif")) {
        return res.status(400).json({ error: "HEIC nu a putut fi convertit pe server. Încearcă să exporți poza ca JPEG sau PNG." });
      }

      return res.status(400).json({ error: "Sunt acceptate doar imagini JPEG, PNG, GIF, WebP sau HEIC convertibil." });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: "AI extraction nu este configurată pe server." });
    }

    const preparedImage = await normalizeImageForExtraction({ imageBase64, mediaType: normalizedMediaType });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 900,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: preparedImage.mediaType,
                data: preparedImage.imageBase64,
              },
            },
            {
              type: "text",
              text: `Analizezi o imagine care conține o listă de invitați pentru nuntă, de obicei screenshot din Notes, Excel, chat sau o poză cu text scris clar.

Extrage fiecare invitat ca un obiect separat.

Reguli:
1. Nu inventa. Dacă nu e clar, lasă câmpul gol sau omite rândul.
2. Returnează doar persoane reale, nu anteturi, titluri sau instrucțiuni.
3. Un invitat trebuie să aibă nume și/sau telefon clar. Dacă vezi doar un număr fără nume, tot îl poți returna, dar marchează numele cât poți de bine.
4. Separă numele în firstName și lastName cât mai corect.
5. Telefonul trebuie normalizat cât poți de bine; păstrează-l într-un format lizibil, de preferat cu cifre și eventual prefixul +40.
6. Emailul este opțional. Notes este opțional.
7. Dacă există duplicate evidente, păstrează doar una.
8. Răspunde strict cu JSON valid, fără explicații.

Format:
{
  "guests": [
    {
      "firstName": "string",
      "lastName": "string",
      "phone": "string sau null",
      "email": "string sau null",
      "notes": "string sau null"
    }
  ]
}`,
            },
          ],
        },
      ],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "{}";
    const parsed = parseAiJsonResponse(raw);
    const guestsArray = Array.isArray(parsed.guests) ? parsed.guests : [];

    const normalizedGuests = guestsArray
      .map((guest) => normalizeImportedGuest(guest))
      .filter((guest): guest is NonNullable<ReturnType<typeof normalizeImportedGuest>> => Boolean(guest))
      .filter((guest) => guest.firstName.trim() || guest.lastName.trim() || guest.phone.trim());

    const dedupedGuests = normalizedGuests.filter((guest, index, list) => {
      const currentKey = normalizeGuestDedupKey(guest);
      return list.findIndex((candidate) => normalizeGuestDedupKey(candidate) === currentKey) === index;
    });

    return res.json({ guests: dedupedGuests });
  } catch (error) {
    console.error("[wedding-hub] POST /guests/extract-from-image failed:", error);
    return res.status(500).json({ error: "Nu s-au putut extrage invitații din imagine." });
  }
});

// POST /api/wedding-hub/guests/bulk-create — create many guests in one request
router.post("/guests/bulk-create", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const database = firestore();
    const coupleReq = req as CoupleAuthenticatedRequest;
    const { weddingId } = coupleReq;
    const guests: unknown[] = Array.isArray(req.body?.guests) ? (req.body.guests as unknown[]) : [];

    if (guests.length === 0) {
      return res.status(400).json({ error: "Trimite cel puțin un invitat." });
    }

    if (guests.length > 500) {
      return res.status(400).json({ error: "Poți importa cel mult 500 invitați per request." });
    }

    const existingSnapshot = await database.collection("wh_guests").where("weddingId", "==", weddingId).get();
    const existingKeys = new Set(
      existingSnapshot.docs.map((doc) => {
        const data = doc.data();
        return normalizeGuestDedupKey({
          firstName: String(data.firstName ?? ""),
          lastName: String(data.lastName ?? ""),
          phone: String(data.phone ?? ""),
          email: String(data.email ?? ""),
        });
      }),
    );

    const importedGuestCandidates: Array<ReturnType<typeof normalizeImportedGuest>> = guests.map((guest: unknown) =>
      normalizeImportedGuest(guest),
    );

    const normalizedGuests: Array<NonNullable<ReturnType<typeof normalizeImportedGuest>>> =
      importedGuestCandidates
        .filter((guest): guest is NonNullable<ReturnType<typeof normalizeImportedGuest>> => Boolean(guest))
        .filter((guest) => guest.firstName.trim() || guest.lastName.trim() || guest.phone.trim());

    if (normalizedGuests.length === 0) {
      return res.status(400).json({ error: "Nu există invitați validați pentru import." });
    }

    const batch = database.batch();
    const createdGuests: Array<Record<string, unknown>> = [];
    const skippedGuests: Array<{ firstName: string; lastName: string; reason: string }> = [];

    normalizedGuests.forEach((guest: NonNullable<ReturnType<typeof normalizeImportedGuest>>) => {
      const key = normalizeGuestDedupKey(guest);
      if (existingKeys.has(key)) {
        skippedGuests.push({
          firstName: guest.firstName,
          lastName: guest.lastName,
          reason: "Duplicat detectat după nume/email/telefon.",
        });
        return;
      }

      const docRef = database.collection("wh_guests").doc();
      const guestDoc = {
        weddingId,
        firstName: guest.firstName,
        lastName: guest.lastName,
        phone: guest.phone,
        email: guest.email,
        tableId: null,
        rsvpStatus: "asteptare",
        menuPreference: null,
        childrenMenuPreference: null,
        adultsCount: 1,
        childrenCount: 0,
        accompanyingAdultNames: [],
        childrenNames: [],
        sameTableWithFamily: false,
        inviteToken: uuidv4(),
        notes: guest.notes,
        acceptanceMessage: "",
        inviteSentAt: null,
        inviteLastSentChannel: null,
        createdAt: Timestamp.now(),
        rsvpSubmittedAt: null,
      };

      batch.set(docRef, guestDoc);
      createdGuests.push({
        id: docRef.id,
        ...guestDoc,
        createdAt: guestDoc.createdAt.toDate().toISOString(),
        rsvpSubmittedAt: null,
      });
      existingKeys.add(key);
    });

    await batch.commit();

    return res.status(201).json({
      ok: true,
      createdGuests,
      skippedGuests,
    });
  } catch (error) {
    console.error("[wedding-hub] POST /guests/bulk-create failed:", error);
    return res.status(500).json({ error: "Nu s-au putut importa invitații." });
  }
});

// PATCH /api/wedding-hub/guests/:guestId — update guest
router.patch("/guests/:guestId", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const database = firestore();
    const coupleReq = req as CoupleAuthenticatedRequest;
    const { weddingId } = coupleReq;
    const { guestId } = req.params;

    const guestDoc = await database.collection("wh_guests").doc(guestId).get();
    if (!guestDoc.exists || guestDoc.data()?.weddingId !== weddingId) {
      return res.status(404).json({ error: "Invitatul nu a fost găsit." });
    }

    const allowedFields: Record<string, unknown> = {};
    const {
      firstName, lastName, phone, email, notes,
      adultsCount, childrenCount, tableId, rsvpStatus, menuPreference, childrenMenuPreference,
      accompanyingAdultNames, childrenNames, sameTableWithFamily,
    } = req.body;

    if (firstName !== undefined) allowedFields.firstName = firstName.trim();
    if (lastName !== undefined) allowedFields.lastName = lastName.trim();
    if (phone !== undefined) allowedFields.phone = phone.trim();
    if (email !== undefined) allowedFields.email = email.trim();
    if (notes !== undefined) allowedFields.notes = notes.trim();
    if (adultsCount !== undefined) allowedFields.adultsCount = Number(adultsCount);
    if (childrenCount !== undefined) allowedFields.childrenCount = Number(childrenCount);
    if (tableId !== undefined) allowedFields.tableId = tableId;
    if (rsvpStatus !== undefined && ["asteptare", "confirmat", "refuzat"].includes(rsvpStatus)) {
      allowedFields.rsvpStatus = rsvpStatus;
    }
    if (menuPreference !== undefined) allowedFields.menuPreference = menuPreference;
    if (childrenMenuPreference !== undefined) allowedFields.childrenMenuPreference = childrenMenuPreference;
    if (accompanyingAdultNames !== undefined) {
      allowedFields.accompanyingAdultNames = Array.isArray(accompanyingAdultNames)
        ? accompanyingAdultNames.map((name) => (typeof name === "string" ? name.trim() : "")).filter(Boolean)
        : [];
    }
    if (childrenNames !== undefined) {
      allowedFields.childrenNames = Array.isArray(childrenNames)
        ? childrenNames.map((name) => (typeof name === "string" ? name.trim() : "")).filter(Boolean)
        : [];
    }
    if (sameTableWithFamily !== undefined) allowedFields.sameTableWithFamily = Boolean(sameTableWithFamily);

    await database.collection("wh_guests").doc(guestId).update(allowedFields);

    const updated = await database.collection("wh_guests").doc(guestId).get();
    const updatedData = updated.data()!;
    res.json({
      id: updated.id,
      ...updatedData,
      createdAt: serializeTimestamp(updatedData.createdAt),
      rsvpSubmittedAt: serializeTimestamp(updatedData.rsvpSubmittedAt),
    });
  } catch (error) {
    console.error("[wedding-hub] PATCH /guests/:guestId failed:", error);
    res.status(500).json({ error: "Nu s-a putut actualiza invitatul." });
  }
});

// POST /api/wedding-hub/guests/bulk-update — update many guests in one request
router.post("/guests/bulk-update", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const database = firestore();
    const coupleReq = req as CoupleAuthenticatedRequest;
    const { weddingId } = coupleReq;
    const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];

    if (updates.length === 0) {
      return res.status(400).json({ error: "Trimite cel puțin un update." });
    }

    if (updates.length > 500) {
      return res.status(400).json({ error: "Poți actualiza cel mult 500 de invitați per request." });
    }

    const normalizedUpdates: BulkGuestUpdateEntry[] = updates.map((entry: Record<string, unknown>, index: number) => {
      if (typeof entry.guestId !== "string" || !entry.guestId.trim()) {
        throw new Error(`Intrarea ${index + 1} nu are guestId valid.`);
      }

      const payload: Record<string, unknown> = {};

      if (entry.firstName !== undefined) payload.firstName = String(entry.firstName).trim();
      if (entry.lastName !== undefined) payload.lastName = String(entry.lastName).trim();
      if (entry.phone !== undefined) payload.phone = String(entry.phone).trim();
      if (entry.email !== undefined) payload.email = String(entry.email).trim();
      if (entry.notes !== undefined) payload.notes = String(entry.notes).trim();
      if (entry.adultsCount !== undefined) payload.adultsCount = Number(entry.adultsCount);
      if (entry.childrenCount !== undefined) payload.childrenCount = Number(entry.childrenCount);
      if (entry.tableId !== undefined) payload.tableId = entry.tableId;
      if (entry.accompanyingAdultNames !== undefined) {
        payload.accompanyingAdultNames = Array.isArray(entry.accompanyingAdultNames)
          ? entry.accompanyingAdultNames.map((name) => (typeof name === "string" ? name.trim() : "")).filter(Boolean)
          : [];
      }
      if (entry.childrenNames !== undefined) {
        payload.childrenNames = Array.isArray(entry.childrenNames)
          ? entry.childrenNames.map((name) => (typeof name === "string" ? name.trim() : "")).filter(Boolean)
          : [];
      }
      if (entry.sameTableWithFamily !== undefined) {
        payload.sameTableWithFamily = Boolean(entry.sameTableWithFamily);
      }

      if (entry.rsvpStatus !== undefined) {
        if (!RSVP_STATUSES.has(String(entry.rsvpStatus))) {
          throw new Error(`Status RSVP invalid pentru guestId ${entry.guestId}.`);
        }
        payload.rsvpStatus = entry.rsvpStatus;
      }

      if (entry.menuPreference !== undefined) {
        if (entry.menuPreference !== null && !MENU_PREFERENCES.has(String(entry.menuPreference))) {
          throw new Error(`Meniu adulți invalid pentru guestId ${entry.guestId}.`);
        }
        payload.menuPreference = entry.menuPreference;
      }

      if (entry.childrenMenuPreference !== undefined) {
        if (entry.childrenMenuPreference !== null && !MENU_PREFERENCES.has(String(entry.childrenMenuPreference))) {
          throw new Error(`Meniu copii invalid pentru guestId ${entry.guestId}.`);
        }
        payload.childrenMenuPreference = entry.childrenMenuPreference;
      }

      if (Object.keys(payload).length === 0) {
        throw new Error(`Nu există câmpuri de actualizat pentru guestId ${entry.guestId}.`);
      }

      return {
        guestId: entry.guestId.trim(),
        payload,
      };
    });

    const uniqueGuestIds = [...new Set(normalizedUpdates.map((entry: BulkGuestUpdateEntry) => entry.guestId))];
    if (uniqueGuestIds.length !== normalizedUpdates.length) {
      return res.status(400).json({ error: "guestId-urile trebuie să fie unice în bulk-update." });
    }

    const referencedTableIds = [
      ...new Set(
        normalizedUpdates
          .map((entry: BulkGuestUpdateEntry) => entry.payload.tableId)
          .filter((tableId: string | null | undefined): tableId is string => typeof tableId === "string" && tableId.trim().length > 0),
      ),
    ];

    const [guestDocs, tableDocs] = await Promise.all([
      Promise.all(uniqueGuestIds.map((guestId: string) => database.collection("wh_guests").doc(guestId).get())),
      Promise.all(referencedTableIds.map((tableId: string) => database.collection("wh_tables").doc(tableId).get())),
    ]);

    const guestMap = new Map(guestDocs.map((doc) => [doc.id, doc]));
    const tableMap = new Map(tableDocs.map((doc) => [doc.id, doc]));

    for (const entry of normalizedUpdates) {
      const guestDoc = guestMap.get(entry.guestId);
      if (!guestDoc?.exists || guestDoc.data()?.weddingId !== weddingId) {
        return res.status(404).json({ error: `Invitatul ${entry.guestId} nu a fost găsit.` });
      }

      if (typeof entry.payload.tableId === "string" && entry.payload.tableId.trim()) {
        const tableDoc = tableMap.get(entry.payload.tableId);
        if (!tableDoc?.exists || tableDoc.data()?.weddingId !== weddingId) {
          return res.status(404).json({ error: `Masa ${entry.payload.tableId} nu a fost găsită.` });
        }
      }
    }

    const batch = database.batch();
    normalizedUpdates.forEach((entry: BulkGuestUpdateEntry) => {
      const guestDoc = guestMap.get(entry.guestId)!;
      batch.update(guestDoc.ref, entry.payload);
    });
    await batch.commit();

    const updatedDocs = await Promise.all(uniqueGuestIds.map((guestId: string) => database.collection("wh_guests").doc(guestId).get()));
    res.json({
      ok: true,
      updatedGuests: updatedDocs.map((doc) => serializeGuest(doc)).filter((guest): guest is SerializedGuest => guest !== null),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nu s-au putut actualiza invitații.";
    console.error("[wedding-hub] POST /guests/bulk-update failed:", error);
    res.status(500).json({ error: message });
  }
});

// DELETE /api/wedding-hub/guests/:guestId — delete guest
router.delete("/guests/:guestId", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const database = firestore();
    const coupleReq = req as CoupleAuthenticatedRequest;
    const { weddingId } = coupleReq;
    const { guestId } = req.params;

    const guestDoc = await database.collection("wh_guests").doc(guestId).get();
    if (!guestDoc.exists || guestDoc.data()?.weddingId !== weddingId) {
      return res.status(404).json({ error: "Invitatul nu a fost găsit." });
    }

    await database.collection("wh_guests").doc(guestId).delete();
    res.json({ ok: true });
  } catch (error) {
    console.error("[wedding-hub] DELETE /guests/:guestId failed:", error);
    res.status(500).json({ error: "Nu s-a putut șterge invitatul." });
  }
});

// POST /api/wedding-hub/tables — create table
router.post("/tables", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const database = firestore();
    const coupleReq = req as CoupleAuthenticatedRequest;
    const { weddingId } = coupleReq;
    const { tableName, tableAlias, capacity } = req.body;

    if (!tableName?.trim()) {
      return res.status(400).json({ error: "Numele mesei este obligatoriu." });
    }

    const tableDoc = {
      weddingId,
      tableName: tableName.trim(),
      tableAlias: typeof tableAlias === "string" && tableAlias.trim() ? tableAlias.trim() : null,
      capacity: Number(capacity) || 8,
      createdAt: Timestamp.now(),
    };

    const docRef = await database.collection("wh_tables").add(tableDoc);

    res.status(201).json({
      id: docRef.id,
      ...tableDoc,
      createdAt: tableDoc.createdAt.toDate().toISOString(),
    });
  } catch (error) {
    console.error("[wedding-hub] POST /tables failed:", error);
    res.status(500).json({ error: "Nu s-a putut crea masa." });
  }
});

// PATCH /api/wedding-hub/tables/:tableId — update table
router.patch("/tables/:tableId", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const database = firestore();
    const coupleReq = req as CoupleAuthenticatedRequest;
    const { weddingId } = coupleReq;
    const { tableId } = req.params;

    const tableDoc = await database.collection("wh_tables").doc(tableId).get();
    if (!tableDoc.exists || tableDoc.data()?.weddingId !== weddingId) {
      return res.status(404).json({ error: "Masa nu a fost găsită." });
    }

    const updates: Record<string, unknown> = {};
    if (req.body.tableName !== undefined) updates.tableName = req.body.tableName.trim();
    if (req.body.tableAlias !== undefined) {
      updates.tableAlias = typeof req.body.tableAlias === "string" && req.body.tableAlias.trim() ? req.body.tableAlias.trim() : null;
    }
    if (req.body.capacity !== undefined) updates.capacity = Number(req.body.capacity);

    await database.collection("wh_tables").doc(tableId).update(updates);

    const updated = await database.collection("wh_tables").doc(tableId).get();
    const updatedData = updated.data()!;
    res.json({
      id: updated.id,
      ...updatedData,
      createdAt: serializeTimestamp(updatedData.createdAt),
    });
  } catch (error) {
    console.error("[wedding-hub] PATCH /tables/:tableId failed:", error);
    res.status(500).json({ error: "Nu s-a putut actualiza masa." });
  }
});

// DELETE /api/wedding-hub/tables/:tableId — delete table + unassign all guests
router.delete("/tables/:tableId", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const database = firestore();
    const coupleReq = req as CoupleAuthenticatedRequest;
    const { weddingId } = coupleReq;
    const { tableId } = req.params;

    const tableDoc = await database.collection("wh_tables").doc(tableId).get();
    if (!tableDoc.exists || tableDoc.data()?.weddingId !== weddingId) {
      return res.status(404).json({ error: "Masa nu a fost găsită." });
    }

    const assignedGuestsSnapshot = await database
      .collection("wh_guests")
      .where("weddingId", "==", weddingId)
      .where("tableId", "==", tableId)
      .get();

    const batch = database.batch();
    assignedGuestsSnapshot.docs.forEach((guestDoc) => {
      batch.update(guestDoc.ref, { tableId: null });
    });
    batch.delete(tableDoc.ref);
    await batch.commit();

    res.json({ ok: true, unassignedGuestIds: assignedGuestsSnapshot.docs.map((d) => d.id) });
  } catch (error) {
    console.error("[wedding-hub] DELETE /tables/:tableId failed:", error);
    res.status(500).json({ error: "Nu s-a putut șterge masa." });
  }
});

// ─── PUBLIC INVITATION ENDPOINTS ─────────────────────────────────────────────

const rsvpRateLimiter = new Map<string, { count: number; resetAt: number }>();

function checkRsvpRateLimit(token: string): boolean {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxRequests = 10;
  const entry = rsvpRateLimiter.get(token);
  if (!entry || now > entry.resetAt) {
    rsvpRateLimiter.set(token, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count += 1;
  return true;
}

// GET /api/wedding-hub/invite/:token — resolve invitation token (public)
router.get("/invite/:token", async (req: Request, res: Response) => {
  try {
    const database = firestore();
    const { token } = req.params;

    const guestSnapshot = await database
      .collection("wh_guests")
      .where("inviteToken", "==", token)
      .limit(1)
      .get();

    if (guestSnapshot.empty) {
      return res.status(404).json({ error: "Invitația nu a fost găsită." });
    }

    const guestDoc = guestSnapshot.docs[0];
    const guestData = guestDoc.data();

    const weddingDoc = await database.collection("wh_weddings").doc(guestData.weddingId).get();
    if (!weddingDoc.exists) {
      return res.status(404).json({ error: "Evenimentul nu a fost găsit." });
    }
    const weddingData = weddingDoc.data()!;

    await guestDoc.ref.update({ lastOpenedAt: Timestamp.now() });

    res.json({
      guestId: guestDoc.id,
      guestFirstName: guestData.firstName,
      guestLastName: guestData.lastName,
      rsvpStatus: guestData.rsvpStatus,
      menuPreference: guestData.menuPreference ?? null,
      childrenMenuPreference: guestData.childrenMenuPreference ?? null,
      adultsCount: guestData.adultsCount ?? 1,
      childrenCount: guestData.childrenCount ?? 0,
      accompanyingAdultNames: Array.isArray(guestData.accompanyingAdultNames) ? guestData.accompanyingAdultNames : [],
      childrenNames: Array.isArray(guestData.childrenNames) ? guestData.childrenNames : [],
      sameTableWithFamily: Boolean(guestData.sameTableWithFamily),
      acceptanceMessage: typeof guestData.acceptanceMessage === "string" ? guestData.acceptanceMessage : "",
      rsvpSubmittedAt: serializeTimestamp(guestData.rsvpSubmittedAt),
      wedding: {
        brideFirstName: weddingData.brideFirstName,
        groomFirstName: weddingData.groomFirstName,
        weddingDate: weddingData.weddingDate,
        city: weddingData.city,
        venueName: weddingData.venueName ?? "",
        venueAddress: weddingData.venueAddress ?? "",
      },
    });
  } catch (error) {
    console.error("[wedding-hub] GET /invite/:token failed:", error);
    res.status(500).json({ error: "Eroare server." });
  }
});

// POST /api/wedding-hub/invite/:token/rsvp — submit RSVP (public)
router.post("/invite/:token/rsvp", async (req: Request, res: Response) => {
  try {
    const database = firestore();
    const { token } = req.params;

    if (!checkRsvpRateLimit(token)) {
      return res.status(429).json({ error: "Prea multe cereri. Încearcă din nou în 15 minute." });
    }

    const {
      rsvpStatus,
      menuPreference,
      childrenMenuPreference,
      adultsCount,
      childrenCount,
      accompanyingAdultNames,
      childrenNames,
      sameTableWithFamily,
      declineReasons,
      declineReasonDetails,
      acceptanceMessage,
    } = req.body;

    if (!["confirmat", "refuzat"].includes(rsvpStatus)) {
      return res.status(400).json({ error: "Status RSVP invalid." });
    }

    const guestSnapshot = await database
      .collection("wh_guests")
      .where("inviteToken", "==", token)
      .limit(1)
      .get();

    if (guestSnapshot.empty) {
      return res.status(404).json({ error: "Invitația nu a fost găsită." });
    }

    const guestDoc = guestSnapshot.docs[0];
    const guestData = guestDoc.data();
    const weddingDoc = await database.collection("wh_weddings").doc(guestData.weddingId).get();
    if (!weddingDoc.exists) {
      return res.status(404).json({ error: "Evenimentul nu a fost găsit." });
    }

    const updates: Record<string, unknown> = {
      rsvpStatus,
      rsvpSubmittedAt: Timestamp.now(),
    };

    if (rsvpStatus === "confirmat") {
      const normalizedAdultsCount = Number(adultsCount) || 1;
      const normalizedChildrenCount = Number(childrenCount) || 0;
      updates.menuPreference = menuPreference ?? null;
      updates.childrenMenuPreference = childrenMenuPreference ?? null;
      updates.adultsCount = normalizedAdultsCount;
      updates.childrenCount = normalizedChildrenCount;
      updates.accompanyingAdultNames = sanitizeNameList(accompanyingAdultNames, Math.max(0, normalizedAdultsCount - 1));
      updates.childrenNames = sanitizeNameList(childrenNames, normalizedChildrenCount);
      updates.sameTableWithFamily = Boolean(sameTableWithFamily);
      updates.declineReasons = [];
      updates.declineReasonDetails = "";
      updates.acceptanceMessage = typeof acceptanceMessage === "string" ? acceptanceMessage.trim() : "";
    } else {
      const normalizedDeclineReasons = Array.isArray(declineReasons)
        ? declineReasons.filter((reason): reason is string => typeof reason === "string" && DECLINE_REASONS.has(reason))
        : [];
      updates.declineReasons = [...new Set(normalizedDeclineReasons)];
      updates.declineReasonDetails = typeof declineReasonDetails === "string" ? declineReasonDetails.trim() : "";
      updates.sameTableWithFamily = false;
      updates.acceptanceMessage = "";
    }

    await guestDoc.ref.update(updates);

    const weddingData = weddingDoc.data()!;
    const emailNotificationsEnabled = Boolean(weddingData.settings?.emailNotificationsEnabled);
    const notifyOnAccept = Boolean(weddingData.settings?.notifyOnAccept ?? emailNotificationsEnabled);
    const notifyOnDecline = Boolean(weddingData.settings?.notifyOnDecline ?? emailNotificationsEnabled);
    const shouldSendEmail = emailNotificationsEnabled && (
      (rsvpStatus === "confirmat" && notifyOnAccept) ||
      (rsvpStatus === "refuzat" && notifyOnDecline)
    );

    if (shouldSendEmail && weddingData.coupleEmail) {
      const guestName = `${guestData.firstName} ${guestData.lastName}`.trim();
      const weddingName = `${weddingData.brideFirstName} & ${weddingData.groomFirstName}`;
      const responseLabel = rsvpStatus === "confirmat" ? "a confirmat participarea" : "a refuzat invitația";
      const summaryLines = [
        `<p style="margin:0 0 12px;">Invitatul <strong>${guestName}</strong> ${responseLabel} la nunta voastră.</p>`,
      ];

      if (rsvpStatus === "confirmat") {
        const normalizedAdultsCount = Number(adultsCount) || 1;
        const normalizedChildrenCount = Number(childrenCount) || 0;
        const accompanyingAdultNames = sanitizeNameList(updates.accompanyingAdultNames, Math.max(0, normalizedAdultsCount - 1));
        const childrenNames = sanitizeNameList(updates.childrenNames, normalizedChildrenCount);
        const familyNames = [
          ...accompanyingAdultNames.filter(Boolean),
          ...childrenNames.filter(Boolean),
        ];

        summaryLines.push(
          `<p style="margin:0 0 8px;"><strong>Adulți:</strong> ${normalizedAdultsCount}</p>`,
          `<p style="margin:0 0 8px;"><strong>Copii:</strong> ${normalizedChildrenCount}</p>`,
          `<p style="margin:0 0 8px;"><strong>Meniu adulți:</strong> ${menuPreference ?? "Nespecificat"}</p>`,
          `<p style="margin:0 0 8px;"><strong>Meniu copii:</strong> ${childrenMenuPreference ?? "Nespecificat"}</p>`,
          `<p style="margin:0 0 8px;"><strong>Vrem să stăm toți la aceeași masă:</strong> ${Boolean(sameTableWithFamily) ? "Da" : "Nu"}</p>`,
        );

        if (familyNames.length > 0) {
          summaryLines.push(
            `<p style="margin:0 0 8px;"><strong>Nume însoțitori:</strong> ${familyNames.map((name) => name || "Nespecificat").join(", ")}</p>`,
          );
        }

        if (typeof updates.acceptanceMessage === "string" && updates.acceptanceMessage.trim()) {
          summaryLines.push(
            `<p style="margin:0 0 8px;"><strong>Mesaj de la invitat:</strong> ${escapeHtml(updates.acceptanceMessage)}</p>`,
          );
        }
      } else {
        const normalizedDeclineReasons = Array.isArray(updates.declineReasons) ? updates.declineReasons as string[] : [];
        const declineLabels = normalizedDeclineReasons
          .map((reason) => DECLINE_REASON_LABELS[reason] ?? reason)
          .join(", ");

        if (declineLabels) {
          summaryLines.push(
            `<p style="margin:0 0 8px;"><strong>Motiv selectat:</strong> ${declineLabels}</p>`,
          );
        }

        if (typeof updates.declineReasonDetails === "string" && updates.declineReasonDetails.trim()) {
          summaryLines.push(
            `<p style="margin:0 0 8px;"><strong>Detalii:</strong> ${updates.declineReasonDetails}</p>`,
          );
        }
      }

      summaryLines.push(
        `<p style="margin:16px 0 0;color:#737373;font-size:13px;">Wedding Hub · ${weddingName}</p>`,
      );

      sendEmail({
        to: weddingData.coupleEmail,
        subject: `RSVP nou: ${guestName} ${rsvpStatus === "confirmat" ? "a confirmat" : "a refuzat"}`,
        html: `
          <div style="font-family:Arial,sans-serif;background:#111;padding:24px;color:#f5f5f5;">
            <div style="max-width:560px;margin:0 auto;border:1px solid #262626;border-radius:16px;padding:24px;background:#171717;">
              <p style="margin:0 0 6px;color:#fb7185;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;">Wedding Hub</p>
              <h1 style="margin:0 0 18px;font-size:24px;font-weight:400;color:#fff;">Răspuns nou la invitație</h1>
              ${summaryLines.join("")}
            </div>
          </div>
        `,
      }).catch((error) => {
        console.error("[wedding-hub] RSVP couple notification email failed:", error);
      });
    }

    res.json({ ok: true, rsvpStatus });
  } catch (error) {
    console.error("[wedding-hub] POST /invite/:token/rsvp failed:", error);
    res.status(500).json({ error: "Eroare la salvarea răspunsului." });
  }
});

// ─── TIMELINE ENDPOINTS ───────────────────────────────────────────────────────

const TIMELINE_TEMPLATE = [
  { title: "Trezire & pregătiri", startTime: "07:00", endTime: "10:00", category: "other", location: "", notes: "" },
  { title: "Cununie Civilă", startTime: "10:00", endTime: "11:30", category: "civil", location: "Starea Civilă", notes: "" },
  { title: "Sesiune foto oficială", startTime: "11:30", endTime: "13:00", category: "photos", location: "", notes: "" },
  { title: "Cununie Religioasă", startTime: "13:00", endTime: "14:30", category: "church", location: "Biserica", notes: "" },
  { title: "Fotografii cu nașii", startTime: "14:30", endTime: "15:30", category: "photos", location: "", notes: "" },
  { title: "Sesiune foto cuplu", startTime: "15:30", endTime: "17:00", category: "photos", location: "", notes: "" },
  { title: "Cocktail & primire invitați", startTime: "17:00", endTime: "19:00", category: "restaurant", location: "", notes: "" },
  { title: "Deschiderea petrecerii", startTime: "19:00", endTime: "20:00", category: "party", location: "", notes: "" },
  { title: "Cina & program artistic", startTime: "20:00", endTime: "01:00", category: "restaurant", location: "", notes: "" },
  { title: "Finalul serii", startTime: "01:00", endTime: "03:00", category: "party", location: "", notes: "" },
];

// GET /api/wedding-hub/timeline
router.get("/timeline", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const database = firestore();
    const coupleReq = req as CoupleAuthenticatedRequest;
    const snapshot = await database
      .collection("wh_timeline")
      .where("weddingId", "==", coupleReq.weddingId)
      .get();
    const moments = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    moments.sort((momentA: any, momentB: any) => momentA.startTime.localeCompare(momentB.startTime));
    res.json({ moments });
  } catch (error) {
    console.error("[wedding-hub] GET /timeline failed:", error);
    res.status(500).json({ error: "Nu s-a putut încărca timeline-ul." });
  }
});

// POST /api/wedding-hub/timeline
router.post("/timeline", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const coupleReq = req as CoupleAuthenticatedRequest;
    const { title, startTime, endTime, location, notes, category } = req.body;
    if (!title?.trim() || !startTime || !endTime) {
      return res.status(400).json({ error: "Titlu, ora start și ora final sunt obligatorii." });
    }
    const now = new Date().toISOString();
    const newMoment = {
      weddingId: coupleReq.weddingId,
      title: title.trim(),
      startTime,
      endTime,
      location: location?.trim() ?? "",
      notes: notes?.trim() ?? "",
      category: category ?? "other",
      isFromTemplate: false,
      createdAt: now,
      updatedAt: now,
    };
    const docRef = await firestore().collection("wh_timeline").add(newMoment);
    res.json({ id: docRef.id, ...newMoment });
  } catch (error) {
    console.error("[wedding-hub] POST /timeline failed:", error);
    res.status(500).json({ error: "Nu s-a putut adăuga momentul." });
  }
});

// PATCH /api/wedding-hub/timeline/:momentId
router.patch("/timeline/:momentId", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const coupleReq = req as CoupleAuthenticatedRequest;
    const { momentId } = req.params;
    const database = firestore();
    const docRef = database.collection("wh_timeline").doc(momentId);
    const doc = await docRef.get();
    if (!doc.exists || doc.data()!.weddingId !== coupleReq.weddingId) {
      return res.status(404).json({ error: "Momentul nu a fost găsit." });
    }
    const { title, startTime, endTime, location, notes, category } = req.body;
    if (!title?.trim() || !startTime || !endTime) {
      return res.status(400).json({ error: "Titlu, ora start și ora final sunt obligatorii." });
    }
    const updates = {
      title: title.trim(),
      startTime,
      endTime,
      location: location?.trim() ?? "",
      notes: notes?.trim() ?? "",
      category: category ?? "other",
      updatedAt: new Date().toISOString(),
    };
    await docRef.update(updates);
    res.json({ id: momentId, ...doc.data(), ...updates });
  } catch (error) {
    console.error("[wedding-hub] PATCH /timeline/:id failed:", error);
    res.status(500).json({ error: "Nu s-a putut salva momentul." });
  }
});

// DELETE /api/wedding-hub/timeline/:momentId
router.delete("/timeline/:momentId", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const coupleReq = req as CoupleAuthenticatedRequest;
    const { momentId } = req.params;
    const database = firestore();
    const docRef = database.collection("wh_timeline").doc(momentId);
    const doc = await docRef.get();
    if (!doc.exists || doc.data()!.weddingId !== coupleReq.weddingId) {
      return res.status(404).json({ error: "Momentul nu a fost găsit." });
    }
    await docRef.delete();
    res.json({ ok: true });
  } catch (error) {
    console.error("[wedding-hub] DELETE /timeline/:id failed:", error);
    res.status(500).json({ error: "Nu s-a putut șterge momentul." });
  }
});

// POST /api/wedding-hub/timeline/apply-template
router.post("/timeline/apply-template", requireCoupleAuth, async (req: Request, res: Response) => {
  try {
    const coupleReq = req as CoupleAuthenticatedRequest;
    const database = firestore();
    const now = new Date().toISOString();
    const batch = database.batch();
    const newMoments: object[] = [];

    for (const template of TIMELINE_TEMPLATE) {
      const docRef = database.collection("wh_timeline").doc();
      const moment = {
        weddingId: coupleReq.weddingId,
        ...template,
        isFromTemplate: true,
        createdAt: now,
        updatedAt: now,
      };
      batch.set(docRef, moment);
      newMoments.push({ id: docRef.id, ...moment });
    }

    await batch.commit();
    res.json({ moments: newMoments });
  } catch (error) {
    console.error("[wedding-hub] POST /timeline/apply-template failed:", error);
    res.status(500).json({ error: "Nu s-a putut aplica șablonul." });
  }
});

export default router;
