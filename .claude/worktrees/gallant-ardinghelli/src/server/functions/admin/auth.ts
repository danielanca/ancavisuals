import * as functions from "firebase-functions";
import { applyCORSpolicy } from "./../../constants/corsFunc";
import { adminUser, getSessionID } from "../../constants/credentials";

export const requestAuth = functions.https.onRequest((request, response) => {
  let userData = JSON.parse(request.body);
  functions.logger.info("request Auth called, username and password are: ", userData.password);
  applyCORSpolicy(response);

  if (userData.password === adminUser.password && userData.email === adminUser.email) {
    // response.cookie("jwt", getSessionID(), { sameSite: "none", secure: true, maxAge: 900 * 25 * 60 * 1000 });
    response.send({ LOGIN_ANSWER: "SUCCESS", LOGIN_TOKEN: getSessionID() });
  } else {
    response.send({ LOGIN_ANSWER: "REJECTED", LOGIN_TOKEN: "NO_AUTH" });
  }
});

// https://stackoverflow.com/questions/57253593/cross-domain-state-cookie-issue-for-oauth-using-firebase-functions-while-on-the
/* response.cookie can not be used because it will return cookies with firebase domain, and we need montanair.ro domain */
