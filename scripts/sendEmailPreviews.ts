/*
 * Sends one copy of every email the site can send, filled with sample data, so the owner can see
 * them all in a real inbox. Everything goes to SMTP_SENDER_EMAIL (info@ancavisuals.ro), admin
 * alerts included, one email every 10 seconds.
 *
 *   npx tsx scripts/sendEmailPreviews.ts            # all of them
 *   npx tsx scripts/sendEmailPreviews.ts 12         # start from #12 (after an interruption)
 *   npx tsx scripts/sendEmailPreviews.ts --dry <dir> # write the final HTML to <dir> instead of sending
 */
import "dotenv/config";

const TO = process.env.SMTP_SENDER_EMAIL ?? "";
if (!TO) throw new Error("SMTP_SENDER_EMAIL is missing from .env");
// Admin alerts read this at import time: point them at the same inbox before loading any template.
process.env.ADMIN_NOTIFICATION_EMAIL = TO;

const DELAY_MS = 10_000;
const SLUG = "12septembrie2026";
const BASE = "https://ancavisuals.ro";
const NOW = new Date().toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" });

type Preview = { name: string; send: () => Promise<unknown> };

async function main() {
  const mailer = await import("../src/server/notifications/mailer");
  const { toMonochromeEmail, isDarkPage } = await import("../src/server/notifications/emailMonochrome");
  const dryIndex = process.argv.indexOf("--dry");
  const dryDir = dryIndex >= 0 ? process.argv[dryIndex + 1] : null;
  const written: { subject: string; html: string }[] = [];
  if (dryDir) {
    const { mkdirSync } = await import("node:fs");
    mkdirSync(dryDir, { recursive: true });
    // The templates that send by themselves go through mailer.sendMail: catch them instead of sending.
    mailer.mailer.sendMail = async ({ subject, html }) => { written.push({ subject, html }); };
  }
  const sendEmail = dryDir
    ? async ({ subject, html }: { subject: string; html: string }) => { written.push({ subject, html }); }
    : mailer.sendEmail;
  const mail = (name: string, email: { subject: string; html: string }) =>
    ({ name, send: () => sendEmail({ to: TO, source: "email-preview", ...email }) }) satisfies Preview;

  const moderation = await import("../src/server/notifications/templates/moderationTemplate");
  const inspiration = await import("../src/server/notifications/templates/inspirationProposalTemplate");
  const contract = await import("../src/server/notifications/templates/contractEmail");
  const handover = await import("../src/server/notifications/templates/handoverEmail");
  const { renderTriggerTemplate } = await import("../src/server/notifications/templates/triggerTemplate");
  const { renderDateCheckTemplate } = await import("../src/server/notifications/templates/dateCheckTemplate");
  const { renderChatbotLeadTemplate } = await import("../src/server/notifications/templates/chatbotLeadTemplate");
  const vat = await import("../src/server/notifications/templates/reverseChargeVatTemplate");
  const { sendOfferViewNotification } = await import("../src/server/notifications/offerViewNotification");
  const monitoring = await import("../src/server/routes/monitoring.routes");
  const { sendCrashEmail } = await import("../src/server/monitoring/serverMonitor");
  const album = await import("../src/server/routes/album.routes");
  const subs = await import("../src/server/routes/albumSubscriptions.routes");
  const qr = await import("../src/server/routes/qrMoments.routes");
  const wedding = await import("../src/server/routes/weddingHub.routes");
  const adminEvents = await import("../src/server/routes/adminEvents.routes");
  const { mementosTestEmail } = await import("../src/server/routes/mementos.routes");
  const { chatTranscriptEmail } = await import("../src/server/routes/assistantChat.routes");
  const { offerDownloadedEmail } = await import("../src/server/routes/oferte.routes");
  const { referralEmail } = await import("../src/server/routes/referral.routes");
  const { landingLeadEmail } = await import("../src/server/routes/campaign.routes");
  const { buildEmailHtml: loginEmailHtml } = await import("../src/server/routes/loginEvents.routes");
  const live = await import("../src/server/routes/liveVisitors.routes");
  const { buildCompletionEmail } = await import("../src/server/routes/proposalLinks.routes");
  const { contactClickEmailHtml } = await import("../src/server/routes/analytics.routes");
  const { buildEmailHtml: photoboothRouteHtml } = await import("../src/server/routes/photobooth.routes");
  const { buildEmailHtml: photoboothCronHtml } = await import("../src/server/cron/photoboothNotify.cron");
  const { sendBackupReminderEmail } = await import("../src/server/cron/postEventBackupReminder.cron");
  const { mementoEmail } = await import("../src/server/cron/mementos.cron");
  const { stepsReminderEmail } = await import("../src/server/cron/healthStepsReminder.cron");
  const retention = await import("../src/server/cron/albumRetention.cron");
  const { weeklyAnalyticsEmail } = await import("../src/server/cron/analytics.cron");
  const { errorsDigestEmail } = await import("../src/server/cron/errors.cron");
  const { buildReminderEmailHtml } = await import("../src/server/cron/reminders.cron");
  const { overdueTaskEmail } = await import("../src/server/cron/clientTasks.cron");
  const { incompleteUploadEmail } = await import("../src/server/services/albumUploadNotifications");
  const { promiseReminderEmail } = await import("../src/server/services/albumPromises");
  const { reminderMessage } = await import("../src/server/services/proposalLinkReminder");
  const { openedEmail } = await import("../src/server/services/handoverOpenedNotification");
  const familyTime = await import("../src/server/services/familyTime.service");
  const familyCalendar = await import("../src/server/services/familyCalendar.service");
  const { familyLoginEmail } = await import("../src/server/services/familyCalendarAuth.service");
  const booking = await import("../src/shared/leadEmails");

  const geo = { city: "Cluj-Napoca", region: "Cluj", country: "RO" };
  const today = new Date().toISOString().slice(0, 10);
  const familyEvents = [
    { id: "e1", dates: [today], type: "Nuntă", clientName: "Ana & Mihai", location: "Cluj-Napoca", total: 2400 },
    { id: "e2", dates: ["2026-11-14", "2026-11-15"], type: "Botez", clientName: "Familia Pop", location: "Turda", total: 900 },
  ] as never;
  const liveSession = {
    visitorNumber: 1287, city: "Cluj-Napoca", country: "RO", currentPage: "/contact", org: "Digi Romania", deviceType: "mobile",
    ip: "89.137.12.34", isGoogleAds: true, attribution: { utmCampaign: "nunti-cluj", utmTerm: "fotograf nunta cluj", gclid: "abc" },
  } as never;
  const update = { id: "u1", kind: "photos", text: "Am adăugat 120 de poze noi din petrecere.", estimateDate: null, createdAt: null } as never;
  const subscriber = { albumSlug: SLUG, email: "client@exemplu.ro", unsubscribeToken: "cod-personal" } as never;
  const whatsappRecipients = [{ name: "Ana Popescu", phone: "+40745111222", link: "https://wa.me/40745111222" }];
  const fakeRequest = { headers: { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", "x-forwarded-for": "89.137.12.34" }, ip: "89.137.12.34", socket: { remoteAddress: "89.137.12.34" }, query: {} } as never;
  const deletedContract = { id: "c-123", eventType: "Nuntă", eventDate: "2026-09-12", clientEmail: "ana@exemplu.ro", clientName: "Ana Popescu", priceTotal: 2400, currency: "EUR", status: "signed" };
  const contractBase = { to: TO, token: "token-demo", eventType: "Nuntă", eventDate: "2026-09-12", baseUrl: BASE };

  const previews: Preview[] = [
    // Moderation & inspiration
    mail("Moderare: poze propuse spre ștergere", moderation.moderationSubmittedEmail({ moderatorEmail: "moderator@exemplu.ro", albumSlug: SLUG, photoCount: 3, note: "Poze neclare de la intrare." })),
    mail("Moderare: decizie", moderation.moderationResultEmail({ albumSlug: SLUG, deletedPhotos: ["IMG_0012.jpg", "IMG_0013.jpg"], keptPhotos: ["IMG_0020.jpg"] })),
    mail("Inspirație: propunere nouă", inspiration.inspirationProposalSubmittedEmail({ proposerEmail: "ana@exemplu.ro", photoCount: 4 })),
    mail("Inspirație: acceptată", inspiration.inspirationProposalReviewEmail({ action: "approve", photoUrl: `${BASE}/og-image.jpg`, rejectionReason: "" })),
    mail("Inspirație: respinsă", inspiration.inspirationProposalReviewEmail({ action: "reject", photoUrl: `${BASE}/og-image.jpg`, rejectionReason: "Poza e prea întunecată." })),

    // Contracts & handover (these send their own copies, admin copy included)
    { name: "Contract: link de semnare", send: () => contract.sendContractLinkEmail(contractBase) },
    { name: "Contract: reminder semnare", send: () => contract.sendContractReminderEmail(contractBase) },
    { name: "Contract: semnat de client", send: () => contract.sendSignedContractEmail({ to: TO, eventType: "Nuntă", eventDate: "2026-09-12", clientName: "Ana Popescu", pdfUrl: `${BASE}/contract.pdf`, admin: { contractId: "c-123", clientPhone: "0745 111 222", eventLocation: "Cluj-Napoca", priceTotal: 2400, priceAdvance: 500, currency: "EUR", signedAt: NOW, signedFrom: "Cluj-Napoca, RO" } }) },
    { name: "Contract: semnat de ambele părți", send: () => contract.sendFullySignedContractEmail({ to: TO, eventType: "Nuntă", eventDate: "2026-09-12", clientName: "Ana Popescu", pdfUrl: `${BASE}/contract.pdf` }) },
    { name: "Contract: date pentru plată", send: () => contract.sendBankTransferEmail({ to: TO, clientName: "Ana Popescu", eventType: "Nuntă", eventDate: "2026-09-12", beneficiaryName: "Anca Visuals", iban: "RO49AAAA1B31007593840000", amount: 2500, currency: "RON", isAdvance: true, dueDate: "2026-11-10", eurRate: 4.97, eurRateDate: today } as never) },
    { name: "Contract: șters", send: () => contract.sendContractDeletedEmail({ contract: deletedContract }) },
    { name: "Proces-verbal: link de semnare", send: () => handover.sendHandoverLinkEmail(contractBase) },
    { name: "Proces-verbal: reminder", send: () => handover.sendHandoverReminderEmail(contractBase) },
    { name: "Proces-verbal: semnat", send: () => handover.sendSignedHandoverEmail({ to: TO, eventType: "Nuntă", eventDate: "2026-09-12", clientName: "Ana Popescu", pdfUrl: `${BASE}/pv.pdf`, digitalLinks: [{ label: "Poze", url: `${BASE}/media/${SLUG}` }, { label: "Video", url: `${BASE}/media/${SLUG}#video` }], digitalLinkExpiryDays: 60, awb: "1234567890" }) },
    { name: "Proces-verbal: reminder descărcare", send: () => handover.sendDownloadReminderEmail({ ...contractBase, linksValidUntil: "2026-12-31" }) },
    mail("Proces-verbal: deschis din SMS", { subject: "📨 Clientul a deschis procesul-verbal", html: openedEmail({ eventLabel: "Nuntă Ana & Mihai — 12 septembrie 2026", status: "nesemnat", geoLabel: "Cluj-Napoca, RO" }) }),

    // Leads & visitors
    mail("Vizitator nou pe site", { subject: "👤 Vizitator nou — /contact", html: renderTriggerTemplate({ typeEvent: "Vizită", url: "/contact", browserVersion: "Mozilla/5.0 (iPhone)", referrer: "https://www.google.com/", ipInfo: { ip: "89.137.12.34", ...geo, org: "Digi Romania", loc: "46.77,23.59" } as never, clientIp: "89.137.12.34", timestamp: NOW, isNewVisitor: true, isGoogleAds: true, utmCampaign: "nunti-cluj", gclid: "abc", landingPath: "/fotograf-nunta-cluj", keyword: "fotograf nunta cluj" }) }),
    mail("Lead: cerere din configurator", { subject: "Cerere nouă — Nuntă 12.09.2026", html: booking.buildHtmlFinal({ selectedFormattedDate: "12.09.2026", eventType: "Nuntă", fullName: "Ana Popescu", phone: "0745 111 222", location: "Cluj-Napoca", startTime: "14:00", endTime: "02:00", overnight: true, durationHours: 12, totalPrice: 2400, selectedPackages: ["Foto", "Video"], showCustom: false, photo: true, video: true }) }),
    mail("Lead rapid din configurator", { subject: "Lead Rapid — Ana Popescu", html: booking.buildQuickLeadHtml({ selectedFormattedDate: "12.09.2026", eventType: "Nuntă", fullName: "Ana Popescu", phone: "0745 111 222" }) }),
    mail("Lead: cerere de apel din /bio", { subject: "Vreau să fiu contactat — 0745 111 222", html: booking.buildBioCallbackHtml("0745 111 222") }),
    mail("Lead: formular landing", landingLeadEmail({ referral: true, pageTitle: "Fotograf nuntă Cluj", subjectTime: NOW, slug: "fotograf-nunta-cluj", name: "Ana Popescu", phone: "0745111222", whatsappLink: "https://wa.me/40745111222", eventType: "Nuntă", eventDate: "12.09.2026", location: "Cluj-Napoca", message: "Bună! Mai aveți liber pe 12 septembrie?" })),
    mail("Click pe contact", { subject: "📞 Click telefon — ancavisuals.ro", html: contactClickEmailHtml({ title: "📞 Click telefon", page: "/contact", locationLabel: "Cluj-Napoca, RO", provider: "Digi Romania" }) }),
    mail("Eveniment live: formular trimis", live.buildEventEmail("form_submitted", liveSession, { kind: "contact", eventType: "nunta" })),
    mail("Album deschis din notificare", { subject: `👀 Clientul a deschis albumul ${SLUG} din email`, html: live.albumOpenedEmail(SLUG, "email", "Cluj-Napoca, RO", "mobile") }),
    { name: "Ofertă vizualizată", send: () => sendOfferViewNotification({ slug: "oferta-ana-mihai", viewCount: 3, request: fakeRequest, clientName: "Ana Popescu", title: "Ofertă nuntă", pageUrl: `${BASE}/oferte/oferta-ana-mihai` }) },
    mail("Ofertă descărcată", offerDownloadedEmail({ slug: "oferta-ana-mihai", clientName: "Ana Popescu", time: NOW, ip: "89.137.12.34", downloads: 2 })),
    mail("Recomandare nouă", referralEmail({ fromAlbum: SLUG, referredName: "Maria Ionescu", referredContact: "0745 333 444" })),
    mail("Chatbot: lead", { subject: "🤖 Lead nou din chatbot", html: renderChatbotLeadTemplate({ phone: "0745 111 222", dateLabel: "12 septembrie 2026" }) }),
    mail("Chatbot: verificare dată", { subject: "📅 Verificare disponibilitate", html: renderDateCheckTemplate({ humanDate: "12 septembrie 2026", isBooked: false }) }),
    mail("Chatbot: transcript", chatTranscriptEmail([{ sender: "user", text: "Bună! Aveți liber pe 12 septembrie?" }, { sender: "bot", text: "Da, data e liberă. Vă pot trimite oferta?" }, { sender: "user", text: "Da, vă rog. 0745 111 222" }])),
    mail("Login: reușit", { subject: "✅ Login Successful — iPhone — Cluj-Napoca", html: loginEmailHtml({ type: "success", ip: "89.137.12.34", browser: "Safari 18", os: "iOS 18", device: "iPhone", screen: "390x844", language: "ro-RO", timezone: "Europe/Bucharest", location: "Cluj-Napoca, RO", timestamp: NOW }) }),
    mail("Login: încercare eșuată", { subject: "⚠️ Login Attempt Alert — Windows — București", html: loginEmailHtml({ type: "failure", ip: "86.120.1.2", browser: "Chrome 130", os: "Windows 11", device: "Desktop", screen: "1920x1080", language: "ro-RO", timezone: "Europe/Bucharest", location: "București, RO", attemptedEmail: "admin@exemplu.ro", timestamp: NOW, errorCode: "auth/wrong-password" }) }),

    // Albums
    mail("Album: eroare vizualizare", album.albumViewErrorEmail({ slug: SLUG, errorMessage: "Imagini inaccesibile", photosCount: 640, pageUrl: `${BASE}/media/${SLUG}`, location: "Cluj-Napoca, RO", ip: "89.137.12.34", userAgent: "Mozilla/5.0 (iPhone)" })),
    mail("Album: încărcare lentă", album.albumViewErrorEmail({ slug: SLUG, errorMessage: "Loading > 8 secunde", pageUrl: `${BASE}/media/${SLUG}`, location: "Cluj-Napoca, RO", ip: "89.137.12.34", userAgent: "Mozilla/5.0 (iPhone)" })),
    mail("Album: selecție imprimare finalizată", album.printSelectionDoneEmail(SLUG, 42)),
    mail("Album: reminder selecție imprimare (client)", album.printReminderEmail(`Bună! Albumul vostru e gata.\n\nAlegeți pozele pentru albumul tipărit aici: ${BASE}/media/${SLUG}?select=print`, `${BASE}/media/${SLUG}?select=print`)),
    mail("Album: client cere ZIP", album.zipRequestEmail(SLUG, 2)),
    mail("Album: abonat nou (admin)", subs.newSubscriberAdminEmail(SLUG, "ana@exemplu.ro", ["email", "sms"] as never)),
    mail("Album: confirmare abonare (client)", { subject: "✅ Abonare confirmată", html: subs.subscribeConfirmationEmail(SLUG, ["email"] as never, "cod-personal") }),
    mail("Album: abonat a deschis albumul", subs.subscriberClickEmail({ slug: SLUG, email: "ana@exemplu.ro", clickedAt: NOW, ip: "89.137.12.34", location: "Cluj-Napoca, RO", albumUrl: `${BASE}/media/${SLUG}` })),
    mail("Album: poze noi (client)", subs.photosAddedEmail(SLUG, "ana@exemplu.ro")),
    (() => { const m = subs.albumUpdateMessages(update, SLUG, subscriber, { unsubscribeLink: true }); return mail("Album: noutate (client)", { subject: m.emailSubject, html: m.emailHtml }); })(),
    mail("Album: de trimis pe WhatsApp", { subject: "📲 De trimis pe WhatsApp (1)", html: subs.whatsappAdminEmail(SLUG, `Am adăugat poze noi în album: ${BASE}/media/${SLUG}`, whatsappRecipients) }),
    mail("Album: expiră în 7 zile (client)", retention.albumExpiryReminderEmail(SLUG, "2026-11-30T12:00:00.000Z", 7)),
    mail("Album: expiră mâine (client)", retention.albumExpiryReminderEmail(SLUG, "2026-11-30T12:00:00.000Z", 1)),
    mail("Album: expirat (admin)", retention.albumExpiredAdminEmail(SLUG, "2026-11-30T12:00:00.000Z")),
    mail("Album: preview-uri incomplete", adminEvents.previewProcessingProblemEmail(SLUG)),
    mail("Album: preview-uri procesate", adminEvents.previewProcessedEmail(SLUG, 638, 2, 1)),
    mail("Album: ZIP actualizat", adminEvents.zipUpdatedEmail(SLUG, 640)),
    mail("Album: ZIP eșuat", adminEvents.zipFailedEmail(SLUG, "Bunny Storage a răspuns cu 503.")),
    mail("Album: upload incomplet", incompleteUploadEmail({ slug: SLUG, total: 640, pending: ["IMG_1201.jpg", "IMG_1202.jpg"] })),
    mail("Album: promisiuni către clienți", promiseReminderEmail([{ id: "p1", albumSlug: SLUG, clients: ["Ana Popescu"], kind: "photos", label: "Poze", text: "Restul pozelor", estimateDate: "2026-11-05", createdAt: null, daysLeft: -1, status: "overdue", reminderSentAt: null, overdueReminderSentAt: null }] as never)),
    mail("Album: link propuneri terminat", buildCompletionEmail({ albumSlug: SLUG, label: "Ana & Mihai", totalPhotos: 640 }, { name: "Ana", proposedCount: 48, viewedCount: 600 } as never)),
    (() => { const m = reminderMessage({ token: "t1", albumSlug: SLUG, label: "Ana & Mihai", totalPhotos: 640 }, { id: "r1", name: "Ana", email: "ana@exemplu.ro" } as never); return mail("Album: reminder alegere poze (client)", m); })(),

    // QR Moments & photobooth
    { name: "QR Moments: mulțumire invitat", send: () => qr.sendThankYouEmail(TO, "Ioana", "Mulțumim că ai fost alături de noi!", "Ana & Mihai", "guest-demo", "wedding" as never) },
    { name: "QR Moments: au vizualizat", send: () => qr.sendViewNotificationEmail(TO, "Ioana", "Ana & Mihai", "guest-demo", `${BASE}/og-image.jpg`, "poza ta", "wedding" as never) },
    { name: "QR Moments: răspuns la upload", send: () => qr.sendCommentNotification(TO, "Ioana", "Ce poză frumoasă!", "ana-mihai", "guest-demo", `${BASE}/og-image.jpg`, "Ana & Mihai", "wedding" as never) },
    { name: "QR Moments: upload nou", send: () => qr.sendUploadNotification(TO, "ana-mihai", "Ioana", { photo: 3, video: 1 } as never) },
    mail("QR Moments: acces galerie", qr.galleryAccessEmail({ coupleLabel: "Ana & Mihai", uploadLabel: "34 poze și 5 clipuri", galleryUrl: `${BASE}/qr-moments/ana-mihai/gallery?pin=1234` })),
    mail("Fotocabină: poza ta (imediat)", { subject: "📸 Poza ta de la fotocabină", html: photoboothRouteHtml("Ioana", `${BASE}/photobooth/demo`) }),
    mail("Fotocabină: galeria ta (cron)", { subject: "📸 Galeria fotocabinei e gata", html: photoboothCronHtml("Ioana", `${BASE}/photobooth/demo`) }),

    // Wedding Hub
    mail("Wedding Hub: mesaj către invitați", { subject: "Detalii pentru nuntă", html: wedding.buildGuestBroadcastEmailHtml({ guestName: "Ioana", weddingName: "Ana & Mihai", subject: "Detalii pentru nuntă", message: "Vă așteptăm la ora 16:00.\nParcarea e în spatele restaurantului." }) }),
    mail("Wedding Hub: RSVP nou", wedding.rsvpCoupleEmail("Ioana Pop", true, ["<p style=\"margin:0 0 8px;\"><strong>Persoane:</strong> 2</p>", "<p style=\"margin:0 0 8px;\"><strong>Meniu:</strong> vegetarian</p>"])),

    // Admin, monitoring, reports
    { name: "Monitorizare: link inexistent (404)", send: () => monitoring.sendNotFoundEmail("/oferta-veche", "https://www.facebook.com/", "Mozilla/5.0 (iPhone)", "89.137.12.34", geo) },
    { name: "Monitorizare: loading lent", send: () => monitoring.sendSlowLoadEmail("Spinner vizibil 9.2 secunde pe /media", "/media/" + SLUG, "89.137.12.34") },
    { name: "Monitorizare: poză care nu se încarcă", send: () => monitoring.sendImageLoadFailedEmail(`[IMAGE LOAD FAILED] ${BASE}/media/${SLUG}/IMG_0001.jpg`, "retry=2", "/media/" + SLUG, "89.137.12.34") },
    { name: "Monitorizare: QR debug", send: () => monitoring.sendQrDebugEmail("Upload failed: 413", "at upload (qr.js:120)", "/qr-moments/ana-mihai", "89.137.12.34", geo) },
    { name: "Monitorizare: eroare nouă", send: () => monitoring.sendNewClientErrorEmail("js" as never, "TypeError: Cannot read properties of undefined", "at Gallery (gallery.js:42)", "/media/" + SLUG, "Mozilla/5.0 (iPhone)", geo) },
    { name: "Monitorizare: crash server", send: () => sendCrashEmail("Error: ECONNRESET\n    at TLSWrap.onStreamRead (node:internal/stream_base_commons:217:20)") },
    mail("Raport: erori nevăzute", errorsDigestEmail([{ message: "TypeError: x is undefined", source: "client", severity: "error", capturedAt: new Date() }, { message: "Slow query on /api/album", source: "server", severity: "warn", capturedAt: new Date() }], 2)),
    mail("Raport: analytics săptămânal", weeklyAnalyticsEmail({ weekLabel: "23 oct. – 30 oct. 2026", totalViews: 1840, uniqueSessions: 612, topPages: [["/", 520], ["/contact", 210], ["/media/" + SLUG, 180]], topCities: [["Cluj-Napoca, RO", 340], ["București, RO", 120]], deviceCount: { Mobile: 1300, Desktop: 540 } })),
    (() => {
      const data = { periodLabel: "octombrie 2026", deadlineLabel: "25 noiembrie 2026", taxableBaseRon: 1250, vatRate: 0.21, vatAmountRon: 262.5, lines: [{ date: "2026-10-03", supplier: "Google Ireland", amountRon: 850 }, { date: "2026-10-18", supplier: "Adobe Systems", amountRon: 400 }] };
      return mail("Raport: TVA taxare inversă", { subject: vat.buildReverseChargeVatSubject(data), html: vat.buildReverseChargeVatHtml(data) });
    })(),
    mail("Memento", mementoEmail({ title: "Plata asigurării", description: "Asigurarea echipamentului expiră.", category: "ancavisuals", recurring: "yearly", daysUntilDue: 3, formattedDate: "2 noiembrie 2026" })),
    mail("Memento: email de test", mementosTestEmail()),
    mail("Reminder", { subject: "🔔 Reminder: Trimite albumul", html: buildReminderEmailHtml("Trimite albumul", "Albumul Ana & Mihai trebuie trimis până vineri.") }),
    mail("Health: pași nelogați", stepsReminderEmail("Dani", today)),
    mail("Task nefăcut", overdueTaskEmail({ id: "task-demo", title: "Trimite selecția de poze", clientName: "Ana Popescu", plannedFor: today, scheduledStart: "10:00", end: "12:00", token: "demo" })),
    { name: "Backup după eveniment", send: () => sendBackupReminderEmail({ eventName: "Nuntă Ana & Mihai", eventDateLabel: "12 septembrie 2026", reminderLabel: "13 septembrie 2026, 10:00", reminderIndex: 1, albumSlug: SLUG, confirmationUrl: `${BASE}/admin` }) },

    // Family calendar
    mail("Familie: cerere timp liber", familyTime.familyTimeRequestEmail("2026-11-20", "2026-11-22", "Ziua mamei", "estera@exemplu.ro")),
    mail("Familie: cerere aprobată", familyTime.familyTimeDecisionEmail({ status: "approved", startDate: "2026-11-20", endDate: "2026-11-22", reply: "Sigur!" } as never)),
    mail("Familie: cerere refuzată", familyTime.familyTimeDecisionEmail({ status: "rejected", startDate: "2026-11-20", endDate: "2026-11-22", reply: "Am nuntă atunci." } as never)),
    mail("Familie: calendar", familyCalendar.familyCalendarEmail({ email: TO, events: familyEvents, today, weekly: false })),
    mail("Familie: calendar săptămânal", familyCalendar.familyCalendarEmail({ email: TO, events: familyEvents, today, weekly: true })),
    mail("Familie: calendar ajutor", familyCalendar.helperCalendarEmail({ email: TO, events: familyEvents, today })),
    mail("Familie: cod de logare", familyLoginEmail("482913", `${BASE}/zile-ocupate`)),

    // Footer-only test email from /admin
    mail("Email de test din admin", { subject: "AncaVisuals — test email", html: "<p>Acesta este emailul de test AncaVisuals. Dacă îl citești, primirea la această adresă este confirmată.</p>" }),
  ];

  if (dryDir) {
    const { writeFileSync } = await import("node:fs");
    for (const [index, preview] of previews.entries()) {
      written.length = 0;
      try { await preview.send(); } catch (error) { console.log(`✗ ${index + 1} ${preview.name}: ${error instanceof Error ? error.message : error}`); continue; }
      if (written.length === 0) { console.log(`· ${index + 1} ${preview.name}: trimis direct prin sendEmail, nu poate fi capturat`); continue; }
      written.forEach((email, part) => {
        const file = `${dryDir}/${String(index + 1).padStart(2, "0")}${part ? `-${part}` : ""}.html`;
        writeFileSync(file, toMonochromeEmail(email.html));
        console.log(`${isDarkPage(email.html) ? "■ închis " : "□ deschis"} ${index + 1} ${preview.name} → ${file}`);
      });
    }
    process.exit(0);
  }

  const startAt = Math.max(1, Number(process.argv[2] ?? 1));
  console.log(`${previews.length} emailuri → ${TO.replace(/^[^@]+/, "***")}, câte unul la ${DELAY_MS / 1000}s (de la #${startAt})`);
  for (let index = startAt - 1; index < previews.length; index++) {
    const preview = previews[index];
    try {
      await preview.send();
      console.log(`✓ ${index + 1}/${previews.length} ${preview.name}`);
    } catch (error) {
      console.log(`✗ ${index + 1}/${previews.length} ${preview.name}: ${error instanceof Error ? error.message : error}`);
    }
    if (index < previews.length - 1) await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }
  process.exit(0);
}

main().catch((error) => { console.error(error); process.exit(1); });
