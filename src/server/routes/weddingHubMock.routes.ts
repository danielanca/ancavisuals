import { Router } from "express";
import type { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { normalizeRomanianPhoneNumber } from "../notifications/sms";
import { requireCoupleAuth } from "../middleware/requireFirebaseAuth";
import type { CoupleAuthenticatedRequest } from "../middleware/requireFirebaseAuth";

const router = Router();
const DEFAULT_WEDDING_NAME = "Wedding Hub Mock";
const DEFAULT_MESSAGE = "Acesta este un mesaj simulat pentru testare.";

type MockRsvpStatus = "asteptare" | "confirmat" | "refuzat";
type MockAudience = "all" | "confirmed" | "declined" | "waiting" | "with-table" | "without-table";
type MockChannel = "email" | "sms";
type MockBroadcastStatus = "queued" | "processing" | "sent" | "partial" | "failed";
type MockDeliveryStatus = "sent" | "failed" | "skipped";

type MockGuest = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  rsvpStatus: MockRsvpStatus;
  tableName: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  rsvpHistory: Array<{
    id: string;
    status: MockRsvpStatus;
    reason: string | null;
    createdAt: string;
  }>;
};

type MockBroadcastDelivery = {
  id: string;
  guestId: string;
  guestName: string;
  channel: MockChannel;
  recipient: string;
  fallbackFrom: MockChannel | null;
  status: MockDeliveryStatus;
  errorMessage: string | null;
  createdAt: string;
};

type MockBroadcast = {
  id: string;
  subject: string;
  message: string;
  audience: MockAudience;
  sendEmailToGuests: boolean;
  sendSmsToGuests: boolean;
  scheduledFor: string | null;
  status: MockBroadcastStatus;
  recipientCount: number;
  emailCount: number;
  smsCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  fallbackCount: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  deliveries: MockBroadcastDelivery[];
  warnings: Array<{ guestName: string; fromChannel: MockChannel; toChannel: MockChannel }>;
  failures: Array<{ guestName: string; channel: MockChannel; recipient: string; reason: string }>;
};

type MockActivity = {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
};

type MockSession = {
  weddingId: string;
  weddingName: string;
  guests: MockGuest[];
  broadcasts: MockBroadcast[];
  activities: MockActivity[];
  updatedAt: string;
};

type MockRecipientPlan = {
  guestId: string;
  guestName: string;
  guest: MockGuest;
  channels: Array<{
    channel: MockChannel;
    recipient: string;
    fallbackFrom: MockChannel | null;
  }>;
  skippedReason: string | null;
};

const mockSessions = new Map<string, MockSession>();
const mockTimers = new Map<string, ReturnType<typeof setTimeout>>();

const FIRST_NAMES = ["Ana", "Maria", "Ioana", "Elena", "Diana", "Andrei", "Mihai", "Paul", "Radu", "Vlad"];
const LAST_NAMES = ["Pop", "Popescu", "Ionescu", "Stan", "Dumitru", "Nistor", "Marin", "Enache", "Petrescu", "Toma"];

function isMockEnabled(): boolean {
  return process.env.WEDDING_HUB_MOCKS === "1" || process.env.VITE_WEDDING_HUB_MOCKS === "1";
}

function now(): string {
  return new Date().toISOString();
}

function createActivity(title: string, detail: string): MockActivity {
  return {
    id: uuidv4(),
    title,
    detail,
    createdAt: now(),
  };
}

function normalizeText(value: string | undefined): string {
  return (value ?? "").trim();
}

function pseudoRandom(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(Math.sin(hash) * 10000) % 1;
}

function buildGuest(firstName: string, lastName: string, index: number, status: MockRsvpStatus): MockGuest {
  const hasEmail = index % 4 !== 0;
  const hasPhone = index % 5 !== 0;
  const baseName = `${firstName}.${lastName}`.toLowerCase();
  return {
    id: uuidv4(),
    firstName,
    lastName,
    email: hasEmail ? `${baseName}${index}@example.com` : "",
    phone: hasPhone ? `+407${String(1000000 + index).slice(-7)}` : "",
    rsvpStatus: status,
    tableName: status === "confirmat" ? `Masa ${Math.ceil((index + 1) / 4)}` : null,
    notes: status === "refuzat" ? "Simulare refuz din mock zone." : "",
    createdAt: now(),
    updatedAt: now(),
    rsvpHistory: [
      {
        id: uuidv4(),
        status,
        reason: status === "refuzat" ? "Simulare refuz" : null,
        createdAt: now(),
      },
    ],
  };
}

