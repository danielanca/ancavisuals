import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, getIdTokenResult, signOut } from 'firebase/auth';

import { getAnalytics, isSupported as analyticsIsSupported } from 'firebase/analytics';
import 'firebase/storage';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';

let analytics: any;

const firebaseConfig = {
  apiKey: 'AIzaSyDxmbqzBXpIUoYCevqizlncQ80CH9b8--s',
  authDomain: 'diniubire-89ce0.firebaseapp.com',
  projectId: 'diniubire-89ce0',
  storageBucket: 'diniubire-89ce0.appspot.com',
  messagingSenderId: '207405173084',
  appId: '1:207405173084:web:1bfdc7d5f35678d9789999',
  measurementId: 'G-WFWYP44Z7L',
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

// Initialize Firebase Authentication
const auth = getAuth(app);
const db = getFirestore(app);

if (typeof window !== 'undefined') {
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
        console.log('Token expiration time:', expirationTime);

        // Set up logic to refresh the token or handle logout
        // Firebase will handle automatic token refreshing by default.
      } catch (error) {
        console.error('Error fetching token result:', error);
      }
    } else {
      console.log('User is logged out');
      onLogout(); // Perform logout logic
    }
  });
};

export { auth, db, storage };
export default app;
