// Profiles: the picture, banner, bio and colours people choose for themselves.
//   cc_profiles/{uid}   id, avatar (data url), banner (data url), accent, nameColor, bio, status
import { db, millis } from './firebase.js';
import { doc, setDoc, onSnapshot, serverTimestamp } from '../vendor/firebase/firebase-firestore.js';

export const Profiles = {
  me: null, map: new Map(), byId: new Map(), onChange: null, _subs: new Map(),
  start(me) { this.me = me; },
  stop() { for (const un of this._subs.values()) un(); this._subs.clear(); this.map.clear(); this.byId.clear(); this.me = null; },
  // Keep a live copy of these people's profiles
  watch(uids) {
    const want = new Set(uids);
    for (const [uid, un] of this._subs) if (!want.has(uid)) { un(); this._subs.delete(uid); this.drop(uid); }
    for (const uid of want) if (!this._subs.has(uid)) {
      this._subs.set(uid, onSnapshot(doc(db, 'cc_profiles', uid), s => {
        this.drop(uid);
        if (s.exists()) { const p = { uid, ...s.data() }; this.map.set(uid, p); if (p.id) this.byId.set(String(p.id).toLowerCase(), p); }
        this.onChange?.();
      }, () => {}));
    }
  },
  drop(uid) { const p = this.map.get(uid); if (p?.id) this.byId.delete(String(p.id).toLowerCase()); this.map.delete(uid); },
  get: uid => Profiles.map.get(uid) || null,
  forId: id => Profiles.byId.get(String(id || '').toLowerCase()) || null,
  // Replace some fields of my profile (empty string clears one)
  async save(patch) {
    const cur = this.map.get(this.me.uid) || {};
    const next = { id: this.me.id, avatar: cur.avatar || '', banner: cur.banner || '', accent: cur.accent || '', nameColor: cur.nameColor || '', bio: cur.bio || '', status: cur.status || '', ...patch, at: serverTimestamp() };
    await setDoc(doc(db, 'cc_profiles', this.me.uid), next);
  }
};
export { millis };