function createSeedSession(weddingId: string, guestCount = 12): MockSession {
  const guests: MockGuest[] = [];
  for (let index = 0; index < guestCount; index += 1) {
    const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
    const lastName = LAST_NAMES[index % LAST_NAMES.length];
    const bucket = index % 6;
    const status: MockRsvpStatus = bucket <= 2 ? "confirmat" : bucket === 3 ? "asteptare" : "refuzat";
    guests.push(buildGuest(firstName, lastName, index + 1, status));
  }

  return {
    weddingId,
    weddingName: DEFAULT_WEDDING_NAME,
    guests,
    broadcasts: [],
    activities: [createActivity("Demo seed", `Au fost create ${guestCount} invitați mock.`)],
    updatedAt: now(),
  };
}

function getSession(weddingId: string): MockSession {
  const existing = mockSessions.get(weddingId);
  if (existing) return existing;

  const created = createSeedSession(weddingId);
  mockSessions.set(weddingId, created);
  return created;
}

function saveSession(session: MockSession): void {
  session.updatedAt = now();
  mockSessions.set(session.weddingId, session);
}

function recordActivity(session: MockSession, title: string, detail: string): void {
  session.activities.unshift(createActivity(title, detail));
  session.activities = session.activities.slice(0, 50);
}

function matchesAudience(guest: MockGuest, audience: MockAudience): boolean {
  switch (audience) {
    case "confirmed":
      return guest.rsvpStatus === "confirmat";
    case "declined":
      return guest.rsvpStatus === "refuzat";
    case "waiting":
      return guest.rsvpStatus === "asteptare";
    case "with-table":
      return Boolean(guest.tableName);
    case "without-table":
      return !guest.tableName;
    case "all":
    default:
      return true;
  }
}

function buildBroadcastPlans(args: {
  guests: MockGuest[];
  audience: MockAudience;
  sendEmailToGuests: boolean;
  sendSmsToGuests: boolean;
}): {
  plans: MockRecipientPlan[];
  warnings: Array<{ guestName: string; fromChannel: MockChannel; toChannel: MockChannel }>;
} {
  const { guests, audience, sendEmailToGuests, sendSmsToGuests } = args;
  const plans: MockRecipientPlan[] = [];
  const warnings: Array<{ guestName: string; fromChannel: MockChannel; toChannel: MockChannel }> = [];

  for (const guest of guests) {
    if (!matchesAudience(guest, audience)) continue;

    const guestName = `${guest.firstName} ${guest.lastName}`.trim();
    const email = normalizeText(guest.email);
    const phone = normalizeRomanianPhoneNumber(guest.phone ?? "");
    const channels: MockRecipientPlan["channels"] = [];

    if (sendEmailToGuests && email) {
      channels.push({ channel: "email", recipient: email, fallbackFrom: null });
    }

    if (sendSmsToGuests && phone) {
      channels.push({ channel: "sms", recipient: phone, fallbackFrom: null });
    }

    if (channels.length === 0) {
      if (sendEmailToGuests && !email && phone) {
        channels.push({ channel: "sms", recipient: phone, fallbackFrom: "email" });
        warnings.push({ guestName, fromChannel: "email", toChannel: "sms" });
      } else if (sendSmsToGuests && !phone && email) {
        channels.push({ channel: "email", recipient: email, fallbackFrom: "sms" });
        warnings.push({ guestName, fromChannel: "sms", toChannel: "email" });
      }
    }

    plans.push({
      guestId: guest.id,
      guestName,
      guest,
      channels,
      skippedReason: channels.length === 0 ? "Nu există canal disponibil pentru opțiunea aleasă." : null,
    });
  }

  return { plans, warnings };
}

function summarizeBroadcast(broadcast: MockBroadcast): string {
  return `${broadcast.subject} · ${broadcast.sentCount} trimise, ${broadcast.failedCount} eșuate`;
}

