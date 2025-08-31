import { Response, Request } from "express";
import { db } from "../firestoreInit";
import { subscriberProps } from "../types/newsletterTypes";
import { applyCORSpolicy } from "../constants/corsFunc";
import { getTimestamp } from "../constants/utils";

export const subscribeToNewsletter = async (request: Request, response: Response) => {
  applyCORSpolicy(response);
  let subscriberData: subscriberProps = request.body;
  console.log("subscribe to newsletter test:", request);
  await databasePost(subscriberData);
  response.send({ subscribeToNewsletter: "SUBSCRIBED" });
};

const databasePost = async (data: subscriberProps) => {
  await db.collection("newsletterSubscribers").doc(data.email).set({
    email: data.email,
    fullName: data.fullName,
    subscribeDate: getTimestamp(),
  });
};
