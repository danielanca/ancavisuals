import { Request, Response } from 'express';
import { applyCORSpolicy } from '../constants/corsFunc';
import { transportOptions } from '../constants/emailCons';
import { emailAuth, adminUser } from '../constants/credentials';
import { renderTriggerClick } from './emails/templates/triggerTemplate';
import nodemailer from 'nodemailer';

const transport = nodemailer.createTransport(transportOptions);

interface TypeEvent {
  typeEvent: string;
  url: string;
  browserVersion: string;
}

export const triggerEvent = async (request: Request, response: Response) => {
  applyCORSpolicy(response);

  try {
    const triggerData: TypeEvent = request.body;
    const payload = request.body; 
    const todayDate = new Date();
    const todayString = `${todayDate.getDate()}/${todayDate.getMonth() + 1}/${todayDate.getFullYear()} ${todayDate.getHours()}:${todayDate.getMinutes()}:${todayDate.getSeconds()}`;

    await transport.sendMail({
      from: emailAuth.email,
      to: `${adminUser.email}`,
      subject: `New Event - ${todayString} ${triggerData.typeEvent}`,
      html: payload.html,
      //html: renderTriggerClick(triggerData.typeEvent, triggerData.url, triggerData.browserVersion),
    });

    console.log('Trigger email sent successfully.');
    response.status(200).send('Email sent successfully.');
  } catch (error) {
    console.error('Error sending trigger email:', error);
    response.status(500).send('Server error occurred.');
  }
};
