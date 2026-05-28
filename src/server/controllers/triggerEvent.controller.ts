import type { Request, Response } from "express";
import { applyCORSpolicy } from "../constants/cors";
import { adminUser } from "../constants/credentials";
import { sendEmail } from "../notifications/mailer";
import { fetchIpInfo, getClientIp } from "../utils/ipinfo";
import { renderTriggerTemplate } from "../notifications/templates/triggerTemplate";

interface TypeEvent {
  typeEvent: string;
  url: string;
  browserVersion: string;
  referrer?: string;
  isNewVisitor?: boolean;
  // Populated by BookingWizard for Lead Rapid / full booking submissions
  subject?: string;
  html?: string;
  to?: string;
}

const COOLDOWN_MS = 18 * 60 * 60 * 1000; // 18 hours

// IP → timestamp of last sent email. Cleaned up lazily on each request.
const lastSentByIp = new Map<string, number>();

function isOnCooldown(ip: string): boolean {
  const lastSent = lastSentByIp.get(ip);
  if (!lastSent) return false;
  return Date.now() - lastSent < COOLDOWN_MS;
}

function recordSent(ip: string): void {
  lastSentByIp.set(ip, Date.now());
  // Evict entries older than cooldown to keep memory bounded
  for (const [storedIp, timestamp] of lastSentByIp) {
    if (Date.now() - timestamp >= COOLDOWN_MS) {
      lastSentByIp.delete(storedIp);
    }
  }
}

export const isLocalIp = (ip: string): boolean => {
  const normalized = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  return normalized === "127.0.0.1" || normalized === "::1" || normalized === "localhost";
};

export const triggerEvent = async (request: Request, response: Response) => {
  applyCORSpolicy(response);

  try {
    const triggerData: TypeEvent = request.body;
    const todayDate = new Date();
    const todayString = `${todayDate.getDate()}/${todayDate.getMonth() + 1}/${todayDate.getFullYear()} ${todayDate.getHours()}:${todayDate.getMinutes()}:${todayDate.getSeconds()}`;

    const clientIp = getClientIp(request);

    if (isLocalIp(clientIp)) {
      response.status(204).send();
      return;
    }

    if (isOnCooldown(clientIp)) {
      response.status(204).send();
      return;
    }

    const ipInfo = await fetchIpInfo(clientIp);

    if (ipInfo && ipInfo.country !== "RO") {
      response.status(204).send();
      return;
    }

    const isNew = triggerData.isNewVisitor !== false;
    const visitorLabel = isNew ? "🆕 Vizitator NOU" : "🔁 Vizitator cunoscut";

    // Booking submissions (Lead Rapid / full booking) send their own html+subject
    const isBookingSubmission = !!triggerData.html && !!triggerData.subject;

    const emailHtml = isBookingSubmission
      ? triggerData.html!
      : renderTriggerTemplate({
          typeEvent: triggerData.typeEvent,
          url: triggerData.url,
          browserVersion: triggerData.browserVersion,
          referrer: triggerData.referrer,
          ipInfo,
          clientIp,
          timestamp: todayString,
          isNewVisitor: isNew,
        });

    const emailSubject = isBookingSubmission
      ? triggerData.subject!
      : `${visitorLabel} — ${triggerData.url} — ${todayString}`;

    await sendEmail({
      to: adminUser.email,
      subject: emailSubject,
      html: emailHtml,
    });

    recordSent(clientIp);
    console.log("Trigger email sent successfully.");
    response.status(200).send("Email sent successfully.");
  } catch (error) {
    console.error("Error sending trigger email:", error);
    response.status(500).send("Server error occurred.");
  }
};
