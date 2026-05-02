import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAK1PxPnxLzGocve2OeKappgBHaKqmaijE",
  authDomain: "joculdetectivului.firebaseapp.com",
  projectId: "joculdetectivului",
  storageBucket: "joculdetectivului.appspot.com",
  messagingSenderId: "245201277429",
  appId: "1:245201277429:web:d68ff347883c18838b90bc",
};

const WEDDING_HUB_APP_NAME = "wedding-hub";

const weddingHubApp =
  getApps().find((firebaseApp) => firebaseApp.name === WEDDING_HUB_APP_NAME) ??
  initializeApp(firebaseConfig, WEDDING_HUB_APP_NAME);

export const weddingHubAuth = getAuth(weddingHubApp);
export default weddingHubApp;
