import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { firestore } from '../firestore';
import { requireFirebaseAuth, requireSupremeAdmin } from '../middleware/requireFirebaseAuth';
const SUPREME_ADMIN_EMAIL = 'ancadaniel1994@gmail.com';
import {
  BUNNY_ACCESS_KEY_HEADER,
  buildBunnyStorageUrl,
  getBunnyStoragePassword,
} from '../constants/bunny';
import { sendEmail } from '../notifications/mailer';
import { APP_BASE_URL } from '../constants/domain';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

const QR_EVENTS = 'qr_events';
const QR_GUESTS = 'qr_guests';
const QR_UPLOADS = 'qr_uploads';
const QR_COMMENTS = 'qr_comments';

const UPLOAD_CLOSE_HOUR = 4;
const MAX_FILES_PER_REQUEST = 25;

const QUICK_REPLIES = [
  'Mulțumim pentru mesaj! Vă iubim',
  'Îți mulțumim din suflet!',
  'Ce surpriză minunată, mulțumim!',
  'Mulțumim, înseamnă enorm pentru noi!',
];

type UploadLookup = {
  id: string;
  guestId: string;
  bunnyUrl: string;
  type: string;
  mimeType: string;
  originalName: string;
};

type GuestLookup = {
  id: string;
  name: string;
  email: string;
};

async function isSupremeAdminRequest(authHeader?: string): Promise<boolean> {
  if (!authHeader?.startsWith('Bearer ')) return false;
  try {
    const decoded = await getAuth().verifyIdToken(authHeader.slice(7));
    return decoded.email === SUPREME_ADMIN_EMAIL;
  } catch {
    return false;
  }
}

function generatePin(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

const ROMANIAN_MONTH_SLUGS = [
  'ianuarie',
  'februarie',
  'martie',
  'aprilie',
  'mai',
  'iunie',
  'iulie',
  'august',
  'septembrie',
  'octombrie',
  'noiembrie',
  'decembrie',
];

function normalizeEventSlug(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildDateSlug(date: Date): string {
  const month = ROMANIAN_MONTH_SLUGS[date.getMonth()] ?? '';
  return `${String(date.getDate()).padStart(2, '0')}${month}${date.getFullYear()}`;
}

async function getEventBySlug(eventSlug: string) {
  return firestore().collection(QR_EVENTS).doc(eventSlug).get();
}

function isUploadWindowOpen(eventDate: Date): boolean {
  return new Date() < getUploadDeadline(eventDate);
}

function getUploadDeadline(eventDate: Date): Date {
  const deadline = new Date(eventDate);
  deadline.setDate(deadline.getDate() + 1);
  deadline.setHours(UPLOAD_CLOSE_HOUR, 0, 0, 0);
  return deadline;
}

function buildBunnyCdnUrl(eventSlug: string, guestId: string, fileName: string): string {
  const cdnDomain = process.env.BUNNY_CDN_DOMAIN ?? '';
  return `${cdnDomain}/qr-moments/${eventSlug}/${guestId}/${fileName}`;
}

function buildBunnyUploadUrl(eventSlug: string, guestId: string, fileName: string): string {
  return buildBunnyStorageUrl('qr-moments', eventSlug, guestId, fileName);
}

function detectMediaType(mimeType: string, originalName: string): 'photo' | 'video' | 'audio' {
  const ext = originalName.toLowerCase().split('.').pop() ?? '';
  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext)) return 'photo';
  if (mimeType.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'webm', 'hevc'].includes(ext)) return 'video';
  return 'audio';
}

function buildUnsubscribeUrl(guestId: string): string {
  const base = APP_BASE_URL;
  return `${base}/qr-moments/unsubscribe/${guestId}`;
}

async function sendThankYouEmail(
  guestEmail: string,
  guestName: string,
  message: string,
  hostDisplayName: string,
  guestId: string,
): Promise<void> {
  const unsubscribeUrl = buildUnsubscribeUrl(guestId);
  await sendEmail({
    to: guestEmail,
    subject: `💌 Mulțumim pentru amintire, ${guestName}!`,
    html: `
      <div style="margin:0;padding:24px;background:#f5f1ea;font-family:Arial,sans-serif;color:#241f1a;">
        <div style="max-width:560px;margin:0 auto;background:#fffdf9;border:1px solid #eadfce;border-radius:18px;padding:28px 24px;box-shadow:0 8px 30px rgba(68,44,16,0.08);">
          <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#b7791f;">QR Moments</p>
          <h2 style="color:#241f1a;margin:0 0 6px;font-size:24px;font-weight:600;">Bună, ${guestName}!</h2>
          <p style="color:#6b5b4d;margin:0 0 18px;">${hostDisplayName} ți-a lăsat un mesaj special:</p>
          <div style="background:#fbf6ee;border:1px solid #ecd9bd;padding:16px 18px;border-radius:12px;margin:0 0 20px;">
            <p style="margin:0;font-size:16px;line-height:1.45;color:#241f1a;">"${message}"</p>
          </div>
          <p style="color:#6b5b4d;font-size:13px;line-height:1.6;margin:0 0 20px;">Ne bucurăm că ai fost alături de ei și că ai imortalizat aceste momente.</p>
          <hr style="border:none;border-top:1px solid #eadfce;margin:0 0 18px;">
          <p style="font-size:12px;color:#7b6a5a;margin:0 0 8px;">
            Nu mai vrei să primești notificări?
            <a href="${unsubscribeUrl}" style="color:#8c5a16;text-decoration:underline;">Dezabonează-te</a>.
          </p>
          <p style="font-size:12px;color:#7b6a5a;margin:0;">
            Ești mireasă, mire sau cunoști un cuplu care se pregătește pentru nuntă?
            <a href="https://ancavisuals.ro" style="color:#8c5a16;text-decoration:underline;">Recomandă-ne</a>
            și primești o ședință foto gratuită.
          </p>
        </div>
      </div>
    `,
  });
}

