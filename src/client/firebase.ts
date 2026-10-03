import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, getIdTokenResult } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from "./firebaseConfig";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// No Firebase Analytics: it was never used, and it loaded a second gtag.js for
// G-SXPFYH4Q3X — that GA4 property is already sent by GTM (double page views).

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
