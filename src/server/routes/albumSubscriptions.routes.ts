import express, { type Request, type Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { sendEmail } from "../notifications/mailer";
import { adminUser } from "../constants/credentials";
import { getClientIp, fetchIpInfo } from "../utils/ipinfo";
import { APP_BASE_URL } from "../constants/domain";
import { logActivity, getNotificationSettings } from "../services/activity.service.js";
import crypto from "node:crypto";
import { listOpenPromises, markPromiseDone } from "../services/albumPromises";
import { isSmsConfigured, normalizeRomanianPhoneNumber, sendSms } from "../notifications/sms";
import {
  ALBUM_UPDATE_META,
  ALBUM_UPDATE_TEXT_MAX,
  AUTOMATED_MESSAGE_LABEL,
  CONTACT_PHONE_DISPLAY,
  SUBSCRIBE_CHANNEL_META,
  albumUpdateMessage,
  formatEstimateDate,
  isValidEmail,
  kindHasDate,
  parseAlbumUpdateKind,
  parseEstimateDate,
  parsePhoneDelivery,
  parseSubscribeChannels,
  phoneChannelsFor,
  type AlbumUpdate,
  type SubscribeChannel,
} from "../../shared/albumUpdates";

const router = express.Router();
const COLLECTION = "albumSubscriptions";
const UPDATES_COLLECTION = "albumUpdates";
const BASE_URL = APP_BASE_URL;
const ALBUM_SLUG = /^[a-z0-9][a-z0-9-_]{0,120}$/i;

type SubscriberDoc = {
  albumSlug: string;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  channels?: SubscribeChannel[];
  unsubscribeToken?: string;
};

const escHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Subscribers saved before channels existed were email-only. */
const channelsOf = (doc: SubscriberDoc): SubscribeChannel[] =>
  Array.isArray(doc.channels) && doc.channels.length ? doc.channels : doc.email ? ["email"] : [];

const unsubscribeUrl = (token?: string) => (token ? `${BASE_URL}/api/album-subscriptions/stop/${token}` : "");

// POST /subscribe — subscribe email to album notifications (no auth required)
// Body: { albumSlug, channels: ["email"|"sms"|"whatsapp"], email?, phone?, name? }.
// Older clients send only { albumSlug, email } → email channel.
type SubscribeInput = { albumSlug: string; channels: SubscribeChannel[]; email: string; phone: string | null; name: string | null };

/** Validates a subscribe body; returns the cleaned input or a user-facing error. */
function parseSubscribeBody(raw: unknown): SubscribeInput | { error: string } {
  const body = (raw ?? {}) as { albumSlug?: string; email?: string; phone?: string; name?: string; channels?: unknown };
  const albumSlug = String(body.albumSlug ?? "");
  const channels = body.channels === undefined ? (["email"] as SubscribeChannel[]) : parseSubscribeChannels(body.channels);
  if (!ALBUM_SLUG.test(albumSlug)) return { error: "Album invalid." };
  if (channels.length === 0) return { error: "Alege cel puțin un canal: Email, SMS sau WhatsApp." };
  const wantsEmail = channels.includes("email");
  const wantsPhone = channels.includes("sms") || channels.includes("whatsapp");
  const email = wantsEmail ? String(body.email ?? "").trim().toLowerCase() : "";
  if (wantsEmail && !isValidEmail(email)) return { error: "Scrie o adresă de email validă." };
  const phone = wantsPhone ? normalizeRomanianPhoneNumber(String(body.phone ?? "")) : null;
  if (wantsPhone && !phone) return { error: "Scrie un număr de telefon valid (ex. 07xx xxx xxx)." };
  const name = String(body.name ?? "").trim().slice(0, 80) || null;
  return { albumSlug, channels, email, phone, name };
}

/** Same email/phone on the album → merge channels instead of creating a duplicate. */
async function upsertSubscriber(
  input: SubscribeInput,
  source: "form" | "admin",
): Promise<{ created: boolean; channels: SubscribeChannel[]; unsubscribeToken?: string }> {
  const { albumSlug, channels, email, phone, name } = input;
  const collection = firestore().collection(COLLECTION);
  const [byEmail, byPhone] = await Promise.all([
    email ? collection.where("albumSlug", "==", albumSlug).where("email", "==", email).get() : null,
    phone ? collection.where("albumSlug", "==", albumSlug).where("phone", "==", phone).get() : null,
  ]);
  const firstDoc = (snap: typeof byEmail) => (snap && !snap.empty ? snap.docs[0] : undefined);
  const existing = firstDoc(byEmail) ?? firstDoc(byPhone);
  if (existing) {
    const merged = Array.from(new Set([...channelsOf(existing.data() as SubscriberDoc), ...channels]));
    await existing.ref.update({
      channels: merged,
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      ...(name ? { name } : {}),
    });
    return { created: false, channels: merged };
  }
  const unsubscribeToken = crypto.randomBytes(12).toString("hex");
  await collection.add({
    albumSlug,
    email: email || null,
    phone,
    name,
    channels,
    ...(source === "admin" ? { source } : {}),
    unsubscribeToken,
    subscribedAt: Timestamp.now(),
  });
  return { created: true, channels, unsubscribeToken };
}

router.post("/subscribe", async (req: Request, res: Response) => {
  const parsed = parseSubscribeBody(req.body);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { albumSlug, channels, email: normalizedEmail, phone } = parsed;
  const normalizedEmailForLog = [normalizedEmail, phone].filter(Boolean).join(" · ");
  try {
    const result = await upsertSubscriber(parsed, "form");
    if (!result.created) {
      res.json({ ok: true, alreadySubscribed: true, channels: result.channels });
      return;
    }

    // Confirmation to the subscriber — email only: a public form must not be able to spend SMS credit.
    if (normalizedEmail) {
      sendEmail({
        to: normalizedEmail,
        source: "album-subscribe-confirmation",
        subject: "[Mesaj automat] ✅ Te-ai abonat la noutățile albumului — Anca Visuals",
        html: subscribeConfirmationEmail(albumSlug, result.channels, parsed.name, result.unsubscribeToken),
      }).catch((error) => console.error("[album-subscriptions] confirmation email failed:", error));
    }

    // Log to activity inbox
    logActivity({
      type: "subscribe",
      title: `🔔 Abonat nou — ${albumSlug}`,
      description: `${normalizedEmailForLog} (${channels.map((c) => SUBSCRIBE_CHANNEL_META[c].label).join(", ")})`,
      metadata: { albumSlug, email: normalizedEmail, phone: phone ?? "", channels: channels.join(",") },
      emailSent: false,
    }).catch(() => {});

    // Send email only if enabled in settings
    getNotificationSettings()
      .then((settings) => {
        if (!settings.email.subscribe) return;
        return sendEmail({
          to: adminUser.email,
          subject: `🔔 Abonat nou la albumul ${albumSlug}`,
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
              <h2 style="color:#111;margin:0 0 16px;">Abonat nou la notificări album</h2>
              <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <tr><td style="padding:8px 0;color:#666;width:120px;">Album</td><td style="color:#111;font-weight:600;">${albumSlug}</td></tr>
                <tr><td style="padding:8px 0;color:#666;">Contact</td><td style="color:#111;font-weight:600;">${escHtml(normalizedEmailForLog)}</td></tr>
                <tr><td style="padding:8px 0;color:#666;">Canale</td><td style="color:#111;">${channels.map((c) => SUBSCRIBE_CHANNEL_META[c].label).join(", ")}</td></tr>
                <tr><td style="padding:8px 0;color:#666;">Data</td><td style="color:#111;">${new Date().toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" })}</td></tr>
              </table>
              <p style="margin:20px 0 0;">
                <a href="${BASE_URL}/media/${encodeURIComponent(albumSlug)}" style="display:inline-block;padding:10px 18px;background:#111;color:#fff;text-decoration:none;border-radius:8px;">Deschide albumul</a>
              </p>
            </div>
          `,
        });
      })
      .catch(() => {});

    res.status(201).json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// GET /click/:slug — track subscriber click-through from email, notify admin, then redirect
router.get("/click/:slug", async (req: Request, res: Response) => {
  const { slug } = req.params;
  const email = typeof req.query.email === "string" ? req.query.email.trim().toLowerCase() : "";
  const albumUrl = `${BASE_URL}/media/${slug}`;

  if (!slug || !email) {
    res.redirect(albumUrl);
    return;
  }

  try {
    const ip = getClientIp(req);
    const ipInfo = await fetchIpInfo(ip);
    const clickedAt = new Date().toLocaleString("ro-RO", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Europe/Bucharest",
    });

    const location = ipInfo
      ? [ipInfo.city, ipInfo.region, ipInfo.country].filter(Boolean).join(", ")
      : "unknown";

    await sendEmail({
      to: adminUser.email,
      subject: `👀 Subscriber opened album ${slug}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
          <h2 style="color:#111;margin:0 0 16px;">Subscriber clicked "Vezi albumul"</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:8px 0;color:#666;width:120px;">Album</td><td style="color:#111;font-weight:600;">${slug}</td></tr>
            <tr><td style="padding:8px 0;color:#666;">Email</td><td style="color:#111;font-weight:600;">${email}</td></tr>
            <tr><td style="padding:8px 0;color:#666;">Clicked at</td><td style="color:#111;">${clickedAt}</td></tr>
            <tr><td style="padding:8px 0;color:#666;">IP</td><td style="color:#111;">${ip || "unknown"}</td></tr>
            <tr><td style="padding:8px 0;color:#666;">Location</td><td style="color:#111;">${location}</td></tr>
          </table>
          <p style="margin:20px 0 0;">
            <a href="${albumUrl}" style="display:inline-block;padding:10px 18px;background:#111;color:#fff;text-decoration:none;border-radius:8px;">Open album</a>
          </p>
        </div>
      `,
    });
  } catch {
    // Ignore tracking failures and still redirect the subscriber to the album.
  }

  res.redirect(albumUrl);
});

// POST /notify/:slug — send notification email to all subscribers (admin only)
router.post("/notify/:slug", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { slug } = req.params;
  try {
    const db = firestore();
    const snapshot = await db
      .collection(COLLECTION)
      .where("albumSlug", "==", slug)
      .get();

    if (snapshot.empty) {
      res.json({ ok: true, sent: 0 });
      return;
    }

    const emails = snapshot.docs.map((doc) => (doc.data() as { email: string }).email);

    await Promise.all(
      emails.map((email) =>
        sendEmail({
          to: email,
          subject: "Poze noi au fost adăugate în albumul tău 📸",
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#0a0a0a;color:#fff;">
              <h1 style="font-size:22px;font-weight:500;margin:0 0 12px;">Fotograful a adăugat poze noi! 🎉</h1>
              <p style="color:#aaa;font-size:15px;line-height:1.6;margin:0 0 24px;">
                Albumul <strong style="color:#fff">${slug}</strong> a fost actualizat cu fotografii și/sau videoclipuri noi.
              </p>
              <a href="${BASE_URL}/api/album-subscriptions/click/${encodeURIComponent(slug)}?email=${encodeURIComponent(email)}" style="display:inline-block;padding:12px 24px;background:#fff;color:#000;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">
                Vezi albumul →
              </a>
              <hr style="border:none;border-top:1px solid #222;margin:32px 0;" />
              <p style="color:#555;font-size:12px;">
                Ai primit acest email deoarece te-ai abonat la notificările pentru albumul <em>${slug}</em>.
              </p>
            </div>
          `,
        })
      )
    );

    res.json({ ok: true, sent: emails.length });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// GET /count/:slug — returns subscriber count for an album (admin only)
router.get("/count/:slug", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { slug } = req.params;
  try {
    const db = firestore();
    const snapshot = await db
      .collection(COLLECTION)
      .where("albumSlug", "==", slug)
      .get();
    res.json({ count: snapshot.size });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// POST /admin-add — the admin adds a subscriber by hand (e.g. themselves); no admin notification.
router.post("/admin-add", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const parsed = parseSubscribeBody(req.body);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  try {
    const result = await upsertSubscriber(parsed, "admin");
    res.status(result.created ? 201 : 200).json({ ok: true, alreadySubscribed: !result.created, channels: result.channels });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// GET /list/:slug — returns subscriber emails for an album (admin only)
router.get("/list/:slug", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { slug } = req.params;
  try {
    const db = firestore();
    const snapshot = await db
      .collection(COLLECTION)
      .where("albumSlug", "==", slug)
      .get();
    const subscribers = snapshot.docs.map(doc => ({
      id: doc.id,
      source: (doc.data().source as string | undefined) ?? "form",
      email: (doc.data().email as string | null) ?? "",
      phone: (doc.data().phone as string | null) ?? null,
      name: (doc.data().name as string | null) ?? null,
      channels: channelsOf(doc.data() as SubscriberDoc),
      subscribedAt: doc.data().subscribedAt ?? null,
    }));
    res.json({ subscribers });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// DELETE /unsubscribe — removes a subscriber by albumSlug + id (phone-only subscribers) or + email (admin only)
router.delete("/unsubscribe", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { albumSlug, email, id } = req.body as { albumSlug?: string; email?: string; id?: string };
  if (albumSlug && typeof id === "string" && id) {
    try {
      const ref = firestore().collection(COLLECTION).doc(id);
      const doc = await ref.get();
      if (!doc.exists || doc.data()?.albumSlug !== albumSlug) {
        res.status(404).json({ error: "Abonatul nu a fost găsit." });
        return;
      }
      await ref.delete();
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
    return;
  }
  if (!albumSlug || !email) {
    res.status(400).json({ error: "albumSlug și email sunt obligatorii." });
    return;
  }
  const normalizedEmail = email.trim().toLowerCase();
  try {
    const db = firestore();
    const snapshot = await db
      .collection(COLLECTION)
      .where("albumSlug", "==", albumSlug)
      .where("email", "==", normalizedEmail)
      .get();
    if (snapshot.empty) {
      res.status(404).json({ error: "Abonatul nu a fost găsit." });
      return;
    }
    await Promise.all(snapshot.docs.map(doc => doc.ref.delete()));
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/* ---------- Noutăți album (estimări, poze noi, anunțuri) ---------- */

function toAlbumUpdate(id: string, data: Record<string, unknown>): AlbumUpdate | null {
  const kind = parseAlbumUpdateKind(data.kind);
  if (!kind) return null;
  const createdAt = data.createdAt as Timestamp | undefined;
  return {
    id,
    kind,
    text: String(data.text ?? ""),
    estimateDate: parseEstimateDate(data.estimateDate),
    createdAt: typeof createdAt?.toDate === "function" ? createdAt.toDate().toISOString() : null,
  };
}

// GET /updates/:slug — public timeline shown on the album page, newest first.
router.get("/updates/:slug", async (req: Request, res: Response) => {
  const { slug } = req.params;
  if (!ALBUM_SLUG.test(slug)) {
    res.status(400).json({ error: "Album invalid." });
    return;
  }
  try {
    const snapshot = await firestore().collection(UPDATES_COLLECTION).where("albumSlug", "==", slug).get();
    const updates = snapshot.docs
      .map((doc) => toAlbumUpdate(doc.id, doc.data()))
      .filter((u): u is AlbumUpdate => u !== null)
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    res.json({ updates });
  } catch (error) {
    console.error("[album-updates] list failed:", error);
    res.status(500).json({ error: "Nu am putut încărca noutățile." });
  }
});

export function subscribeConfirmationEmail(
  slug: string,
  channels: readonly SubscribeChannel[],
  name: string | null | undefined,
  token: string | undefined,
): string {
  const albumUrl = `${BASE_URL}/media/${encodeURIComponent(slug)}`;
  const stop = unsubscribeUrl(token);
  const firstName = name?.trim().split(/\s+/)[0];
  const channelList = channels.map((c) => SUBSCRIBE_CHANNEL_META[c].label).join(", ");
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#0a0a0a;color:#fff;">
      <p style="color:#999;font-size:12px;line-height:1.5;border-left:2px solid #c9a96e;padding:2px 0 2px 10px;margin:0 0 20px;">${AUTOMATED_MESSAGE_LABEL}</p>
      <p style="color:#c9a96e;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:0 0 8px;">✅ Abonare confirmată</p>
      <h1 style="font-size:22px;font-weight:500;margin:0 0 12px;">${firstName ? `Bună, ${escHtml(firstName)}!` : "Bună!"}</h1>
      <p style="color:#ddd;font-size:15px;line-height:1.6;margin:0 0 12px;">Te-ai abonat la noutățile albumului <strong>${escHtml(slug)}</strong>.</p>
      <p style="color:#ddd;font-size:15px;line-height:1.6;margin:0 0 24px;">Îți scriem pe <strong>${escHtml(channelList)}</strong> când apar poze noi, o estimare de livrare sau un anunț de la fotograf.</p>
      <a href="${albumUrl}" style="display:inline-block;padding:12px 24px;background:#fff;color:#000;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">Vezi albumul →</a>
      <hr style="border:none;border-top:1px solid #222;margin:32px 0;" />
      <p style="color:#555;font-size:12px;">Nu te-ai abonat tu? Poți ignora acest mesaj${stop ? ` sau te poți <a href="${stop}" style="color:#777;">dezabona aici</a>` : ""}. Pentru întrebări, scrie-ne pe WhatsApp la ${CONTACT_PHONE_DISPLAY}.</p>
    </div>`;
}

function albumUpdateEmail(update: AlbumUpdate, slug: string, subscriber: SubscriberDoc): string {
  const meta = ALBUM_UPDATE_META[update.kind];
  const clickUrl = `${BASE_URL}/api/album-subscriptions/click/${encodeURIComponent(slug)}?email=${encodeURIComponent(subscriber.email ?? "")}`;
  const stop = unsubscribeUrl(subscriber.unsubscribeToken);
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#0a0a0a;color:#fff;">
      <p style="color:#999;font-size:12px;line-height:1.5;border-left:2px solid #c9a96e;padding:2px 0 2px 10px;margin:0 0 20px;">${AUTOMATED_MESSAGE_LABEL}</p>
      <p style="color:#c9a96e;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:0 0 8px;">${meta.emoji} ${meta.label}</p>
      ${update.estimateDate ? `<h1 style="font-size:22px;font-weight:500;margin:0 0 12px;">${escHtml(formatEstimateDate(update.estimateDate))}</h1>` : ""}
      <p style="color:#ddd;font-size:15px;line-height:1.6;margin:0 0 24px;white-space:pre-line;">${escHtml(update.text)}</p>
      <a href="${clickUrl}" style="display:inline-block;padding:12px 24px;background:#fff;color:#000;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">Vezi albumul →</a>
      <hr style="border:none;border-top:1px solid #222;margin:32px 0;" />
      <p style="color:#555;font-size:12px;">Ai primit acest mesaj pentru că te-ai abonat la noutățile albumului <em>${escHtml(slug)}</em>. Pentru întrebări, scrie-ne pe WhatsApp la ${CONTACT_PHONE_DISPLAY}.${stop ? ` <a href="${stop}" style="color:#777;">Dezabonare</a>` : ""}</p>
    </div>`;
}

type WhatsappRecipient = { name: string | null; phone: string; link: string };

const formatPhone = (phone: string) => phone.replace(/^\+40(\d{3})(\d{3})(\d{3})$/, "0$1 $2 $3");

/**
 * Email to the admin with a WhatsApp-style preview of the message and one button per
 * subscriber that opens WhatsApp with the text already filled in (no WhatsApp API needed).
 */
export function whatsappAdminEmail(slug: string, message: string, recipients: WhatsappRecipient[]): string {
  const now = new Date().toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" });
  const bubble = escHtml(message).replace(/(https?:\/\/[^\s<]+)/g, '<span style="color:#027eb5;text-decoration:underline;">$1</span>');
  const buttons = recipients.map((r) => `
      <tr><td style="padding:6px 0;">
        <a href="${r.link}" style="display:block;padding:14px 18px;background:#25D366;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;text-align:center;">
          Trimite pe WhatsApp → ${escHtml(r.name || formatPhone(r.phone))}${r.name ? ` <span style="font-weight:400;opacity:0.85;">(${escHtml(formatPhone(r.phone))})</span>` : ""}
        </a>
      </td></tr>`).join("");
  return `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <h2 style="color:#111;margin:0 0 6px;font-size:20px;">📲 ${recipients.length === 1 ? "1 abonat" : `${recipients.length} abonați`} pe WhatsApp — albumul ${escHtml(slug)}</h2>
      <p style="color:#666;margin:0 0 18px;font-size:14px;">Așa va arăta mesajul la client. Apasă pe un buton: se deschide WhatsApp cu textul deja scris, tu doar apeși „Trimite”.</p>

      <div style="background:#efeae2;border-radius:12px;padding:18px 14px;margin:0 0 20px;">
        <div style="max-width:85%;margin-left:auto;background:#d9fdd3;border-radius:10px 0 10px 10px;padding:8px 10px 6px;box-shadow:0 1px 1px rgba(0,0,0,0.12);">
          <div style="color:#111b21;font-size:14.5px;line-height:1.45;white-space:pre-wrap;word-break:break-word;">${bubble}</div>
          <div style="text-align:right;color:#667781;font-size:11px;margin-top:4px;">${now} ✓✓</div>
        </div>
      </div>

      <table role="presentation" style="width:100%;border-collapse:collapse;">${buttons}</table>
      <p style="color:#999;font-size:12px;margin:18px 0 0;">Pe telefon butonul deschide aplicația WhatsApp; pe calculator, WhatsApp Web sau Desktop.</p>
    </div>`;
}

type PublishBody = { kind?: unknown; text?: unknown; estimateDate?: unknown; notify?: unknown; phoneDelivery?: unknown; email?: unknown };
type PublishOutcome = { status: number; body: Record<string, unknown> };

/**
 * Saves one update on one album and (with notify) sends it: email + SMS automatically,
 * WhatsApp as ready-to-send links. Shared by the album page (one album) and the admin
 * "Noutăți în masă" panel (many albums). `emailAdminWhatsapp: false` lets the bulk panel send
 * one combined WhatsApp email instead of one per album.
 */
async function publishAlbumUpdate(slug: string, body: PublishBody, { emailAdminWhatsapp = true } = {}): Promise<PublishOutcome> {
  const kind = parseAlbumUpdateKind(body.kind);
  const phoneDelivery = parsePhoneDelivery(body.phoneDelivery);
  const emailSubscribers = body.email !== false;
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const estimateDate = kind && kindHasDate(kind) ? parseEstimateDate(body.estimateDate) : null;
  if (!ALBUM_SLUG.test(slug) || !kind) return { status: 400, body: { error: "Album sau tip de noutate invalid." } };
  if (!text || text.length > ALBUM_UPDATE_TEXT_MAX) return { status: 400, body: { error: `Scrie mesajul (maxim ${ALBUM_UPDATE_TEXT_MAX} caractere).` } };
  // One day of slack for time zones; a past estimate is almost always a mistyped year.
  if (estimateDate && new Date(`${estimateDate}T12:00:00Z`).getTime() < Date.now() - 36 * 3600 * 1000) {
    return { status: 400, body: { error: "Data estimată e în trecut. Verifică anul." } };
  }

  const db = firestore();
  const now = Timestamp.now();
  const ref = await db.collection(UPDATES_COLLECTION).add({ albumSlug: slug, kind, text, estimateDate, createdAt: now });
  const update: AlbumUpdate = { id: ref.id, kind, text, estimateDate, createdAt: now.toDate().toISOString() };

  const sent = { email: 0, sms: 0, failed: 0 };
  const whatsapp: WhatsappRecipient[] = [];
  let adminEmailed = false;
  let smsSkipped = false;
  let message = "";

  if (body.notify === true) {
    const albumUrl = `${BASE_URL}/media/${encodeURIComponent(slug)}`;
    message = albumUpdateMessage(update, albumUrl);
    const snapshot = await db.collection(COLLECTION).where("albumSlug", "==", slug).get();
    const smsReady = isSmsConfigured();
    await Promise.all(snapshot.docs.map(async (doc) => {
      const subscriber = doc.data() as SubscriberDoc;
      const channels = channelsOf(subscriber);
      const phoneChannels = phoneChannelsFor(channels, phoneDelivery);
      if (emailSubscribers && channels.includes("email") && subscriber.email) {
        try {
          await sendEmail({ to: subscriber.email, subject: `[Mesaj automat] ${ALBUM_UPDATE_META[kind].emoji} ${ALBUM_UPDATE_META[kind].label} — de la fotograful evenimentului tău (Anca Visuals)`, html: albumUpdateEmail(update, slug, subscriber) });
          sent.email++;
        } catch { sent.failed++; }
      }
      if (phoneChannels.includes("sms") && subscriber.phone) {
        if (!smsReady) smsSkipped = true;
        else {
          try { await sendSms({ to: subscriber.phone, body: `${message}\nDezabonare: ${unsubscribeUrl(subscriber.unsubscribeToken)}` }); sent.sms++; }
          catch (error) { sent.failed++; console.error("[albumUpdates] SMS failed:", error instanceof Error ? error.message : error); }
        }
      }
      if (phoneChannels.includes("whatsapp") && subscriber.phone) {
        whatsapp.push({
          name: subscriber.name ?? null,
          phone: subscriber.phone,
          link: `https://wa.me/${subscriber.phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`,
        });
      }
    }));
    await ref.update({ sent: { ...sent, whatsapp: whatsapp.length }, phoneDelivery, email: emailSubscribers });
    if (emailAdminWhatsapp && whatsapp.length > 0) {
      try {
        await sendEmail({
          to: adminUser.email,
          subject: `📲 De trimis pe WhatsApp (${whatsapp.length}) — ${ALBUM_UPDATE_META[kind].label}, albumul ${slug}`,
          html: whatsappAdminEmail(slug, message, whatsapp),
        });
        adminEmailed = true;
      } catch (error) {
        console.error("[album-updates] WhatsApp admin email failed:", error);
      }
    }
  }

  return { status: 201, body: { update, sent, smsSkipped, whatsapp, adminEmailed, message } };
}

// POST /updates/:slug — admin posts an update; { notify: true } also sends it to subscribers.
// Email and SMS go out automatically; WhatsApp comes back as ready-to-send links.
router.post("/updates/:slug", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const outcome = await publishAlbumUpdate(req.params.slug, (req.body ?? {}) as PublishBody);
    res.status(outcome.status).json(outcome.body);
  } catch (error) {
    console.error("[album-updates] post failed:", error);
    res.status(500).json({ error: "Nu am putut publica noutatea." });
  }
});

const BULK_MAX_ALBUMS = 60;

// POST /updates-bulk — "Noutăți în masă": the same update (e.g. "mai durează puțin pozele")
// on several albums at once. Each album gets its own entry in its log and its own messages
// (the link in the text points to that album); WhatsApp links for all albums come back in
// one list and in ONE email to the admin.
router.post("/updates-bulk", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as PublishBody & { slugs?: unknown };
  const slugs = Array.isArray(body.slugs)
    ? Array.from(new Set(body.slugs.map(String).filter((slug) => ALBUM_SLUG.test(slug))))
    : [];
  if (slugs.length === 0) {
    res.status(400).json({ error: "Alege cel puțin un album." });
    return;
  }
  if (slugs.length > BULK_MAX_ALBUMS) {
    res.status(400).json({ error: `Maxim ${BULK_MAX_ALBUMS} albume odată.` });
    return;
  }
  const results: { slug: string; ok: boolean; error?: string; sent?: unknown; whatsapp?: WhatsappRecipient[]; smsSkipped?: boolean }[] = [];
  const emailSections: string[] = [];
  // One album at a time: keeps SMS / email providers from rate-limiting a burst.
  for (const slug of slugs) {
    try {
      const outcome = await publishAlbumUpdate(slug, body, { emailAdminWhatsapp: false });
      if (outcome.status !== 201) {
        results.push({ slug, ok: false, error: String(outcome.body.error ?? "Eroare") });
        // Same body for every album: a validation error (empty text, past date) fails them all.
        if (results.length === 1) {
          res.status(outcome.status).json({ error: outcome.body.error, results });
          return;
        }
        continue;
      }
      const whatsapp = outcome.body.whatsapp as WhatsappRecipient[];
      results.push({ slug, ok: true, sent: outcome.body.sent, whatsapp, smsSkipped: Boolean(outcome.body.smsSkipped) });
      if (whatsapp.length > 0) emailSections.push(whatsappAdminEmail(slug, String(outcome.body.message), whatsapp));
    } catch (error) {
      console.error(`[album-updates] bulk publish failed for ${slug}:`, error);
      results.push({ slug, ok: false, error: "Nu am putut publica noutatea." });
    }
  }

  let adminEmailed = false;
  const waCount = results.reduce((sum, r) => sum + (r.whatsapp?.length ?? 0), 0);
  if (emailSections.length > 0) {
    try {
      await sendEmail({
        to: adminUser.email,
        subject: `📲 De trimis pe WhatsApp (${waCount}) — noutate la ${emailSections.length} ${emailSections.length === 1 ? "album" : "albume"}`,
        html: emailSections.join('<hr style="border:none;border-top:2px solid #ddd;margin:24px 0;" />'),
      });
      adminEmailed = true;
    } catch (error) {
      console.error("[album-updates] bulk WhatsApp admin email failed:", error);
    }
  }
  res.status(201).json({ results, adminEmailed });
});

// GET /admin/promises — open promises (dated updates not yet marked done) for the dashboard.
router.get("/admin/promises", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    res.json({ promises: await listOpenPromises() });
  } catch (error) {
    console.error("[album-promises] list failed:", error);
    res.status(500).json({ error: "Nu am putut încărca promisiunile." });
  }
});

// POST /admin/promises/:id/done — the promised photos / video / album were delivered.
router.post("/admin/promises/:id/done", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const ok = await markPromiseDone(String(req.params.id));
    if (!ok) { res.status(404).json({ error: "Promisiunea nu există." }); return; }
    res.json({ ok: true });
  } catch (error) {
    console.error("[album-promises] done failed:", error);
    res.status(500).json({ error: "Nu am putut marca promisiunea." });
  }
});

const OVERVIEW_EVENTS = "adminEvents";

const isoOf = (value: unknown): string | null => {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return null;
};

// GET /admin/albums-overview — every event that has an album, for "Noutăți în masă":
// client name, event date, how many subscribers, and the last update already posted.
router.get("/admin/albums-overview", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    const db = firestore();
    const [events, subscriptions, updates] = await Promise.all([
      db.collection(OVERVIEW_EVENTS).get(),
      db.collection(COLLECTION).get(),
      db.collection(UPDATES_COLLECTION).get(),
    ]);
    const subscriberCount = new Map<string, number>();
    subscriptions.docs.forEach((doc) => {
      const slug = String(doc.data().albumSlug ?? "");
      if (slug) subscriberCount.set(slug, (subscriberCount.get(slug) ?? 0) + 1);
    });
    const lastUpdate = new Map<string, { kind: string; text: string; createdAt: string | null }>();
    updates.docs.forEach((doc) => {
      const data = doc.data();
      const slug = String(data.albumSlug ?? "");
      const createdAt = isoOf(data.createdAt);
      const current = lastUpdate.get(slug);
      if (slug && (!current || (createdAt ?? "") > (current.createdAt ?? ""))) {
        lastUpdate.set(slug, { kind: String(data.kind ?? ""), text: String(data.text ?? ""), createdAt });
      }
    });
    // One row per album; two events sharing an album show both client names.
    const albums = new Map<string, { slug: string; clients: string[]; eventDate: string | null; eventIds: string[] }>();
    events.docs.forEach((doc) => {
      const data = doc.data();
      const slug = typeof data.albumSlug === "string" ? data.albumSlug.trim() : "";
      if (!slug) return;
      const client = String(data.client?.fullName ?? data.title ?? "").trim();
      const row = albums.get(slug) ?? { slug, clients: [], eventDate: isoOf(data.eventDate), eventIds: [] };
      if (client && !row.clients.includes(client)) row.clients.push(client);
      row.eventIds.push(doc.id);
      albums.set(slug, row);
    });
    const rows = Array.from(albums.values())
      .map((row) => ({ ...row, subscribers: subscriberCount.get(row.slug) ?? 0, lastUpdate: lastUpdate.get(row.slug) ?? null }))
      .sort((a, b) => (b.eventDate ?? "").localeCompare(a.eventDate ?? ""));
    res.json({ albums: rows });
  } catch (error) {
    console.error("[album-updates] overview failed:", error);
    res.status(500).json({ error: "Nu am putut încărca albumele." });
  }
});

router.delete("/updates/:slug/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const ref = firestore().collection(UPDATES_COLLECTION).doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.albumSlug !== req.params.slug) {
      res.status(404).json({ error: "Noutatea nu există." });
      return;
    }
    await ref.delete();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// GET /stop/:token — one-click unsubscribe link sent in every email / SMS.
router.get("/stop/:token", async (req: Request, res: Response) => {
  const token = String(req.params.token ?? "");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (!/^[a-f0-9]{24}$/.test(token)) {
    res.status(400).send("<p>Link de dezabonare invalid.</p>");
    return;
  }
  try {
    const snapshot = await firestore().collection(COLLECTION).where("unsubscribeToken", "==", token).get();
    await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
    res.send(`<div style="font-family:sans-serif;max-width:480px;margin:60px auto;text-align:center;"><h2>Te-ai dezabonat.</h2><p style="color:#666;">Nu mai primești noutăți despre acest album.</p><p><a href="${BASE_URL}">ancavisuals.ro</a></p></div>`);
  } catch {
    res.status(500).send("<p>Eroare. Încearcă din nou.</p>");
  }
});

export default router;