function finalizeBroadcast(session: MockSession, broadcastId: string): void {
  const broadcast = session.broadcasts.find((item) => item.id === broadcastId);
  if (!broadcast || broadcast.status !== "queued") return;

  broadcast.status = "processing";
  broadcast.startedAt = now();
  saveSession(session);

  const { plans, warnings } = buildBroadcastPlans({
    guests: session.guests,
    audience: broadcast.audience,
    sendEmailToGuests: broadcast.sendEmailToGuests,
    sendSmsToGuests: broadcast.sendSmsToGuests,
  });

  const deliveries: MockBroadcastDelivery[] = [];
  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  const failures: MockBroadcast["failures"] = [];

  plans.forEach((plan, planIndex) => {
    if (plan.channels.length === 0) {
      skippedCount += 1;
      deliveries.push({
        id: uuidv4(),
        guestId: plan.guestId,
        guestName: plan.guestName,
        channel: broadcast.sendEmailToGuests ? "email" : "sms",
        recipient: plan.guest.email || plan.guest.phone || "",
        fallbackFrom: null,
        status: "skipped",
        errorMessage: plan.skippedReason,
        createdAt: now(),
      });
      return;
    }

    plan.channels.forEach((channelInfo, channelIndex) => {
      const seed = `${broadcast.id}:${plan.guestId}:${channelInfo.channel}:${planIndex}:${channelIndex}`;
      const success = pseudoRandom(seed) > 0.12;
      const deliveryStatus: MockDeliveryStatus = success ? "sent" : "failed";

      deliveries.push({
        id: uuidv4(),
        guestId: plan.guestId,
        guestName: plan.guestName,
        channel: channelInfo.channel,
        recipient: channelInfo.recipient,
        fallbackFrom: channelInfo.fallbackFrom,
        status: deliveryStatus,
        errorMessage: success ? null : `Eșec simulat pe canalul ${channelInfo.channel}.`,
        createdAt: now(),
      });

      if (success) {
        sentCount += 1;
      } else {
        failedCount += 1;
        failures.push({
          guestName: plan.guestName,
          channel: channelInfo.channel,
          recipient: channelInfo.recipient,
          reason: `Eșec simulat pe canalul ${channelInfo.channel}.`,
        });
      }
    });
  });

  broadcast.deliveries = deliveries;
  broadcast.warnings = warnings;
  broadcast.failures = failures;
  broadcast.recipientCount = plans.length;
  broadcast.emailCount = plans.filter((plan) => Boolean(plan.guest.email)).length;
  broadcast.smsCount = plans.filter((plan) => Boolean(plan.guest.phone)).length;
  broadcast.sentCount = sentCount;
  broadcast.failedCount = failedCount;
  broadcast.skippedCount = skippedCount;
  broadcast.fallbackCount = warnings.length;
  broadcast.completedAt = now();
  broadcast.status = failedCount > 0 ? (sentCount > 0 ? "partial" : "failed") : "sent";

  recordActivity(session, "Mesaj simulat livrat", summarizeBroadcast(broadcast));
  saveSession(session);
}

