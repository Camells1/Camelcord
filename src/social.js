// Friends, presence and direct messages. Same collections as Camel Client, so a DM sent here
// shows up there and the other way round.
import { clean } from './filter.js';
import { db, stamp, millis } from './firebase.js';
import { nice, cleanName, cleanTag, splitId, keyOf, findByName } from './account.js';
import {
  doc, getDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, collection, query, where, orderBy, limitToLast, onSnapshot, arrayUnion, arrayRemove, FieldPath
} from '../vendor/firebase/firebase-firestore.js';

const nameOnly = id => String(id || '?').split('#')[0];
export const pairOf = (a, b) => [a, b].sort().join('_');
const ONLINE_FOR = 150000; // a friend counts as online if they checked in within 2.5 minutes

export const Friends = {
  me: null, list: [], presence: new Map(), error: '', loaded: false, onChange: null,
  _unsub: null, _presUnsubs: new Map(), _beat: null, _state: 'online',

  start(me) {
    if (this.me?.uid === me.uid) { this.me = me; return; }
    this.stop(); this.me = me;
    const q = query(collection(db, 'friends'), where('users', 'array-contains', me.uid));
    this._unsub = onSnapshot(q, snap => {
      this.error = ''; this.loaded = true;
      this.list = snap.docs.map(d => {
        const x = d.data(), other = x.users.find(u => u !== me.uid);
        return { pair: d.id, uid: other, id: clean(x.ids?.[other] || 'Player'), status: x.status, incoming: x.status === 'pending' && x.from !== me.uid };
      });
      const want = new Set(this.list.filter(f => f.status === 'accepted').map(f => f.uid));
      this.watchPresence(want, 'friends');
      this.onChange?.();
    }, e => { this.error = nice(e); this.onChange?.(); });
    this.setPresence('online');
    this._beat = setInterval(() => { this.setPresence(this._state); this.onChange?.(); }, 60000);
  },
  stop() {
    this._unsub?.(); this._unsub = null;
    for (const s of this._presUnsubs.values()) s.un();
    this._presUnsubs.clear(); this.presence.clear(); this.list = []; this.loaded = false; this.me = null;
    clearInterval(this._beat);
  },
  // Watch presence for a set of uids; each caller (friends, a server's members) owns a named group
  _groups: new Map(),
  watchPresence(uids, group) {
    this._groups.set(group, new Set(uids));
    const needed = new Set(); for (const g of this._groups.values()) for (const u of g) needed.add(u);
    for (const [uid, s] of this._presUnsubs) if (!needed.has(uid)) { s.un(); this._presUnsubs.delete(uid); this.presence.delete(uid); }
    for (const uid of needed) if (!this._presUnsubs.has(uid)) {
      const un = onSnapshot(doc(db, 'presence', uid), s => { this.presence.set(uid, s.exists() ? s.data() : null); this.onChange?.(); }, () => {});
      this._presUnsubs.set(uid, { un });
    }
  },
  // state: online | idle | dnd | invisible (invisible is written as offline so friends see you as away)
  async setPresence(state) {
    if (!this.me) return;
    this._state = state;
    if (state === 'invisible') state = 'offline';
    try {
      const b = writeBatch(db);
      b.set(doc(db, 'presence', this.me.uid), { id: this.me.id, state, game: 'Camelcord', at: serverTimestamp() });
      stamp(b, this.me.uid, 'presence');
      await b.commit();
    } catch (_) {}
  },
  statusOf(uid) {
    const p = this.presence.get(uid);
    if (!p || p.state === 'offline') return 'offline';
    if (Date.now() - millis(p.at) > ONLINE_FOR) return 'offline';
    return ['ingame', 'idle', 'dnd'].includes(p.state) ? p.state : 'online';
  },
  isFriend(uid) { return this.list.some(f => f.uid === uid && f.status === 'accepted'); },
  async add(idText) {
    const text = String(idText || '').trim();
    if (!text) throw new Error('Type their username.');
    // A plain username is all you need. (Old name#TAG ids still work too.)
    if (text.includes('#')) {
      const [rawName, rawTag] = splitId(text), name = cleanName(rawName), tag = cleanTag(rawTag);
      const snap = name && tag ? await getDoc(doc(db, 'ids', keyOf(name, tag))) : null;
      if (!snap?.exists()) throw new Error(`Nobody is called ${nameOnly(text)}.`);
      return this.addUid(snap.data().uid, `${snap.data().name}#${snap.data().tag}`);
    }
    const found = await findByName(cleanName(text));
    if (!found.length) throw new Error(`Nobody is called ${cleanName(text) || text}.`);
    if (found.length > 1) throw new Error(`More than one person uses that username. Ask them for their full id (name#tag).`);
    return this.addUid(found[0].uid, `${found[0].name}#${found[0].tag}`);
  },
  async addUid(other, theirId) {
    if (other === this.me.uid) throw new Error("That's you.");
    const have = this.list.find(f => f.uid === other);
    if (have?.status === 'accepted') throw new Error(`You and ${theirId} are already friends.`);
    if (have?.incoming) { await this.accept(have.pair); return `You and ${theirId} are now friends.`; }
    if (have) throw new Error(`You already asked ${theirId}.`);
    const users = [this.me.uid, other].sort();
    const fb = writeBatch(db);
    fb.set(doc(db, 'friends', users.join('_')), { users, from: this.me.uid, status: 'pending', ids: { [this.me.uid]: this.me.id, [other]: theirId }, at: serverTimestamp() });
    stamp(fb, this.me.uid, 'friend');
    await fb.commit();
    return `Friend request sent to ${theirId}.`;
  },
  accept: pair => updateDoc(doc(db, 'friends', pair), { status: 'accepted' }),
  remove: pair => deleteDoc(doc(db, 'friends', pair))
};

