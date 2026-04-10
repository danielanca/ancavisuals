/*
 * Purpose: initializes the client-side Firebase app and exports the shared auth,
 * firestore and storage instances used by the browser app. It also wires optional
 * analytics startup and exposes a helper that reacts to auth-state changes.
 */
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, getIdTokenResult, signOut } from "firebase/auth";

import { getAnalytics, isSupported as analyticsIsSupported } from "firebase/analytics";
import type { Analytics } from "firebase/analytics";
import "firebase/storage";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";

let analytics: Analytics | null = null;

const firebaseConfig = {
  apiKey: "AIzaSyAK1PxPnxLzGocve2OeKappgBHaKqmaijE",
  authDomain: "joculdetectivului.firebaseapp.com",
  projectId: "joculdetectivului",
  storageBucket: "joculdetectivului.appspot.com",
  messagingSenderId: "245201277429",
  appId: "1:245201277429:web:d68ff347883c18838b90bc",
  measurementId: "G-SXPFYH4Q3X",
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

// Initialize Firebase Authentication
const auth = getAuth(app);
const db = getFirestore(app);

if (typeof window !== "undefined") {
  analyticsIsSupported().then(isSupported => {
    if (isSupported) {
      analytics = getAnalytics(app);
    }
  });
}

// A function to monitor authentication state
export const monitorAuthState = (onLogout: () => void) => {
  onAuthStateChanged(auth, async user => {
    if (user) {
      try {
        const tokenResult = await getIdTokenResult(user);
        const expirationTime = tokenResult.expirationTime;

        // You can use this information to check expiration
        console.log("Token expiration time:", expirationTime);

        // Set up logic to refresh the token or handle logout
        // Firebase will handle automatic token refreshing by default.
      } catch (error) {
        console.error("Error fetching token result:", error);
      }
    } else {
      console.log("User is logged out");
      onLogout(); // Perform logout logic
    }
  });
};

export { auth, db, storage };
export default app;
