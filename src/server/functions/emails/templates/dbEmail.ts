import * as functions from 'firebase-functions'
import * as admin from "firebase-admin";

export const postOrderToDB = async (invoiceID: number, dataObject: any, todayDate: string) => {
    dataObject.invoiceID = `${invoiceID}`;
    dataObject.timestamp = todayDate;
    
    return await admin
      .firestore()
      .collection("orders")
      .doc(invoiceID.toString())
      .create(dataObject)
      .then((result:any) => functions.logger.info("POST_To_DB: ", result));
  };
  