async function sendViewNotificationEmail(
  guestEmail: string,
  guestName: string,
  hostDisplayName: string,
  guestId: string,
  thumbnailUrl: string | null,
): Promise<void> {
  const unsubscribeUrl = buildUnsubscribeUrl(guestId);
  const thumbnailHtml = thumbnailUrl
    ? `<img src="${thumbnailUrl}" alt="Fișierul tău" style="display:block;max-width:280px;width:100%;border-radius:12px;border:1px solid #eadfce;margin:12px 0;">`
    : '';

  await sendEmail({
    to: guestEmail,
    subject: `👀 ${hostDisplayName} a văzut ce ai trimis!`,
    html: `
      <div style="margin:0;padding:24px;background:#f5f1ea;font-family:Arial,sans-serif;color:#241f1a;">
        <div style="max-width:560px;margin:0 auto;background:#fffdf9;border:1px solid #eadfce;border-radius:18px;padding:28px 24px;box-shadow:0 8px 30px rgba(68,44,16,0.08);">
          <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#b7791f;">QR Moments</p>
          <h2 style="color:#241f1a;margin:0 0 6px;font-size:24px;font-weight:600;">Bună, ${guestName}!</h2>
          <p style="color:#6b5b4d;margin:0 0 12px;">${hostDisplayName} tocmai a văzut ce ai trimis la eveniment. Mulțumim că ai imortalizat aceste momente!</p>
          ${thumbnailHtml}
          <hr style="border:none;border-top:1px solid #eadfce;margin:16px 0;">
          <p style="font-size:12px;color:#7b6a5a;margin:0 0 8px;">
            Nu mai vrei să primești notificări?
            <a href="${unsubscribeUrl}" style="color:#8c5a16;text-decoration:underline;">Dezabonează-te</a>.
          </p>
        </div>
      </div>
    `,
  });
}

async function sendCommentNotification(
  guestEmail: string,
  guestName: string,
  commentText: string,
  eventSlug: string,
  guestId: string,
  thumbnailUrl: string | null,
  hostDisplayName: string,
): Promise<void> {
  const galleryUrl = `${APP_BASE_URL}/qr-moments/${eventSlug}/gallery`;
  const unsubscribeUrl = buildUnsubscribeUrl(guestId);

  const thumbnailHtml = thumbnailUrl
    ? `<img src="${thumbnailUrl}" alt="Poza ta" style="max-width:280px;border-radius:8px;margin:12px 0;">`
    : '';

  await sendEmail({
    to: guestEmail,
    subject: `💌 ${hostDisplayName} a răspuns la ce ai trimis!`,
    html: `
      <div style="margin:0;padding:24px;background:#f5f1ea;font-family:Arial,sans-serif;color:#241f1a;">
        <div style="max-width:560px;margin:0 auto;background:#fffdf9;border:1px solid #eadfce;border-radius:18px;padding:28px 24px;box-shadow:0 8px 30px rgba(68,44,16,0.08);">
          <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#b7791f;">QR Moments</p>
          <h2 style="color:#241f1a;margin:0 0 6px;font-size:24px;font-weight:600;">Bună, ${guestName}!</h2>
          <p style="color:#6b5b4d;margin:0;">${hostDisplayName} a lăsat un mesaj la ce ai trimis:</p>

          <div style="background:#fbf6ee;border:1px solid #ecd9bd;padding:16px 18px;border-radius:12px;margin:18px 0;">
            <p style="margin:0;font-size:16px;line-height:1.45;color:#241f1a;">"${commentText}"</p>
          </div>

          ${thumbnailHtml ? `<div style="margin:0 0 12px;">${thumbnailHtml.replace('style="max-width:280px;border-radius:8px;margin:12px 0;"', 'style="display:block;max-width:280px;width:100%;border-radius:12px;border:1px solid #eadfce;margin:0;"')}</div>` : ''}

          <a href="${galleryUrl}" style="display:inline-block;background:#e0a13b;color:#241f1a;padding:11px 22px;border-radius:999px;text-decoration:none;font-weight:700;margin-top:8px;">
            Vezi galeria
          </a>

          <hr style="border:none;border-top:1px solid #eadfce;margin:28px 0 18px;">
          <p style="font-size:12px;line-height:1.5;color:#7b6a5a;margin:0 0 8px;">
            Nu mai vrei să primești notificări?
            <a href="${unsubscribeUrl}" style="color:#8c5a16;text-decoration:underline;">Dezabonează-te</a>.
          </p>
          <p style="font-size:12px;line-height:1.5;color:#7b6a5a;margin:0;">
            Ești mireasă, mire sau cunoști pe cineva care își pregătește nunta?
            <a href="https://ancavisuals.ro" style="color:#8c5a16;text-decoration:underline;">Recomandă-ne cu drag</a>
            și primești o ședință foto gratuită.
          </p>
        </div>
      </div>
    `,
  });
}

async function sendUploadNotification(
  notificationEmail: string,
  eventSlug: string,
  guestName: string,
  uploadedCount: number,
): Promise<void> {
  const uploadLabel = uploadedCount === 1 ? 'un fișier nou' : `${uploadedCount} fișiere noi`;
  const galleryUrl = `${APP_BASE_URL}/qr-moments/${eventSlug}/gallery`;

  await sendEmail({
    to: notificationEmail,
    subject: `QR Moments: ${guestName} a încărcat ${uploadLabel}`,
    html: `
      <div style="margin:0;padding:24px;background:#f5f1ea;font-family:Arial,sans-serif;color:#241f1a;">
        <div style="max-width:560px;margin:0 auto;background:#fffdf9;border:1px solid #eadfce;border-radius:18px;padding:28px 24px;box-shadow:0 8px 30px rgba(68,44,16,0.08);">
          <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#b7791f;">QR Moments</p>
          <h2 style="color:#241f1a;margin:0 0 8px;font-size:24px;font-weight:600;">Upload nou în QR Moments</h2>
          <p style="color:#6b5b4d;margin:0;line-height:1.5;">${guestName} a încărcat ${uploadLabel} pentru evenimentul <strong>${eventSlug}</strong>.</p>
          <a href="${galleryUrl}" style="display:inline-block;background:#e0a13b;color:#241f1a;padding:11px 22px;border-radius:999px;text-decoration:none;font-weight:700;margin-top:18px;">
            Deschide galeria
          </a>
        </div>
      </div>
    `,
  });
}

