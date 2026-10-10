// Voice: WebRTC audio in a full mesh (everyone connects to everyone), signalled through Firestore.
// A "room" is any document that has a `voice` and a `signals` subcollection:
//   cc_servers/{sid}/channels/{cid}   a voice channel
//   cc_calls/{pairId}                 a call between two friends
// Each person writes voice/{uid} (who they are, muted?, deafened?, a heartbeat) and listens for
// signals addressed to them. For every pair the one with the smaller uid sends the offer, so the
// two sides never offer at the same time.
import { db, millis } from './firebase.js';
import {
  doc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, onSnapshot, serverTimestamp
} from '../vendor/firebase/firebase-firestore.js';

const FRESH = 50000, BEAT = 15000;
const rnd = () => Math.random().toString(36).slice(2, 10);

const loadSettings = () => { try { return JSON.parse(localStorage.getItem('cc.audio') || '{}'); } catch (_) { return {}; } };
export const AudioSettings = {
  get: loadSettings,
  set(patch) { localStorage.setItem('cc.audio', JSON.stringify({ ...loadSettings(), ...patch })); }
};
// How loud everyone is for me: one master level and one level per person (0 to 1)
const loadVol = () => { try { return JSON.parse(localStorage.getItem('cc.vol') || '{}'); } catch (_) { return {}; } };
const clamp01 = n => Math.min(1, Math.max(0, +n || 0));
function iceServers() {
  const list = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  try { const t = JSON.parse(localStorage.getItem('cc.turn') || 'null'); if (t?.urls) list.push(t); } catch (_) {}
  return list;
}

