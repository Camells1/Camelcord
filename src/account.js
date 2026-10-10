// Camel Studios accounts: the same accounts as Camel Client, the website and the games.
// People see and use a plain username. Underneath, each account's id is "name#TAG" (the tag is a
// hidden detail that old accounts need to stay unique), and usernames are kept unique on their own.
import { clean, ok } from './filter.js';
import { auth, db, stamp } from './firebase.js';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile,
  sendPasswordResetEmail, signOut, setPersistence, browserLocalPersistence, browserSessionPersistence
} from '../vendor/firebase/firebase-auth.js';
import { doc, getDoc, getDocs, collection, query, where, documentId, writeBatch, serverTimestamp } from '../vendor/firebase/firebase-firestore.js';

export const cleanName = n => String(n || '').replace(/[^\p{L}\p{N} _.-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 14);
export const cleanTag = t => String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
export const randomTag = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
export const splitId = dn => { const i = (dn || '').lastIndexOf('#'); return i > 0 ? [dn.slice(0, i), dn.slice(i + 1)] : [dn || '', '']; };
export const keyOf = (name, tag) => name.toLowerCase() + '#' + tag;
const TAKEN = 'That username is already taken. Try another one.';

// Everyone who uses this username: ids are stored as "name#tag" with the name in lowercase, so
// they all sort between "name#" and the next character after '#'.
export async function findByName(name) {
  const n = String(name || '').toLowerCase().trim();
  if (!n) return [];
  const upper = n + String.fromCharCode('#'.charCodeAt(0) + 1);
  const snap = await getDocs(query(collection(db, 'ids'), where(documentId(), '>=', n + '#'), where(documentId(), '<', upper)));
  return snap.docs.map(d => ({ uid: d.data().uid, name: d.data().name, tag: d.data().tag }));
}

export const nice = e => ({
  'auth/invalid-credential': 'Wrong email or password.', 'auth/wrong-password': 'Wrong email or password.', 'auth/user-not-found': 'No account with that email.',
  'auth/email-already-in-use': 'That email already has an account. Sign in instead.', 'auth/weak-password': 'Password needs at least 6 characters.',
  'auth/invalid-email': 'That email address looks wrong.', 'auth/missing-password': 'Type your password.', 'auth/too-many-requests': 'Too many tries. Wait a minute and try again.',
  'auth/network-request-failed': 'No connection. Check your internet.', 'id-taken': TAKEN,
  'permission-denied': "Camelcord isn't fully set up yet (the database rules need publishing), or you can't do that.",
  'unavailable': 'No connection. Check your internet.'
}[e?.code] || e?.message || String(e));

// ids/{name#TAG} can exist only once: that's what makes an account id unique
async function claim(user, name, tag) {
  const key = keyOf(name, tag);
  const snap = await getDoc(doc(db, 'ids', key)), owner = snap.exists() ? snap.data().uid : null;
  if (owner && owner !== user.uid) throw Object.assign(new Error(TAKEN), { code: 'id-taken' });
  if (!owner) {
    const mine = await getDoc(doc(db, 'users', user.uid)), old = mine.exists() ? mine.data().id : null;
    const b = writeBatch(db);
    b.set(doc(db, 'ids', key), { uid: user.uid, name, tag, at: serverTimestamp() });
    if (old && old !== key) b.delete(doc(db, 'ids', old));
    b.set(doc(db, 'users', user.uid), { id: key });
    stamp(b, user.uid, 'id');
    await b.commit();
  }
  await updateProfile(user, { displayName: `${name}#${tag}` });
}

export const Account = {
  user: null,            // { uid, email, name, tag, id }
  ready: false,
  signingUp: false,
  onChange: null,        // (user | null) once we know who is signed in, and on every change

  start() {
    onAuthStateChanged(auth, async u => {
      if (u && this.signingUp) return; // signUp() reports the new account once its name is claimed
      if (!u) { this.user = null; this.ready = true; this.onChange?.(null); return; }
      const [name, tag] = splitId(u.displayName);
      this.user = { uid: u.uid, email: u.email, name: name || 'Player', tag: tag || '', id: name && tag ? `${name}#${tag}` : (u.email || 'Player') };
      this.ready = true;
      // Accounts made before IDs were unique: register theirs the first time we see them
      if (name && tag) { try { const mine = await getDoc(doc(db, 'users', u.uid)); if (!mine.exists() || mine.data().id !== keyOf(name, tag)) await claim(u, name, tag); } catch (_) {} }
      this.onChange?.(this.user);
    });
  },
  async signIn(email, password, stay) {
    await setPersistence(auth, stay ? browserLocalPersistence : browserSessionPersistence);
    await signInWithEmailAndPassword(auth, email.trim(), password);
  },
  async signUp(email, password, name, _unused, stay) {
    name = cleanName(name);
    if (name.length < 3) throw new Error('Your username needs at least 3 characters.');
    if (!ok(name)) throw new Error("Pick a different username: that one isn't allowed.");
    if ((await findByName(name)).length) throw Object.assign(new Error(TAKEN), { code: 'id-taken' });
    let tag = randomTag();
    for (let i = 0; i < 5 && (await getDoc(doc(db, 'ids', keyOf(name, tag)))).exists(); i++) tag = randomTag();
    await setPersistence(auth, stay ? browserLocalPersistence : browserSessionPersistence);
    this.signingUp = true;
    let cred;
    try {
      cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await claim(cred.user, name, tag);
    } finally { this.signingUp = false; }
    const [n, t] = splitId(cred.user.displayName);
    this.user = { uid: cred.user.uid, email: cred.user.email, name: n, tag: t, id: `${n}#${t}` };
    this.onChange?.(this.user);
  },
  reset: email => sendPasswordResetEmail(auth, email.trim()),
  signOut: () => signOut(auth)
};

export { clean, ok };