// ─── Public: check event + pass + expiry ────────────────────────────────────

router.get('/:eventSlug', async (request: Request, response: Response) => {
  const { eventSlug } = request.params;
  const { pass } = request.query as { pass?: string };

  // Admin bypass: skip pass check and force isOpen=true
  let isAdmin = false;
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const decoded = await getAuth().verifyIdToken(authHeader.slice(7));
      isAdmin = decoded.email === SUPREME_ADMIN_EMAIL;
    } catch { }
  }

  try {
    const eventDoc = await getEventBySlug(eventSlug);

    if (!eventDoc.exists) {
      response.status(404).json({ error: 'Evenimentul nu există.' });
      return;
    }

    const eventData = eventDoc.data()!;

    if (!isAdmin && eventData.pin !== pass) {
      response.status(403).json({ error: 'Acces interzis.' });
      return;
    }

    const eventDate = (eventData.eventDate as Timestamp).toDate();
    const deadline = getUploadDeadline(eventDate);
    const isOpen = isAdmin ? true : isUploadWindowOpen(eventDate);

    response.json({
      eventSlug,
      isOpen,
      deadline: deadline.toISOString(),
      bride: eventData.bride ?? null,
      groom: eventData.groom ?? null,
    });
  } catch (error) {
    console.error('[qr-moments] GET /:eventSlug failed:', error);
    response.status(500).json({ error: 'Eroare server.' });
  }
});

// ─── Public: register guest ──────────────────────────────────────────────────

router.post('/guest/register', async (request: Request, response: Response) => {
  const { eventSlug, name, email, gdprConsent, emailConsent, pass } = request.body as {
    eventSlug: string;
    name: string;
    email: string;
    gdprConsent: boolean;
    emailConsent: boolean;
    pass?: string;
  };

  // Admin bypass: skip pass + window checks
  let isAdmin = false;
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const decoded = await getAuth().verifyIdToken(authHeader.slice(7));
      isAdmin = decoded.email === SUPREME_ADMIN_EMAIL;
    } catch { }
  }

  if (!eventSlug || !name?.trim() || !email?.trim()) {
    response.status(400).json({ error: 'Câmpuri obligatorii lipsă.' });
    return;
  }

  if (!isAdmin && (!gdprConsent || !emailConsent)) {
    response.status(400).json({ error: 'Consimțămintele sunt obligatorii.' });
    return;
  }

  try {
    const eventDoc = await getEventBySlug(eventSlug);
    if (!eventDoc.exists) {
      response.status(404).json({ error: 'Evenimentul nu există.' });
      return;
    }

    if (!isAdmin && eventDoc.data()!.pin !== pass) {
      response.status(403).json({ error: 'Acces interzis.' });
      return;
    }

    const eventDate = (eventDoc.data()!.eventDate as Timestamp).toDate();
    if (!isAdmin && !isUploadWindowOpen(eventDate)) {
      response.status(403).json({ error: 'Perioada de upload s-a închis.' });
      return;
    }

    const existingSnapshot = await firestore()
      .collection(QR_GUESTS)
      .where('eventSlug', '==', eventSlug)
      .where('email', '==', email.toLowerCase().trim())
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      response.json({ guestId: existingSnapshot.docs[0].id, returning: true });
      return;
    }

    const docRef = await firestore().collection(QR_GUESTS).add({
      eventSlug,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      gdprConsent: true,
      emailConsent: true,
      uploadIds: [],
      createdAt: Timestamp.now(),
    });

    response.status(201).json({ guestId: docRef.id });
  } catch {
    response.status(500).json({ error: 'Eroare server.' });
  }
});

// ─── Public: upload asset ────────────────────────────────────────────────────

router.post(
  '/:eventSlug/upload',
  upload.array('files', MAX_FILES_PER_REQUEST),
  async (request: Request, response: Response) => {
    const { eventSlug } = request.params;
    const { guestId, pass } = request.body as { guestId: string; pass?: string };
    const files = request.files as Express.Multer.File[];

    if (!guestId || !files?.length) {
      response.status(400).json({ error: 'guestId și fișiere sunt obligatorii.' });
      return;
    }

    const accessKey = getBunnyStoragePassword();
    if (!accessKey) {
      response.status(500).json({ error: 'Configurare server eronată.' });
      return;
    }

    // Admin flow bypasses the PIN check for uploads as well.
    let isAdmin = false;
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const decoded = await getAuth().verifyIdToken(authHeader.slice(7));
        isAdmin = decoded.email === SUPREME_ADMIN_EMAIL;
      } catch { }
    }

    try {
      const [eventDoc, guestDoc] = await Promise.all([
        getEventBySlug(eventSlug),
        firestore().collection(QR_GUESTS).doc(guestId).get(),
      ]);

      if (!eventDoc.exists) {
        response.status(404).json({ error: 'Evenimentul nu există.' });
        return;
      }

      if (!isAdmin && eventDoc.data()!.pin !== pass) {
        response.status(403).json({ error: 'Acces interzis.' });
        return;
      }

      if (!guestDoc.exists || guestDoc.data()!.eventSlug !== eventSlug) {
        response.status(403).json({ error: 'Invitat invalid pentru acest eveniment.' });
        return;
      }

      const eventDate = (eventDoc.data()!.eventDate as Timestamp).toDate();
      if (!isAdmin && !isUploadWindowOpen(eventDate)) {
        response.status(403).json({ error: 'Perioada de upload s-a închis.' });
        return;
      }

      const uploadResults = await Promise.all(
        files.map(async (file) => {
          const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          const storageUrl = buildBunnyUploadUrl(eventSlug, guestId, uniqueName);

          const uploadResponse = await fetch(storageUrl, {
            method: 'PUT',
            headers: {
              [BUNNY_ACCESS_KEY_HEADER]: accessKey,
              'Content-Type': 'application/octet-stream',
            },
            body: file.buffer,
          });

          if (!uploadResponse.ok) {
            throw new Error(`Bunny upload eșuat pentru ${file.originalname}: ${uploadResponse.status}`);
          }

          const mediaType = detectMediaType(file.mimetype, file.originalname);
          const cdnUrl = buildBunnyCdnUrl(eventSlug, guestId, uniqueName);

          const uploadDoc = await firestore().collection(QR_UPLOADS).add({
            eventSlug,
            guestId,
            type: mediaType,
            bunnyUrl: cdnUrl,
            fileName: uniqueName,
            mimeType: file.mimetype,
            originalName: file.originalname,
            visible: true,
            createdAt: Timestamp.now(),
          });

          return uploadDoc.id;
        }),
      );

      await firestore()
        .collection(QR_GUESTS)
        .doc(guestId)
        .update({
          uploadIds: (await firestore().collection(QR_GUESTS).doc(guestId).get()).data()?.uploadIds?.concat(uploadResults) ?? uploadResults,
        });

      const guestName = guestDoc.data()!.name as string;
      const notificationEmail = eventDoc.data()!.notificationEmail as string | undefined;
      if (notificationEmail) {
        sendUploadNotification(notificationEmail, eventSlug, guestName, uploadResults.length).catch(() => {});
      }

      response.status(201).json({ uploadedCount: uploadResults.length, uploadIds: uploadResults });
    } catch {
      response.status(500).json({ error: 'Eroare la upload.' });
    }
  },
);