export const Voice = {
  me: null,
  room: null,             // { path, label, kind: 'channel' | 'call' }
  state: 'idle',          // idle | connecting | connected
  error: '',
  muted: false, deafened: false,
  participants: new Map(),// uid -> { uid, id, muted, deafened, session, at }
  conn: new Map(),        // uid -> 'connecting' | 'connected' | 'failed'
  speaking: new Set(),    // uids that are talking right now (includes me)
  noMic: false,
  ptt: false, pttHeld: false, // push-to-talk: the mic is only open while the key is held
  sharing: false,         // am I sharing my screen?
  screens: new Map(),     // uid -> MediaStream of that person's shared screen
  onChange: null,
  _s: null,               // everything that belongs to the current session of the room

  get active() { return !!this.room; },
  isIn(path) { return this.room?.path === path; },

  // ---- volume (affects only what I hear)
  get master() { const m = loadVol().master; return m == null ? 1 : clamp01(m); },
  volumeOf(uid) { const v = (loadVol().users || {})[uid]; return v == null ? 1 : clamp01(v); },
  setMaster(v) {
    const d = loadVol(); d.master = clamp01(v); localStorage.setItem('cc.vol', JSON.stringify(d));
    this._volumes();
  },
  setVolume(uid, v) {
    const d = loadVol(); d.users = d.users || {}; d.users[uid] = clamp01(v); localStorage.setItem('cc.vol', JSON.stringify(d));
    this._volumes();
  },
  _volumes() { for (const p of this._s?.peers.values() || []) if (p.audio) p.audio.volume = clamp01(this.master * this.volumeOf(p.uid)); },

  // ---- push to talk
  setPtt(on) { this.ptt = !!on; this.pttHeld = false; this._apply(); },
  pttHold(down) { if (this.ptt && this.pttHeld !== down) { this.pttHeld = down; this._apply(); } },
  get micOpen() { return !this.muted && (!this.ptt || this.pttHeld); },

  async join(path, label, kind, me) {
    if (this.room) await this.leave();
    this.me = me; this.room = { path, label, kind }; this.state = 'connecting'; this.error = ''; this.noMic = false;
    this.participants = new Map(); this.conn = new Map(); this.speaking = new Set();
    const s = this._s = { session: rnd(), peers: new Map(), subs: [], audios: new Set(), stream: null, track: null, meters: new Map(), timers: [], ctx: null, closed: false, early: new Map() };
    this._change();
    try {
      await this._mic(s);
      s.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (s.track) this._meter(s, me.uid, new MediaStream([s.track]));
      await setDoc(this._self(), this._selfData(s));
      s.subs.push(onSnapshot(collection(db, path, 'voice'), snap => { this._people(s, snap.docs); }, e => this._fail(e)));
      s.subs.push(onSnapshot(query(collection(db, path, 'signals'), where('to', '==', me.uid)), snap => {
        for (const ch of snap.docChanges()) if (ch.type === 'added') this._signal(s, ch.doc);
      }, e => this._fail(e)));
      s.timers.push(setInterval(() => this._beat(s), BEAT));
      s.timers.push(setInterval(() => this._tick(s), 120));
      this.state = 'connected';
    } catch (e) { this._fail(e); }
    this._change();
  },

  async leave() {
    const s = this._s, room = this.room;
    if (!s || !room) return;
    s.closed = true; this._s = null; this.sharing = false; this.screens = new Map();
    s.timers.forEach(clearInterval); s.subs.forEach(un => un());
    for (const uid of [...s.peers.keys()]) this._closePeer(s, uid);
    s.stream?.getTracks().forEach(t => t.stop());
    s.shareStream?.getTracks().forEach(t => t.stop());
    for (const m of s.meters.values()) { try { m.src.disconnect(); } catch (_) {} }
    try { await s.ctx?.close(); } catch (_) {}
    this.room = null; this.state = 'idle'; this.participants = new Map(); this.conn = new Map(); this.speaking = new Set();
    try { await deleteDoc(doc(db, room.path, 'voice', this.me.uid)); } catch (_) {}
    this._change();
  },

  setMuted(v) {
    this.muted = !!v;
    if (!this.muted && this.deafened) this.deafened = false; // unmuting while deafened also undeafens
    this._apply();
  },
  // Deafening also mutes you; undeafening puts your mute back the way it was
  setDeafened(v) {
    v = !!v;
    if (v && !this.deafened) { this._mutedBefore = this.muted; this.deafened = true; this.muted = true; }
    else if (!v && this.deafened) { this.deafened = false; this.muted = !!this._mutedBefore; }
    this._apply();
  },
  _apply() {
    const s = this._s;
    if (s?.track) s.track.enabled = this.micOpen;
    for (const a of s?.audios || []) a.muted = this.deafened;
    if (s && this._lastSent !== `${this.muted}${this.deafened}`) { this._lastSent = `${this.muted}${this.deafened}`; updateDoc(this._self(), { muted: this.muted, deafened: this.deafened }).catch(() => {}); }
    this._change();
  },

  // ---- screen sharing
  // `stream` is a MediaStream with a video track (from the screen picker). Everyone in the room gets it.
  async startShare(stream) {
    const s = this._s; if (!s || !stream) return;
    if (this.sharing) await this.stopShare();
    const track = stream.getVideoTracks()[0]; if (!track) return;
    try { track.contentHint = 'detail'; } catch (_) {}
    s.shareStream = stream; s.shareTrack = track; this.sharing = true;
    track.addEventListener('ended', () => { if (s.shareTrack === track) this.stopShare(); });
    for (const p of s.peers.values()) if (p.vsender) { await p.vsender.replaceTrack(track).catch(() => {}); this._tuneShare(p.vsender); }
    updateDoc(this._self(), { screen: true }).catch(() => {});
    this._change();
  },
  async stopShare() {
    const s = this._s;
    if (!this.sharing) return;
    this.sharing = false;
    if (s) {
      for (const p of s.peers.values()) p.vsender?.replaceTrack(null).catch(() => {});
      s.shareStream?.getTracks().forEach(t => t.stop());
      s.shareStream = null; s.shareTrack = null;
      updateDoc(this._self(), { screen: false }).catch(() => {});
    }
    this._change();
  },
  _tuneShare(sender) {
    try {
      const params = sender.getParameters();
      if (!params.encodings?.length) params.encodings = [{}];
      params.encodings[0].maxBitrate = 3000000;
      sender.setParameters(params).catch(() => {});
    } catch (_) {}
  },

  // ---- plumbing
  _self() { return doc(db, this.room.path, 'voice', this.me.uid); },
  _selfData(s) { return { id: this.me.id, session: s.session, muted: this.muted, deafened: this.deafened, ...(this.sharing ? { screen: true } : {}), at: serverTimestamp() }; },
  _beat(s) { if (!s.closed) updateDoc(this._self(), { at: serverTimestamp() }).catch(() => {}); },
  _change() { this.onChange?.(); },
  _fail(e) {
    this.error = e?.name === 'NotAllowedError' ? 'Microphone blocked.' : (e?.code === 'permission-denied' ? "You can't join this call." : (e?.message || String(e)));
    this.state = 'idle';
    const s = this._s; if (s) this.leave();
    this._change();
  },

  async _mic(s) {
    const cfg = AudioSettings.get();
    try {
      s.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: cfg.echo !== false, noiseSuppression: cfg.noise !== false, autoGainControl: cfg.agc !== false, ...(cfg.input ? { deviceId: { exact: cfg.input } } : {}) }
      });
      s.track = s.stream.getAudioTracks()[0] || null;
      if (s.track) s.track.enabled = this.micOpen;
    } catch (e) {
      // No microphone (or blocked): you can still listen
      this.noMic = true; s.track = null; s.stream = null;
      if (e?.name === 'NotAllowedError') this.error = 'Microphone blocked: you can listen but not talk.';
    }
  },
  // Switch microphone while in a call
  async changeInput(deviceId) {
    AudioSettings.set({ input: deviceId });
    const s = this._s; if (!s) return;
    try {
      const cfg = AudioSettings.get();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: cfg.echo !== false, noiseSuppression: cfg.noise !== false, autoGainControl: cfg.agc !== false, deviceId: { exact: deviceId } } });
      const track = stream.getAudioTracks()[0];
      track.enabled = this.micOpen;
      s.stream?.getTracks().forEach(t => t.stop());
      s.stream = stream; s.track = track; this.noMic = false;
      for (const p of s.peers.values()) p.sender?.replaceTrack(track).catch(() => {});
      this._meter(s, this.me.uid, new MediaStream([track]));
    } catch (_) {}
    this._change();
  },
  setOutput(deviceId) {
    AudioSettings.set({ output: deviceId });
    for (const a of this._s?.audios || []) a.setSinkId?.(deviceId).catch(() => {});
  },

  _people(s, docs) {
    if (s.closed) return;
    const next = new Map();
    for (const d of docs) {
      const x = d.data(), uid = d.id;
      if (uid !== this.me.uid && Date.now() - millis(x.at) > FRESH && !d.metadata.hasPendingWrites) continue;
      next.set(uid, { uid, id: x.id, muted: !!x.muted, deafened: !!x.deafened, screen: !!x.screen, session: x.session, at: millis(x.at) });
    }
    this.participants = next;
    // Drop connections to people who left (or came back with a new session)
    for (const [uid, p] of [...s.peers]) { const n = next.get(uid); if (!n || (p.session && n.session !== p.session)) this._closePeer(s, uid); }
    // The smaller uid starts each connection
    for (const [uid, n] of next) {
      if (uid === this.me.uid || s.peers.has(uid)) continue;
      if (this.me.uid < uid) this._offer(s, uid, n.session);
    }
    this._change();
  },
  // Re-run the freshness check even when nothing was written (a crashed client stops beating)
  _tick(s) {
    if (s.closed) return;
    let changed = false;
    for (const [uid, p] of this.participants) if (uid !== this.me.uid && Date.now() - p.at > FRESH * 1.6) { this.participants.delete(uid); this._closePeer(s, uid); changed = true; }
    for (const [uid, m] of s.meters) {
      m.an.getByteTimeDomainData(m.buf);
      let peak = 0; for (let i = 0; i < m.buf.length; i++) peak = Math.max(peak, Math.abs(m.buf[i] - 128));
      const on = peak > 9 && !(uid === this.me.uid && !this.micOpen);
      if (on) m.hold = 4; else if (m.hold > 0) m.hold--;
      const talking = m.hold > 0;
      if (talking !== this.speaking.has(uid)) { talking ? this.speaking.add(uid) : this.speaking.delete(uid); changed = true; }
    }
    if (changed) this._change();
  },
  _meter(s, uid, stream) {
    const old = s.meters.get(uid); if (old) { try { old.src.disconnect(); } catch (_) {} }
    try {
      const src = s.ctx.createMediaStreamSource(stream), an = s.ctx.createAnalyser();
      an.fftSize = 512; src.connect(an);
      s.meters.set(uid, { src, an, buf: new Uint8Array(an.fftSize), hold: 0 });
    } catch (_) {}
  },

  _peer(s, uid, session, initiator) {
    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    const p = { uid, session, pc, initiator, queue: [], sender: null, audio: null, remoteSet: false };
    s.peers.set(uid, p);
    this.conn.set(uid, 'connecting');
    pc.onicecandidate = e => { if (e.candidate) this._send(s, uid, p.session, 'ice', JSON.stringify(e.candidate)); };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'connected') this.conn.set(uid, 'connected');
      else if (st === 'failed') { this.conn.set(uid, 'failed'); this._closePeer(s, uid); /* the next heartbeat starts a fresh attempt */ }
      else if (st === 'closed') this.conn.delete(uid);
      this._change();
    };
    pc.ontrack = e => {
      if (e.track.kind === 'video') { this.screens.set(uid, new MediaStream([e.track])); this._change(); return; }
      const a = new Audio();
      a.autoplay = true; a.srcObject = e.streams[0] || new MediaStream([e.track]); a.muted = this.deafened;
      a.volume = clamp01(this.master * this.volumeOf(uid));
      const out = AudioSettings.get().output; if (out && a.setSinkId) a.setSinkId(out).catch(() => {});
      a.play().catch(() => {});
      p.audio = a; s.audios.add(a);
      this._meter(s, uid, a.srcObject);
    };
    return p;
  },
  _closePeer(s, uid) {
    const p = s.peers.get(uid); if (!p) return;
    s.peers.delete(uid); this.conn.delete(uid); this.screens.delete(uid);
    try { p.pc.close(); } catch (_) {}
    if (p.audio) { p.audio.srcObject = null; s.audios.delete(p.audio); }
    const m = s.meters.get(uid); if (m) { try { m.src.disconnect(); } catch (_) {} s.meters.delete(uid); }
    this.speaking.delete(uid);
  },
  async _offer(s, uid, session) {
    const p = this._peer(s, uid, session, true);
    try {
      const t = p.pc.addTransceiver('audio', { direction: 'sendrecv' });
      p.sender = t.sender;
      if (s.track) await t.sender.replaceTrack(s.track);
      // A video lane that is always negotiated: sharing a screen later is just a replaceTrack, no renegotiation
      const vt = p.pc.addTransceiver('video', { direction: 'sendrecv' });
      p.vsender = vt.sender;
      if (s.shareTrack) { await vt.sender.replaceTrack(s.shareTrack); this._tuneShare(vt.sender); }
      await p.pc.setLocalDescription(await p.pc.createOffer());
      this._send(s, uid, session, 'offer', JSON.stringify(p.pc.localDescription));
    } catch (_) { this._closePeer(s, uid); }
  },
  async _signal(s, d) {
    if (s.closed) return;
    const x = d.data(), uid = x.from;
    deleteDoc(d.ref).catch(() => {});
    if (x.toSession !== s.session) return; // meant for an older visit of ours
    try {
      if (x.kind === 'offer') {
        const known = this.participants.get(uid);
        if (known && known.session && known.session !== x.session) return;
        if (s.peers.get(uid) && s.peers.get(uid).session !== x.session) this._closePeer(s, uid);
        const p = s.peers.get(uid) || this._peer(s, uid, x.session, false);
        // Candidates that arrived ahead of the offer
        p.queue.push(...(s.early.get(uid + x.session) || [])); s.early.delete(uid + x.session);
        await p.pc.setRemoteDescription(JSON.parse(x.data)); p.remoteSet = true;
        for (const c of p.queue.splice(0)) await p.pc.addIceCandidate(c).catch(() => {});
        for (const t of p.pc.getTransceivers()) {
          const kind = t.receiver.track?.kind;
          if (kind === 'audio') { t.direction = 'sendrecv'; p.sender = t.sender; if (s.track) await t.sender.replaceTrack(s.track); }
          else if (kind === 'video') { t.direction = 'sendrecv'; p.vsender = t.sender; if (s.shareTrack) { await t.sender.replaceTrack(s.shareTrack); this._tuneShare(t.sender); } }
        }
        await p.pc.setLocalDescription(await p.pc.createAnswer());
        this._send(s, uid, x.session, 'answer', JSON.stringify(p.pc.localDescription));
      } else {
        const p = s.peers.get(uid);
        if (!p && x.kind === 'ice') { const k = uid + x.session; s.early.set(k, [...(s.early.get(k) || []), JSON.parse(x.data)]); return; }
        if (!p || p.session !== x.session) return;
        if (x.kind === 'answer') {
          await p.pc.setRemoteDescription(JSON.parse(x.data)); p.remoteSet = true;
          for (const c of p.queue.splice(0)) await p.pc.addIceCandidate(c).catch(() => {});
        } else if (x.kind === 'ice') {
          const c = JSON.parse(x.data);
          if (p.remoteSet) await p.pc.addIceCandidate(c).catch(() => {}); else p.queue.push(c);
        }
      }
    } catch (_) { this._closePeer(s, uid); }
  },
  _send(s, to, toSession, kind, data) {
    if (s.closed) return;
    addDoc(collection(db, this.room.path, 'signals'), { from: this.me.uid, to, session: s.session, toSession, kind, data }).catch(() => {});
  }
};

