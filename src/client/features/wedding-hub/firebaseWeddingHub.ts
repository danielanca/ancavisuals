import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { firebaseConfig } from "../../firebaseConfig";

const WEDDING_HUB_APP_NAME = "wedding-hub";

const weddingHubApp =
  getApps().find((firebaseApp) => firebaseApp.name === WEDDING_HUB_APP_NAME) ??
  initializeApp(firebaseConfig, WEDDING_HUB_APP_NAME);

export const weddingHubAuth = getAuth(weddingHubApp);
export default weddingHubApp;