// ─── Gallery: get uploads grouped by guest (PIN protected) ──────────────────

router.get('/:eventSlug/gallery', async (request: Request, response: Response) => {
  const { eventSlug } = request.params;
  const { pin } = request.query as { pin?: string };

  // Admin flow: skip the PIN if a valid supreme-admin Firebase token is present.
  let isAdmin = false;
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const decoded = await getAuth().verifyIdToken(authHeader.slice(7));
      isAdmin = decoded.email === SUPREME_ADMIN_EMAIL;
    } catch { }
  }

  if (!isAdmin && !pin) {
    response.status(401).json({ error: 'PIN necesar.' });
    return;
  }

  try {
    const eventDoc = await firestore().collection(QR_EVENTS).doc(eventSlug).get();
    if (!eventDoc.exists) {
      response.status(404).json({ error: 'Eveniment negăsit.' });
      return;
    }
    if (!isAdmin && eventDoc.data()!.pin !== pin) {
      response.status(403).json({ error: 'PIN incorect.' });
      return;
    }

    const [uploadsSnapshot, guestsSnapshot] = await Promise.all([
      firestore().collection(QR_UPLOADS).where('eventSlug', '==', eventSlug).where('visible', '==', true).get(),
      firestore().collection(QR_GUESTS).where('eventSlug', '==', eventSlug).get(),
    ]);

    const guestMap = new Map(
      guestsSnapshot.docs.map((doc) => [
        doc.id,
        {
          id: doc.id,
          name: doc.data().name as string,
          hasEmail: !!(doc.data().email && doc.data().emailConsent !== false),
        },
      ]),
    );

    const uploadsByGuest = new Map<string, { guest: { id: string; name: string; hasEmail: boolean }; uploads: object[] }>();

    for (const doc of uploadsSnapshot.docs) {
      const data = doc.data();
      const guestId = data.guestId as string;
      const guest = guestMap.get(guestId) ?? { id: guestId, name: 'Anonim', hasEmail: false };

      if (!uploadsByGuest.has(guestId)) {
        uploadsByGuest.set(guestId, { guest, uploads: [] });
      }

      uploadsByGuest.get(guestId)!.uploads.push({
        id: doc.id,
        type: data.type,
        bunnyUrl: data.bunnyUrl,
        mimeType: data.mimeType,
        originalName: data.originalName,
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
        thankedAt: data.thankedAt ? (data.thankedAt as Timestamp).toDate().toISOString() : null,
      });
    }

    const grouped = Array.from(uploadsByGuest.values()).map((group) => ({
      ...group,
      uploads: group.uploads.sort((firstUpload, secondUpload) => {
        const firstCreatedAt = (firstUpload as { createdAt: string }).createdAt;
        const secondCreatedAt = (secondUpload as { createdAt: string }).createdAt;
        return secondCreatedAt.localeCompare(firstCreatedAt);
      }),
    })).sort((a, b) => {
      const aLatest = (a.uploads[0] as { createdAt: string }).createdAt;
      const bLatest = (b.uploads[0] as { createdAt: string }).createdAt;
      return bLatest.localeCompare(aLatest);
    });

    response.json({
      groups: grouped,
      quickReplies: QUICK_REPLIES,
      event: {
        bride: eventDoc.data()!.bride ?? null,
        groom: eventDoc.data()!.groom ?? null,
      },
    });
  } catch {
    response.status(500).json({ error: 'Eroare server.' });
  }
});

// ─── Gallery: get comments for an upload ────────────────────────────────────

router.get('/comment/:uploadId', async (request: Request, response: Response) => {
  try {
    const { eventSlug, pin } = request.query as { eventSlug?: string; pin?: string };
    const authHeader = request.headers.authorization;
    const isAdmin = await isSupremeAdminRequest(authHeader);

    if (!eventSlug || (!isAdmin && !pin)) {
      response.status(401).json({ error: 'PIN necesar.' });
      return;
    }

    const eventDoc = await getEventBySlug(eventSlug);
    if (!eventDoc.exists || (!isAdmin && eventDoc.data()!.pin !== pin)) {
      response.status(403).json({ error: 'PIN incorect.' });
      return;
    }

    const uploadDoc = await firestore().collection(QR_UPLOADS).doc(request.params.uploadId).get();
    if (!uploadDoc.exists || uploadDoc.data()!.eventSlug !== eventSlug) {
      response.status(404).json({ error: 'Upload negăsit.' });
      return;
    }

    const snapshot = await firestore()
      .collection(QR_COMMENTS)
      .where('uploadId', '==', request.params.uploadId)
      .get();

    const comments = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        text: doc.data().text as string,
        fromHost: doc.data().fromHost as boolean,
        hostRole: (doc.data().hostRole as 'bride' | 'groom' | undefined) ?? null,
        createdAt: (doc.data().createdAt as Timestamp).toDate().toISOString(),
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    response.json({ comments });
  } catch {
    response.status(500).json({ error: 'Eroare server.' });
  }
});