// ---------------------------------------------------------------- calls between friends
// cc_calls/{pair}: { users, from, state: 'ringing' | 'active', at }. The caller makes it, the other
// person sees it ring and either joins (state: active) or declines (deletes it).
export const Calls = {
  me: null, incoming: null, outgoing: null, onChange: null, onDeclined: null, _unsub: null, _ringTimer: null, _joinedAt: 0,
  start(me) {
    this.stop(); this.me = me;
    this._unsub = onSnapshot(query(collection(db, 'cc_calls'), where('users', 'array-contains', me.uid)), snap => {
      const calls = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const fresh = c => Date.now() - millis(c.at) < 60000;
      this.incoming = calls.find(c => c.from !== me.uid && c.state === 'ringing' && fresh(c)) || null;
      const mine = calls.find(c => c.from === me.uid);
      // The other person declined or hung up: the call document is gone while we are still in it
      const inCall = Voice.room?.kind === 'call' ? Voice.room.path.split('/')[1] : null;
      if (inCall && !calls.some(c => c.id === inCall) && Date.now() - this._joinedAt > 4000) this.onDeclined?.(inCall);
      this.outgoing = mine ? mine.id : null;
      this.onChange?.();
    }, () => {});
  },
  stop() { this._unsub?.(); this._unsub = null; this.incoming = null; this.outgoing = null; clearTimeout(this._ringTimer); },
  // Ring a friend and join the call ourselves
  async call(pair, label) {
    const users = pair.split('_');
    await setDoc(doc(db, 'cc_calls', pair), { users, from: this.me.uid, state: 'ringing', at: serverTimestamp() });
    this.outgoing = pair; this._joinedAt = Date.now();
    await Voice.join(`cc_calls/${pair}`, label, 'call', this.me);
    clearTimeout(this._ringTimer);
    // Nobody picked up
    this._ringTimer = setTimeout(() => { if (Voice.room?.path === `cc_calls/${pair}` && Voice.participants.size <= 1) this.hangup(); }, 45000);
  },
  async answer(label) {
    const c = this.incoming; if (!c) return;
    this.incoming = null;
    this._joinedAt = Date.now();
    await updateDoc(doc(db, 'cc_calls', c.id), { state: 'active' }).catch(() => {});
    await Voice.join(`cc_calls/${c.id}`, label, 'call', this.me);
  },
  async decline() {
    const c = this.incoming; if (!c) return;
    this.incoming = null;
    await deleteDoc(doc(db, 'cc_calls', c.id)).catch(() => {});
    this.onChange?.();
  },
  async hangup() {
    const path = Voice.room?.path;
    clearTimeout(this._ringTimer);
    await Voice.leave();
    if (path?.startsWith('cc_calls/')) await deleteDoc(doc(db, path)).catch(() => {});
    this.outgoing = null; this.onChange?.();
  }
};
