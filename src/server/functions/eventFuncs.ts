import { Request, Response } from "express";
import { applyCORSpolicy } from "../constants/corsFunc";
import { transportOptions } from "../constants/emailCons";
import { emailAuth, adminUser } from "../constants/credentials";
import nodemailer from "nodemailer";
import { fetchIpInfo, getClientIp } from "../utils/ipinfo";
import { renderTriggerTemplate } from "./emails/templates/triggerTemplate";

const transport = nodemailer.createTransport(transportOptions);

interface TypeEvent {
  typeEvent: string;
  url: string;
  browserVersion: string;
  referrer?: string;
}

const isLocalIp = (ip: string): boolean => {
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

    const ipInfo = await fetchIpInfo(clientIp);

    if (ipInfo && ipInfo.country !== "RO") {
      response.status(204).send();
      return;
    }

    const emailHtml = renderTriggerTemplate({
      typeEvent: triggerData.typeEvent,
      url: triggerData.url,
      browserVersion: triggerData.browserVersion,
      referrer: triggerData.referrer,
      ipInfo,
      clientIp,
      timestamp: todayString,
    });

    await transport.sendMail({
      from: emailAuth.email,
      to: adminUser.email,
      subject: `👁 Vizitator nou — ${triggerData.typeEvent} — ${todayString}`,
      html: emailHtml,
    });

    console.log("Trigger email sent successfully.");
    response.status(200).send("Email sent successfully.");
  } catch (error) {
    console.error("Error sending trigger email:", error);
    response.status(500).send("Server error occurred.");
  }
};