// ─── Gallery: post comment (host only — PIN protected) ───────────────────────

router.post('/comment', async (request: Request, response: Response) => {
  const { uploadId, eventSlug, pin, text } = request.body as {
    uploadId: string;
    eventSlug: string;
    pin: string;
    text: string;
    hostRole?: 'bride' | 'groom';
  };
  const authHeader = request.headers.authorization;
  const isAdmin = await isSupremeAdminRequest(authHeader);

  if (!uploadId || !eventSlug || (!isAdmin && !pin) || !text?.trim()) {
    response.status(400).json({ error: 'Câmpuri obligatorii lipsă.' });
    return;
  }

  try {
    const eventDoc = await firestore().collection(QR_EVENTS).doc(eventSlug).get();
    if (!eventDoc.exists || (!isAdmin && eventDoc.data()!.pin !== pin)) {
      response.status(403).json({ error: 'PIN incorect.' });
      return;
    }

    await firestore().collection(QR_COMMENTS).add({
      uploadId,
      eventSlug,
      text: text.trim(),
      fromHost: true,
      hostRole: request.body.hostRole === 'groom' ? 'groom' : 'bride',
      createdAt: Timestamp.now(),
    });

    const uploadDoc = await firestore().collection(QR_UPLOADS).doc(uploadId).get();
    if (!uploadDoc.exists) {
      response.json({ ok: true });
      return;
    }

    const uploadData = uploadDoc.data()!;
    const guestDoc = await firestore().collection(QR_GUESTS).doc(uploadData.guestId as string).get();

    if (guestDoc.exists && guestDoc.data()!.emailConsent === true) {
      const guestData = guestDoc.data()!;
      const isPhoto = (uploadData.type as string) === 'photo';
      const thumbnail = isPhoto ? (uploadData.bunnyUrl as string) : null;
      const eventData = eventDoc.data()!;
      const hostRole = request.body.hostRole === 'groom' ? 'groom' : 'bride';
      const hostDisplayName = hostRole === 'groom'
        ? ((eventData.groom as string | undefined)?.trim() || 'Mirele')
        : ((eventData.bride as string | undefined)?.trim() || 'Mireasa');

      sendCommentNotification(
        guestData.email as string,
        guestData.name as string,
        text.trim(),
        eventSlug,
        guestDoc.id,
        thumbnail,
        hostDisplayName,
      ).catch(() => {});
    }

    response.json({ ok: true });
  } catch {
    response.status(500).json({ error: 'Eroare server.' });
  }
});

// ─── Gallery: thank guest for upload ────────────────────────────────────────

router.post('/thank/:uploadId', async (request: Request, response: Response) => {
  const { uploadId } = request.params;
  const { eventSlug, pin, message, hostRole } = request.body as {
    eventSlug: string;
    pin: string;
    message: string;
    hostRole?: 'bride' | 'groom';
  };

  const authHeader = request.headers.authorization;
  const isAdmin = await isSupremeAdminRequest(authHeader);

  if (!uploadId || !eventSlug || !message?.trim() || (!isAdmin && !pin)) {
    response.status(400).json({ error: 'Câmpuri obligatorii lipsă.' });
    return;
  }

  try {
    const eventDoc = await firestore().collection(QR_EVENTS).doc(eventSlug).get();
    if (!eventDoc.exists || (!isAdmin && eventDoc.data()!.pin !== pin)) {
      response.status(403).json({ error: 'PIN incorect.' });
      return;
    }

    const uploadRef = firestore().collection(QR_UPLOADS).doc(uploadId);
    const uploadDoc = await uploadRef.get();
    if (!uploadDoc.exists || uploadDoc.data()!.eventSlug !== eventSlug) {
      response.status(404).json({ error: 'Upload negăsit.' });
      return;
    }

    if (uploadDoc.data()!.thankedAt) {
      response.json({ ok: true, alreadyThanked: true });
      return;
    }

    const thankedAt = Timestamp.now();
    await uploadRef.update({ thankedAt, thankMessage: message.trim() });

    const guestDoc = await firestore().collection(QR_GUESTS).doc(uploadDoc.data()!.guestId as string).get();
    if (guestDoc.exists && guestDoc.data()!.email && guestDoc.data()!.emailConsent !== false) {
      const guestData = guestDoc.data()!;
      const eventData = eventDoc.data()!;
      const effectiveHostRole = hostRole === 'groom' ? 'groom' : 'bride';
      const hostDisplayName = effectiveHostRole === 'groom'
        ? ((eventData.groom as string | undefined)?.trim() || 'Mirele')
        : ((eventData.bride as string | undefined)?.trim() || 'Mireasa');

      sendThankYouEmail(
        guestData.email as string,
        guestData.name as string,
        message.trim(),
        hostDisplayName,
        guestDoc.id,
      ).catch(() => {});
    }

    response.json({ ok: true, thankedAt: thankedAt.toDate().toISOString() });
  } catch {
    response.status(500).json({ error: 'Eroare server.' });
  }
});

// ─── Gallery: notify guest on first view/play ────────────────────────────────

