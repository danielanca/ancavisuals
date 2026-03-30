import { Request, Response } from "express";
import { applyCORSpolicy } from "../constants/corsFunc";
import { generateInvoiceID } from "../constants/utils";
import { ResponseObject, transportOptions } from "./../constants/emailCons";
import { getDateAndHour } from "../constants/utils";
import { emailAuth, adminUser } from "../constants/credentials";
import { renderClientMail } from "./../functions/emails/templates/clientOrderTemplate";
import { renderAdminTemplate } from "../functions/emails/templates/admOrderConf";
import { postOrderToDB } from "../functions/emails/dbEmail";
import { triggerEvent } from "../functions/eventFuncs";

import nodemailer from "nodemailer";
const nodeMail: any = nodemailer;
const transport = nodeMail.createTransport(transportOptions);
export { triggerEvent };

/**
 * List of API examples.
 * @route GET /api
 */
export const getApi = async (req: Request, res: Response) => {
  const data = {
    message: "Welcome to the API!",
  };
  console.log("Server was called by a dude");

  // Sending JSON response
  return res.status(200).json(data);
};

export const sendEmail = async (request: Request, response: Response) => {
  applyCORSpolicy(response);
  console.log("We received something");
  const invoiceNumberID = generateInvoiceID();

  let ResponseData: ResponseObject = {
    EMAILTO_ADMIN: "EMPTY",
    EMAILTO_CLIENT: "EMPTY",
    invoiceNumberID: String(invoiceNumberID),
  };

  const data = request.body;
  if (!data) {
    return response.status(400).json({ error: "Missing request body" });
  }

  let cartProd: any;
  try {
    cartProd = JSON.parse(data.cartProducts);
  } catch {
    return response.status(400).json({ error: "Invalid cartProducts JSON" });
  }

  const downloadURL = data.downloadURL;

  const transmitToAdmin = () => {
    transport
      .sendMail({
        from: emailAuth.email,
        to: adminUser.email,
        subject: "Comanda noua - " + data.firstName,
        html: renderAdminTemplate(cartProd, invoiceNumberID, data, downloadURL),
      })
      .then((responseToAdmin: any) => {
        ResponseData.EMAILTO_ADMIN = responseToAdmin;
        response.send(ResponseData);
      })
      .catch((err: any) => {
        console.error("Failed to send admin email:", err);
        if (!response.headersSent) {
          response.status(500).json({ error: "Failed to send admin email" });
        }
      });
  };

  await postOrderToDB(invoiceNumberID, data, getDateAndHour());

  if (!data.emailAddress) {
    console.error("No recipients defined");
    transmitToAdmin();
    return;
  }
  transport
    .sendMail({
      from: emailAuth.email,
      to: data.emailAddress,
      subject: "Comanda inregistrata, " + data.firstName,
      html: renderClientMail(cartProd, invoiceNumberID, data),
    })
    .then((emailClientResponse: any) => {
      ResponseData.EMAILTO_CLIENT = emailClientResponse;
      transmitToAdmin();
    })
    .catch((err: any) => {
      console.error("Failed to send client email:", err);
      transmitToAdmin();
    });
};
