// Bots that run on the server owner's copy of Camelcord (so they work while the owner is online):
//   auto-mod: deletes messages that break the server's rules and posts a short warning
//   welcome:  greets people who join
// Giveaways, polls and tickets don't need the owner online; they live in the database (see servers.js).
import { db, millis } from './firebase.js';
import { Servers } from './servers.js';
import { deleteDoc, collection, query, orderBy, limitToLast, onSnapshot } from '../vendor/firebase/firebase-firestore.js';

const nameOf = id => String(id || 'Someone').split('#')[0];
const DEFAULT_WELCOME = 'Welcome to the server, {user}!';
const escapeRe = w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const Bots = {
  me: null, _subs: new Map(), _recent: new Map(), _warned: new Map(), _posts: [], _since: 0,
  start(me) {
    this.stop(); this.me = me; this._since = Date.now() - 2000;
    Servers.onMemberJoined = (s, uid) => this.welcome(s, uid);
  },
  stop() { for (const un of this._subs.values()) un(); this._subs.clear(); this.me = null; Servers.onMemberJoined = null; },

  // Call when servers / rooms / settings change: watch the rooms of every server I own that has auto-mod on
  sync() {
    if (!this.me) return;
    const want = new Set();
    for (const s of Servers.list) {
      if (s.owner !== this.me.uid || !Servers.botsOf(s.id).automod.on) continue;
      for (const c of Servers.channelsOf(s.id)) if (c.kind === 'text') want.add(s.id + '/' + c.id);
    }
    for (const [k, un] of [...this._subs]) if (!want.has(k)) { un(); this._subs.delete(k); }
    for (const k of want) if (!this._subs.has(k)) {
      const [sid, cid] = k.split('/');
      const q = query(collection(db, 'cc_servers', sid, 'channels', cid, 'messages'), orderBy('at'), limitToLast(30));
      this._subs.set(k, onSnapshot(q, snap => {
        for (const ch of snap.docChanges()) if (ch.type === 'added' && !ch.doc.metadata.hasPendingWrites) this.check(sid, cid, ch.doc);
      }, () => {}));
    }
  },

  // Bots never post more than 6 times a minute, so a bad rule can't make a mess
  _canPost() {
    const now = Date.now();
    this._posts = this._posts.filter(t => now - t < 60000);
    if (this._posts.length >= 6) return false;
    this._posts.push(now);
    return true;
  },

  check(sid, cid, d) {
    const m = d.data();
    if (!m || m.bot || m.from === this.me.uid) return;
    if (millis(m.at) < this._since) return;                       // from before I started watching
    const srv = Servers.server(sid); if (!srv) return;
    if ((srv.mods || []).includes(m.from)) return;                // moderators are exempt
    const cfg = Servers.botsOf(sid).automod; if (!cfg.on) return;
    const text = String(m.text || '');
    const letters = text.replace(/[^A-Za-z]/g, '');
    let reason = '';
    const words = String(cfg.words || '').split(/[,\n]/).map(w => w.trim().toLowerCase()).filter(Boolean);
    if (words.some(w => new RegExp('\\b' + escapeRe(w) + '\\b', 'i').test(text))) reason = 'that word isn’t allowed here';
    else if (cfg.links && /(https?:\/\/|www\.)\S+/i.test(text)) reason = 'links aren’t allowed here';
    else if (cfg.caps && text.length >= 12 && letters.length >= 8 && text.replace(/[^A-Z]/g, '').length / letters.length > 0.7) reason = 'please don’t shout';
    else if (cfg.mentions && (text.match(/@\S+/g) || []).length >= 5) reason = 'too many mentions';
    else if (cfg.spam) {
      const now = Date.now(), list = (this._recent.get(m.from) || []).filter(t => now - t < 8000);
      list.push(now); this._recent.set(m.from, list);
      if (list.length >= 6) reason = 'slow down, that’s a lot of messages';
    }
    if (!reason) return;
    deleteDoc(d.ref).catch(() => {});
    const last = this._warned.get(m.from) || 0;
    if (Date.now() - last > 20000 && this._canPost()) {
      this._warned.set(m.from, Date.now());
      Servers.sendBot(sid, cid, 'automod', `🛡️ ${nameOf(srv.ids?.[m.from])}: ${reason}.`).catch(() => {});
    }
  },

  welcome(srv, uid) {
    if (!this.me || srv.owner !== this.me.uid || uid === this.me.uid) return;
    const cfg = Servers.botsOf(srv.id).welcome; if (!cfg.on) return;
    const rooms = Servers.channelsOf(srv.id).filter(c => c.kind === 'text');
    const room = rooms.find(c => !c.announce) || rooms[0];
    if (!room || !this._canPost()) return;
    const text = String(cfg.text || DEFAULT_WELCOME).replace(/\{user\}/g, nameOf(srv.ids?.[uid])).replace(/\{server\}/g, srv.name);
    Servers.sendBot(srv.id, room.id, 'welcome', '👋 ' + text).catch(() => {});
  }
};