router.post('/view-notify/:uploadId', async (request: Request, response: Response) => {
  const { uploadId } = request.params;
  const { eventSlug, pin } = request.body as { eventSlug: string; pin: string };

  const authHeader = request.headers.authorization;
  const isAdmin = await isSupremeAdminRequest(authHeader);

  if (!uploadId || !eventSlug || (!isAdmin && !pin)) {
    response.status(400).json({ error: 'Câmpuri obligatorii lipsă.' });
    return;
  }

  try {
    const eventDoc = await firestore().collection(QR_EVENTS).doc(eventSlug).get();
    if (!eventDoc.exists || (!isAdmin && eventDoc.data()!.pin !== pin)) {
      response.status(403).json({ error: 'PIN incorect.' });
      return;
    }

    const uploadRef = firestore().collection(QR_UPLOADS).doc(uploadId);
    const uploadDoc = await uploadRef.get();
    if (!uploadDoc.exists || uploadDoc.data()!.eventSlug !== eventSlug) {
      response.status(404).json({ error: 'Upload negăsit.' });
      return;
    }

    if (uploadDoc.data()!.notifiedAt) {
      response.json({ ok: true, alreadyNotified: true });
      return;
    }

    await uploadRef.update({ notifiedAt: Timestamp.now() });

    const guestDoc = await firestore().collection(QR_GUESTS).doc(uploadDoc.data()!.guestId as string).get();
    if (guestDoc.exists && guestDoc.data()!.email && guestDoc.data()!.emailConsent !== false) {
      const guestData = guestDoc.data()!;
      const eventData = eventDoc.data()!;
      const hostDisplayName =
        ((eventData.bride as string | undefined)?.trim() || '') ||
        ((eventData.groom as string | undefined)?.trim() || '') ||
        'Mirii';
      const isPhoto = uploadDoc.data()!.type === 'photo';
      const thumbnailUrl = isPhoto ? (uploadDoc.data()!.bunnyUrl as string) : null;

      sendViewNotificationEmail(
        guestData.email as string,
        guestData.name as string,
        hostDisplayName,
        guestDoc.id,
        thumbnailUrl,
      ).catch(() => {});
    }

    response.json({ ok: true });
  } catch {
    response.status(500).json({ error: 'Eroare server.' });
  }
});

// ─── Public: unsubscribe ─────────────────────────────────────────────────────

router.get('/unsubscribe/:guestId', async (request: Request, response: Response) => {
  try {
    const guestRef = firestore().collection(QR_GUESTS).doc(request.params.guestId);
    const guestDoc = await guestRef.get();

    if (!guestDoc.exists) {
      response.status(404).json({ error: 'Invitat negăsit.' });
      return;
    }

    await guestRef.update({ emailConsent: false });
    response.json({ ok: true });
  } catch {
    response.status(500).json({ error: 'Eroare server.' });
  }
});

// ─── Admin: list all uploads for event ──────────────────────────────────────

router.get('/admin/:eventSlug/uploads', requireFirebaseAuth, requireSupremeAdmin, async (request: Request, response: Response) => {
  try {
    const snapshot = await firestore()
      .collection(QR_UPLOADS)
      .where('eventSlug', '==', request.params.eventSlug)
      .get();

    const uploads = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: (doc.data().createdAt as Timestamp).toDate().toISOString(),
    }));

    response.json({ uploads });
  } catch {
    response.status(500).json({ error: 'Eroare server.' });
  }
});

router.get('/admin/events', requireFirebaseAuth, requireSupremeAdmin, async (_request: Request, response: Response) => {
  try {
    const snapshot = await firestore().collection(QR_EVENTS).orderBy('eventDate', 'desc').get();

    const events = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        eventSlug: data.eventSlug ?? doc.id,
        adminEventId: data.adminEventId ?? null,
        bride: data.bride ?? null,
        groom: data.groom ?? null,
        notificationEmail: data.notificationEmail ?? null,
        pin: data.pin ?? null,
        eventDate: (data.eventDate as Timestamp).toDate().toISOString(),
        createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate().toISOString() : null,
      };
    });

    response.json({ events });
  } catch {
    response.status(500).json({ error: 'Eroare server.' });
  }
});

router.post('/admin/events', requireFirebaseAuth, requireSupremeAdmin, async (request: Request, response: Response) => {
  const { bride, groom, pin, adminEventId, notificationEmail } = request.body as {
    bride?: string;
    groom?: string;
    pin?: string;
    adminEventId?: string;
    notificationEmail?: string;
  };

  if (!adminEventId?.trim()) {
    response.status(400).json({ error: 'Trebuie să alegi un eveniment confirmat.' });
    return;
  }

  try {
    const adminEventDoc = await firestore().collection('adminEvents').doc(adminEventId.trim()).get();
    if (!adminEventDoc.exists) {
      response.status(404).json({ error: 'Evenimentul selectat nu există.' });
      return;
    }

    const adminEventData = adminEventDoc.data()!;
    if (adminEventData.status !== 'confirmat') {
      response.status(400).json({ error: 'Poți crea QR Moments doar pentru evenimente confirmate.' });
      return;
    }

    const adminEventDateRaw = adminEventData.eventDate as Timestamp | string | null;
    const parsedEventDate =
      adminEventDateRaw instanceof Timestamp
        ? adminEventDateRaw.toDate()
        : adminEventDateRaw
        ? new Date(adminEventDateRaw)
        : null;

    if (!parsedEventDate || Number.isNaN(parsedEventDate.getTime())) {
      response.status(400).json({ error: 'Evenimentul selectat nu are o dată validă.' });
      return;
    }

    const normalizedEventSlug = normalizeEventSlug(buildDateSlug(parsedEventDate));
    const eventRef = firestore().collection(QR_EVENTS).doc(normalizedEventSlug);
    const existingEvent = await eventRef.get();

    if (existingEvent.exists) {
      response.status(409).json({ error: 'Există deja un eveniment QR Moments cu acest slug.' });
      return;
    }

    const nextPin = pin?.trim().toUpperCase() || generatePin();

    await eventRef.set({
      eventSlug: normalizedEventSlug,
      adminEventId: adminEventId?.trim() || null,
      bride: bride?.trim() || null,
      groom: groom?.trim() || null,
      notificationEmail: notificationEmail?.trim().toLowerCase() || null,
      eventDate: Timestamp.fromDate(parsedEventDate),
      pin: nextPin,
      createdAt: Timestamp.now(),
    });

    response.status(201).json({
      ok: true,
      event: {
        id: normalizedEventSlug,
        eventSlug: normalizedEventSlug,
        adminEventId: adminEventId?.trim() || null,
        bride: bride?.trim() || null,
        groom: groom?.trim() || null,
        notificationEmail: notificationEmail?.trim().toLowerCase() || null,
        pin: nextPin,
        eventDate: parsedEventDate.toISOString(),
        createdAt: new Date().toISOString(),
      },
    });
  } catch {
    response.status(500).json({ error: 'Eroare server.' });
  }
});

