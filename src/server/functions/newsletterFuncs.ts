// src/server/functions/newsletterFuncs.ts
import { Response, Request } from 'express';
import { db } from '../firestoreInit.js'; // <-- .js
import { subscriberProps } from '../types/newsletterTypes';
import { applyCORSpolicy } from '../constants/corsFunc.js'; // <-- .js
import { getTimestamp } from '../constants/utils.js'; // <-- .js

export const subscribeToNewsletter = async (request: Request, response: Response) => {
  applyCORSpolicy(response);
  const subscriberData: subscriberProps = request.body;
  await databasePost(subscriberData);
  response.send({ subscribeToNewsletter: 'SUBSCRIBED' });
};

const databasePost = async (data: subscriberProps) => {
  await db.collection('newsletterSubscribers').doc(data.email).set({
    email: data.email,
    fullName: data.fullName,
    subscribeDate: getTimestamp(),
  });
};
