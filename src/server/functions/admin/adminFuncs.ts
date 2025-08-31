import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { applyCORSpolicy } from "../../constants/corsFunc";
import { getAuthToken } from "../../constants/credentials";

export const requestOrders = functions.https.onRequest(async (request, response) => {
  applyCORSpolicy(response);

  let authToken = getAuthToken(request.body);
  if (!authToken) {
    functions.logger.info(` TOKEN INVALID `);
  }

  const result = await getOrdersAdmin();
  response.send({ ordersList: result, requestOrdersAnswer: `You : ${request.body}` });
});

const getOrdersAdmin = async () => {
  const adminFirestore = admin.firestore();
  const collection = adminFirestore.collection("orders");
  let ordersArray: any[] = [];

  const snapshot = await collection.get();
  snapshot.forEach((doc) => {
    ordersArray.push(doc.data());
  });
  functions.logger.info(` ORDERS ARRAY IS:  ${ordersArray}`);
  return ordersArray;
};