router.patch('/admin/:eventSlug', requireFirebaseAuth, requireSupremeAdmin, async (request: Request, response: Response) => {
  const { bride, groom, eventDate, pin, adminEventId, notificationEmail } = request.body as {
    bride?: string;
    groom?: string;
    eventDate?: string;
    pin?: string;
    adminEventId?: string;
    notificationEmail?: string;
  };

  const updatePayload: Record<string, unknown> = {};

  if (typeof bride === 'string') updatePayload.bride = bride.trim() || null;
  if (typeof groom === 'string') updatePayload.groom = groom.trim() || null;
  if (typeof pin === 'string') updatePayload.pin = pin.trim().toUpperCase() || generatePin();
  if (typeof adminEventId === 'string') updatePayload.adminEventId = adminEventId.trim() || null;
  if (typeof notificationEmail === 'string') updatePayload.notificationEmail = notificationEmail.trim().toLowerCase() || null;
  if (typeof eventDate === 'string') {
    const parsedEventDate = new Date(eventDate);
    if (Number.isNaN(parsedEventDate.getTime())) {
      response.status(400).json({ error: 'eventDate invalid.' });
      return;
    }
    updatePayload.eventDate = Timestamp.fromDate(parsedEventDate);
  }

  if (Object.keys(updatePayload).length === 0) {
    response.status(400).json({ error: 'Nu există câmpuri de actualizat.' });
    return;
  }

  try {
    const eventRef = firestore().collection(QR_EVENTS).doc(request.params.eventSlug);
    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) {
      response.status(404).json({ error: 'Evenimentul nu există.' });
      return;
    }

    await eventRef.update(updatePayload);
    const refreshedDoc = await eventRef.get();
    const refreshedData = refreshedDoc.data()!;

    response.json({
      ok: true,
      event: {
        id: refreshedDoc.id,
        eventSlug: refreshedData.eventSlug ?? refreshedDoc.id,
        adminEventId: refreshedData.adminEventId ?? null,
        bride: refreshedData.bride ?? null,
        groom: refreshedData.groom ?? null,
        notificationEmail: refreshedData.notificationEmail ?? null,
        pin: refreshedData.pin ?? null,
        eventDate: (refreshedData.eventDate as Timestamp).toDate().toISOString(),
        createdAt: refreshedData.createdAt ? (refreshedData.createdAt as Timestamp).toDate().toISOString() : null,
      },
    });
  } catch {
    response.status(500).json({ error: 'Eroare server.' });
  }
});

// ─── Admin: list guests for event ───────────────────────────────────────────

router.get('/admin/:eventSlug/guests', requireFirebaseAuth, requireSupremeAdmin, async (request: Request, response: Response) => {
  try {
    const snapshot = await firestore()
      .collection(QR_GUESTS)
      .where('eventSlug', '==', request.params.eventSlug)
      .get();

    const guests = snapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name,
      email: doc.data().email,
      emailConsent: doc.data().emailConsent,
      uploadCount: ((doc.data().uploadIds as string[]) ?? []).length,
      createdAt: (doc.data().createdAt as Timestamp).toDate().toISOString(),
    }));

    response.json({ guests });
  } catch {
    response.status(500).json({ error: 'Eroare server.' });
  }
});

router.get('/admin/:eventSlug/comments', requireFirebaseAuth, requireSupremeAdmin, async (request: Request, response: Response) => {
  try {
    const [commentsSnapshot, uploadsSnapshot, guestsSnapshot] = await Promise.all([
      firestore().collection(QR_COMMENTS).where('eventSlug', '==', request.params.eventSlug).get(),
      firestore().collection(QR_UPLOADS).where('eventSlug', '==', request.params.eventSlug).get(),
      firestore().collection(QR_GUESTS).where('eventSlug', '==', request.params.eventSlug).get(),
    ]);

    const uploadMap = new Map<string, UploadLookup>(
      uploadsSnapshot.docs.map((doc) => [doc.id, {
        id: doc.id,
        guestId: doc.data().guestId as string,
        bunnyUrl: doc.data().bunnyUrl as string,
        type: doc.data().type as string,
        mimeType: doc.data().mimeType as string,
        originalName: doc.data().originalName as string,
      }]),
    );
    const guestMap = new Map<string, GuestLookup>(
      guestsSnapshot.docs.map((doc) => [doc.id, {
        id: doc.id,
        name: doc.data().name as string,
        email: doc.data().email as string,
      }]),
    );

    const comments = commentsSnapshot.docs
      .map((doc) => {
        const data = doc.data();
        const upload = uploadMap.get(data.uploadId as string);
        const guest = upload ? guestMap.get(upload.guestId as string) : null;

        return {
          id: doc.id,
          uploadId: data.uploadId,
          eventSlug: data.eventSlug,
          text: data.text,
          fromHost: data.fromHost,
          createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
          upload: upload
            ? {
                id: upload.id,
                bunnyUrl: upload.bunnyUrl,
                type: upload.type,
                mimeType: upload.mimeType,
                originalName: upload.originalName,
              }
            : null,
          guest: guest
            ? {
                id: guest.id,
                name: guest.name,
                email: guest.email,
              }
            : null,
        };
      })
      .sort((firstComment, secondComment) => secondComment.createdAt.localeCompare(firstComment.createdAt));

    response.json({ comments });
  } catch {
    response.status(500).json({ error: 'Eroare server.' });
  }
});

