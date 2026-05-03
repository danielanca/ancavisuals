import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { emailAuth } from "../constants/credentials";

const productionTransport = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  service: "gmail",
  secure: true,
  auth: { user: emailAuth.email, pass: emailAuth.password },
} as SMTPTransport.Options);

const testHost = process.env.SMTP_TEST_HOST;
const testPort = process.env.SMTP_TEST_PORT ? Number(process.env.SMTP_TEST_PORT) : 587;
const testUser = process.env.SMTP_TEST_USER;
const testPass = process.env.SMTP_TEST_PASS;

const testTransport = testHost
  ? nodemailer.createTransport({
      host: testHost,
      port: testPort,
      secure: testPort === 465,
      auth: { user: testUser, pass: testPass },
    } as SMTPTransport.Options)
  : null;

let testEmailMode = false;

export function setTestEmailMode(enabled: boolean): void {
  testEmailMode = enabled;
}

export function getTestEmailMode(): boolean {
  return testEmailMode;
}

export function isTestTransportAvailable(): boolean {
  return testTransport !== null;
}

export const mailer = productionTransport;

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

function wrapHtml(html: string): string {
  if (html.trimStart().startsWith("<!DOCTYPE")) return html;
  return `<!DOCTYPE html><html lang="ro"><head><meta charset="UTF-8"></head><body>${html}</body></html>`;
}

export async function sendEmail({ to, subject, html, from }: SendEmailOptions): Promise<void> {
  const activeTransport = testEmailMode && testTransport ? testTransport : productionTransport;
  const activeFrom = from ?? (testEmailMode && testUser ? testUser : emailAuth.email);
  await activeTransport.sendMail({ from: activeFrom, to, subject, html: wrapHtml(html) });
}
