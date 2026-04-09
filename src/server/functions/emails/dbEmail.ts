import { db } from "./../../firestoreInit";

export const postOrderToDB = async (invoiceID: number, dataObject: any, todayDate: string) => {
  dataObject.invoiceID = `${invoiceID}`;
  dataObject.timestamp = todayDate;

  return await db
    .collection("orders")
    .doc(invoiceID.toString())
    .create(dataObject);
};
