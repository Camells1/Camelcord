// Firebase for Camelcord: the same project as every Camel Studios account.
// Open the page with ?emu to run against the local Firebase emulators (development only).
import { initializeApp } from '../vendor/firebase/firebase-app.js';
import { getAuth, connectAuthEmulator } from '../vendor/firebase/firebase-auth.js';
import { getFirestore, connectFirestoreEmulator, doc, serverTimestamp } from '../vendor/firebase/firebase-firestore.js';

export const EMU = typeof location !== 'undefined' && new URLSearchParams(location.search).has('emu');

// Public web config (safe to ship: access is controlled by Firebase Auth and the Firestore rules)
const app = initializeApp({
  apiKey: 'AIzaSyAgEzMO9dzwwHr-iyvDhRho-DY1-gg9os4',
  authDomain: 'riftline-f4af8.firebaseapp.com',
  projectId: EMU ? 'demo-camelcord' : 'riftline-f4af8',
  storageBucket: 'riftline-f4af8.firebasestorage.app',
  messagingSenderId: '393303739849',
  appId: '1:393303739849:web:cd9b1b2e0cb1725a512c18'
});
export const auth = getAuth(app);
export const db = getFirestore(app);
if (EMU) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9189', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8185);
}

// Rate limiting: Firestore rules only accept a throttled write if the same batch stamps rate/{uid}.field
export const stamp = (batch, uid, field) => batch.set(doc(db, 'rate', uid), { [field]: serverTimestamp() }, { merge: true });

export const millis = t => (t?.toMillis ? t.toMillis() : Date.now());
