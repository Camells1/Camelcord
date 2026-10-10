// Camelcord servers: a server has members, text channels and voice channels.
//   cc_servers/{sid}                              name, owner, members[], ids{uid: name#TAG}, icon, color, invite
//   cc_servers/{sid}/channels/{cid}               name, kind 'text' | 'voice', at
//   cc_servers/{sid}/channels/{cid}/messages/{m}  from, text, at
//   cc_invites/{code}                             sid, name, icon, color, owner  (anyone signed in can read one by its code)
import { db, stamp, millis } from './firebase.js';
import { nice } from './account.js';
import { msgOf, cleanText, readAt, markRead } from './social.js';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, FieldPath, serverTimestamp, collection, query, where, orderBy, limit, limitToLast,
  onSnapshot, arrayUnion, arrayRemove, deleteField
} from '../vendor/firebase/firebase-firestore.js';

export const COLORS = ['#5b8cff', '#7b6cf0', '#43b3c4', '#43b581', '#e0a34a', '#ed6a5a', '#d1577a', '#8f9aa8'];
export const ICONS = ['💬', '🎮', '🎵', '🚀', '⚔️', '🔥', '🎨', '📚', '🧠', '🌊', '🍕', '👾', '🌵', '🐪', '☀️', '🐸'];
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => Array.from({ length: 7 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const FRESH = 50000; // a voice participant counts if they checked in within this long

export const Servers = {
  me: null, list: [], channels: new Map(), onChange: null, onIncoming: null, error: '',
  messages: [], active: null,           // { sid, cid } for the open text channel
  last: new Map(),                      // cid -> newest message
  voice: new Map(),                     // channel path -> [{ uid, id, muted, deafened, at }]
  _unsub: null, _chan: new Map(), _msg: null, _last: new Map(), _lastSeeded: new Set(), _voice: new Map(), _sidOf: new Map(),

  start(me) {
    this.stop(); this.me = me;
    const q = query(collection(db, 'cc_servers'), where('members', 'array-contains', me.uid));
    this._unsub = onSnapshot(q, snap => {
      this.error = '';
      this.list = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => millis(a.at) - millis(b.at));
      const ids = new Set(this.list.map(s => s.id));
      for (const [sid, un] of this._chan) if (!ids.has(sid)) {
        un(); this._chan.delete(sid); this.channels.delete(sid);
        for (const [cid, s] of [...this._sidOf]) if (s === sid) this._dropChannel(cid);
        this._emo.get(sid)?.(); this._emo.delete(sid);
        for (const [k, e] of [...this.emoji]) if (e.sid === sid) this.emoji.delete(k);
      }
      for (const sid of ids) if (!this._chan.has(sid)) { this._watchChannels(sid); this._watchEmoji(sid); }
      this.onChange?.();
    }, e => { this.error = nice(e); this.onChange?.(); });
  },
  stop() {
    this._unsub?.(); this._unsub = null;
    for (const un of this._chan.values()) un(); this._chan.clear();
    for (const un of this._last.values()) un(); this._last.clear();
    for (const un of this._voice.values()) un(); this._voice.clear(); this._sidOf.clear();
    for (const un of this._emo.values()) un(); this._emo.clear(); this.emoji.clear();
    this._msg?.(); this._msg = null;
    this.list = []; this.channels.clear(); this.last.clear(); this.voice.clear(); this._lastSeeded.clear(); this.messages = []; this.active = null; this.me = null;
  },
  server: sid => Servers.list.find(s => s.id === sid) || null,
  isOwner(sid) { return this.server(sid)?.owner === this.me?.uid; },
  channelsOf: sid => Servers.channels.get(sid) || [],
  channelPath: (sid, cid) => `cc_servers/${sid}/channels/${cid}`,

  _watchChannels(sid) {
    const q = query(collection(db, 'cc_servers', sid, 'channels'), orderBy('at'));
    this._chan.set(sid, onSnapshot(q, snap => {
      const chans = snap.docs.map(d => ({ id: d.id, sid, ...d.data() }));
      this.channels.set(sid, chans);
      const ids = new Set(chans.map(c => c.id));
      // Newest message in each text channel (unread dots), voice roster of each voice channel
      for (const c of chans) {
        this._sidOf.set(c.id, sid);
        if (c.kind === 'text' && !this._last.has(c.id)) {
          const lq = query(collection(db, 'cc_servers', sid, 'channels', c.id, 'messages'), orderBy('at'), limitToLast(1));
          this._last.set(c.id, onSnapshot(lq, s => {
            const m = s.docs[0] && msgOf(s.docs[0]);
            if (!m) { this._lastSeeded.add(c.id); return; }
            const old = this.last.get(c.id);
            const fresh = this._lastSeeded.has(c.id) && m.from !== this.me?.uid && old?.id !== m.id && !m.pending;
            this.last.set(c.id, m); this._lastSeeded.add(c.id);
            if (fresh) this.onIncoming?.(sid, c, m);
            this.onChange?.();
          }, () => {}));
        }
        if (c.kind === 'voice' && !this._voice.has(c.id)) {
          const path = this.channelPath(sid, c.id);
          this._voice.set(c.id, onSnapshot(collection(db, path, 'voice'), s => {
            this.voice.set(path, s.docs.map(d => ({ uid: d.id, ...d.data() })));
            this.onChange?.();
          }, () => {}));
        }
      }
      for (const cid of [...this._last.keys()]) if (this._sidOf.get(cid) === sid && !ids.has(cid)) this._dropChannel(cid);
      for (const cid of [...this._voice.keys()]) if (this._sidOf.get(cid) === sid && !ids.has(cid)) this._dropChannel(cid);
      this.onChange?.();
    }, () => {}));
  },
  _dropChannel(cid) {
    this._last.get(cid)?.(); this._last.delete(cid); this.last.delete(cid);
    this._voice.get(cid)?.(); this._voice.delete(cid); this._sidOf.delete(cid);
  },

  // Who is in a voice channel right now (ignores people whose heartbeat stopped)
  voiceOf(sid, cid) {
    const rows = this.voice.get(this.channelPath(sid, cid)) || [];
    return rows.filter(r => Date.now() - millis(r.at) < FRESH || r.uid === this.me?.uid);
  },

  // ---- servers
  async create(name, icon, color, img = '') {
    name = cleanText(name, 30);
    if (name.length < 2) throw new Error('Give your server a name (at least 2 characters).');
    const code = makeCode();
    const sref = doc(collection(db, 'cc_servers')), b = writeBatch(db), me = this.me;
    b.set(sref, { name, owner: me.uid, members: [me.uid], ids: { [me.uid]: me.id }, icon: icon || '💬', color: color || COLORS[0], invite: code, ...(img ? { img } : {}), at: serverTimestamp() });
    b.set(doc(db, 'cc_invites', code), { sid: sref.id, name, icon: icon || '💬', color: color || COLORS[0], owner: me.uid, at: serverTimestamp() });
    b.set(doc(collection(sref, 'channels')), { name: 'general', kind: 'text', at: new Date(Date.now()) });
    b.set(doc(collection(sref, 'channels')), { name: 'Lounge', kind: 'voice', at: new Date(Date.now() + 1) });
    stamp(b, me.uid, 'ccserver');
    await b.commit();
    return sref.id;
  },
  async peekInvite(code) {
    code = String(code || '').trim().toUpperCase().replace(/^.*\//, '');
    if (code.length < 4) throw new Error('Paste an invite code, like K7P2XQM.');
    const snap = await getDoc(doc(db, 'cc_invites', code));
    if (!snap.exists()) throw new Error("That invite doesn't exist (or was cancelled).");
    return { code, ...snap.data() };
  },
  async join(code) {
    const inv = await this.peekInvite(code);
    if (this.list.some(s => s.id === inv.sid)) throw new Error("You're already in that server.");
    await updateDoc(doc(db, 'cc_servers', inv.sid), { members: arrayUnion(this.me.uid), ['ids.' + this.me.uid]: this.me.id });
    return inv.sid;
  },
  leave(sid) { return updateDoc(doc(db, 'cc_servers', sid), { members: arrayRemove(this.me.uid), ['ids.' + this.me.uid]: deleteField() }); },
  async remove(sid) {
    const s = this.server(sid);
    const b = writeBatch(db);
    if (s?.invite) b.delete(doc(db, 'cc_invites', s.invite));
    b.delete(doc(db, 'cc_servers', sid));
    await b.commit();
  },
  rename: (sid, name) => updateDoc(doc(db, 'cc_servers', sid), { name: cleanText(name, 30) || 'Server' }),
  kick: (sid, uid) => updateDoc(doc(db, 'cc_servers', sid), { members: arrayRemove(uid), ['ids.' + uid]: deleteField() }),
  async newInvite(sid) {
    const s = this.server(sid), code = makeCode(), b = writeBatch(db);
    if (s.invite) b.delete(doc(db, 'cc_invites', s.invite));
    b.set(doc(db, 'cc_invites', code), { sid, name: s.name, icon: s.icon, color: s.color, owner: s.owner, at: serverTimestamp() });
    b.update(doc(db, 'cc_servers', sid), { invite: code });
    await b.commit();
    return code;
  },

  // ---- channels
  async addChannel(sid, name, kind) {
    name = String(name || '').trim().replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 24);
    if (kind === 'text') name = name.toLowerCase().replace(/\s+/g, '-');
    if (!name) throw new Error('Give the channel a name.');
    const ref = doc(collection(db, 'cc_servers', sid, 'channels'));
    const b = writeBatch(db);
    b.set(ref, { name, kind, at: serverTimestamp() });
    stamp(b, this.me.uid, 'ccchan');
    await b.commit();
    return ref.id;
  },
  deleteChannel: (sid, cid) => deleteDoc(doc(db, 'cc_servers', sid, 'channels', cid)),

  // ---- messages
  unread(sid, cid) { const m = this.last.get(cid); return !!m && m.from !== this.me?.uid && m.at > readAt('ch:' + cid) && !(this.active?.cid === cid); },
  unreadServer(sid) { return this.channelsOf(sid).some(c => c.kind === 'text' && this.unread(sid, c.id)); },
  open(sid, cid) {
    this._msg?.(); this.active = { sid, cid }; this.messages = [];
    const q = query(collection(db, 'cc_servers', sid, 'channels', cid, 'messages'), orderBy('at'), limitToLast(100));
    this._msg = onSnapshot(q, s => { this.messages = s.docs.map(msgOf); markRead('ch:' + cid); this.onChange?.(); }, e => { this.error = nice(e); this.onChange?.(); });
  },
  close() { this._msg?.(); this._msg = null; this.active = null; this.messages = []; },
  async send(text, img = '') {
    text = cleanText(text, 4000);
    if ((!text && !img) || !this.active) return;
    const { sid, cid } = this.active, b = writeBatch(db);
    b.set(doc(collection(db, 'cc_servers', sid, 'channels', cid, 'messages')), { from: this.me.uid, text, ...(img ? { img } : {}), at: serverTimestamp() });
    stamp(b, this.me.uid, 'ccmsg');
    await b.commit();
  },
  react(sid, cid, mid, key, on) {
    return updateDoc(doc(db, 'cc_servers', sid, 'channels', cid, 'messages', mid), new FieldPath('re', key), on ? arrayUnion(this.me.uid) : arrayRemove(this.me.uid));
  },
  // ---- custom emoji: cc_servers/{sid}/emoji/{name} = { name, img, by }
  emoji: new Map(),     // name -> { name, img, sid, by }
  _emo: new Map(),
  _watchEmoji(sid) {
    this._emo.set(sid, onSnapshot(collection(db, 'cc_servers', sid, 'emoji'), s => {
      for (const [k, e] of [...this.emoji]) if (e.sid === sid) this.emoji.delete(k);
      for (const d of s.docs) this.emoji.set(d.id, { name: d.id, sid, ...d.data() });
      this.onChange?.();
    }, () => {}));
  },
  async addEmoji(sid, name, img) {
    name = String(name || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
    if (name.length < 2) throw new Error('Emoji names need at least 2 letters or numbers.');
    await setDoc(doc(db, 'cc_servers', sid, 'emoji', name), { name, img, by: this.me.uid, at: serverTimestamp() });
    return name;
  },
  deleteEmoji: (sid, name) => deleteDoc(doc(db, 'cc_servers', sid, 'emoji', name)),
  setIconImage: (sid, img) => updateDoc(doc(db, 'cc_servers', sid), { img }),
  deleteMessage(sid, cid, mid) { return deleteDoc(doc(db, 'cc_servers', sid, 'channels', cid, 'messages', mid)); }
};
