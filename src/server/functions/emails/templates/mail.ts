import * as functions from "firebase-functions";
import { applyCORSpolicy } from "../../../constants/corsFunc";
import { ResponseObject, transportOptions } from "../../../constants/emailCons";
import { generateInvoiceID } from "../../../constants/utils";
import { postOrderToDB } from "./dbEmail";
import { emailAuth, adminUser } from "../../../constants/credentials";
import { getDateAndHour } from "./../../../constants/utils";
import { renderClientMail } from "./clientOrderTemplate";
import { renderAdminTemplate } from "./admOrderConf";
import nodemailer from "nodemailer";
const nodeMail: any = nodemailer;
const transport = nodeMail.createTransport(transportOptions);

export const sendEmail = functions.https.onRequest(async (request, response) => {
  applyCORSpolicy(response);
  const invoiceNumberID = generateInvoiceID();

  let ResponseData: ResponseObject = {
    EMAILTO_ADMIN: "EMPTY",
    EMAILTO_CLIENT: "EMPTY",
    invoiceNumberID: "EMPTY",
  };
  const data = JSON.parse(request.body);  
  await postOrderToDB(invoiceNumberID, data, getDateAndHour());
  let cartProd = JSON.parse(data.cartProducts);
  let downloadURL = data.downloadURL; 
  functions.logger.info("Data from client:", data);
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
    });

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
      });
  };
});
