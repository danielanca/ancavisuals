import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { applyCORSpolicy } from "../constants/corsFunc";

export const getStringsList = functions.https.onRequest((request, response) => {
  applyCORSpolicy(response);
  let { stringRequest: requestType } = JSON.parse(request.body);
  console.log("Request type is:", requestType);

  try {
    admin
      .firestore()
      .collection("list")
      .doc(requestType)
      .get()
      .then((result) => response.send({ resultSent: result.data() }));
  } catch (error) {
    response.send({ errorSent: error });
  }
});

export const sendStringsList = functions.https.onRequest((request, response) => {
  applyCORSpolicy(response);
  let { stringRequest: requestType, payload } = JSON.parse(request.body);

  console.log("Request type is:", requestType);
  console.log("PAYLOAD IS:", typeof payload);
  try {
    admin
      .firestore()
      .collection("list")
      .doc(requestType)
      .set(JSON.parse(payload), { merge: true })
      .then((result) => response.send({ resultSent: true, timeStamp: result }));
  } catch (error) {
    response.send({ errorSent: error });
  }
});

//THIS for getting data from a collection
// admin
// .firestore()
// .collection(requestType)
// .get()
// .then((result) => response.send({ resultSent: result.docs.map((doc) => doc.data()) }));
