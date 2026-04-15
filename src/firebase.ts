import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDocFromCache, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Test connection to Firestore
async function testConnection() {
  try {
    console.log('DEBUG: Starting Firestore connection test on database:', firebaseConfig.firestoreDatabaseId);
    // Try to fetch a non-existent doc in a collection that should be public
    await getDocFromServer(doc(db, 'songs', '_connection_test_'));
    console.log('Firestore connection test successful');
  } catch (error: any) {
    if (error.message?.includes('the client is offline') || error.message?.includes('Failed to get document because the client is offline')) {
      console.error("Firestore is offline. Please check your Firebase configuration and ensure your domain is authorized.");
    } else {
      console.error("Firestore connection test error:", error.message || error);
      console.error("Full error object:", JSON.stringify(error));
    }
  }
}

testConnection();

export const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error('Error signing in with Google', error);
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out', error);
  }
};
