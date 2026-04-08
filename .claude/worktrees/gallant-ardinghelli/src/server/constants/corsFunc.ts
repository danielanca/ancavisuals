import { Response } from "express";

import { remoteAddress, remoteAddressLocal } from "./../constants/address";
const localHost = process.env.NODE_ENV === "production" ? remoteAddress : remoteAddressLocal;
// console.log("Local host is:", localHost);
export const applyCORSpolicy = (response: Response<any>) => {
  response.header("Access-Control-Allow-Origin", "*");
  response.header("Access-Control-Allow-Credentials", "true");
  response.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  response.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");
};