// ---------------------------------------------------------------- direct messages
const cleanText = (t, max) => clean(String(t || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max));
export const msgOf = d => { const x = d.data(); return { id: d.id, from: x.from, text: clean(x.text || ''), img: typeof x.img === 'string' ? x.img : '', re: x.re || {}, edited: !!x.edited, bot: x.bot || '', app: x.app || '', at: millis(x.at), pending: d.metadata?.hasPendingWrites }; };
export const readAt = key => +(localStorage.getItem('cc.read:' + key) || 0);
export const markRead = key => localStorage.setItem('cc.read:' + key, String(Date.now()));

export const DMs = {
  me: null, uid: null, messages: [], last: new Map(), onChange: null, onIncoming: null, error: '',
  _unsub: null, _watch: new Map(), _seeded: new Set(),
  start(me) { this.me = me; },
  stop() { this.close(); for (const un of this._watch.values()) un(); this._watch.clear(); this.last.clear(); this._seeded.clear(); this.me = null; },
  // Newest message from each friend, for unread dots and notifications
  watch(uids) {
    if (!this.me) return;
    for (const [uid, un] of this._watch) if (!uids.includes(uid)) { un(); this._watch.delete(uid); this.last.delete(uid); this._seeded.delete(uid); }
    for (const uid of uids) if (!this._watch.has(uid)) {
      const q = query(collection(db, 'chats', pairOf(this.me.uid, uid), 'messages'), orderBy('at'), limitToLast(1));
      this._watch.set(uid, onSnapshot(q, s => {
        const m = s.docs[0] && msgOf(s.docs[0]);
        if (!m) return;
        const prev = this.last.get(uid);
        const fresh = this._seeded.has(uid) && m.from !== this.me.uid && !prev?.pending && prev?.id !== m.id && (!prev || m.at > prev.at) && Date.now() - m.at < 30000;
        this.last.set(uid, m); this._seeded.add(uid);
        if (fresh) this.onIncoming?.(uid, m);
        this.onChange?.();
      }, () => {}));
    }
  },
  unread(uid) { const m = this.last.get(uid); return !!m && m.from !== this.me?.uid && m.at > readAt('dm:' + uid) && this.uid !== uid; },
  open(uid) {
    this.close(); this.uid = uid; this.messages = [];
    const q = query(collection(db, 'chats', pairOf(this.me.uid, uid), 'messages'), orderBy('at'), limitToLast(100));
    this._unsub = onSnapshot(q, s => { this.messages = s.docs.map(msgOf); markRead('dm:' + uid); this.onChange?.(); }, e => { this.error = nice(e); this.onChange?.(); });
  },
  close() { this._unsub?.(); this._unsub = null; this.uid = null; this.messages = []; this.error = ''; },
  async send(text, img = '') {
    text = cleanText(text, 4000);
    if ((!text && !img) || !this.uid) return;
    const b = writeBatch(db);
    b.set(doc(collection(db, 'chats', pairOf(this.me.uid, this.uid), 'messages')), { from: this.me.uid, text, ...(img ? { img } : {}), at: serverTimestamp() });
    stamp(b, this.me.uid, 'chat');
    await b.commit();
  },
  edit(mid, text) {
    text = cleanText(text, 4000);
    if (!text) throw new Error('A message can’t be empty.');
    return updateDoc(doc(db, 'chats', pairOf(this.me.uid, this.uid), 'messages', mid), { text, edited: true });
  },
  // Toggle my reaction on a message
  react(mid, key, on) {
    const ref = doc(db, 'chats', pairOf(this.me.uid, this.uid), 'messages', mid);
    return updateDoc(ref, new FieldPath('re', key), on ? arrayUnion(this.me.uid) : arrayRemove(this.me.uid));
  }
};

export { cleanText };