function scheduleBroadcast(session: MockSession, broadcastId: string, scheduledFor: string | null): void {
  const existingTimer = mockTimers.get(broadcastId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const delayMs = scheduledFor ? Math.max(0, new Date(scheduledFor).getTime() - Date.now()) : 800;
  const timer = setTimeout(() => {
    mockTimers.delete(broadcastId);
    finalizeBroadcast(session, broadcastId);
  }, delayMs);

  mockTimers.set(broadcastId, timer);
}

function serializeSession(session: MockSession) {
  return {
    weddingId: session.weddingId,
    weddingName: session.weddingName,
    guests: session.guests,
    broadcasts: session.broadcasts,
    activities: session.activities,
    updatedAt: session.updatedAt,
  };
}

router.get("/status", requireCoupleAuth, (req: Request, res: Response) => {
  if (!isMockEnabled()) {
    return res.status(404).json({ enabled: false, error: "Zona mock este dezactivată." });
  }

  const coupleReq = req as CoupleAuthenticatedRequest;
  const session = getSession(coupleReq.weddingId);
  res.json({
    enabled: true,
    weddingId: session.weddingId,
    weddingName: session.weddingName,
    guestCount: session.guests.length,
    broadcastCount: session.broadcasts.length,
    latestActivity: session.activities[0] ?? null,
  });
});

router.use(requireCoupleAuth);

router.use((req: Request, res: Response, next) => {
  if (!isMockEnabled()) {
    return res.status(404).json({ error: "Zona mock este dezactivată." });
  }
  next();
});

router.get("/session", (req: Request, res: Response) => {
  const coupleReq = req as CoupleAuthenticatedRequest;
  const session = getSession(coupleReq.weddingId);
  res.json({ session: serializeSession(session) });
});

router.post("/reset", (req: Request, res: Response) => {
  const coupleReq = req as CoupleAuthenticatedRequest;
  const guestCount = Number.isFinite(Number(req.body?.guestCount)) ? Math.max(1, Math.min(60, Number(req.body.guestCount))) : 12;
  const session = createSeedSession(coupleReq.weddingId, guestCount);
  mockSessions.set(coupleReq.weddingId, session);
  recordActivity(session, "Demo reset", `Zona mock a fost resetată cu ${guestCount} invitați.`);
  saveSession(session);
  res.json({ ok: true, session: serializeSession(session) });
});

router.post("/seed", (req: Request, res: Response) => {
  const coupleReq = req as CoupleAuthenticatedRequest;
  const guestCount = Number.isFinite(Number(req.body?.guestCount)) ? Math.max(1, Math.min(60, Number(req.body.guestCount))) : 24;
  const session = createSeedSession(coupleReq.weddingId, guestCount);
  mockSessions.set(coupleReq.weddingId, session);
  recordActivity(session, "Demo seed", `Au fost generați ${guestCount} invitați noi.`);
  saveSession(session);
  res.json({ ok: true, session: serializeSession(session) });
});

router.post("/rsvp", (req: Request, res: Response) => {
  const coupleReq = req as CoupleAuthenticatedRequest;
  const session = getSession(coupleReq.weddingId);
  const status = req.body?.status as MockRsvpStatus | undefined;
  if (!status || !["asteptare", "confirmat", "refuzat"].includes(status)) {
    return res.status(400).json({ error: "Status RSVP invalid." });
  }

  const guestId = normalizeText(req.body?.guestId);
  const reason = normalizeText(req.body?.reason) || null;

  let guest = guestId ? session.guests.find((item) => item.id === guestId) : undefined;
  const firstName = normalizeText(req.body?.firstName) || guest?.firstName || "Invitat";
  const lastName = normalizeText(req.body?.lastName) || guest?.lastName || "Mock";
  if (!guest) {
    guest = {
      id: uuidv4(),
      firstName,
      lastName,
      email: normalizeText(req.body?.email),
      phone: normalizeText(req.body?.phone),
      rsvpStatus: status,
      tableName: status === "confirmat" ? "Masa mock" : null,
      notes: normalizeText(req.body?.notes),
      createdAt: now(),
      updatedAt: now(),
      rsvpHistory: [],
    };
    session.guests.unshift(guest);
  }

  guest.firstName = firstName || guest.firstName;
  guest.lastName = lastName || guest.lastName;
  guest.email = normalizeText(req.body?.email) || guest.email;
  guest.phone = normalizeText(req.body?.phone) || guest.phone;
  guest.rsvpStatus = status;
  guest.tableName = status === "confirmat" ? guest.tableName ?? "Masa mock" : null;
  guest.notes = normalizeText(req.body?.notes) || guest.notes;
  guest.updatedAt = now();
  guest.rsvpHistory.unshift({
    id: uuidv4(),
    status,
    reason,
    createdAt: now(),
  });

  recordActivity(
    session,
    "RSVP simulat",
    `${guest.firstName} ${guest.lastName} a trecut la ${status === "confirmat" ? "confirmat" : status === "refuzat" ? "refuzat" : "așteptare"}.`,
  );
  saveSession(session);

  res.json({ ok: true, guest });
});

router.post("/messages/preview", (req: Request, res: Response) => {
  const coupleReq = req as CoupleAuthenticatedRequest;
  const session = getSession(coupleReq.weddingId);
  const audience = (req.body?.audience as MockAudience | undefined) ?? "confirmed";
  const sendEmailToGuests = req.body?.sendEmailToGuests !== false;
  const sendSmsToGuests = req.body?.sendSmsToGuests !== false;
  const { plans, warnings } = buildBroadcastPlans({
    guests: session.guests,
    audience,
    sendEmailToGuests,
    sendSmsToGuests,
  });

  res.json({
    ok: true,
    summary: {
      recipientCount: plans.length,
      emailCount: plans.filter((plan) => plan.channels.some((channel) => channel.channel === "email")).length,
      smsCount: plans.filter((plan) => plan.channels.some((channel) => channel.channel === "sms")).length,
      fallbackCount: warnings.length,
      skippedCount: plans.filter((plan) => plan.channels.length === 0).length,
    },
    warnings,
    recipients: plans.slice(0, 15).map((plan) => ({
      guestId: plan.guestId,
      guestName: plan.guestName,
      channels: plan.channels,
      skippedReason: plan.skippedReason,
    })),
  });
});

router.post("/messages/send", (req: Request, res: Response) => {
  const coupleReq = req as CoupleAuthenticatedRequest;
  const session = getSession(coupleReq.weddingId);
  const subject = normalizeText(req.body?.subject) || "Mesaj simulat";
  const message = normalizeText(req.body?.message) || DEFAULT_MESSAGE;
  const audience = (req.body?.audience as MockAudience | undefined) ?? "confirmed";
  const sendEmailToGuests = req.body?.sendEmailToGuests !== false;
  const sendSmsToGuests = req.body?.sendSmsToGuests !== false;
  const scheduledFor = normalizeText(req.body?.scheduledFor) || null;
  const broadcast: MockBroadcast = {
    id: uuidv4(),
    subject,
    message,
    audience,
    sendEmailToGuests,
    sendSmsToGuests,
    scheduledFor,
    status: "queued",
    recipientCount: 0,
    emailCount: 0,
    smsCount: 0,
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    fallbackCount: 0,
    createdAt: now(),
    startedAt: null,
    completedAt: null,
    deliveries: [],
    warnings: [],
    failures: [],
  };

  session.broadcasts.unshift(broadcast);
  recordActivity(session, "Mesaj simulat pus în coadă", subject);
  saveSession(session);
  scheduleBroadcast(session, broadcast.id, scheduledFor);

  res.status(201).json({ ok: true, broadcast });
});

router.get("/messages/broadcasts", (req: Request, res: Response) => {
  const coupleReq = req as CoupleAuthenticatedRequest;
  const session = getSession(coupleReq.weddingId);
  res.json({ broadcasts: session.broadcasts });
});

router.get("/messages/broadcasts/:broadcastId", (req: Request, res: Response) => {
  const coupleReq = req as CoupleAuthenticatedRequest;
  const session = getSession(coupleReq.weddingId);
  const broadcast = session.broadcasts.find((item) => item.id === req.params.broadcastId);
  if (!broadcast) {
    return res.status(404).json({ error: "Broadcast-ul mock nu a fost găsit." });
  }
  res.json({ broadcast });
});

router.get("/guests/:guestId/history", (req: Request, res: Response) => {
  const coupleReq = req as CoupleAuthenticatedRequest;
  const session = getSession(coupleReq.weddingId);
  const guest = session.guests.find((item) => item.id === req.params.guestId);
  if (!guest) {
    return res.status(404).json({ error: "Invitatul mock nu a fost găsit." });
  }

  const deliveries = session.broadcasts.flatMap((broadcast) =>
    broadcast.deliveries.filter((delivery) => delivery.guestId === guest.id).map((delivery) => ({
      broadcastId: broadcast.id,
      subject: broadcast.subject,
      channel: delivery.channel,
      recipient: delivery.recipient,
      status: delivery.status,
      fallbackFrom: delivery.fallbackFrom,
      errorMessage: delivery.errorMessage,
      createdAt: delivery.createdAt,
    })),
  );

  res.json({
    guest,
    rsvpHistory: guest.rsvpHistory,
    deliveries,
  });
});

export default router;
