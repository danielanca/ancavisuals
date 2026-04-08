import { emailAuth } from "./credentials";
import SMTPTransport from "nodemailer/lib/smtp-transport";
export interface ResponseObject {
  EMAILTO_CLIENT: string;
  EMAILTO_ADMIN: string;
  invoiceNumberID: string;
}

export const transportOptions: SMTPTransport.Options = {
  host: "smtp.gmail.com",
  port: 465,
  service: "gmail",
  secure: true,
  auth: {
    user: emailAuth.email,
    pass: emailAuth.password,
  },
};
