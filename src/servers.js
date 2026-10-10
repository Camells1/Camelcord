// Camelcord servers: a server has members, chat rooms and voice rooms, plus bots.
//   cc_servers/{sid}                              name, owner, members[], ids{uid: id}, icon, color, invite, img
//   cc_servers/{sid}/channels/{cid}               name, kind 'text' | 'voice', slow (seconds), at
//   cc_servers/{sid}/channels/{cid}/messages/{m}  from, text, img, re{}, edited, bot, app, at
//   cc_servers/{sid}/bots/config                  auto-mod, welcome, who can start giveaways ...
//   cc_servers/{sid}/apps/{id}                    giveaways and polls
//   cc_servers/{sid}/tickets/{id}/msgs/{m}        support tickets (opener + owner only)
//   cc_slow/{uid}_{cid}                           slowmode stamps
//   cc_invites/{code}                             sid, name, icon, color, owner
import { db, stamp, millis } from './firebase.js';
import { nice } from './account.js';
import { msgOf, cleanText, readAt, markRead } from './social.js';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, FieldPath, serverTimestamp, collection, query, where, orderBy, limitToLast,
  onSnapshot, arrayUnion, arrayRemove, deleteField
} from '../vendor/firebase/firebase-firestore.js';

export const COLORS = ['#5b8cff', '#7b6cf0', '#43b3c4', '#43b581', '#e0a34a', '#ed6a5a', '#d1577a', '#8f9aa8'];
export const ICONS = ['💬', '🎮', '🎵', '🚀', '⚔️', '🔥', '🎨', '📚', '🧠', '🌊', '🍕', '👾', '🌵', '🐪', '☀️', '🐸'];
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => Array.from({ length: 7 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const FRESH = 90000; // a voice participant counts if they checked in within this long

// A listener that logs what went wrong and re-subscribes by itself (a dead listener means a frozen screen)
export const listenErrors = [];
function listen(q, next, onError) {
  let un = null, dead = false, tries = 0;
  const label = typeof onError === 'string' ? onError : 'listener';
  const go = () => {
    un = onSnapshot(q, snap => { tries = 0; next(snap); }, e => {
      listenErrors.push(label + ': ' + (e.code || e.message));
      console.warn('[camelcord] listener ' + label + ' stopped:', e.code || e.message);
      if (typeof onError === 'function') onError(e);
      if (!dead && tries++ < 6) setTimeout(() => { if (!dead) go(); }, 1500 * tries);
    });
  };
  go();
  return () => { dead = true; un?.(); };
}

export const DEFAULT_BOTS = {
  automod: { on: false, words: '', links: false, spam: true, caps: false, mentions: true },
  welcome: { on: false, text: 'Welcome to the server, {user}!' },
  giveawayAnyone: false, tickets: true, polls: true
};

export const Servers = {
  me: null, list: [], channels: new Map(), onChange: null, onIncoming: null, error: '',
  messages: [], active: null,           // { sid, cid } for the open room
  last: new Map(),                      // cid -> newest message
  voice: new Map(),                     // channel path -> [{ uid, id, muted, deafened, at }]
  emoji: new Map(),                     // name -> { name, img, sid, by }
  apps: new Map(),                      // app id -> { id, sid, type, ... }
  tickets: new Map(),                   // sid -> [ticket]
  botCfg: new Map(),                    // sid -> config
  _unsub: null, _chan: new Map(), _msg: null, _last: new Map(), _lastSeeded: new Set(), _voice: new Map(), _sidOf: new Map(),
  _emo: new Map(), _apps: new Map(), _tix: new Map(), _bots: new Map(), _tick: null,

  start(me) {
    this.stop(); this.me = me;
    const q = query(collection(db, 'cc_servers'), where('members', 'array-contains', me.uid));
    this._unsub = listen(q, snap => {
      this.error = '';
      const before = new Map(this.list.map(s => [s.id, s]));
      this.list = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => millis(a.at) - millis(b.at));
      const ids = new Set(this.list.map(s => s.id));
      for (const sid of [...this._chan.keys()]) if (!ids.has(sid)) this._dropServer(sid);
      for (const s of this.list) if (!this._chan.has(s.id)) { this._watchChannels(s.id); this._watchEmoji(s.id); this._watchApps(s.id); this._watchBots(s.id); this._watchTickets(s); }
      // People who joined since last time (the welcome bot listens to this)
      for (const s of this.list) {
        const old = before.get(s.id);
        if (old) for (const u of s.members) if (!old.members.includes(u)) this.onMemberJoined?.(s, u);
      }
      this.onChange?.();
    }, e => { this.error = nice(e); this.onChange?.(); });
    // Giveaways and polls that have run out are closed by whoever notices first
    this._tick = setInterval(() => this._closeDue(), 4000);
  },
  stop() {
    this._unsub?.(); this._unsub = null; clearInterval(this._tick);
    for (const m of [this._chan, this._last, this._voice, this._emo, this._apps, this._tix, this._bots]) { for (const un of m.values()) un(); m.clear(); }
    this._sidOf.clear(); this.emoji.clear(); this.apps.clear(); this.tickets.clear(); this.botCfg.clear();
    this._msg?.(); this._msg = null;
    this.list = []; this.channels.clear(); this.last.clear(); this.voice.clear(); this._lastSeeded.clear(); this.messages = []; this.active = null; this.me = null;
  },
  _dropServer(sid) {
    for (const m of [this._chan, this._emo, this._apps, this._tix, this._bots]) { m.get(sid)?.(); m.delete(sid); }
    this.channels.delete(sid); this.tickets.delete(sid); this.botCfg.delete(sid);
    for (const [cid, s] of [...this._sidOf]) if (s === sid) this._dropChannel(cid);
    for (const [k, e] of [...this.emoji]) if (e.sid === sid) this.emoji.delete(k);
    for (const [k, a] of [...this.apps]) if (a.sid === sid) this.apps.delete(k);
  },
  server: sid => Servers.list.find(s => s.id === sid) || null,
  isOwner(sid) { return this.server(sid)?.owner === this.me?.uid; },
  channelsOf: sid => Servers.channels.get(sid) || [],
  channelPath: (sid, cid) => `cc_servers/${sid}/channels/${cid}`,
  botsOf: sid => ({ ...DEFAULT_BOTS, ...(Servers.botCfg.get(sid) || {}), automod: { ...DEFAULT_BOTS.automod, ...(Servers.botCfg.get(sid)?.automod || {}) }, welcome: { ...DEFAULT_BOTS.welcome, ...(Servers.botCfg.get(sid)?.welcome || {}) } }),
  // Where a room's messages live. Ticket rooms have ids like "t_<ticketId>".
  _col(sid, cid) { return cid.startsWith('t_') ? ['cc_servers', sid, 'tickets', cid.slice(2), 'msgs'] : ['cc_servers', sid, 'channels', cid, 'messages']; },

  _watchChannels(sid) {
    const q = query(collection(db, 'cc_servers', sid, 'channels'), orderBy('at'));
    this._chan.set(sid, listen(q, snap => {
      const chans = snap.docs.map(d => ({ id: d.id, sid, ...d.data() }));
      this.channels.set(sid, chans);
      const ids = new Set(chans.map(c => c.id));
      for (const c of chans) {
        this._sidOf.set(c.id, sid);
        if (c.kind === 'text' && !this._last.has(c.id)) {
          const lq = query(collection(db, ...this._col(sid, c.id)), orderBy('at'), limitToLast(1));
          this._last.set(c.id, listen(lq, s => {
            const m = s.docs[0] && msgOf(s.docs[0]);
            if (!m) { this._lastSeeded.add(c.id); return; }
            const old = this.last.get(c.id);
            const fresh = this._lastSeeded.has(c.id) && m.from !== this.me?.uid && old?.id !== m.id && !m.pending && !m.bot && (!old || m.at > old.at) && Date.now() - m.at < 30000;
            this.last.set(c.id, m); this._lastSeeded.add(c.id);
            if (fresh) this.onIncoming?.(sid, c, m);
            this.onChange?.();
          }, () => {}));
        }
        if (c.kind === 'voice' && !this._voice.has(c.id)) {
          const path = this.channelPath(sid, c.id);
          this._voice.set(c.id, listen(collection(db, path, 'voice'), s => {
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
  setIconImage: (sid, img) => updateDoc(doc(db, 'cc_servers', sid), { img }),

  // ---- moderators and bans (owner only)
  isMod(sid) { const s = this.server(sid); return !!s && (s.owner === this.me?.uid || (s.mods || []).includes(this.me?.uid)); },
  setMod: (sid, uid, on) => updateDoc(doc(db, 'cc_servers', sid), { mods: on ? arrayUnion(uid) : arrayRemove(uid) }),
  ban: (sid, uid) => updateDoc(doc(db, 'cc_servers', sid), { members: arrayRemove(uid), mods: arrayRemove(uid), bans: arrayUnion(uid), ['ids.' + uid]: deleteField() }),
  unban: (sid, uid) => updateDoc(doc(db, 'cc_servers', sid), { bans: arrayRemove(uid) }),
  // ---- notifications you have switched off for a server (just this device)
  isMuted(sid) { try { return JSON.parse(localStorage.getItem('cc.muted') || '[]').includes(sid); } catch (_) { return false; } },
  toggleMuted(sid) {
    let l = []; try { l = JSON.parse(localStorage.getItem('cc.muted') || '[]'); } catch (_) {}
    l = l.includes(sid) ? l.filter(x => x !== sid) : [...l, sid];
    localStorage.setItem('cc.muted', JSON.stringify(l)); this.onChange?.();
  },

  // ---- rooms
  async addChannel(sid, name, kind, announce = false) {
    name = String(name || '').trim().replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 24);
    if (kind === 'text') name = name.toLowerCase().replace(/\s+/g, '-');
    if (!name) throw new Error('Give the room a name.');
    const ref = doc(collection(db, 'cc_servers', sid, 'channels'));
    const b = writeBatch(db);
    b.set(ref, { name, kind, ...(announce && kind === 'text' ? { announce: true } : {}), at: serverTimestamp() });
    stamp(b, this.me.uid, 'ccchan');
    await b.commit();
    return ref.id;
  },
  renameChannel(sid, cid, name) {
    const c = this.channelsOf(sid).find(x => x.id === cid);
    name = String(name || '').trim().replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 24);
    if (c?.kind === 'text') name = name.toLowerCase().replace(/\s+/g, '-');
    if (!name) throw new Error('Give the room a name.');
    return updateDoc(doc(db, 'cc_servers', sid, 'channels', cid), { name });
  },
  setAnnounce: (sid, cid, on) => updateDoc(doc(db, 'cc_servers', sid, 'channels', cid), { announce: !!on }),
  setSlow: (sid, cid, secs) => updateDoc(doc(db, 'cc_servers', sid, 'channels', cid), { slow: Math.max(0, Math.min(3600, Math.round(secs))) }),
  slowOf(sid, cid) { return this.channelsOf(sid).find(c => c.id === cid)?.slow || 0; },
  deleteChannel: (sid, cid) => deleteDoc(doc(db, 'cc_servers', sid, 'channels', cid)),

  // ---- messages
  unread(sid, cid) { const m = this.last.get(cid); return !!m && m.from !== this.me?.uid && m.at > readAt('ch:' + cid) && !(this.active?.cid === cid); },
  unreadServer(sid) { return this.channelsOf(sid).some(c => c.kind === 'text' && this.unread(sid, c.id)); },
  open(sid, cid) {
    this._msg?.(); this.active = { sid, cid }; this.messages = [];
    const q = query(collection(db, ...this._col(sid, cid)), orderBy('at'), limitToLast(100));
    this._msg = listen(q, s => { this.messages = s.docs.map(msgOf); markRead('ch:' + cid); this.onChange?.(); }, e => { this.error = nice(e); this.onChange?.(); });
  },
  close() { this._msg?.(); this._msg = null; this.active = null; this.messages = []; },
  // Posts into the open room (or `to` = {sid, cid}). extra: { bot, app }
  async send(text, img = '', extra = {}, to = null) {
    text = cleanText(text, 4000);
    const { sid, cid } = to || this.active || {};
    if ((!text && !img) || !sid) return;
    const b = writeBatch(db);
    b.set(doc(collection(db, ...this._col(sid, cid))), { from: this.me.uid, text, ...(img ? { img } : {}), ...extra, at: serverTimestamp() });
    stamp(b, this.me.uid, 'ccmsg');
    // Slowmode: the room remembers when I last posted (the rules check this stamp)
    if (!cid.startsWith('t_') && this.slowOf(sid, cid) > 0 && !this.isOwner(sid)) b.set(doc(db, 'cc_slow', `${this.me.uid}_${cid}`), { at: serverTimestamp() });
    await b.commit();
  },
  sendBot(sid, cid, bot, text) { return this.send(text, '', { bot }, { sid, cid }); },
  react(sid, cid, mid, key, on) {
    return updateDoc(doc(db, ...this._col(sid, cid), mid), new FieldPath('re', key), on ? arrayUnion(this.me.uid) : arrayRemove(this.me.uid));
  },
  edit(sid, cid, mid, text) {
    text = cleanText(text, 4000);
    if (!text) throw new Error('A message can’t be empty. Delete it instead.');
    return updateDoc(doc(db, ...this._col(sid, cid), mid), { text, edited: true });
  },
  deleteMessage(sid, cid, mid) { return deleteDoc(doc(db, ...this._col(sid, cid), mid)); },

  // ---- custom emoji
  _watchEmoji(sid) {
    this._emo.set(sid, listen(collection(db, 'cc_servers', sid, 'emoji'), s => {
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

  // ---- bots: settings, giveaways, polls
  _watchBots(sid) {
    this._bots.set(sid, listen(doc(db, 'cc_servers', sid, 'bots', 'config'), s => {
      if (s.exists()) this.botCfg.set(sid, s.data()); else this.botCfg.delete(sid);
      this.onChange?.();
    }, () => {}));
  },
  saveBots(sid, cfg) { return setDoc(doc(db, 'cc_servers', sid, 'bots', 'config'), { ...cfg, at: serverTimestamp() }); },
  _watchApps(sid) {
    this._apps.set(sid, listen(collection(db, 'cc_servers', sid, 'apps'), s => {
      for (const [k, a] of [...this.apps]) if (a.sid === sid) this.apps.delete(k);
      for (const d of s.docs) this.apps.set(d.id, { id: d.id, sid, ...d.data() });
      this.onChange?.();
    }, () => {}));
  },
  // Start a giveaway or poll and announce it in a room
  async startApp(sid, cid, data) {
    const ref = doc(collection(db, 'cc_servers', sid, 'apps'));
    const b = writeBatch(db);
    b.set(ref, { by: this.me.uid, status: 'open', winner: '', at: serverTimestamp(), ...data });
    stamp(b, this.me.uid, 'ccapp');
    await b.commit();
    const extra = { app: ref.id };
    if (this.isOwner(sid)) extra.bot = data.type;   // owner-run apps are shown as bot posts
    await this.send(data.type === 'giveaway' ? `🎉 Giveaway: ${data.title}` : `📊 Poll: ${data.title}`, '', extra, { sid, cid }).catch(() => {});
    return ref.id;
  },
  enterGiveaway(sid, aid) { return updateDoc(doc(db, 'cc_servers', sid, 'apps', aid), { entrants: arrayUnion(this.me.uid) }); },
  vote(sid, aid, index) { return updateDoc(doc(db, 'cc_servers', sid, 'apps', aid), new FieldPath('votes', this.me.uid), index); },
  async endApp(sid, aid) {
    const a = this.apps.get(aid); if (!a || a.status !== 'open') return;
    const winner = a.type === 'giveaway' && a.entrants?.length ? a.entrants[Math.floor(Math.random() * a.entrants.length)] : '';
    await updateDoc(doc(db, 'cc_servers', sid, 'apps', aid), { status: 'ended', winner });
  },
  deleteApp: (sid, aid) => deleteDoc(doc(db, 'cc_servers', sid, 'apps', aid)),
  _closeDue() {
    const now = Date.now();
    for (const a of this.apps.values()) {
      if (a.status === 'open' && a.endsAt && now >= a.endsAt + 500 && !a._closing) {
        a._closing = true;
        this.endApp(a.sid, a.id).catch(() => {}).finally(() => setTimeout(() => { a._closing = false; }, 8000));
      }
    }
  },

  // ---- support tickets
  _watchTickets(s) {
    const sid = s.id, mine = s.owner === this.me.uid;
    const q = mine ? query(collection(db, 'cc_servers', sid, 'tickets'), orderBy('at')) : query(collection(db, 'cc_servers', sid, 'tickets'), where('by', '==', this.me.uid));
    this._tix.set(sid, listen(q, snap => {
      this.tickets.set(sid, snap.docs.map(d => ({ id: d.id, sid, ...d.data() })).sort((a, b) => millis(a.at) - millis(b.at)));
      this.onChange?.();
    }, () => {}));
  },
  ticketsOf: sid => Servers.tickets.get(sid) || [],
  async newTicket(sid, subject) {
    subject = cleanText(subject, 80);
    if (!subject) throw new Error('Tell us what the ticket is about.');
    const ref = doc(collection(db, 'cc_servers', sid, 'tickets')), b = writeBatch(db);
    b.set(ref, { by: this.me.uid, byId: this.me.id, subject, status: 'open', at: serverTimestamp() });
    stamp(b, this.me.uid, 'ccticket');
    await b.commit();
    return 't_' + ref.id;
  },
  setTicket: (sid, tid, status) => updateDoc(doc(db, 'cc_servers', sid, 'tickets', tid), { status })
};
