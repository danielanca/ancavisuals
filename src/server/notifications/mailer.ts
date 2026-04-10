import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { emailAuth } from "../constants/credentials";

const transportOptions: SMTPTransport.Options = {
  host: "smtp.gmail.com",
  port: 465,
  service: "gmail",
  secure: true,
  auth: {
    user: emailAuth.email,
    pass: emailAuth.password,
  },
};

export const mailer = nodemailer.createTransport(transportOptions);

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail({ to, subject, html, from = emailAuth.email }: SendEmailOptions): Promise<void> {
  await mailer.sendMail({ from, to, subject, html });
}
