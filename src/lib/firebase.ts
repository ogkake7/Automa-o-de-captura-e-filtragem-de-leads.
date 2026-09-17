import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDHr9J16dQKSsNyQFZCML1qb2Tjbviq8ck",
  authDomain: "studio-7967400061-7b8d1.firebaseapp.com",
  projectId: "studio-7967400061-7b8d1",
  storageBucket: "studio-7967400061-7b8d1.firebasestorage.app",
  messagingSenderId: "435381930914",
  appId: "1:435381930914:web:82025767e3cd81d92640fb"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use the explicit databaseId if provided in the config, otherwise fallback to default
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, (firebaseConfig as any).firestoreDatabaseId);

import { doc, getDocFromServer } from 'firebase/firestore';

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

