import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, getIdTokenResult } from "firebase/auth";
import { getAnalytics, isSupported as analyticsIsSupported } from "firebase/analytics";
import type { Analytics } from "firebase/analytics";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from "./firebaseConfig";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

let analytics: Analytics | null = null;
if (typeof window !== "undefined") {
  analyticsIsSupported().then((isSupported) => {
    if (isSupported) analytics = getAnalytics(app);
  });
}

export const monitorAuthState = (onLogout: () => void) => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const tokenResult = await getIdTokenResult(user);
        console.log("Token expiration time:", tokenResult.expirationTime);
      } catch (error) {
        console.error("Error fetching token result:", error);
      }
    } else {
      console.log("User is logged out");
      onLogout();
    }
  });
};

export { auth, db, storage };
export default app;