router.get('/admin/:eventSlug/overview', requireFirebaseAuth, requireSupremeAdmin, async (request: Request, response: Response) => {
  try {
    const eventDoc = await firestore().collection(QR_EVENTS).doc(request.params.eventSlug).get();
    if (!eventDoc.exists) {
      response.status(404).json({ error: 'Evenimentul nu există.' });
      return;
    }

    const [uploadsSnapshot, guestsSnapshot, commentsSnapshot] = await Promise.all([
      firestore().collection(QR_UPLOADS).where('eventSlug', '==', request.params.eventSlug).get(),
      firestore().collection(QR_GUESTS).where('eventSlug', '==', request.params.eventSlug).get(),
      firestore().collection(QR_COMMENTS).where('eventSlug', '==', request.params.eventSlug).get(),
    ]);

    const eventData = eventDoc.data()!;
    const guests = guestsSnapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name,
      email: doc.data().email,
      gdprConsent: doc.data().gdprConsent,
      emailConsent: doc.data().emailConsent,
      uploadIds: doc.data().uploadIds ?? [],
      createdAt: (doc.data().createdAt as Timestamp).toDate().toISOString(),
    })).sort((firstGuest, secondGuest) => secondGuest.createdAt.localeCompare(firstGuest.createdAt));

    const guestMap = new Map(guests.map((guest) => [guest.id, guest]));

    const uploads = uploadsSnapshot.docs.map((doc) => ({
      id: doc.id,
      eventSlug: doc.data().eventSlug,
      guestId: doc.data().guestId,
      guestName: guestMap.get(doc.data().guestId as string)?.name ?? 'Anonim',
      type: doc.data().type,
      bunnyUrl: doc.data().bunnyUrl,
      fileName: doc.data().fileName,
      originalName: doc.data().originalName,
      visible: doc.data().visible,
      mimeType: doc.data().mimeType,
      createdAt: (doc.data().createdAt as Timestamp).toDate().toISOString(),
    })).sort((firstUpload, secondUpload) => secondUpload.createdAt.localeCompare(firstUpload.createdAt));

    const uploadMap = new Map(uploads.map((upload) => [upload.id, upload]));

    const comments = commentsSnapshot.docs.map((doc) => ({
      id: doc.id,
      uploadId: doc.data().uploadId,
      eventSlug: doc.data().eventSlug,
      text: doc.data().text,
      fromHost: doc.data().fromHost,
      createdAt: (doc.data().createdAt as Timestamp).toDate().toISOString(),
      uploadOriginalName: uploadMap.get(doc.data().uploadId as string)?.originalName ?? null,
      guestName: uploadMap.get(doc.data().uploadId as string)?.guestName ?? 'Anonim',
    })).sort((firstComment, secondComment) => secondComment.createdAt.localeCompare(firstComment.createdAt));

    response.json({
      event: {
        id: eventDoc.id,
        eventSlug: eventData.eventSlug ?? eventDoc.id,
        adminEventId: eventData.adminEventId ?? null,
        bride: eventData.bride ?? null,
        groom: eventData.groom ?? null,
        notificationEmail: eventData.notificationEmail ?? null,
        pin: eventData.pin ?? null,
        eventDate: (eventData.eventDate as Timestamp).toDate().toISOString(),
        createdAt: eventData.createdAt ? (eventData.createdAt as Timestamp).toDate().toISOString() : null,
      },
      guests,
      uploads,
      comments,
    });
  } catch {
    response.status(500).json({ error: 'Eroare server.' });
  }
});

// ─── Admin: delete upload ────────────────────────────────────────────────────

router.delete('/admin/upload/:uploadId', requireFirebaseAuth, requireSupremeAdmin, async (request: Request, response: Response) => {
  try {
    const uploadDoc = await firestore().collection(QR_UPLOADS).doc(request.params.uploadId).get();
    if (!uploadDoc.exists) {
      response.status(404).json({ error: 'Upload negăsit.' });
      return;
    }

    const data = uploadDoc.data()!;
    const accessKey = getBunnyStoragePassword();
    const storageUrl = buildBunnyUploadUrl(data.eventSlug as string, data.guestId as string, data.fileName as string);

    await fetch(storageUrl, {
      method: 'DELETE',
      headers: { [BUNNY_ACCESS_KEY_HEADER]: accessKey },
    });

    await Promise.all([
      firestore().collection(QR_UPLOADS).doc(request.params.uploadId).delete(),
      firestore().collection(QR_GUESTS).doc(data.guestId as string).update({
        uploadIds: FieldValue.arrayRemove(request.params.uploadId),
      }),
      Promise.all(
        (await firestore().collection(QR_COMMENTS).where('uploadId', '==', request.params.uploadId).get()).docs.map((doc) => doc.ref.delete()),
      ),
    ]);

    response.json({ ok: true });
  } catch {
    response.status(500).json({ error: 'Eroare server.' });
  }
});

// ─── Admin: delete comment ───────────────────────────────────────────────────

router.delete('/admin/comment/:commentId', requireFirebaseAuth, requireSupremeAdmin, async (request: Request, response: Response) => {
  try {
    await firestore().collection(QR_COMMENTS).doc(request.params.commentId).delete();
    response.json({ ok: true });
  } catch {
    response.status(500).json({ error: 'Eroare server.' });
  }
});

// ─── Admin: reset PIN for event ──────────────────────────────────────────────

router.post('/admin/:eventSlug/pin', requireFirebaseAuth, requireSupremeAdmin, async (request: Request, response: Response) => {
  const newPin = Math.random().toString(36).slice(2, 8).toUpperCase();
  try {
    await firestore().collection(QR_EVENTS).doc(request.params.eventSlug).update({ pin: newPin });
    response.json({ pin: newPin });
  } catch {
    response.status(500).json({ error: 'Eroare server.' });
  }
});

export default router;
