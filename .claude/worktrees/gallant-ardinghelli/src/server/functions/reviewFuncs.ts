import * as functions from "firebase-functions";
import { Request, Response } from "express";
import * as admin from "firebase-admin";
import { ReviewType, ReviewToPostType } from "../types/reviewTypes";

export const sendReviewToServer = async (request: Request, response: Response) => {
  let requestParam = request.body;
  console.log("INCOMING Review for ", requestParam);

  // postReviewData(requestParam)
  //   .then(result => {
  //     console.log("RESPONSE [postReviewData]", result);
  //     response.send({ response: "SENT" });
  //   })
  //   .catch(err => response.send({ response: "reviewErrorServer", errorDetails: err }));
};

const postReviewData = async (data: ReviewType) => {
  data.date = new Date().toISOString().slice(0, 10);

  let newReview: ReviewType = data;
  let theResult = await admin
    .firestore()
    .collection("products")
    .doc("activeProds")
    .get()
    .then(result => {
      let dataObject = JSON.stringify(result.data());

      const incomingProducts = JSON.parse(dataObject);
      console.log("Response of postReviewData is:", incomingProducts);
      if (typeof incomingProducts !== "undefined") {
        let reviewsOfProduct: ReviewToPostType[] = Array.from(incomingProducts[data.reviewProductID].reviews);
        console.log("THE TYPE OF reviewsOfProduct is ", reviewsOfProduct);
        reviewsOfProduct.push({
          email: newReview.email,
          date: newReview.date,
          reviewActual: newReview.reviewActual,
          name: newReview.name,
          starsNumber: newReview.starsNumber,
          mediaLink: newReview.mediaLink,
        });

        incomingProducts[data.reviewProductID].reviews = reviewsOfProduct;
        return incomingProducts[data.reviewProductID];
      } else {
        functions.logger.info("sendReviewToServer response: ", incomingProducts);
        return null;
      }
    });
  console.log(`Sending back to DB ${data.reviewProductID}`, +theResult);
  return await admin
    .firestore()
    .collection("products")
    .doc("activeProds")
    .update({
      [data.reviewProductID]: theResult,
    })
    .then(response => response)
    .catch(err => err);
};

// .update({
//   1: {
//     reviews: {
//       3: { actualComment: "E ok  Estera", date: "Fara date", name: "Esty", stars: "4" }
//     }
//   }
// })

// .firestore()
// .collection("products")
// .doc("activeProds")
// .update({
//   [modelID.ID]: {
//     ID: modelID.ID,
//     title: modelID.title,
//     shortDescription: modelID.shortDescription,
//     price: modelID.price,
//     firstDescription: modelID.firstDescription,
//     reviews: {},
//     // reviews: {
//     //   0: {
//     //     reviewActual: "Sunt ok produsele, un pic cam scump",
//     //     starsNumber: "3",
//     //     name: "Lips Mihai",
//     //     date: "19.02.2020",
//     //     reviewProductID: "0"
//     //   }
//     // },

//     jsonContent: modelID.jsonContent

//     imageProduct: [
//       "https://firebasestorage.googleapis.com/v0/b/sapunmontan.appspot.com/o/poza1.png?alt=media&token=d55eb00a-21e7-4ab2-8bf7-80c5e5c0569c",
//       "https://firebasestorage.googleapis.com/v0/b/sapunmontan.appspot.com/o/poza1.png?alt=media&token=d55eb00a-21e7-4ab2-8bf7-80c5e5c0569c",
//       "https://firebasestorage.googleapis.com/v0/b/sapunmontan.appspot.com/o/sapunCarbune.jpg?alt=media&token=c0c66773-a2aa-4602-9c45-17e5232e6724"
//     ],
//     ULbeneficii: ["Revigorează pielea", "Curata in profunzime pielea"]
//   }
