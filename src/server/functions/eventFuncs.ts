import { Request, Response } from "express";
import { applyCORSpolicy } from "../constants/corsFunc";
import { transportOptions } from "../constants/emailCons";
import { emailAuth, adminUser } from "../constants/credentials";
import nodemailer from "nodemailer";
import { fetchIpInfo, getClientIp } from "../../utils/ipinfo";

const transport = nodemailer.createTransport(transportOptions);

interface TypeEvent {
  typeEvent: string;
  url: string;
  browserVersion: string;
}

const isLocalIp = (ip: string): boolean => {
  const normalized = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  return normalized === "127.0.0.1" || normalized === "::1" || normalized === "localhost";
};

export const triggerEvent = async (request: Request, response: Response) => {
  applyCORSpolicy(response);

  try {
    const triggerData: TypeEvent = request.body;
    const payload = request.body;
    const todayDate = new Date();
    const todayString = `${todayDate.getDate()}/${todayDate.getMonth() + 1}/${todayDate.getFullYear()} ${todayDate.getHours()}:${todayDate.getMinutes()}:${todayDate.getSeconds()}`;

    const clientIp = getClientIp(request);

    if (isLocalIp(clientIp)) {
      response.status(204).send();
      return;
    }

    const ipInfo = await fetchIpInfo(clientIp);

    const locationParts = [ipInfo?.city, ipInfo?.region, ipInfo?.country].filter(
      (value: string | undefined): value is string => typeof value === "string" && value.length > 0,
    );
    const location = locationParts.length > 0 ? locationParts.join(", ") : "-";

    const metadataHtml = `
      <hr/>
      <h3>Request metadata</h3>
      <ul>
        <li><b>IP</b>: ${ipInfo?.ip ?? clientIp ?? "-"}</li>
        <li><b>Location</b>: ${location}</li>
        <li><b>Coordinates</b>: ${ipInfo?.loc ?? "-"}</li>
        <li><b>Timezone</b>: ${ipInfo?.timezone ?? "-"}</li>
        <li><b>Org</b>: ${ipInfo?.org ?? "-"}</li>
        <li><b>Hostname</b>: ${ipInfo?.hostname ?? "-"}</li>
      </ul>
    `;

    const emailHtml = `${payload.html ?? ""}${metadataHtml}`;

    await transport.sendMail({
      from: emailAuth.email,
      to: `${adminUser.email}`,
      subject: `New Event - ${todayString} ${triggerData.typeEvent}`,
      html: emailHtml,
      // html: renderTriggerClick(triggerData.typeEvent, triggerData.url, triggerData.browserVersion),
    });

    console.log("Trigger email sent successfully.");
    response.status(200).send("Email sent successfully.");
  } catch (error) {
    console.error("Error sending trigger email:", error);
    response.status(500).send("Server error occurred.");
  }
};
