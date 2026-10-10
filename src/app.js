// Camelcord UI: sign in, servers, rooms, friends and direct messages, voice rooms and calls,
// screen sharing, bots, themes, profiles, pictures, reactions and custom emoji
// (all free for everyone: "Camelcord Plus").
import { Account, nice } from './account.js';
import { Friends, DMs, pairOf } from './social.js';
import { Servers, COLORS, ICONS, DEFAULT_BOTS } from './servers.js';
import { Voice, Calls, AudioSettings } from './voice.js';
import { Profiles } from './profiles.js';
import { Themes, PRESETS, buildVars, initTheme, themeFromImage, shrinkImage } from './themes.js';
import { Prefs } from './prefs.js';
import { limit } from './limits.js';
import { Bots } from './bots.js';

const host = window.camel || {
  win: { min() {}, max() {}, close() {}, onState() {}, onFocus() {} }, open: u => window.open(u, '_blank'),
  notify(t, b) { try { if (window.Notification && Notification.permission === 'granted' && document.hidden) new Notification(t, { body: b }); } catch (_) {} }, attention() {},
  info: async () => ({ version: 'web' }), zoom: null, screens: null, startup: async () => false,
  update: { state: async () => ({ state: 'none' }), check: async () => ({ state: 'none' }), install: async () => false, onState() {} }
};

const IS_WEB = !window.camel;                     // the phone / browser version has no desktop shell
const isMobile = () => window.matchMedia('(max-width: 760px)').matches;
const canShare = () => !!host.screens || !!navigator.mediaDevices?.getDisplayMedia;

// ---------------------------------------------------------------- tiny DOM helpers
const $ = s => document.querySelector(s);
function h(tag, a, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(a || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = k => { if (k == null || k === false) return; if (Array.isArray(k)) k.forEach(add); else el.append(k.nodeType ? k : document.createTextNode(k)); };
  kids.forEach(add);
  return el;
}
const ICON = {
  mic: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>',
  micoff: '<path d="M1 1l22 22"/><path d="M9 9v3a3 3 0 0 0 5.1 2.1M15 9.3V4a3 3 0 0 0-5.9-.8"/><path d="M17 16.9A7 7 0 0 1 5 12v-2M19 10v2a7 7 0 0 1-.1 1.2M12 19v4M8 23h8"/>',
  head: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>',
  headoff: '<path d="M1 1l22 22"/><path d="M3 18v-6a9 9 0 0 1 14.8-6.9M21 12v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  room: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  announce: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>',
  volume: '<path d="M11 5L6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  sliders: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
  smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  chev: '<path d="M6 9l6 6 6-6"/>',
  crown: '<path d="M2 18h20M3 7l5 5 4-7 4 7 5-5-2 11H5z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  compass: '<circle cx="12" cy="12" r="10"/><path d="M16 8l-2 6-6 2 2-6z"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  signal: '<path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4v16"/>',
  msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  userplus: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v9H5v-9M7.5 8a2.5 2.5 0 1 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 1 1 0 5"/>',
  poll: '<path d="M18 20V10M12 20V4M6 20v-6"/>',
  ticket: '<path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 1 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z"/><path d="M13 5v14" stroke-dasharray="2 3"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  bellOff: '<path d="M13.7 21a1.9 1.9 0 0 1-3.4 0M18 8a6 6 0 0 0-9.3-5M6 8c0 7-3 9-3 9h14M1 1l22 22"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>'
};
const svgEl = (n, cls = '') => { const t = document.createElement('template'); t.innerHTML = `<svg class="i ${cls}" viewBox="0 0 24 24">${ICON[n]}</svg>`; return t.content.firstChild; };
const camelSvg = w => { const t = document.createElement('template'); t.innerHTML = `<svg viewBox="0 0 64 64" width="${w}" height="${w}"><use href="#camelglyph"/></svg>`; return t.content.firstChild; };

// ---------------------------------------------------------------- small utilities
const AVC = ['#5b8cff', '#7b6cf0', '#d1577a', '#43b3c4', '#43b581', '#e0a34a', '#ed6a5a', '#9a8cf0'];
const hash = s => { let n = 7; for (const c of String(s)) n = (n * 31 + c.charCodeAt(0)) >>> 0; return n; };
const colorOf = id => AVC[hash(String(id).toLowerCase()) % AVC.length];
const nameOnly = id => String(id || '?').split('#')[0];   // people only ever see the username
function avatar(id, cls = '', status = '') {
  const pic = Profiles.forId(id)?.avatar;
  return h('div', { class: 'av ' + cls + (pic ? ' has-img' : ''), style: pic ? `background-image:url('${pic}')` : `background:${colorOf(id)}` },
    pic ? null : (nameOnly(id)[0] || '?').toUpperCase(), status ? h('i', { class: 'dot ' + status }) : null);
}
const nameColor = id => Profiles.forId(id)?.nameColor || colorOf(id);
const customEmoji = name => Servers.emoji.get(name) || null;
const reKey = e => (e.startsWith(':') ? 'c_' + e.slice(1, -1) : 'u_' + [...e].map(c => c.codePointAt(0).toString(16)).join('-'));
const reShow = k => (k.startsWith('c_') ? ':' + k.slice(2) + ':' : String.fromCodePoint(...k.slice(2).split('-').map(x => parseInt(x, 16))));
function emojiNode(e) {
  if (e.startsWith(':')) { const c = customEmoji(e.slice(1, -1)); if (c) return h('img', { class: 'cemoji', src: c.img, alt: e, title: e }); }
  return document.createTextNode(e);
}
const fmtTime = ms => new Date(ms).toLocaleTimeString([], { hour: Prefs.get('clock24') ? '2-digit' : 'numeric', minute: '2-digit', hour12: !Prefs.get('clock24') });
const dayKey = ms => new Date(ms).toDateString();
function dayLabel(ms) {
  const d = new Date(ms), t = new Date();
  if (d.toDateString() === t.toDateString()) return 'Today';
  const y = new Date(t); y.setDate(t.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}
function toast(text, kind = '') {
  const t = h('div', { class: 'toast ' + kind }, text);
  $('#toasts').append(t);
  setTimeout(() => t.remove(), 3800);
}
const fail = e => toast(nice(e), 'err');
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
};
function pickFile(accept = 'image/*') {
  return new Promise(res => {
    const i = h('input', { type: 'file', accept, style: 'display:none' });
    i.addEventListener('change', () => { res(i.files[0] || null); i.remove(); });
    document.body.append(i); i.click();
  });
}
const mins = ms => ms >= 86400000 ? `${Math.round(ms / 86400000)}d` : ms >= 3600000 ? `${Math.round(ms / 3600000)}h` : `${Math.max(1, Math.round(ms / 60000))}m`;
function timeLeft(ms) {
  const left = ms - Date.now();
  if (left <= 0) return 'ending…';
  const s = Math.floor(left / 1000);
  if (s < 90) return `${s}s left`;
  if (s < 5400) return `${Math.round(s / 60)} min left`;
  if (s < 172800) return `${Math.round(s / 3600)} h left`;
  return `${Math.round(s / 86400)} days left`;
}
// "10m", "2h", "1d", "30s" -> milliseconds
function parseDuration(t) {
  const m = /^(\d+(?:\.\d+)?)\s*(s|m|h|d|w)$/i.exec(String(t).trim());
  if (!m) return 0;
  return Math.round(+m[1] * { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 }[m[2].toLowerCase()]);
}

// Message text: **bold**, *italic*, `code`, links, @mentions and :custom: emoji. Built from text nodes, never innerHTML.
function richText(text) {
  const frag = document.createDocumentFragment();
  const myName = Account.user ? nameOnly(Account.user.id).toLowerCase() : '';
  for (const part of String(text).split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|https?:\/\/[^\s<]+|:[a-z0-9_]{2,20}:|@[A-Za-z0-9_.-]{3,14})/g)) {
    if (!part) continue;
    if (/^:[a-z0-9_]{2,20}:$/.test(part)) frag.append(emojiNode(part));
    else if (part.startsWith('@') && part.length > 3) frag.append(h('span', { class: 'mention' + (part.slice(1).toLowerCase() === myName || part.toLowerCase() === '@everyone' ? ' me' : '') }, part));
    else if (part.startsWith('`') && part.length > 2) frag.append(h('code', {}, part.slice(1, -1)));
    else if (part.startsWith('**') && part.length > 4) frag.append(h('b', {}, part.slice(2, -2)));
    else if (part.startsWith('*') && part.length > 2) frag.append(h('i', {}, part.slice(1, -1)));
    else if (/^https?:\/\//.test(part)) frag.append(h('a', { onclick: () => host.open(part) }, part));
    else frag.append(part);
  }
  return frag;
}

// ---------------------------------------------------------------- state
const S = {
  sel: 'home',                       // 'home' or a server id
  view: { kind: 'friends' },         // friends | dm {uid} | text {sid,cid} | voice {sid,cid} | ticket {sid,cid}
  tab: 'online',                     // friends tab: online | all | pending | add
  raf: 0, centerKey: '', focused: true, presKey: '', serversLoaded: false, attach: '',
  hideMembers: store.get('cc.hidePeople', '0') === '1',
  status: store.get('cc.status', 'online'), search: '', searchOpen: false, holdStage: false,
  update: { state: 'none' }, lastActive: Date.now(), autoIdle: false,
  mview: 'nav', peopleOpen: false                // phones show one pane at a time: the list ('nav') or the chat
};
try { const n = JSON.parse(store.get('cc.nav', 'null')); if (n?.sel) { S.sel = n.sel; S.view = n.view || S.view; } } catch (_) {}
const drafts = new Map();
// Draw on the next frame, or on a timer when the window is hidden (frames stop then, but bots and sounds must not)
const schedule = () => {
  if (S.raf) return;
  const run = () => { S.raf = 0; render(); };
  S.raf = document.hidden ? setTimeout(run, 120) : requestAnimationFrame(run);
};
const dnd = () => S.status === 'dnd';

// ---------------------------------------------------------------- sounds
let actx = null;
function tone(freqs, dur = 0.11, vol = 0.05, force = false) {
  if (!force && (!Prefs.get('sounds') || dnd())) return;
  try {
    actx = actx || new AudioContext();
    freqs.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + i * dur;
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
    });
  } catch (_) {}
}
const sfx = {
  msg: () => tone([880, 1175], 0.07),
  join: () => Prefs.get('joinSounds') && tone([523, 784], 0.1),
  leave: () => Prefs.get('joinSounds') && tone([659, 392], 0.1)
};
let ringTimer = null;
function ring(on) {
  if (on && !ringTimer) {
    const go = () => { if (Prefs.get('ringSound') && !dnd()) tone([740, 988, 740, 988], 0.16, 0.06, true); };
    go(); ringTimer = setInterval(go, 2200); if (Prefs.get('flash')) host.attention(true);
  }
  if (!on && ringTimer) { clearInterval(ringTimer); ringTimer = null; host.attention(false); }
}
const ping = (title, body) => { if (Prefs.get('notify') && !dnd()) host.notify(title, body); };

function idOf(uid) {
  const me = Account.user;
  if (uid === me.uid) return me.id;
  const f = Friends.list.find(x => x.uid === uid); if (f) return f.id;
  for (const s of Servers.list) if (s.ids?.[uid]) return s.ids[uid];
  return Profiles.get(uid)?.id || 'Someone';
}
const friendsAccepted = () => Friends.list.filter(f => f.status === 'accepted');
const STATUS_LABEL = { online: 'Online', idle: 'Idle', dnd: 'Do not disturb', ingame: 'Playing', offline: 'Offline', invisible: 'Invisible' };
const statusText = uid => STATUS_LABEL[Friends.statusOf(uid)] || 'Offline';
const profileStatus = id => Profiles.forId(id)?.status || '';
function go(sel, view) {
  S.sel = sel; S.view = view; S.search = ''; S.searchOpen = false;
  if (isMobile()) { S.mview = 'chat'; S.peopleOpen = false; }
  store.set('cc.nav', JSON.stringify({ sel, view }));
  if (view.kind === 'dm') DMs.open(view.uid); else DMs.close();
  if (view.kind === 'text' || view.kind === 'ticket') Servers.open(view.sid, view.cid); else Servers.close();
  schedule();
}
function openServer(sid) {
  if (isMobile()) { S.sel = sid; S.mview = 'nav'; S.peopleOpen = false; schedule(); return; }
  const chans = Servers.channelsOf(sid), first = chans.find(c => c.kind === 'text') || chans[0];
  if (first) go(sid, { kind: first.kind, sid, cid: first.id });
  else { S.sel = sid; S.view = { kind: 'pending', sid }; schedule(); }
}
async function setStatus(st, auto = false) {
  S.status = st; S.autoIdle = auto;
  if (!auto) store.set('cc.status', st);
  await Friends.setPresence(st === 'idle' && !auto ? 'idle' : st);
  schedule();
}

// ---------------------------------------------------------------- overlays: modal, menu, profile card, emoji picker
const layer = () => $('#layer');
function closeOverlays(keepIncoming = true) {
  for (const el of [...layer().children]) if (!(keepIncoming && el.id === 'inc')) el.remove();
}
function modal(build, size = '') {
  closeOverlays();
  const box = h('div', { class: 'modal ' + size });
  const close = () => scrim.remove();
  build(box, close);
  const scrim = h('div', { class: 'scrim', onmousedown: e => { if (e.target === scrim) close(); } }, box);
  layer().append(scrim);
  return close;
}
function popup(el, x, y) {
  el.style.visibility = 'hidden'; layer().append(el);
  const r = el.getBoundingClientRect();
  el.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
  el.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
  el.style.visibility = '';
}
function menu(x, y, items) {
  closeOverlays();
  const m = h('div', { class: 'menu' }, items.map(it => it === '-' ? h('hr') : h('button', { class: (it.danger ? 'danger ' : '') + (it.on ? 'on' : ''), onclick: () => { closeOverlays(); it.fn(); } }, it.dot ? h('i', { class: 'sdot ' + it.dot }) : null, h('span', { style: 'flex:1' }, it.label), it.icon ? svgEl(it.icon) : (it.on ? svgEl('check') : null))));
  popup(m, x, y);
}
document.addEventListener('mousedown', e => {
  if (!e.target.closest('.menu, .card, .modal, .emoji-pop, [data-keep]')) for (const el of [...layer().children]) if (/\b(menu|card|emoji-pop)\b/.test(el.className)) el.remove();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOverlays(); });

const STD_EMOJI = '😀 😂 🤣 😊 😍 😎 🤔 😅 😭 😡 😴 🥳 👍 👎 👏 🙏 💪 🔥 ✨ ❤️ 💀 👀 🎉 🌟 🎮 🎵 🍕 🍔 ☕ 🏆 🚀 💯 ✅ ❌ 😈 🤝 🫡 🥲 😤 🤯 😬 🙃 😇 🤠 🧠 👾 🐪 🌵'.split(' ');
function emojiPicker(anchor, onPick) {
  closeOverlays();
  const el = h('div', { class: 'emoji-pop', 'data-keep': 1 });
  const pick = e => { el.remove(); onPick(e); };
  el.append(h('div', { class: 'lab' }, 'Emoji'), h('div', { class: 'grid' }, STD_EMOJI.map(e => h('button', { onclick: () => pick(e) }, e))));
  for (const srv of Servers.list) {
    const mine = [...Servers.emoji.values()].filter(c => c.sid === srv.id);
    const here = S.sel === srv.id;
    if (!mine.length && !here) continue;
    el.append(h('div', { class: 'lab' }, srv.name, here ? h('button', { onclick: () => { el.remove(); addEmojiFlow(srv.id); } }, '+ Add emoji') : null),
      h('div', { class: 'grid' }, mine.map(c => h('button', { title: ':' + c.name + ':', onclick: () => pick(':' + c.name + ':') }, h('img', { class: 'cemoji', src: c.img })))));
  }
  const r = anchor.getBoundingClientRect();
  layer().append(el);
  const w = el.getBoundingClientRect();
  el.style.left = Math.max(8, Math.min(r.right - w.width, innerWidth - w.width - 8)) + 'px';
  el.style.top = Math.max(8, r.top - w.height - 8) + 'px';
}
async function addEmojiFlow(sid) {
  const f = await pickFile();
  if (!f) return;
  try {
    limit('emoji');
    const img = await shrinkImage(f, { max: 96, maxChars: 70000 });
    const base = f.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20) || 'emoji';
    const name = await Servers.addEmoji(sid, base.length < 2 ? base + 'x' : base, img);
    toast(`Added :${name}: — type it in a message.`, 'ok');
  } catch (e) { fail(e); }
}
function lightbox(src) {
  const el = h('div', { class: 'lightbox', onclick: () => el.remove() }, h('img', { src }));
  document.body.append(el);
}

function profileCard(uid, id, x, y) {
  closeOverlays();
  const me = Account.user, isMe = uid === me.uid, friend = Friends.isFriend(uid), st = isMe ? S.status : Friends.statusOf(uid);
  const sid = S.sel !== 'home' ? S.sel : null, srv = sid && Servers.server(sid);
  const p = Profiles.forId(id) || Profiles.get(uid) || {};
  const name = nameOnly(id), iAmOwner = srv && srv.owner === me.uid, theyMod = srv && (srv.mods || []).includes(uid);
  const btn = (label, cls, fn) => h('button', { class: 'btn ' + cls, onclick: () => { closeOverlays(); fn(); } }, label);
  const btns = [];
  if (isMe) btns.push(btn('Edit profile', 'gold', () => settingsModal('profile')));
  if (!isMe && friend) { btns.push(btn('Message', 'gold', () => go('home', { kind: 'dm', uid }))); btns.push(btn('Call', 'green', () => startCall(uid))); }
  if (!isMe && !friend) btns.push(btn('Add friend', 'gold', () => { try { limit('friend'); } catch (e) { return fail(e); } Friends.addUid(uid, id).then(m => toast(m, 'ok')).catch(fail); }));
  const mod = [];
  if (iAmOwner && !isMe) {
    mod.push(btn(theyMod ? 'Remove moderator' : 'Make moderator', '', () => Servers.setMod(sid, uid, !theyMod).then(() => toast(theyMod ? `${name} is no longer a moderator.` : `${name} is a moderator now.`, 'ok')).catch(fail)));
    mod.push(btn('Remove', 'red', () => Servers.kick(sid, uid).then(() => toast(`${name} was removed.`, 'ok')).catch(fail)));
    mod.push(btn('Ban', 'red', () => confirmModal(`Ban ${name}?`, 'They are removed and can’t use an invite to come back until you unban them.', 'Ban', () => Servers.ban(sid, uid).then(() => toast(`${name} was banned.`, 'ok')).catch(fail))));
  }
  const status = (srv && srv.owner === uid ? '👑 Owner · ' : theyMod ? '🛡️ Moderator · ' : '') + (isMe ? STATUS_LABEL[S.status] : (STATUS_LABEL[st] || 'Offline')) + (p.status ? ' · ' + p.status : '');
  const card = h('div', { class: 'card' },
    h('div', { class: 'banner', style: p.banner ? `background-image:url('${p.banner}')` : `background:linear-gradient(135deg,${colorOf(id)},var(--bg2))` }),
    h('div', { class: 'in' }, avatar(id), h('h4', { style: `color:${nameColor(id)}` }, name),
      h('div', { class: 'st' }, status),
      p.bio ? h('div', { class: 'bio' }, p.bio) : null,
      btns.length ? h('div', { class: 'btns' }, btns) : null,
      mod.length ? h('div', { class: 'btns wrap' }, mod) : null));
  popup(card, x, y);
}

// ---------------------------------------------------------------- calls
async function startCall(uid) {
  const f = Friends.list.find(x => x.uid === uid && x.status === 'accepted');
  if (!f) return;
  try { limit('call'); } catch (e) { return fail(e); }
  go('home', { kind: 'dm', uid });
  try { await Calls.call(f.pair, nameOnly(f.id)); applyJoinMuted(); } catch (e) { fail(e); }
}
function applyJoinMuted() { if (Prefs.get('joinMuted') && Voice.room && !Voice.muted) Voice.setMuted(true); }
async function joinVoice(sid, cid) {
  const ch = Servers.channelsOf(sid).find(c => c.id === cid), srv = Servers.server(sid);
  if (!ch) return;
  const path = Servers.channelPath(sid, cid);
  if (Voice.isIn(path)) return;
  if (Calls.outgoing) await Calls.hangup();
  await Voice.join(path, `${ch.name} · ${srv?.name || ''}`, 'channel', Account.user);
  if (Voice.error) toast(Voice.error, 'err');
  applyJoinMuted();
}
async function leaveVoice() {
  if (Voice.room?.kind === 'call') await Calls.hangup(); else await Voice.leave();
}

let lastRoster = new Set();
Voice.onChange = () => {
  const now = new Set(Voice.participants.keys());
  if (Voice.room && lastRoster.size) {
    for (const u of now) if (!lastRoster.has(u) && u !== Account.user?.uid) sfx.join();
    for (const u of lastRoster) if (!now.has(u) && u !== Account.user?.uid) sfx.leave();
  }
  lastRoster = Voice.room ? now : new Set();
  schedule();
};
Calls.onDeclined = () => { toast('Call ended.'); Calls.hangup(); };

// Screen sharing: choose what to share, then hand it to the voice engine
async function shareFlow() {
  if (!Voice.room) return;
  if (Voice.sharing) return Voice.stopShare();
  if (!host.screens) {
    try { const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false }); await Voice.startShare(stream); } catch (e) { if (e?.name !== 'NotAllowedError') fail(e); }
    return;
  }
  let sources = [];
  try { sources = await host.screens(); } catch (e) { return fail(e); }
  if (!sources.length) return toast('Nothing to share was found.', 'err');
  modal((box, close) => {
    let chosen = sources.find(s => s.screen) || sources[0], quality = '1080-30';
    const grid = h('div', { class: 'sources' });
    const paint = () => grid.replaceChildren(...sources.map(s => h('button', { class: 'source' + (s.id === chosen.id ? ' sel' : ''), onclick: () => { chosen = s; paint(); } },
      h('div', { class: 'thumb', style: s.thumb ? `background-image:url('${s.thumb}')` : '' }), h('span', {}, s.screen ? '🖥️ ' + s.name : s.name))));
    paint();
    const sel = h('select', { onchange: e => { quality = e.target.value; } },
      ...[['720-30', '720p · 30 fps (light)'], ['1080-30', '1080p · 30 fps'], ['1080-60', '1080p · 60 fps (smooth)']].map(([v, l]) => h('option', { value: v, selected: v === quality }, l)));
    box.append(h('h2', {}, 'Share your screen'), h('p', { class: 'sub' }, 'Everyone in the room can watch. Pick a whole screen or a single window.'), grid,
      h('label', { class: 'f', style: 'margin-top:14px' }, 'Quality', sel),
      h('div', { class: 'foot' }, h('button', { class: 'btn ghost', onclick: close }, 'Cancel'),
        h('button', { class: 'btn gold', onclick: async () => {
          const [hgt, fps] = quality.split('-').map(Number), w = Math.round(hgt * 16 / 9);
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: chosen.id, maxWidth: w, maxHeight: hgt, maxFrameRate: fps } } });
            close(); await Voice.startShare(stream);
          } catch (e) { fail(e); }
        } }, 'Start sharing')));
  }, 'wide');
}

// ---------------------------------------------------------------- server strip (top)
function renderRail() {
  const rail = $('#rail');
  const dmUnread = friendsAccepted().filter(f => DMs.unread(f.uid)).length + Friends.list.filter(f => f.incoming).length;
  const items = [];
  items.push(h('button', { class: 'rail-btn home' + (S.sel === 'home' ? ' active' : ''), title: 'Home', onclick: () => { go('home', S.view.kind === 'dm' || S.view.kind === 'friends' ? S.view : { kind: 'friends' }); if (isMobile()) S.mview = 'nav'; } },
    camelSvg(26), dmUnread ? h('span', { class: 'badge' }, dmUnread) : null));
  items.push(h('div', { class: 'rail-sep' }));
  for (const s of Servers.list) {
    const unread = Servers.unreadServer(s.id) && S.sel !== s.id && !Servers.isMuted(s.id), active = S.sel === s.id;
    const style = s.img ? `background-image:linear-gradient(rgba(0,0,0,.25),rgba(0,0,0,.25)),url('${s.img}')` : `background-color:${s.color || COLORS[0]}`;
    items.push(h('button', { class: 'rail-btn' + (active ? ' active' : '') + (unread ? ' unread' : '') + (Servers.isMuted(s.id) ? ' muted' : ''), title: s.name + (Servers.isMuted(s.id) ? ' (muted)' : ''), style, onclick: () => openServer(s.id),
      oncontextmenu: e => { e.preventDefault(); menu(e.clientX, e.clientY, [{ label: Servers.isMuted(s.id) ? 'Unmute server' : 'Mute server', icon: Servers.isMuted(s.id) ? 'bell' : 'bellOff', fn: () => Servers.toggleMuted(s.id) }, { label: 'Invite people', icon: 'userplus', fn: () => inviteModal(s) }, { label: 'Server info', icon: 'sliders', fn: () => serverSettingsModal(s, 'info') }]); } },
      s.img ? null : (s.icon || nameOnly(s.name)[0]), active ? h('span', { class: 'nm' }, s.name) : null));
  }
  items.push(h('button', { class: 'rail-btn add', title: 'Create a server', onclick: createServerModal }, '+'));
  items.push(h('button', { class: 'rail-btn join', title: 'Join a server with an invite code', onclick: joinServerModal }, svgEl('compass')));
  rail.replaceChildren(...items);
}

// ---------------------------------------------------------------- left column
function statusMenu(e) {
  const r = e.currentTarget.getBoundingClientRect();
  const opt = (key, dot) => ({ label: STATUS_LABEL[key], dot, on: S.status === key, fn: () => setStatus(key) });
  menu(r.left, r.bottom + 6, [opt('online', 'online'), opt('idle', 'idle'), opt('dnd', 'dnd'), opt('invisible', 'offline'), '-',
    { label: 'Edit profile', icon: 'edit', fn: () => settingsModal('profile') }, { label: 'Settings', icon: 'sliders', fn: () => settingsModal() }]);
}
function userBar() {
  const me = Account.user;
  const dot = S.status === 'invisible' ? 'offline' : S.status;
  return h('div', { class: 'userbar' },
    h('div', { class: 'who', title: 'Set your status', onclick: statusMenu }, avatar(me.id, '', dot),
      h('div', {}, h('b', {}, nameOnly(me.id)), h('span', {}, profileStatus(me.id) || STATUS_LABEL[S.status]))),
    h('button', { class: 'ibtn' + (Voice.muted ? ' on' : ''), title: Voice.muted ? 'Unmute' : 'Mute', onclick: () => Voice.setMuted(!Voice.muted) }, svgEl(Voice.muted ? 'micoff' : 'mic')),
    h('button', { class: 'ibtn' + (Voice.deafened ? ' on' : ''), title: Voice.deafened ? 'Undeafen' : 'Deafen', onclick: () => Voice.setDeafened(!Voice.deafened) }, svgEl(Voice.deafened ? 'headoff' : 'head')),
    h('button', { class: 'ibtn settings', title: 'Settings', onclick: () => settingsModal() }, svgEl('sliders')));
}
function voiceBar() {
  if (!Voice.room) return null;
  const connecting = Voice.state === 'connecting';
  const peers = [...Voice.conn.values()];
  const live = peers.length && peers.every(s => s === 'connected');
  const text = connecting ? 'Connecting…' : (Voice.room.kind === 'call' ? (live ? 'Call connected' : (Voice.participants.size > 1 ? 'Connecting…' : 'Calling…')) : (peers.length && !live ? 'Connecting…' : 'Voice connected'));
  return h('div', { class: 'voicebar' + (connecting ? ' connecting' : '') },
    h('div', { class: 'top' }, svgEl('signal', 'signal'),
      h('div', { class: 'st' }, h('b', {}, text), h('span', {}, Voice.room.label)),
      canShare() ? h('button', { class: 'ibtn' + (Voice.sharing ? ' sel' : ''), title: Voice.sharing ? 'Stop sharing' : 'Share your screen', onclick: shareFlow }, svgEl('monitor')) : null,
      h('button', { class: 'ibtn red', title: 'Disconnect', onclick: leaveVoice }, svgEl('phone', 'hang'))));
}

function renderSide() {
  const side = $('#side'), me = Account.user;
  let head, scroll;
  if (S.sel === 'home') {
    const incoming = Friends.list.filter(f => f.incoming).length;
    head = h('div', { class: 'side-head static' }, h('span', { class: 'name' }, 'Home'));
    const rows = [
      h('div', { class: 'row' + (S.view.kind === 'friends' ? ' active' : ''), onclick: () => go('home', { kind: 'friends' }) }, svgEl('users'), h('span', { class: 'label' }, 'Friends'), incoming ? h('span', { class: 'badge', style: 'position:static;border:0' }, incoming) : null),
      h('div', { class: 'side-label' }, 'Messages')
    ];
    const friends = friendsAccepted().sort((a, b) => {
      const la = DMs.last.get(a.uid)?.at || 0, lb = DMs.last.get(b.uid)?.at || 0;
      if (la !== lb) return lb - la;
      return (Friends.statusOf(a.uid) === 'offline') - (Friends.statusOf(b.uid) === 'offline') || a.id.localeCompare(b.id);
    });
    if (!friends.length) rows.push(h('div', { class: 'empty' }, 'No friends yet. Add someone by their username on the Friends page.'));
    for (const f of friends) {
      const st = Friends.statusOf(f.uid), inCall = Voice.room?.path === `cc_calls/${f.pair}`;
      rows.push(h('div', { class: 'row' + (S.view.kind === 'dm' && S.view.uid === f.uid ? ' active' : '') + (DMs.unread(f.uid) ? ' unread' : ''), onclick: () => go('home', { kind: 'dm', uid: f.uid }) },
        avatar(f.id, '', st),
        h('div', { class: 'label' }, nameOnly(f.id), h('span', { class: 'sub' }, inCall ? 'In a call' : (profileStatus(f.id) || STATUS_LABEL[st]))),
        h('div', { class: 'acts' }, h('button', { title: 'Call', onclick: e => { e.stopPropagation(); startCall(f.uid); } }, svgEl('phone')))));
    }
    scroll = h('div', { class: 'side-scroll' }, rows);
  } else {
    const srv = Servers.server(S.sel);
    if (!srv) { side.replaceChildren(userBar()); return; }
    const owner = srv.owner === me.uid, cfg = Servers.botsOf(srv.id);
    head = h('div', { class: 'side-head', onclick: e => serverMenu(srv, e.currentTarget.getBoundingClientRect()) }, h('span', { class: 'name' }, srv.name), svgEl('chev'));
    const chans = Servers.channelsOf(srv.id), text = chans.filter(c => c.kind === 'text'), voice = chans.filter(c => c.kind === 'voice');
    const rows = [];
    const label = (t, kind, extra) => h('div', { class: 'side-label' }, t, extra || (owner && kind ? h('button', { title: 'Add a room', onclick: () => channelModal(srv.id, kind) }, svgEl('plus')) : null));
    rows.push(label('Chat rooms', 'text'));
    for (const c of text) rows.push(h('div', { class: 'row ch' + (S.view.kind === 'text' && S.view.cid === c.id ? ' active' : '') + (Servers.unread(srv.id, c.id) ? ' unread' : ''), onclick: () => go(srv.id, { kind: 'text', sid: srv.id, cid: c.id }), oncontextmenu: e => { e.preventDefault(); channelMenu(e, srv, c); } },
      svgEl(c.announce ? 'announce' : 'room'), h('span', { class: 'label' }, c.name), c.slow ? h('span', { class: 'slowtag', title: `Slowmode: ${c.slow}s` }, c.slow + 's') : null));
    rows.push(label('Voice rooms', 'voice'));
    for (const c of voice) {
      const path = Servers.channelPath(srv.id, c.id), people = Servers.voiceOf(srv.id, c.id), here = Voice.isIn(path);
      rows.push(h('div', { class: 'row ch' + (S.view.kind === 'voice' && S.view.cid === c.id ? ' active' : '') + (here ? ' live' : ''), onclick: () => { go(srv.id, { kind: 'voice', sid: srv.id, cid: c.id }); joinVoice(srv.id, c.id); }, oncontextmenu: e => { e.preventDefault(); channelMenu(e, srv, c); } },
        svgEl('volume'), h('span', { class: 'label' }, c.name)));
      if (people.length) rows.push(h('div', { class: 'vusers' }, people.map(p => {
        const talking = here && Voice.speaking.has(p.uid);
        return h('div', { class: 'vuser' }, avatar(p.id || '', 'sm' + (talking ? ' talk' : '')),
          h('span', { class: 'name' }, nameOnly(p.id)), p.screen ? svgEl('monitor') : null, p.deafened ? svgEl('headoff') : p.muted ? svgEl('micoff') : null);
      })));
    }
    if (cfg.tickets) {
      const mods = Servers.isMod(srv.id), tix = Servers.ticketsOf(srv.id), open = tix.filter(t => t.status === 'open');
      rows.push(label(mods ? 'Support tickets' : 'My tickets', null, h('button', { title: 'Open a ticket', onclick: () => ticketModal(srv.id) }, svgEl('plus'))));
      for (const t of open) rows.push(h('div', { class: 'row ch' + (S.view.kind === 'ticket' && S.view.cid === 't_' + t.id ? ' active' : ''), onclick: () => go(srv.id, { kind: 'ticket', sid: srv.id, cid: 't_' + t.id }) },
        svgEl('ticket'), h('div', { class: 'label' }, t.subject, mods && t.by !== me.uid ? h('span', { class: 'sub' }, 'from ' + nameOnly(t.byId)) : null)));
      if (!open.length) rows.push(h('div', { class: 'empty small' }, mods ? 'No open tickets.' : 'Need help from the owner? Open a ticket.'));
    }
    if (!chans.length) rows.push(h('div', { class: 'empty' }, 'Loading rooms…'));
    scroll = h('div', { class: 'side-scroll' }, rows);
  }
  side.replaceChildren(...[userBar(), head, scroll, voiceBar()].filter(Boolean));
}
function serverMenu(srv, rect) {
  const owner = srv.owner === Account.user.uid;
  const items = [{ label: 'Invite people', icon: 'userplus', fn: () => inviteModal(srv) }];
  if (owner) items.push({ label: 'Server settings', icon: 'sliders', fn: () => serverSettingsModal(srv, 'general') });
  else items.push({ label: 'Server info', icon: 'sliders', fn: () => serverSettingsModal(srv, 'info') });
  if (owner) items.push({ label: 'Add a chat room', icon: 'room', fn: () => channelModal(srv.id, 'text') }, { label: 'Add a voice room', icon: 'volume', fn: () => channelModal(srv.id, 'voice') });
  items.push({ label: 'Add custom emoji', icon: 'smile', fn: () => addEmojiFlow(srv.id) });
  items.push({ label: Servers.isMuted(srv.id) ? 'Unmute server' : 'Mute server', icon: Servers.isMuted(srv.id) ? 'bell' : 'bellOff', fn: () => Servers.toggleMuted(srv.id) });
  items.push('-');
  items.push(owner ? { label: 'Delete server', icon: 'trash', danger: true, fn: () => confirmModal(`Delete ${srv.name}?`, 'This removes the server, its rooms and every message for everyone. This cannot be undone.', 'Delete server', () => Servers.remove(srv.id).then(() => { go('home', { kind: 'friends' }); toast('Server deleted.', 'ok'); }).catch(fail)) }
    : { label: 'Leave server', icon: 'logout', danger: true, fn: () => confirmModal(`Leave ${srv.name}?`, "You'll need a new invite to come back.", 'Leave server', () => { if (Voice.room?.path.startsWith(`cc_servers/${srv.id}/`)) Voice.leave(); Servers.leave(srv.id).then(() => go('home', { kind: 'friends' })).catch(fail); }) });
  menu(rect.left + 8, rect.bottom + 4, items);
}
function channelMenu(e, srv, c) {
  if (srv.owner !== Account.user.uid) return;
  menu(e.clientX, e.clientY, [
    { label: 'Rename room', icon: 'edit', fn: () => promptModal('Rename room', 'Room name', c.name, 'Rename', v => Servers.renameChannel(srv.id, c.id, v)) },
    ...(c.kind === 'text' ? [{ label: 'Slowmode…', icon: 'signal', fn: () => serverSettingsModal(srv, 'rooms') }] : []),
    '-',
    { label: 'Delete room', icon: 'trash', danger: true, fn: () => confirmModal(`Delete ${c.name}?`, 'Everything in this room will be gone for everyone.', 'Delete room', () => Servers.deleteChannel(srv.id, c.id).catch(fail)) }]);
}

// ---------------------------------------------------------------- center
function initCenter() {
  const c = $('#center');
  c.replaceChildren(h('div', { class: 'head', id: 'c-head' }), h('div', { class: 'searchbar hidden', id: 'c-search' }), h('div', { class: 'page hidden', id: 'c-page' }), h('div', { class: 'stage hidden', id: 'c-stage' }), h('div', { class: 'msgs hidden', id: 'c-msgs' }), h('div', { class: 'composer hidden', id: 'c-comp' }));
  $('#c-search').append(svgEl('search'), h('input', { id: 'c-search-in', placeholder: 'Search this room', oninput: e => { S.search = e.target.value.trim().toLowerCase(); schedule(); } }),
    h('button', { class: 'ibtn', title: 'Close search', onclick: () => { S.searchOpen = false; S.search = ''; schedule(); } }, svgEl('x')));
  const ta = h('textarea', { id: 'c-input', rows: 1, maxlength: 4000,
    onkeydown: e => {
      const enter = e.key === 'Enter';
      if (enter && ((Prefs.get('enterToSend') && !e.shiftKey) || (!Prefs.get('enterToSend') && e.ctrlKey))) { e.preventDefault(); sendMessage(); }
      else if (e.key === 'ArrowUp' && !ta.value) editLast();
    },
    oninput: autoGrow,
    onpaste: e => { const f = [...(e.clipboardData?.files || [])].find(x => x.type.startsWith('image/')); if (f) { e.preventDefault(); attachFile(f); } } });
  $('#c-comp').append(h('div', { id: 'c-att' }), h('div', { class: 'box' },
    h('button', { class: 'ibtn', title: 'Send a picture or GIF', onclick: async () => { const f = await pickFile(); if (f) attachFile(f); } }, svgEl('image')),
    h('button', { class: 'ibtn', id: 'c-tools', 'data-keep': 1, title: 'Giveaway, poll, ticket and commands', onclick: appsMenu }, svgEl('gift')),
    ta,
    h('button', { class: 'ibtn', 'data-keep': 1, title: 'Emoji', onclick: e => emojiPicker(e.currentTarget, ins => { ta.setRangeText(ins, ta.selectionStart, ta.selectionEnd, 'end'); ta.focus(); autoGrow(); }) }, svgEl('smile')),
    h('button', { class: 'ibtn send', title: 'Send', onclick: sendMessage }, svgEl('send'))));
  let depth = 0;
  c.addEventListener('dragenter', e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { depth++; if (depth === 1) c.append(h('div', { class: 'drop', id: 'c-drop' }, 'Drop the picture to send it')); } });
  c.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) $('#c-drop')?.remove(); });
  c.addEventListener('dragover', e => e.preventDefault());
  c.addEventListener('drop', e => { e.preventDefault(); depth = 0; $('#c-drop')?.remove(); const f = [...(e.dataTransfer?.files || [])].find(x => x.type.startsWith('image/')); if (f && !$('#c-comp').classList.contains('hidden')) attachFile(f); });
}
function autoGrow() { const t = $('#c-input'); t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 180) + 'px'; }
async function attachFile(file) {
  try {
    limit('upload');
    S.attach = await shrinkImage(file, { max: 1600, quality: 0.82, maxChars: 880000 });
    paintAttach();
  } catch (e) { toast(e.message || 'Could not use that picture.', 'err'); }
}
function paintAttach() {
  const el = $('#c-att');
  el.replaceChildren(...(S.attach ? [h('div', { class: 'att-chip' }, h('img', { src: S.attach }), h('button', { class: 'ibtn', title: 'Remove', onclick: () => { S.attach = ''; paintAttach(); } }, svgEl('x')))] : []));
}
function appsMenu(e) {
  const r = e.currentTarget.getBoundingClientRect(), inServer = S.sel !== 'home' && (S.view.kind === 'text');
  const items = [];
  if (inServer) {
    items.push({ label: 'Start a giveaway', icon: 'gift', fn: () => giveawayModal() }, { label: 'Create a poll', icon: 'poll', fn: () => pollModal() });
    if (Servers.botsOf(S.sel).tickets) items.push({ label: 'Open a support ticket', icon: 'ticket', fn: () => ticketModal(S.sel) });
    items.push('-');
  }
  items.push({ label: 'Commands', icon: 'sliders', fn: commandsModal });
  menu(r.left, r.top - 8 - items.length * 38, items);
}

// ---- slash commands
const COMMANDS = [
  ['/roll 2d6', 'Roll dice (or /roll 20)'], ['/flip', 'Flip a coin'], ['/8ball question', 'Ask the magic 8-ball'],
  ['/shrug', 'Add ¯\\_(ツ)_/¯'], ['/me waves', 'Say something in third person'],
  ['/giveaway 10m Prize', 'Start a giveaway (10m, 2h, 1d…)'], ['/poll 1h Question | A | B', 'Start a poll'],
  ['/ticket subject', 'Open a support ticket'], ['/slowmode 10', 'Slowmode for this room in seconds (owner)'], ['/clear 5', 'Delete the last messages (moderators)']
];
function commandsModal() {
  modal((box, close) => box.append(h('h2', {}, 'Commands'), h('p', { class: 'sub' }, 'Type these in any chat room.'),
    ...COMMANDS.map(([c, d]) => h('div', { class: 'cmd' }, h('code', {}, c), h('span', {}, d))),
    h('div', { class: 'foot' }, h('button', { class: 'btn', onclick: close }, 'Done'))));
}
const BALL = ['It is certain.', 'Without a doubt.', 'Yes, definitely.', 'Most likely.', 'Outlook good.', 'Ask again later.', 'Cannot predict now.', "Don't count on it.", 'My reply is no.', 'Very doubtful.'];
// Returns the text to send instead, or null when the command was handled here
async function runCommand(raw, inServer) {
  const [cmd, ...rest] = raw.slice(1).split(/\s+/), arg = rest.join(' ').trim(), me = nameOnly(Account.user.id), lc = cmd.toLowerCase();
  const v = S.view, sid = v.sid;
  switch (lc) {
    case 'help': case 'commands': commandsModal(); return null;
    case 'flip': return `🪙 ${me} flipped ${Math.random() < 0.5 ? 'heads' : 'tails'}`;
    case 'roll': {
      const m = /^(\d{1,2})?d(\d{1,3})$/i.exec(arg || 'd6'), n = /^\d{1,4}$/.test(arg) ? +arg : 0;
      if (n) return `🎲 ${me} rolled ${1 + Math.floor(Math.random() * n)} (1–${n})`;
      if (!m) { toast('Try /roll 2d6 or /roll 20', 'err'); return null; }
      const count = +(m[1] || 1), sides = +m[2], rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
      return `🎲 ${me} rolled ${rolls.reduce((a, b) => a + b, 0)} (${rolls.join(' + ')})`;
    }
    case '8ball': return `🎱 ${arg ? arg + ' → ' : ''}${BALL[Math.floor(Math.random() * BALL.length)]}`;
    case 'shrug': return `${arg ? arg + ' ' : ''}¯\\_(ツ)_/¯`;
    case 'me': return arg ? `*${me} ${arg}*` : null;
    case 'giveaway': case 'poll': case 'ticket': case 'slowmode': case 'clear': {
      if (!inServer) { toast('That command works in a server room.', 'err'); return null; }
      if (lc === 'ticket') { await openTicket(sid, arg); return null; }
      if (lc === 'giveaway') {
        const [dur, ...p] = arg.split(/\s+/), ms = parseDuration(dur), prize = p.join(' ');
        if (!ms || !prize) { toast('Try /giveaway 10m Cool prize', 'err'); return null; }
        await createGiveaway(sid, v.cid, prize, ms); return null;
      }
      if (lc === 'poll') {
        let ms = 0, body = arg; const first = arg.split(/\s+/)[0];
        if (parseDuration(first)) { ms = parseDuration(first); body = arg.slice(first.length).trim(); }
        const parts = body.split('|').map(x => x.trim()).filter(Boolean);
        if (parts.length < 3) { toast('Try /poll Question | Option A | Option B', 'err'); return null; }
        await createPoll(sid, v.cid, parts[0], parts.slice(1, 7), ms); return null;
      }
      if (lc === 'slowmode') {
        if (!Servers.isOwner(sid)) { toast('Only the owner can set slowmode.', 'err'); return null; }
        const secs = parseInt(arg, 10); if (isNaN(secs)) { toast('Try /slowmode 10 (or 0 to turn it off)', 'err'); return null; }
        await Servers.setSlow(sid, v.cid, secs); toast(secs ? `Slowmode: ${secs}s` : 'Slowmode off.', 'ok'); return null;
      }
      if (lc === 'clear') {
        if (!Servers.isMod(sid)) { toast('Only moderators can do that.', 'err'); return null; }
        const n = Math.max(1, Math.min(50, parseInt(arg, 10) || 5)), list = Servers.messages.slice(-n);
        await Promise.all(list.map(m => Servers.deleteMessage(sid, v.cid, m.id).catch(() => {})));
        toast(`Deleted ${list.length} messages.`, 'ok'); return null;
      }
      return null;
    }
    default: toast(`Unknown command /${cmd}. Try /help.`, 'err'); return null;
  }
}

async function sendMessage() {
  const ta = $('#c-input'), raw = ta.value.trim(), img = S.attach;
  if (!raw && !img) return;
  const inServer = S.view.kind === 'text', inTicket = S.view.kind === 'ticket', inDM = S.view.kind === 'dm';
  let text = raw;
  try {
    if (raw.startsWith('/') && !img && (inServer || inDM || inTicket)) {
      ta.value = ''; autoGrow();
      text = await runCommand(raw, inServer);
      if (text == null) return;
    }
    limit('message');
  } catch (e) { fail(e); return; }
  ta.value = ''; autoGrow(); S.attach = ''; paintAttach();
  try {
    if (inDM) await DMs.send(text, img);
    else if (inServer || inTicket) await Servers.send(text, img);
  } catch (e) { ta.value = raw; S.attach = img; paintAttach(); autoGrow(); toast(e.code === 'permission-denied' ? msgDenied() : nice(e), 'err'); }
}
function msgDenied() {
  const v = S.view;
  if (v.kind === 'text') {
    const c = Servers.channelsOf(v.sid).find(x => x.id === v.cid);
    if (c?.announce && !Servers.isMod(v.sid)) return 'Only moderators can post in this announcement room.';
    if (c?.slow) return `Slowmode is on: wait ${c.slow}s between messages.`;
  }
  return 'Slow down a little (or you were removed from this chat).';
}

// Up arrow in an empty box edits your last message
function editLast() {
  const me = Account.user.uid, list = S.view.kind === 'dm' ? DMs.messages : Servers.messages;
  const mine = [...list].reverse().find(m => m.from === me && !m.bot && !m.pending);
  if (mine) editModal(mine);
}
function editModal(m) {
  modal((box, close) => {
    const ta = h('textarea', { rows: 4, maxlength: 4000, style: 'width:100%;resize:vertical' }); ta.value = m.text;
    const save = async () => {
      try {
        limit('edit');
        if (S.view.kind === 'dm') await DMs.edit(m.id, ta.value); else await Servers.edit(S.view.sid, S.view.cid, m.id, ta.value);
        close();
      } catch (e) { fail(e); }
    };
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } });
    box.append(h('h2', {}, 'Edit message'), h('p', { class: 'sub' }, 'Press Enter to save.'), ta,
      h('div', { class: 'foot' }, h('button', { class: 'btn ghost', onclick: close }, 'Cancel'), h('button', { class: 'btn gold', onclick: save }, 'Save')));
    setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 0);
  });
}

// ---- giveaways, polls, tickets
const DURS = [['1m', '1 minute'], ['10m', '10 minutes'], ['1h', '1 hour'], ['6h', '6 hours'], ['1d', '1 day'], ['3d', '3 days'], ['1w', '1 week']];
async function createGiveaway(sid, cid, prize, ms) {
  limit('app');
  await Servers.startApp(sid, cid, { type: 'giveaway', title: prize.slice(0, 100), prize: prize.slice(0, 100), endsAt: Date.now() + ms, entrants: [] });
}
async function createPoll(sid, cid, question, options, ms) {
  limit('app');
  await Servers.startApp(sid, cid, { type: 'poll', title: question.slice(0, 110), options: options.map(o => o.slice(0, 60)), votes: {}, endsAt: ms ? Date.now() + ms : 0 });
}
async function openTicket(sid, subject) {
  limit('ticket');
  const cid = await Servers.newTicket(sid, subject);
  toast('Ticket opened. The owner can see it now.', 'ok');
  go(sid, { kind: 'ticket', sid, cid });
}
function giveawayModal() {
  const sid = S.view.sid, cid = S.view.cid;
  if (!Servers.isMod(sid) && !Servers.botsOf(sid).giveawayAnyone) return toast('Only moderators can start giveaways in this server.', 'err');
  modal((box, close) => {
    const prize = h('input', { maxlength: 100, placeholder: 'A gift card, a game key, bragging rights…' });
    let dur = '1h';
    const sel = h('select', { onchange: e => { dur = e.target.value; } }, ...DURS.map(([v, l]) => h('option', { value: v, selected: v === dur }, l)));
    box.append(h('h2', {}, '🎉 Start a giveaway'), h('p', { class: 'sub' }, 'Everyone in the server can press Enter. When time is up a random entrant wins.'),
      h('label', { class: 'f' }, 'Prize', prize), h('label', { class: 'f' }, 'Runs for', sel),
      h('div', { class: 'foot' }, h('button', { class: 'btn ghost', onclick: close }, 'Cancel'),
        h('button', { class: 'btn gold', onclick: async () => { if (!prize.value.trim()) return toast('What is the prize?', 'err'); try { await createGiveaway(sid, cid, prize.value.trim(), parseDuration(dur)); close(); } catch (e) { fail(e); } } }, 'Start')));
    setTimeout(() => prize.focus(), 0);
  });
}
function pollModal() {
  const sid = S.view.sid, cid = S.view.cid;
  modal((box, close) => {
    const q = h('input', { maxlength: 110, placeholder: 'What should we play tonight?' });
    const opts = [h('input', { maxlength: 60, placeholder: 'Option 1' }), h('input', { maxlength: 60, placeholder: 'Option 2' })];
    const list = h('div', { style: 'display:grid;gap:8px;margin-bottom:10px' }, ...opts);
    let dur = '0';
    const sel = h('select', { onchange: e => { dur = e.target.value; } }, h('option', { value: '0' }, 'No time limit'), ...DURS.slice(2).map(([v, l]) => h('option', { value: v }, l)));
    box.append(h('h2', {}, '📊 Create a poll'), h('p', { class: 'sub' }, ''), h('label', { class: 'f' }, 'Question', q), list,
      h('button', { class: 'btn', onclick: () => { if (opts.length < 6) { const i = h('input', { maxlength: 60, placeholder: 'Option ' + (opts.length + 1) }); opts.push(i); list.append(i); i.focus(); } } }, '+ Add option'),
      h('label', { class: 'f', style: 'margin-top:14px' }, 'Closes after', sel),
      h('div', { class: 'foot' }, h('button', { class: 'btn ghost', onclick: close }, 'Cancel'),
        h('button', { class: 'btn gold', onclick: async () => {
          const options = opts.map(o => o.value.trim()).filter(Boolean);
          if (!q.value.trim() || options.length < 2) return toast('A poll needs a question and at least two options.', 'err');
          try { await createPoll(sid, cid, q.value.trim(), options, dur === '0' ? 0 : parseDuration(dur)); close(); } catch (e) { fail(e); }
        } }, 'Create')));
    setTimeout(() => q.focus(), 0);
  });
}
function ticketModal(sid) {
  modal((box, close) => {
    const subject = h('input', { maxlength: 80, placeholder: 'What do you need help with?' });
    const go2 = async () => { if (!subject.value.trim()) return; try { await openTicket(sid, subject.value.trim()); close(); } catch (e) { fail(e); } };
    subject.addEventListener('keydown', e => { if (e.key === 'Enter') go2(); });
    box.append(h('h2', {}, '🎫 Open a ticket'), h('p', { class: 'sub' }, 'A private chat between you and the server’s moderators. Nobody else can see it.'),
      h('label', { class: 'f' }, 'Subject', subject), h('div', { class: 'foot' }, h('button', { class: 'btn ghost', onclick: close }, 'Cancel'), h('button', { class: 'btn gold', onclick: go2 }, 'Open ticket')));
    setTimeout(() => subject.focus(), 0);
  });
}

// ---- the app cards inside messages
function appCard(m, ctx) {
  const a = Servers.apps.get(m.app);
  if (!a) return h('div', { class: 'appcard gone' }, 'This giveaway or poll was removed.');
  const me = Account.user, mine = a.by === me.uid, mod = Servers.isMod(ctx.sid), open = a.status === 'open';
  const ctrl = [];
  if (open && (mine || mod)) ctrl.push(h('button', { class: 'btn', onclick: () => Servers.endApp(a.sid, a.id).catch(fail) }, a.type === 'giveaway' ? 'End now' : 'Close poll'));
  if (mine || mod) ctrl.push(h('button', { class: 'btn ghost', onclick: () => Servers.deleteApp(a.sid, a.id).catch(fail) }, 'Delete'));
  if (a.type === 'giveaway') {
    const entered = (a.entrants || []).includes(me.uid), winner = a.winner ? nameOnly(idOf(a.winner)) : '';
    return h('div', { class: 'appcard' },
      h('div', { class: 'ac-top' }, h('b', {}, '🎁 ' + a.prize), h('span', { class: 'ac-meta' }, open ? timeLeft(a.endsAt) : 'Ended')),
      open ? h('button', { class: 'btn ' + (entered ? '' : 'gold'), disabled: entered, onclick: () => { try { limit('react'); } catch (e) { return fail(e); } Servers.enterGiveaway(a.sid, a.id).catch(fail); } }, entered ? 'Entered ✓' : '🎉 Enter giveaway')
        : h('div', { class: 'ac-win' }, winner ? `🏆 ${winner} won!` : 'Nobody entered.'),
      h('div', { class: 'ac-meta' }, `${(a.entrants || []).length} ${(a.entrants || []).length === 1 ? 'entry' : 'entries'} · started by ${nameOnly(idOf(a.by))}`),
      ctrl.length ? h('div', { class: 'ac-ctrl' }, ctrl) : null);
  }
  const votes = a.votes || {}, total = Object.keys(votes).length, myVote = votes[me.uid];
  return h('div', { class: 'appcard' },
    h('div', { class: 'ac-top' }, h('b', {}, '📊 ' + a.title), h('span', { class: 'ac-meta' }, open ? (a.endsAt ? timeLeft(a.endsAt) : 'Open') : 'Closed')),
    ...(a.options || []).map((o, i) => {
      const n = Object.values(votes).filter(v => v === i).length, pct = total ? Math.round(n * 100 / total) : 0;
      return h('button', { class: 'pollopt' + (myVote === i ? ' mine' : ''), disabled: !open, onclick: () => { try { limit('react'); } catch (e) { return fail(e); } Servers.vote(a.sid, a.id, i).catch(fail); } },
        h('span', { class: 'bar', style: `width:${pct}%` }), h('span', { class: 'ol' }, o), h('span', { class: 'on' }, `${pct}% · ${n}`));
    }),
    h('div', { class: 'ac-meta' }, `${total} ${total === 1 ? 'vote' : 'votes'} · by ${nameOnly(idOf(a.by))}`),
    ctrl.length ? h('div', { class: 'ac-ctrl' }, ctrl) : null);
}

function viewKey() { const v = S.view; return v.kind + ':' + (v.uid || v.cid || v.sid || ''); }
function renderCenter() {
  const v = S.view, key = viewKey(), changed = key !== S.centerKey;
  const head = $('#c-head'), page = $('#c-page'), stage = $('#c-stage'), msgs = $('#c-msgs'), comp = $('#c-comp'), sbar = $('#c-search');
  if (changed) {
    const old = S.centerKey; if (old) drafts.set(old, $('#c-input').value);
    S.centerKey = key; $('#c-input').value = drafts.get(key) || ''; autoGrow(); S.firstFill = true; S.attach = ''; paintAttach();
    $('#c-search-in').value = '';
  }
  const me = Account.user;
  let showPage = false, showStage = false, mini = false, showMsgs = false, showComp = false;
  let title = [];
  const tools = [];
  const searchBtn = h('button', { class: 'ibtn' + (S.searchOpen ? ' sel' : ''), title: 'Search this room', onclick: () => { S.searchOpen = !S.searchOpen; if (!S.searchOpen) S.search = ''; schedule(); if (S.searchOpen) setTimeout(() => $('#c-search-in').focus(), 0); } }, svgEl('search'));
  const peopleBtn = S.sel !== 'home' ? h('button', { class: 'ibtn' + (S.hideMembers ? '' : ' sel'), title: 'Show or hide people', onclick: () => { if (isMobile()) S.peopleOpen = !S.peopleOpen; else { S.hideMembers = !S.hideMembers; store.set('cc.hidePeople', S.hideMembers ? '1' : '0'); } schedule(); } }, svgEl('users')) : null;
  if (v.kind === 'friends') {
    showPage = true;
    const incoming = Friends.list.filter(f => f.incoming).length;
    const tab = (id, label, extra) => h('button', { class: 'tab' + (S.tab === id ? ' active' : '') + (id === 'add' ? ' add' : ''), onclick: () => { S.tab = id; schedule(); } }, label, extra);
    title = [svgEl('users'), 'Friends', h('span', { class: 'sepv' }), tab('online', 'Online'), tab('all', 'All'), tab('pending', 'Pending', incoming ? h('span', { style: 'color:var(--red)' }, ` ${incoming}`) : null), tab('add', 'Add friend')];
    renderFriendsPage(page);
  } else if (v.kind === 'dm') {
    const f = Friends.list.find(x => x.uid === v.uid);
    const id = f?.id || idOf(v.uid), st = Friends.statusOf(v.uid), pair = pairOf(me.uid, v.uid);
    const inCall = Voice.room?.path === `cc_calls/${pair}`;
    title = [avatar(id, 'sm', st), nameOnly(id), h('span', { class: 'status' }, profileStatus(id) || STATUS_LABEL[st]), h('span', { class: 'grow' }), searchBtn,
      inCall ? h('button', { class: 'btn red', onclick: leaveVoice }, 'End call') : h('button', { class: 'ibtn', title: 'Start a voice call', onclick: () => startCall(v.uid) }, svgEl('phone'))];
    showMsgs = true; showComp = true;
    if (inCall) { showStage = true; mini = true; renderStage(stage, true); }
    renderMessages(msgs, DMs.messages, { sid: null }, nameOnly(id), DMs.error);
    $('#c-input').placeholder = `Message ${nameOnly(id)}`;
  } else if (v.kind === 'text') {
    const ch = Servers.channelsOf(v.sid).find(c => c.id === v.cid);
    const locked = ch?.announce && !Servers.isMod(v.sid);
    title = [svgEl(ch?.announce ? 'announce' : 'room'), ch?.name || '…', ch?.slow ? h('span', { class: 'topic' }, `Slowmode ${ch.slow}s`) : null, h('span', { class: 'grow' }), searchBtn, peopleBtn];
    showMsgs = true; showComp = !locked;
    renderMessages(msgs, Servers.messages, { sid: v.sid, cid: v.cid }, ch?.name || '', Servers.error);
    $('#c-input').placeholder = `Message ${ch?.name || 'room'}`;
  } else if (v.kind === 'ticket') {
    const t = Servers.ticketsOf(v.sid).find(x => 't_' + x.id === v.cid);
    const can = t && (t.by === me.uid || Servers.isMod(v.sid));
    title = [svgEl('ticket'), t?.subject || 'Ticket', t ? h('span', { class: 'topic' }, t.status === 'open' ? 'Open' : 'Closed') : null, h('span', { class: 'grow' }),
      can && t.status === 'open' ? h('button', { class: 'btn', onclick: () => Servers.setTicket(v.sid, t.id, 'closed').catch(fail) }, 'Close ticket') : null,
      can && t.status === 'closed' ? h('button', { class: 'btn', onclick: () => Servers.setTicket(v.sid, t.id, 'open').catch(fail) }, 'Reopen') : null, peopleBtn];
    showMsgs = true; showComp = !!t && t.status === 'open';
    renderMessages(msgs, Servers.messages, { sid: v.sid, cid: v.cid, ticket: t }, t?.subject || 'Ticket', Servers.error);
    $('#c-input').placeholder = 'Reply in this ticket';
  } else if (v.kind === 'voice') {
    const ch = Servers.channelsOf(v.sid).find(c => c.id === v.cid);
    title = [svgEl('volume'), ch?.name || '…', h('span', { class: 'topic' }, 'Voice room'), h('span', { class: 'grow' }), peopleBtn];
    showStage = true; renderStage(stage, false);
  } else title = ['Loading…'];
  title.unshift(h('button', { class: 'ibtn backbtn', title: 'Back', onclick: () => { S.mview = 'nav'; S.peopleOpen = false; schedule(); } }, svgEl('chev', 'left')));
  head.replaceChildren(...title.filter(Boolean));
  page.classList.toggle('hidden', !showPage);
  stage.classList.toggle('hidden', !showStage); stage.classList.toggle('mini', mini);
  msgs.classList.toggle('hidden', !showMsgs);
  comp.classList.toggle('hidden', !showComp);
  sbar.classList.toggle('hidden', !(S.searchOpen && showMsgs));
  $('#c-tools').classList.toggle('hidden', v.kind === 'ticket');
  if (changed && showComp) setTimeout(() => $('#c-input').focus(), 0);
}

function toggleReaction(ctx, m, key) {
  try { limit('react'); } catch (e) { return fail(e); }
  const on = !(m.re?.[key] || []).includes(Account.user.uid);
  const p = ctx.sid ? Servers.react(ctx.sid, ctx.cid, m.id, key, on) : DMs.react(m.id, key, on);
  p.catch(fail);
}
const BOTS = { automod: ['AutoMod', '🛡️'], welcome: ['Welcome', '👋'], giveaway: ['Giveaway', '🎁'], poll: ['Polls', '📊'], tickets: ['Tickets', '🎫'] };
function renderMessages(el, list, ctx, name, error) {
  const stick = S.firstFill || el.scrollHeight - el.scrollTop - el.clientHeight < 90;
  const me = Account.user, mod = ctx.sid && Servers.isMod(ctx.sid);
  const kids = [];
  if (error) kids.push(h('div', { class: 'note err', style: 'margin:12px 16px' }, error));
  const q = S.searchOpen ? S.search : '';
  if (q) { list = list.filter(m => (m.text || '').toLowerCase().includes(q)); kids.push(h('div', { class: 'day' }, h('span', {}, `${list.length} ${list.length === 1 ? 'result' : 'results'} for “${q}”`))); }
  else if (list.length < 100) kids.push(h('div', { class: 'welcome' },
    h('div', { class: 'big' }, ctx.ticket ? '🎫' : ctx.sid ? '💬' : '👋'), h('h2', {}, ctx.ticket ? name : ctx.sid ? `Welcome to ${name}` : name),
    h('p', {}, ctx.ticket ? 'Only you and the moderators can see this ticket.' : ctx.sid ? 'This is the start of the room. Say something!' : 'This is the start of your conversation. Say hi!')));
  let prevDay = '';
  list.forEach((m, i) => {
    const prev = list[i - 1], next = list[i + 1], day = dayKey(m.at);
    if (day !== prevDay) { kids.push(h('div', { class: 'day' }, h('span', {}, dayLabel(m.at)))); prevDay = day; }
    const near = (a, b) => a && b && a.from === b.from && !!a.bot === !!b.bot && Math.abs(a.at - b.at) <= 5 * 60 * 1000 && dayKey(a.at) === dayKey(b.at);
    const first = !near(prev, m), last = !near(m, next);
    const isBot = !!m.bot, mine = m.from === me.uid && !isBot, id = idOf(m.from);
    const canDelete = ctx.sid && (mine || mod) && !m.pending;
    const canEdit = mine && !m.pending && !m.app;
    const res = Object.entries(m.re || {}).filter(([, u]) => u.length);
    const [botName, botIcon] = BOTS[m.bot] || ['Bot', '🤖'];
    const who = isBot
      ? h('span', { class: 'who' }, botName, h('span', { class: 'bottag' }, 'BOT'))
      : ((first && (!mine || Prefs.get('layout') === 'list')) ? h('span', { class: 'who', style: `color:${nameColor(id)}`, onclick: e => profileCard(m.from, id, e.clientX + 8, e.clientY) }, nameOnly(id)) : null);
    kids.push(h('div', { class: 'msg' + (first ? ' first' : '') + (mine ? ' mine' : '') + (m.pending ? ' pending' : '') + (isBot ? ' bot' : ''),
      onclick: e => { if (isMobile() && !e.target.closest('a,button,img,.who,.re,.tools')) e.currentTarget.classList.toggle('sel'); } },
      h('div', { class: 'gut' }, (Prefs.get('layout') === 'list' ? first : last && !mine) ? (isBot ? h('div', { class: 'av botav' }, botIcon) : h('div', { onclick: e => profileCard(m.from, id, e.clientX + 8, e.clientY) }, avatar(id))) : null),
      h('div', { class: 'bubble' },
        first || isBot ? who : null,
        m.text && !(m.app && Servers.apps.get(m.app)) ? h('div', { class: 'text' }, richText(m.text)) : null,
        m.app ? appCard(m, ctx) : null,
        m.img ? h('img', { class: 'attach', src: m.img, onclick: () => lightbox(m.img) }) : null,
        res.length ? h('div', { class: 'res' }, res.map(([k, u]) => h('button', { class: 're' + (u.includes(me.uid) ? ' me' : ''), onclick: () => toggleReaction(ctx, m, k) }, emojiNode(reShow(k)), String(u.length)))) : null,
        h('span', { class: 'when' }, m.edited ? '(edited) ' : '', fmtTime(m.at))),
      m.pending || ctx.ticket && false ? null : h('div', { class: 'tools' },
        h('button', { title: 'React', 'data-keep': 1, onclick: e => emojiPicker(e.currentTarget, em => toggleReaction(ctx, m, reKey(em))) }, svgEl('smile')),
        canEdit ? h('button', { title: 'Edit message', onclick: () => editModal(m) }, svgEl('edit')) : null,
        canDelete ? h('button', { class: 'del', title: 'Delete message', onclick: () => Servers.deleteMessage(ctx.sid, ctx.cid, m.id).catch(fail) }, svgEl('trash')) : null)));
  });
  el.replaceChildren(...kids);
  if (stick) el.scrollTop = el.scrollHeight;
  S.firstFill = false;
}

// ---- voice stage: watch shared screens, see who is here, volume per person
const videoCache = new Map(); // uid -> <video>
function watchVideo(uid, stream) {
  let v = videoCache.get(uid);
  if (!v) { v = h('video', { autoplay: true, playsinline: true, muted: true, class: 'screenvid', title: 'Double-click for full screen', ondblclick: e => (document.fullscreenElement ? document.exitFullscreen() : e.currentTarget.requestFullscreen?.()) }); v.muted = true; videoCache.set(uid, v); }
  if (v.srcObject !== stream) { v.srcObject = stream; v.play?.().catch(() => {}); }
  return v;
}
function renderStage(el, mini) {
  if (S.holdStage) return;                     // someone is dragging a volume slider: leave it alone
  const me = Account.user, v = S.view;
  let path, tiles = [], connected = false;
  if (mini) path = `cc_calls/${pairOf(me.uid, v.uid)}`; else path = Servers.channelPath(v.sid, v.cid);
  connected = Voice.isIn(path);
  const watching = [];
  if (connected) {
    const seen = new Set([me.uid]);
    tiles.push({ uid: me.uid, id: me.id, muted: Voice.muted || (Voice.ptt && !Voice.pttHeld), deafened: Voice.deafened, talking: Voice.speaking.has(me.uid), conn: 'connected', self: true });
    for (const p of Voice.participants.values()) if (!seen.has(p.uid)) {
      seen.add(p.uid); tiles.push({ ...p, talking: Voice.speaking.has(p.uid), conn: Voice.conn.get(p.uid) || 'connecting' });
      if (p.screen && Voice.screens.has(p.uid)) watching.push(p);
    }
    if (mini && !seen.has(v.uid)) tiles.push({ uid: v.uid, id: idOf(v.uid), ringing: true });
  } else if (!mini) {
    for (const p of Servers.voiceOf(v.sid, v.cid)) tiles.push({ uid: p.uid, id: p.id, muted: p.muted, deafened: p.deafened, screen: p.screen });
  }
  for (const [uid, vid] of [...videoCache]) if (!watching.some(w => w.uid === uid)) { vid.srcObject = null; videoCache.delete(uid); }
  const tile = t => h('div', { class: 'tile' + (t.talking ? ' talk' : '') + (t.ringing ? ' ring' : ''), style: `--tint:${colorOf(t.id)}`, onclick: e => { if (!e.target.closest('.vol')) profileCard(t.uid, t.id, e.clientX, e.clientY); } },
    avatar(t.id), t.conn === 'connecting' && !t.self ? h('span', { class: 'conn' }, 'connecting…') : null, t.screen ? h('span', { class: 'live' }, '● LIVE') : null,
    h('div', { class: 'nm' }, h('span', {}, nameOnly(t.id) + (t.ringing ? ' (calling…)' : '')), t.deafened ? svgEl('headoff') : t.muted ? svgEl('micoff') : null),
    connected && !t.self && !t.ringing ? h('input', { class: 'vol', type: 'range', min: 0, max: 100, value: Math.round(Voice.volumeOf(t.uid) * 100), title: `Volume for ${nameOnly(t.id)}`,
      onpointerdown: () => { S.holdStage = true; }, onpointerup: () => { S.holdStage = false; schedule(); }, onchange: () => { S.holdStage = false; schedule(); },
      oninput: e => Voice.setVolume(t.uid, e.target.value / 100) }) : null);
  const hint = Voice.error && connected ? h('div', { class: 'stage-hint err' }, Voice.error)
    : (connected && Voice.noMic ? h('div', { class: 'stage-hint err' }, 'No microphone found: you can listen but not talk.')
      : (connected && Voice.ptt ? h('div', { class: 'stage-hint' }, `Push to talk: hold ${keyName(Prefs.get('pttKey'))}`) : h('div', { class: 'stage-hint' }, Voice.sharing ? '🖥️ You are sharing your screen' : '')));
  const ctl = connected
    ? h('div', { class: 'controls' },
      h('button', { class: 'cbtn' + (Voice.muted ? ' off' : ''), title: Voice.muted ? 'Unmute' : 'Mute', onclick: () => Voice.setMuted(!Voice.muted) }, svgEl(Voice.muted ? 'micoff' : 'mic')),
      h('button', { class: 'cbtn' + (Voice.deafened ? ' off' : ''), title: Voice.deafened ? 'Undeafen' : 'Deafen', onclick: () => Voice.setDeafened(!Voice.deafened) }, svgEl(Voice.deafened ? 'headoff' : 'head')),
      canShare() ? h('button', { class: 'cbtn' + (Voice.sharing ? ' live' : ''), title: Voice.sharing ? 'Stop sharing' : 'Share your screen', onclick: shareFlow }, svgEl('monitor')) : null,
      h('div', { class: 'mastervol', title: 'Everyone’s volume' }, svgEl('volume'), h('input', { type: 'range', min: 0, max: 100, value: Math.round(Voice.master * 100),
        onpointerdown: () => { S.holdStage = true; }, onpointerup: () => { S.holdStage = false; schedule(); }, onchange: () => { S.holdStage = false; schedule(); },
        oninput: e => Voice.setMaster(e.target.value / 100) })),
      h('button', { class: 'cbtn end', title: 'Leave', onclick: leaveVoice }, svgEl('phone', 'hang')))
    : h('div', { class: 'controls' }, h('button', { class: 'cbtn join', onclick: () => joinVoice(v.sid, v.cid) }, svgEl('phone'), 'Join voice'));
  el.classList.toggle('watching', watching.length > 0);
  el.replaceChildren(
    ...(watching.length ? [h('div', { class: 'watch' + (watching.length > 1 ? ' multi' : '') }, watching.map(w => h('div', { class: 'wbox' }, watchVideo(w.uid, Voice.screens.get(w.uid)), h('span', { class: 'wname' }, `🖥️ ${nameOnly(w.id)}'s screen`))))] : []),
    h('div', { class: 'tiles' }, tiles.length ? tiles.map(tile) : h('div', { class: 'empty' }, 'Nobody is here yet. Be the first to join!')), hint, ctl);
}

function renderFriendsPage(el) {
  const kids = [];
  if (Friends.error) kids.push(h('div', { class: 'note err' }, Friends.error));
  const row = (f, acts) => {
    const st = Friends.statusOf(f.uid);
    return h('div', { class: 'frow' }, avatar(f.id, 'lg', f.status === 'accepted' ? st : ''),
      h('div', { class: 'nm' }, h('b', { style: `color:${nameColor(f.id)}` }, nameOnly(f.id)),
        h('span', {}, f.status === 'pending' ? (f.incoming ? 'Wants to be friends' : 'Request sent') : (profileStatus(f.id) || STATUS_LABEL[st]))),
      h('div', { class: 'acts' }, acts));
  };
  if (S.tab === 'add') {
    if (el.dataset.tab === 'add' && el.querySelector('input')) return; // keep the typing box steady
    const input = h('input', { placeholder: 'Their username', maxlength: 24, onkeydown: e => { if (e.key === 'Enter') go2(); } });
    const out = h('div');
    const go2 = async () => {
      try { limit('friend'); const m = await Friends.add(input.value); out.replaceChildren(h('div', { class: 'note ok' }, m)); input.value = ''; }
      catch (e) { out.replaceChildren(h('div', { class: 'note err' }, nice(e))); }
    };
    kids.push(h('h3', {}, 'Add a friend'), h('p', { style: 'color:var(--dim);margin:0 0 12px' }, `Type their username. Yours is ${nameOnly(Account.user.id)}.`),
      h('div', { class: 'addbox' }, input, h('button', { class: 'btn gold', onclick: go2 }, 'Send request')), out);
  } else {
    const all = Friends.list;
    let list, label;
    if (S.tab === 'pending') { list = all.filter(f => f.status === 'pending'); label = `Pending — ${list.length}`; }
    else if (S.tab === 'all') { list = all.filter(f => f.status === 'accepted'); label = `All friends — ${list.length}`; }
    else { list = all.filter(f => f.status === 'accepted' && Friends.statusOf(f.uid) !== 'offline'); label = `Online — ${list.length}`; }
    kids.push(h('h3', {}, label));
    if (!list.length) kids.push(h('div', { class: 'empty' }, S.tab === 'pending' ? 'No pending requests.' : S.tab === 'all' ? 'No friends yet. Use “Add friend” to find someone.' : 'Nobody is online right now.'));
    const grid = h('div', { class: 'flist' });
    for (const f of list.sort((a, b) => a.id.localeCompare(b.id))) {
      const acts = [];
      if (f.status === 'accepted') {
        acts.push(h('button', { class: 'ibtn', title: 'Message', onclick: () => go('home', { kind: 'dm', uid: f.uid }) }, svgEl('msg')));
        acts.push(h('button', { class: 'ibtn', title: 'Call', onclick: () => startCall(f.uid) }, svgEl('phone')));
        acts.push(h('button', { class: 'ibtn', title: 'Remove friend', onclick: () => confirmModal(`Remove ${nameOnly(f.id)}?`, 'You can add them again later.', 'Remove friend', () => Friends.remove(f.pair).catch(fail)) }, svgEl('x')));
      } else if (f.incoming) {
        acts.push(h('button', { class: 'ibtn green', title: 'Accept', onclick: () => Friends.accept(f.pair).catch(fail) }, svgEl('check')));
        acts.push(h('button', { class: 'ibtn', title: 'Ignore', onclick: () => Friends.remove(f.pair).catch(fail) }, svgEl('x')));
      } else acts.push(h('button', { class: 'ibtn', title: 'Cancel request', onclick: () => Friends.remove(f.pair).catch(fail) }, svgEl('x')));
      grid.append(row(f, acts));
    }
    kids.push(grid);
  }
  el.dataset.tab = S.tab;
  el.replaceChildren(...kids);
}

// ---------------------------------------------------------------- people drawer
function renderMembers() {
  const el = $('#members'), app = $('#app');
  const srv = S.sel !== 'home' ? Servers.server(S.sel) : null;
  app.classList.toggle('no-members', !srv);
  app.classList.toggle('hide-members', !!srv && S.hideMembers);
  app.classList.toggle('m-chat', S.mview === 'chat');
  app.classList.toggle('m-nav', S.mview !== 'chat');
  app.classList.toggle('m-people', !!srv && !!S.peopleOpen);
  if (!srv) { el.replaceChildren(); return; }
  const rows = srv.members.map(uid => ({ uid, id: srv.ids?.[uid] || idOf(uid), st: uid === Account.user.uid ? (S.status === 'invisible' ? 'offline' : S.status) : Friends.statusOf(uid) }));
  const byName = (a, b) => nameOnly(a.id).localeCompare(nameOnly(b.id));
  const on = rows.filter(r => r.st !== 'offline').sort(byName), off = rows.filter(r => r.st === 'offline').sort(byName);
  const mk = r => h('div', { class: 'member' + (r.st === 'offline' ? ' off' : ''), onclick: e => profileCard(r.uid, r.id, e.clientX - 310, e.clientY) },
    avatar(r.id, '', r.st), h('span', { class: 'nm', style: Profiles.forId(r.id)?.nameColor ? `color:${nameColor(r.id)}` : '' }, nameOnly(r.id), profileStatus(r.id) ? h('small', {}, profileStatus(r.id)) : null),
    srv.owner === r.uid ? svgEl('crown', 'crown') : (srv.mods || []).includes(r.uid) ? svgEl('shield', 'crown') : null);
  el.replaceChildren(...[h('div', { class: 'm-label' }, `Online — ${on.length}`), ...on.map(mk), off.length ? h('div', { class: 'm-label' }, `Offline — ${off.length}`) : null, ...off.map(mk)].filter(Boolean));
  const key = srv.members.join(',');
  if (S.presKey !== key) { S.presKey = key; Friends.watchPresence(srv.members.filter(u => u !== Account.user.uid), 'server'); }
}

// ---------------------------------------------------------------- incoming call card + update bar
function renderIncoming() {
  let el = $('#inc');
  const c = Calls.incoming;
  if (!c || Voice.room?.path === `cc_calls/${c.id}`) { el?.remove(); ring(false); return; }
  const f = Friends.list.find(x => x.uid === c.from), id = f?.id || idOf(c.from);
  ring(true);
  const node = h('div', { class: 'incoming', id: 'inc' }, avatar(id), h('b', {}, nameOnly(id)), h('span', {}, 'is calling you…'),
    h('div', { class: 'btns' },
      h('button', { class: 'cbtn end', title: 'Decline', onclick: () => Calls.decline() }, svgEl('phone', 'hang')),
      h('button', { class: 'cbtn', style: 'background:var(--green);color:#07140d', title: 'Answer', onclick: async () => { go('home', { kind: 'dm', uid: c.from }); await Calls.answer(nameOnly(id)); applyJoinMuted(); if (Voice.error) toast(Voice.error, 'err'); } }, svgEl('phone'))));
  if (el) el.replaceWith(node); else layer().append(node);
}
function renderUpdate() {
  const bar = $('#updatebar'), u = S.update;
  if (u.state === 'ready') {
    bar.classList.remove('hidden');
    bar.replaceChildren(svgEl('download'), h('span', {}, `Camelcord ${u.version} is ready.`), h('button', { class: 'btn gold', onclick: () => host.update.install() }, 'Restart to update'));
  } else if (u.state === 'downloading') {
    bar.classList.remove('hidden');
    bar.replaceChildren(svgEl('download'), h('span', {}, `Downloading update ${u.version}… ${Math.round((u.progress || 0) * 100)}%`));
  } else bar.classList.add('hidden');
}

// ---------------------------------------------------------------- modals
function confirmModal(title, text, label, fn) {
  modal((box, close) => box.append(h('h2', {}, title), h('p', { class: 'sub' }, text),
    h('div', { class: 'foot' }, h('button', { class: 'btn ghost', onclick: close }, 'Cancel'), h('button', { class: 'btn red', onclick: () => { close(); fn(); } }, label))));
}
function promptModal(title, label, value, button, fn) {
  modal((box, close) => {
    const input = h('input', { value, maxlength: 40 });
    const go2 = async () => { try { await fn(input.value); close(); } catch (e) { fail(e); } };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') go2(); });
    box.append(h('h2', {}, title), h('p', { class: 'sub' }, ''), h('label', { class: 'f' }, label, input),
      h('div', { class: 'foot' }, h('button', { class: 'btn ghost', onclick: close }, 'Cancel'), h('button', { class: 'btn gold', onclick: go2 }, button)));
    setTimeout(() => { input.focus(); input.select(); }, 0);
  });
}
const afterJoin = sid => { const wait = setInterval(() => { if (Servers.server(sid) && Servers.channelsOf(sid).length) { clearInterval(wait); openServer(sid); } }, 120); setTimeout(() => clearInterval(wait), 6000); };

function createServerModal() {
  let icon = ICONS[0], color = COLORS[0], img = '';
  modal((box, close) => {
    const name = h('input', { maxlength: 30, placeholder: `${nameOnly(Account.user.id)}'s server`, value: `${nameOnly(Account.user.id)}'s server` });
    const prev = h('div', { class: 'preview' });
    const pickI = h('div', { class: 'picker' }), pickC = h('div', { class: 'picker colors' });
    const imgBtn = h('button', { class: 'btn', onclick: async () => { const f = await pickFile(); if (!f) return; try { img = await shrinkImage(f, { max: 128, square: true, maxChars: 38000 }); paint(); } catch (e) { fail(e); } } }, 'Use a picture instead');
    const paint = () => {
      prev.replaceChildren(h('div', { class: 'rail-btn', style: img ? `background-image:url('${img}');cursor:default;width:44px` : `background-color:${color};cursor:default;width:44px` }, img ? null : icon),
        h('div', {}, h('b', {}, name.value || 'Your server'), h('div', { style: 'color:var(--dim);font-size:12.5px' }, 'Starts with a chat room and a voice room')));
      pickI.replaceChildren(...ICONS.map(i => h('button', { class: !img && i === icon ? 'sel' : '', onclick: () => { icon = i; img = ''; paint(); } }, i)));
      pickC.replaceChildren(...COLORS.map(c => h('button', { class: c === color ? 'sel' : '', style: `background:${c}`, onclick: () => { color = c; paint(); } })));
      imgBtn.textContent = img ? 'Change picture' : 'Use a picture instead';
    };
    name.addEventListener('input', paint);
    const make = h('button', { class: 'btn gold', onclick: async () => {
      make.disabled = true;
      try { limit('server'); const sid = await Servers.create(name.value, icon, color, img); close(); toast('Server created!', 'ok'); afterJoin(sid); }
      catch (e) { make.disabled = false; fail(e); }
    } }, 'Create server');
    box.append(h('h2', {}, 'Create your server'), h('p', { class: 'sub' }, 'A place for you and your friends: chat rooms and voice rooms.'),
      prev, h('label', { class: 'f' }, 'Server name', name), h('label', { class: 'f' }, 'Icon', pickI, imgBtn), h('label', { class: 'f' }, 'Colour', pickC),
      h('div', { class: 'foot' }, h('button', { class: 'btn ghost', onclick: close }, 'Cancel'), make));
    paint(); setTimeout(() => name.select(), 0);
  });
}
function joinServerModal() {
  modal((box, close) => {
    const code = h('input', { placeholder: 'K7P2XQM', maxlength: 24, style: 'text-align:center;font-family:Consolas,monospace;font-size:18px;letter-spacing:3px;text-transform:uppercase' });
    const out = h('div');
    let found = null;
    const go2 = async () => {
      try {
        limit('invite');
        if (!found) {
          found = await Servers.peekInvite(code.value);
          out.replaceChildren(h('div', { class: 'preview' }, h('div', { class: 'rail-btn', style: `background-color:${found.color};cursor:default;width:44px` }, found.icon), h('div', {}, h('b', {}, found.name), h('div', { style: 'color:var(--dim);font-size:12.5px' }, 'You have been invited to join'))));
          btn.textContent = `Join ${found.name}`;
        } else { const sid = await Servers.join(found.code); close(); toast(`Joined ${found.name}!`, 'ok'); afterJoin(sid); }
      } catch (e) { found = null; btn.textContent = 'Find server'; out.replaceChildren(h('div', { class: 'note err' }, e.code === 'permission-denied' ? 'You can’t join that server (you may be banned).' : nice(e))); }
    };
    code.addEventListener('keydown', e => { if (e.key === 'Enter') go2(); });
    code.addEventListener('input', () => { found = null; btn.textContent = 'Find server'; out.replaceChildren(); });
    const btn = h('button', { class: 'btn gold', onclick: go2 }, 'Find server');
    box.append(h('h2', {}, 'Join a server'), h('p', { class: 'sub' }, 'Paste the invite code a friend sent you.'), h('label', { class: 'f' }, 'Invite code', code), out,
      h('div', { class: 'foot' }, h('button', { class: 'btn ghost', onclick: close }, 'Cancel'), btn));
    setTimeout(() => code.focus(), 0);
  });
}
function inviteModal(srv) {
  modal((box, close) => {
    const codeEl = h('input', { readonly: true, value: srv.invite || '' });
    box.append(h('h2', {}, `Invite friends to ${srv.name}`), h('p', { class: 'sub' }, 'Send this code to a friend. They press the compass at the top and paste it in.'),
      h('div', { class: 'codebox' }, codeEl, h('button', { class: 'btn gold', onclick: () => { navigator.clipboard?.writeText(codeEl.value); toast('Invite code copied.', 'ok'); } }, 'Copy')),
      srv.owner === Account.user.uid ? h('p', { class: 'sub', style: 'margin-top:14px' }, 'Want to cancel this code? ', h('a', { style: 'color:var(--gold);cursor:pointer', onclick: async () => { try { codeEl.value = await Servers.newInvite(srv.id); toast('New code made. The old one no longer works.', 'ok'); } catch (e) { fail(e); } } }, 'Make a new one')) : null,
      h('div', { class: 'foot' }, h('button', { class: 'btn', onclick: close }, 'Done')));
  });
}
function channelModal(sid, kind) {
  modal((box, close) => {
    let k = kind || 'text', ann = false;
    const name = h('input', { maxlength: 24 });
    const choice = h('div', { class: 'choice' });
    const annBox = h('label', { style: 'display:flex;gap:8px;align-items:center;margin-bottom:6px' });
    const annIn = h('input', { type: 'checkbox', onchange: e => { ann = e.target.checked; } });
    annBox.append(annIn, 'Announcement room (only moderators can post)');
    const paint = () => {
      choice.replaceChildren(h('button', { class: k === 'text' ? 'sel' : '', onclick: () => { k = 'text'; paint(); } }, svgEl('room'), 'Chat'), h('button', { class: k === 'voice' ? 'sel' : '', onclick: () => { k = 'voice'; paint(); } }, svgEl('volume'), 'Voice'));
      name.placeholder = k === 'text' ? 'new-room' : 'New voice room';
      annBox.classList.toggle('hidden', k !== 'text');
    };
    const make = h('button', { class: 'btn gold', onclick: async () => { try { await Servers.addChannel(sid, name.value, k, ann); close(); } catch (e) { fail(e); } } }, 'Add room');
    name.addEventListener('keydown', e => { if (e.key === 'Enter') make.click(); });
    box.append(h('h2', {}, 'Add a room'), h('p', { class: 'sub' }, ''), choice, h('label', { class: 'f' }, 'Room name', name), annBox, h('div', { class: 'foot' }, h('button', { class: 'btn ghost', onclick: close }, 'Cancel'), make));
    paint(); setTimeout(() => name.focus(), 0);
  });
}

// ---- server settings: general, rooms, people, bots, emoji, info
function serverSettingsModal(srv0, tab = 'general') {
  const sid = srv0.id, owner = srv0.owner === Account.user.uid;
  const cur = () => Servers.server(sid) || srv0;
  modal((box, close) => {
    const pane = h('div', { class: 'pane' }), nav = h('nav', {});
    const tabs = owner
      ? [['general', 'General'], ['rooms', 'Rooms'], ['people', 'People'], ['bots', 'Bots'], ['emoji', 'Emoji'], ['info', 'Info']]
      : [['info', 'Info'], ['emoji', 'Emoji']];
    const show = id => {
      tab = id;
      nav.replaceChildren(h('h4', {}, cur().name), ...tabs.map(([k, label]) => h('button', { class: k === id ? 'on' : '', onclick: () => show(k) }, label)));
      pane.replaceChildren(...({ general, rooms, people, bots, emoji, info }[id])(close));
    };
    const general = () => {
      const srv = cur(), name = h('input', { maxlength: 30, value: srv.name }), iconRow = h('div', { class: 'pavrow' });
      const paintIcon = () => iconRow.replaceChildren(
        h('div', { class: 'rail-btn', style: srv.img ? `background-image:url('${srv.img}');width:48px;height:48px;cursor:default` : `background-color:${srv.color};width:48px;height:48px;cursor:default` }, srv.img ? null : srv.icon),
        h('button', { class: 'btn', onclick: async () => { const f = await pickFile(); if (!f) return; try { srv.img = await shrinkImage(f, { max: 128, square: true, maxChars: 38000 }); await Servers.setIconImage(srv.id, srv.img); paintIcon(); } catch (e) { fail(e); } } }, 'Upload picture'),
        srv.img ? h('button', { class: 'btn ghost', onclick: async () => { srv.img = ''; await Servers.setIconImage(srv.id, '').catch(fail); paintIcon(); } }, 'Remove') : null);
      paintIcon();
      return [h('h2', {}, 'General'), h('p', { class: 'sub' }, ''), h('label', { class: 'f' }, 'Server name', name), h('label', { class: 'f' }, 'Server picture', iconRow),
        h('div', { class: 'foot' }, h('button', { class: 'btn gold', onclick: () => Servers.rename(sid, name.value).then(() => { toast('Saved.', 'ok'); show('general'); }).catch(fail) }, 'Save'))];
    };
    const rooms = () => {
      const srv = cur(), chans = Servers.channelsOf(sid);
      const rowFor = c => {
        const nm = h('input', { value: c.name, maxlength: 24, style: 'flex:1;min-width:0' });
        const slow = h('select', { onchange: e => Servers.setSlow(sid, c.id, +e.target.value).then(() => toast('Slowmode updated.', 'ok')).catch(fail) },
          ...[[0, 'No slowmode'], [5, '5 seconds'], [10, '10 seconds'], [30, '30 seconds'], [60, '1 minute'], [300, '5 minutes']].map(([v, l]) => h('option', { value: v, selected: (c.slow || 0) === v }, l)));
        return h('div', { class: 'roomrow' }, svgEl(c.kind === 'voice' ? 'volume' : c.announce ? 'announce' : 'room'), nm,
          h('button', { class: 'btn', onclick: () => Servers.renameChannel(sid, c.id, nm.value).then(() => toast('Renamed.', 'ok')).catch(fail) }, 'Rename'),
          c.kind === 'text' ? slow : null,
          c.kind === 'text' ? h('label', { class: 'mini', title: 'Only moderators can post' }, h('input', { type: 'checkbox', checked: !!c.announce, onchange: e => Servers.setAnnounce(sid, c.id, e.target.checked).catch(fail) }), 'Announce') : null,
          h('button', { class: 'ibtn', title: 'Delete room', onclick: () => confirmModal(`Delete ${c.name}?`, 'Everything in this room will be gone for everyone.', 'Delete room', () => Servers.deleteChannel(sid, c.id).then(() => show('rooms')).catch(fail)) }, svgEl('trash')));
      };
      return [h('h2', {}, 'Rooms'), h('p', { class: 'sub' }, 'Slowmode makes everyone but you wait between messages. Announcement rooms only let moderators post.'), ...chans.map(rowFor),
        h('div', { class: 'foot' }, h('button', { class: 'btn', onclick: () => channelModal(sid, 'text') }, '+ Add a room'))];
    };
    const people = () => {
      const srv = cur();
      const row = uid => {
        const id = srv.ids?.[uid] || idOf(uid), isOwner = uid === srv.owner, isMod = (srv.mods || []).includes(uid);
        return h('div', { class: 'frow' }, avatar(id), h('div', { class: 'nm' }, h('b', {}, nameOnly(id)), h('span', {}, isOwner ? 'Owner' : isMod ? 'Moderator' : 'Member')),
          isOwner ? svgEl('crown', 'crown') : h('div', { class: 'acts' },
            h('button', { class: 'btn', onclick: () => Servers.setMod(sid, uid, !isMod).then(() => show('people')).catch(fail) }, isMod ? 'Remove mod' : 'Make mod'),
            h('button', { class: 'btn ghost', onclick: () => Servers.kick(sid, uid).then(() => show('people')).catch(fail) }, 'Remove'),
            h('button', { class: 'btn ghost', onclick: () => Servers.ban(sid, uid).then(() => show('people')).catch(fail) }, 'Ban')));
      };
      const bans = srv.bans || [];
      return [h('h2', {}, 'People'), h('p', { class: 'sub' }, 'Moderators can delete messages, start giveaways and handle tickets.'), ...srv.members.map(row),
        bans.length ? h('div', { class: 'sect' }, `Banned — ${bans.length}`) : null,
        ...bans.map(uid => h('div', { class: 'frow' }, h('div', { class: 'nm' }, h('b', {}, nameOnly(Profiles.get(uid)?.id || 'Someone'))), h('button', { class: 'btn', onclick: () => Servers.unban(sid, uid).then(() => show('people')).catch(fail) }, 'Unban')))].filter(Boolean);
    };
    const bots = () => {
      const c = Servers.botsOf(sid);
      const chk = (label, val, set, help) => h('label', { class: 'opt' }, h('input', { type: 'checkbox', checked: !!val, onchange: e => set(e.target.checked) }), h('span', {}, label, help ? h('small', {}, help) : null));
      const words = h('textarea', { rows: 2, placeholder: 'badword, another word', style: 'width:100%;resize:none' }); words.value = c.automod.words || '';
      const welcome = h('input', { value: c.welcome.text || '', maxlength: 160 });
      return [h('h2', {}, 'Bots'), h('p', { class: 'sub' }, 'Auto-mod and the welcome bot run on your copy of Camelcord, so they work while you are online. Giveaways, polls and tickets work any time.'),
        h('div', { class: 'sect' }, '🛡️ Auto-mod'),
        chk('Turn on auto-mod', c.automod.on, v => { c.automod.on = v; }), chk('Block links', c.automod.links, v => { c.automod.links = v; }),
        chk('Stop message floods', c.automod.spam, v => { c.automod.spam = v; }, '6 messages in 8 seconds'), chk('Stop shouting', c.automod.caps, v => { c.automod.caps = v; }, 'mostly capital letters'),
        chk('Limit mentions', c.automod.mentions, v => { c.automod.mentions = v; }, '5 or more @mentions'),
        h('label', { class: 'f' }, 'Blocked words', words),
        h('div', { class: 'sect' }, '👋 Welcome bot'), chk('Greet new members', c.welcome.on, v => { c.welcome.on = v; }),
        h('label', { class: 'f' }, 'Message  ({user} and {server} get replaced)', welcome),
        h('div', { class: 'sect' }, 'Giveaways, polls and tickets'),
        chk('Anyone can start giveaways', c.giveawayAnyone, v => { c.giveawayAnyone = v; }, 'otherwise only moderators'),
        chk('Support tickets', c.tickets, v => { c.tickets = v; }), chk('Polls', c.polls, v => { c.polls = v; }),
        h('div', { class: 'foot' }, h('button', { class: 'btn gold', onclick: async () => {
          c.automod.words = words.value; c.welcome.text = welcome.value;
          try { await Servers.saveBots(sid, { automod: c.automod, welcome: c.welcome, giveawayAnyone: c.giveawayAnyone, tickets: c.tickets, polls: c.polls }); toast('Bot settings saved.', 'ok'); setTimeout(() => Bots.sync(), 500); } catch (e) { fail(e); }
        } }, 'Save bot settings'))];
    };
    const emoji = () => {
      const list = [...Servers.emoji.values()].filter(c => c.sid === sid);
      const rowFor = c => h('div', { class: 'frow' }, h('img', { class: 'cemoji', src: c.img, style: 'width:32px;height:32px' }), h('div', { class: 'nm' }, h('b', {}, ':' + c.name + ':')),
        (owner || c.by === Account.user.uid) ? h('button', { class: 'btn ghost', onclick: () => Servers.deleteEmoji(sid, c.name).then(() => show('emoji')).catch(fail) }, 'Delete') : null);
      return [h('h2', {}, `Emoji — ${list.length}`), h('p', { class: 'sub' }, 'Anyone in the server can add emoji. Type :name: to use one.'), ...list.map(rowFor),
        h('div', { class: 'foot' }, h('button', { class: 'btn gold', onclick: async () => { await addEmojiFlow(sid); setTimeout(() => show('emoji'), 600); } }, '+ Add emoji'))];
    };
    const info = () => {
      const srv = cur();
      const date = srv.at?.toDate ? srv.at.toDate().toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
      return [h('h2', {}, srv.name), h('p', { class: 'sub' }, `Created ${date} · ${srv.members.length} ${srv.members.length === 1 ? 'person' : 'people'} · owned by ${nameOnly(srv.ids?.[srv.owner] || idOf(srv.owner))}`),
        h('div', { class: 'sect' }, 'Invite code'), h('div', { class: 'codebox' }, h('input', { readonly: true, value: srv.invite || '' }), h('button', { class: 'btn gold', onclick: () => { navigator.clipboard?.writeText(srv.invite || ''); toast('Invite code copied.', 'ok'); } }, 'Copy')),
        h('div', { class: 'sect' }, 'On this device'),
        h('label', { class: 'opt' }, h('input', { type: 'checkbox', checked: Servers.isMuted(sid), onchange: () => Servers.toggleMuted(sid) }), h('span', {}, 'Mute this server', h('small', {}, 'no sounds or desktop notifications from it'))),
        h('div', { class: 'sect' }, 'Rooms'), h('p', { class: 'sub' }, `${Servers.channelsOf(sid).filter(c => c.kind === 'text').length} chat · ${Servers.channelsOf(sid).filter(c => c.kind === 'voice').length} voice`)];
    };
    box.classList.add('huge');
    box.append(nav, pane);
    show(tab);
  }, 'huge');
}

// ---- themes
function swatch(t, sel, onPick, onDelete) {
  const v = buildVars(t);
  const sw = h('div', { class: 'sw', style: t.wall ? `background-image:url('${t.wall}')` : '' }, ...(t.wall ? [] : [h('i', { style: `background:${v['--bg0']}` }), h('i', { style: `background:${v['--bg2']}` }), h('i', { style: `background:${v['--bg4']}` })]), h('b', { style: `background:${v['--gold']}` }));
  return h('button', { class: 'theme' + (sel ? ' sel' : ''), title: t.name, onclick: onPick }, sw, h('span', {}, t.name),
    onDelete ? h('span', { class: 'x', title: 'Delete theme', onclick: e => { e.stopPropagation(); onDelete(); } }, '×') : null);
}
function themeEditor(base, after) {
  const draft = { id: base?.id || 'c_' + Date.now().toString(36), name: base?.name || 'My theme', hue: base?.hue ?? 225, sat: base?.sat ?? 10, accent: base?.accent || '#5b8cff', light: !!base?.light, wall: base?.wall || '', wallDim: base?.wallDim ?? 82 };
  let wallData = draft.wall;
  const live = () => { draft.wall = useWall.checked ? wallData : ''; Themes.apply({ ...draft }); preview(); };
  const restore = () => Themes.use(Themes.currentId());
  const name = h('input', { value: draft.name, maxlength: 24, oninput: e => { draft.name = e.target.value; } });
  const hue = h('input', { type: 'range', min: 0, max: 360, value: draft.hue, oninput: e => { draft.hue = +e.target.value; live(); } });
  const sat = h('input', { type: 'range', min: 0, max: 45, value: draft.sat, oninput: e => { draft.sat = +e.target.value; live(); } });
  const accent = h('input', { type: 'color', value: draft.accent, oninput: e => { draft.accent = e.target.value; live(); } });
  const dim = h('input', { type: 'range', min: 40, max: 96, value: draft.wallDim, oninput: e => { draft.wallDim = +e.target.value; live(); } });
  const useWall = h('input', { type: 'checkbox', checked: !!draft.wall, onchange: live });
  const mode = h('div', { class: 'choice' });
  const prev = h('div', { class: 'themes', style: 'grid-template-columns:1fr' });
  const preview = () => prev.replaceChildren(swatch({ ...draft, wall: '' }, false, () => {}));
  const paintMode = () => mode.replaceChildren(h('button', { class: draft.light ? '' : 'sel', onclick: () => { draft.light = false; paintMode(); live(); } }, 'Dark'), h('button', { class: draft.light ? 'sel' : '', onclick: () => { draft.light = true; paintMode(); live(); } }, 'Light'));
  modal((box, close) => {
    const fromPic = h('button', { class: 'btn', onclick: async () => {
      const f = await pickFile(); if (!f) return;
      try {
        const r = await themeFromImage(f, { light: draft.light });
        draft.hue = r.hue; draft.sat = r.sat; draft.accent = r.accent; wallData = r.wall; useWall.checked = true;
        hue.value = r.hue; sat.value = r.sat; accent.value = r.accent;
        if (name.value === 'My theme') { name.value = f.name.replace(/\.[^.]+$/, '').slice(0, 24); draft.name = name.value; }
        live(); toast('Colours picked from your picture.', 'ok');
      } catch (e) { fail(e); }
    } }, 'Pick colours from a picture');
    box.append(h('h2', {}, base?.custom && base?.id ? 'Edit theme' : 'Make a theme'), h('p', { class: 'sub' }, 'Changes show up right away. Save it to keep it.'),
      h('label', { class: 'f' }, 'Name', name), fromPic, h('div', { style: 'height:14px' }), mode,
      h('div', { class: 'sliderrow' }, 'Tint', hue, h('span', {}, '')), h('div', { class: 'sliderrow' }, 'Colourfulness', sat, h('span', {}, '')),
      h('div', { class: 'sliderrow' }, 'Accent', accent, h('span', {}, '')),
      h('label', { style: 'display:flex;gap:8px;align-items:center;margin:6px 0' }, useWall, 'Use the picture as the chat wallpaper'),
      h('div', { class: 'sliderrow' }, 'Wallpaper dim', dim, h('span', {}, '')), prev,
      h('div', { class: 'foot' }, h('button', { class: 'btn ghost', onclick: () => { restore(); close(); } }, 'Cancel'),
        h('button', { class: 'btn gold', onclick: () => {
          try { draft.wall = useWall.checked ? wallData : ''; draft.custom = true; Themes.save({ ...draft }); Themes.use(draft.id); close(); toast('Theme saved.', 'ok'); after?.(); }
          catch (e) { fail(e); }
        } }, 'Save theme')));
    paintMode(); preview(); live();
  }, 'wide');
}

// ---- settings
const keyName = code => ({ Backquote: '`', Space: 'Space', ControlRight: 'Right Ctrl', AltRight: 'Right Alt', ShiftRight: 'Right Shift' }[code] || String(code || '').replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, '') || '—');
async function settingsModal(tab = 'appearance') {
  let inputs = [], outputs = [];
  try { const devs = await navigator.mediaDevices.enumerateDevices(); inputs = devs.filter(d => d.kind === 'audioinput'); outputs = devs.filter(d => d.kind === 'audiooutput'); } catch (_) {}
  const info = await host.info();
  const P = Prefs;
  // small form helpers
  const toggle = (label, key, help, after) => h('label', { class: 'opt' }, h('input', { type: 'checkbox', checked: !!P.get(key), onchange: e => { P.set(key, e.target.checked); after?.(e.target.checked); } }), h('span', {}, label, help ? h('small', {}, help) : null));
  const select = (label, key, options, num) => h('label', { class: 'f' }, label, h('select', { onchange: e => P.set(key, num ? +e.target.value : e.target.value) }, ...options.map(([v, l]) => h('option', { value: v, selected: String(P.get(key)) === String(v) }, l))));
  const range = (label, key, min, max, step, fmt) => { const out = h('span', {}, fmt(P.get(key))); return h('div', { class: 'sliderrow' }, label, h('input', { type: 'range', min, max, step, value: P.get(key), oninput: e => { P.set(key, +e.target.value); out.textContent = fmt(+e.target.value); } }), out); };
  const keycap = (label, key, help) => {
    const b = h('button', { class: 'btn keycap' }, keyName(P.get(key)));
    b.addEventListener('click', () => {
      b.textContent = 'Press a key…';
      const on = e => { e.preventDefault(); e.stopPropagation(); document.removeEventListener('keydown', on, true); if (e.code !== 'Escape') P.set(key, e.code); b.textContent = keyName(P.get(key)); };
      document.addEventListener('keydown', on, true);
    });
    return h('div', { class: 'opt keyrow' }, h('span', {}, label, help ? h('small', {}, help) : null), b);
  };

  const appearance = () => {
    const grid = h('div', { class: 'themes' });
    const paint = () => {
      const cur = Themes.currentId();
      grid.replaceChildren(
        h('button', { class: 'theme make', onclick: () => themeEditor(null, paint) }, h('div', { class: 'sw' }, '+'), h('span', {}, 'Make your own')),
        h('button', { class: 'theme make', onclick: async () => {
          const f = await pickFile(); if (!f) return;
          try {
            const r = await themeFromImage(f);
            themeEditor({ name: f.name.replace(/\.[^.]+$/, '').slice(0, 24) || 'From picture', hue: r.hue, sat: r.sat, accent: r.accent, light: false, wall: r.wall, custom: true }, paint);
          } catch (e) { fail(e); }
        } }, h('div', { class: 'sw' }, '🖼'), h('span', {}, 'Theme from a picture')),
        ...Themes.custom().map(t => swatch(t, t.id === cur, () => { Themes.use(t.id); paint(); }, () => { Themes.remove(t.id); paint(); })),
        ...PRESETS.map(t => swatch(t, t.id === cur, () => { Themes.use(t.id); paint(); })));
    };
    paint();
    return [h('h2', {}, 'Appearance'), h('p', { class: 'sub' }, `${PRESETS.length} built-in themes, or make your own. Give it any picture and it picks the colours (and can use the picture as your chat wallpaper).`), grid,
      h('div', { class: 'sect' }, 'Display'),
      range('App size', 'scale', 0.8, 1.4, 0.05, v => Math.round(v * 100) + '%'),
      range('Text size', 'chatSize', 12, 20, 1, v => v + 'px'),
      select('Message layout', 'layout', [['bubbles', 'Chat bubbles'], ['list', 'Compact list (no bubbles)']]),
      select('Spacing', 'density', [['cozy', 'Comfortable'], ['compact', 'Compact']]),
      toggle('24-hour clock', 'clock24', '', () => schedule()), toggle('Reduce motion', 'reduceMotion', 'turns off animations')];
  };

  const profile = () => {
    const me = Account.user, cur = Profiles.get(me.uid) || {};
    const d = { avatar: cur.avatar || '', banner: cur.banner || '', bio: cur.bio || '', status: cur.status || '', nameColor: cur.nameColor || '' };
    const prev = h('div', { class: 'card', style: 'position:static;width:100%;max-width:320px;animation:none' });
    const paintPrev = () => {
      prev.replaceChildren(h('div', { class: 'banner', style: d.banner ? `background-image:url('${d.banner}')` : `background:linear-gradient(135deg,${colorOf(me.id)},var(--bg2))` }),
        h('div', { class: 'in' }, h('div', { class: 'av' + (d.avatar ? ' has-img' : ''), style: d.avatar ? `background-image:url('${d.avatar}')` : `background:${colorOf(me.id)}` }, d.avatar ? null : (nameOnly(me.id)[0] || '?').toUpperCase()),
          h('h4', { style: d.nameColor ? `color:${d.nameColor}` : '' }, nameOnly(me.id)), h('div', { class: 'st' }, d.status || STATUS_LABEL[S.status]), d.bio ? h('div', { class: 'bio' }, d.bio) : null));
    };
    const upload = (key, opts) => async () => { const f = await pickFile(); if (!f) return; try { limit('upload'); d[key] = await shrinkImage(f, opts); paintPrev(); } catch (e) { fail(e); } };
    const status = h('input', { value: d.status, maxlength: 60, placeholder: 'What are you up to?', oninput: e => { d.status = e.target.value; paintPrev(); } });
    const bio = h('textarea', { rows: 3, maxlength: 190, style: 'width:100%;resize:none', oninput: e => { d.bio = e.target.value; paintPrev(); } }); bio.value = d.bio;
    const color = h('input', { type: 'color', value: d.nameColor || '#5b8cff', oninput: e => { d.nameColor = e.target.value; paintPrev(); } });
    paintPrev();
    return [h('h2', {}, 'My profile'), h('p', { class: 'sub' }, 'Everyone you share a server or a friendship with sees this.'),
      h('div', { class: 'plusbox' }, h('b', {}, '✦ Camelcord Plus is on for everyone'), h('p', {}, 'Animated GIF avatars, profile banners, name colours, themes and wallpapers, custom emoji, pictures and GIFs, reactions, 4000-character messages, server pictures, bots, giveaways, polls and screen sharing. No subscription.')),
      h('div', { class: 'profile-edit' },
        h('div', { class: 'pavrow' }, prev),
        h('div', { class: 'pavrow' }, h('button', { class: 'btn', onclick: upload('avatar', { max: 256, square: true, maxChars: 110000 }) }, 'Upload avatar (GIFs work)'), h('button', { class: 'btn ghost', onclick: () => { d.avatar = ''; paintPrev(); } }, 'Remove')),
        h('div', { class: 'pavrow' }, h('button', { class: 'btn', onclick: upload('banner', { max: 720, maxChars: 280000 }) }, 'Upload banner'), h('button', { class: 'btn ghost', onclick: () => { d.banner = ''; paintPrev(); } }, 'Remove')),
        h('label', { class: 'f' }, 'Status message', status), h('label', { class: 'f' }, 'About me', bio),
        h('div', { class: 'pavrow' }, h('span', { style: 'color:var(--dim)' }, 'Name colour'), color, h('button', { class: 'btn ghost', onclick: () => { d.nameColor = ''; paintPrev(); } }, 'Default')),
        h('div', { class: 'foot' }, h('button', { class: 'btn gold', onclick: async () => { try { await Profiles.save({ ...d, accent: '' }); toast('Profile saved.', 'ok'); } catch (e) { fail(e); } } }, 'Save profile')))];
  };

  const notifications = () => [h('h2', {}, 'Notifications'), h('p', { class: 'sub' }, 'Do not disturb (click your name, top-left) silences everything below.'),
    toggle('Desktop notifications', 'notify', 'when Camelcord is in the background'), toggle('Message sounds', 'sounds'), toggle('Ring for incoming calls', 'ringSound'),
    toggle('Sounds when people join or leave voice', 'joinSounds'), toggle('Flash the taskbar for calls', 'flash'),
    IS_WEB && window.Notification && Notification.permission !== 'granted' ? h('button', { class: 'btn gold', style: 'margin-top:10px', onclick: () => Notification.requestPermission().then(() => settingsModal('notifications')) }, 'Allow notifications on this device') : null,
    h('p', { class: 'sub', style: 'margin-top:14px' }, 'You can also mute a single server: right-click it (or long-press it) in the strip at the top.')].filter(Boolean);

  const voice = () => {
    const cfg = AudioSettings.get();
    const sel = (list, cur, fn, none) => h('select', { onchange: e => fn(e.target.value) }, h('option', { value: '' }, none), ...list.map((dv, i) => h('option', { value: dv.deviceId, selected: dv.deviceId === cur }, dv.label || `Device ${i + 1}`)));
    const proc = (label, k, help) => h('label', { class: 'opt' }, h('input', { type: 'checkbox', checked: cfg[k] !== false, onchange: e => { AudioSettings.set({ [k]: e.target.checked }); toast('Applies the next time you join a call.', 'ok'); } }), h('span', {}, label, help ? h('small', {}, help) : null));
    const master = h('input', { type: 'range', min: 0, max: 100, value: Math.round(Voice.master * 100), oninput: e => Voice.setMaster(e.target.value / 100) });
    const turn = h('textarea', { rows: 3, style: 'width:100%;font-family:Consolas,monospace;font-size:12px', placeholder: '{"urls":"turn:example.com:3478","username":"…","credential":"…"}' });
    turn.value = store.get('cc.turn', '') || '';
    return [h('h2', {}, 'Voice'), h('p', { class: 'sub' }, ''),
      h('label', { class: 'f' }, 'Microphone', sel(inputs, cfg.input, id => Voice.active ? Voice.changeInput(id) : AudioSettings.set({ input: id }), 'Default microphone')),
      h('label', { class: 'f' }, 'Speakers', sel(outputs, cfg.output, id => Voice.setOutput(id), 'Default speakers')),
      h('div', { class: 'sliderrow' }, 'Everyone’s volume', master, h('span', {}, '')),
      proc('Noise suppression', 'noise'), proc('Echo cancellation', 'echo'), proc('Automatic volume', 'agc', 'evens out quiet and loud'),
      toggle('Join calls muted', 'joinMuted'),
      toggle('Push to talk', 'ptt', 'the mic is only open while you hold the key', v => Voice.setPtt(v)),
      keycap('Push-to-talk key', 'pttKey', 'works while Camelcord is focused'),
      h('div', { class: 'sect' }, 'Advanced: relay server (TURN)'),
      h('p', { class: 'sub', style: 'margin-bottom:8px;font-size:12.5px' }, 'Only needed if a friend can’t hear you on strict networks. Paste a TURN server as JSON.'), turn,
      h('div', { class: 'foot' }, h('button', { class: 'btn gold', onclick: () => { const t = turn.value.trim(); if (t) { try { JSON.parse(t); } catch (_) { return toast('That TURN setting is not valid JSON.', 'err'); } } store.set('cc.turn', t); toast('Saved.', 'ok'); } }, 'Save'))];
  };

  const keybinds = () => [h('h2', {}, 'Keybinds'), h('p', { class: 'sub' }, 'These work while Camelcord is the window in front.'),
    h('div', { class: 'opt keyrow' }, h('span', {}, 'Mute / unmute', h('small', {}, 'Ctrl + Shift + the key')), h('button', { class: 'btn keycap' }, 'Ctrl+Shift+' + keyName(P.get('muteKey')))),
    keycap('Mute key', 'muteKey'), keycap('Deafen key (Ctrl + Shift +)', 'deafenKey'), keycap('Push-to-talk key', 'pttKey'),
    h('div', { class: 'sect' }, 'Other shortcuts'),
    ...[['Ctrl + F', 'Search the room'], ['Up arrow (empty box)', 'Edit your last message'], ['Enter / Shift + Enter', 'Send / new line'], ['Esc', 'Close a window or menu']].map(([k, d]) => h('div', { class: 'cmd' }, h('code', {}, k), h('span', {}, d)))];

  const behavior = () => [h('h2', {}, 'Behavior'), h('p', { class: 'sub' }, ''),
    toggle('Press Enter to send', 'enterToSend', 'off: Ctrl + Enter sends and Enter makes a new line'),
    select('Show me as idle after', 'autoIdle', [[0, 'Never'], [5, '5 minutes'], [10, '10 minutes'], [30, '30 minutes']], true),
    toggle('Start Camelcord when Windows starts', 'startup', '', v => host.startup(v)),
    h('div', { class: 'sect' }, 'Reset'), h('button', { class: 'btn', onclick: () => confirmModal('Reset settings?', 'Puts every setting on this page back to normal. Your theme and profile stay.', 'Reset', () => { Prefs.reset(); toast('Settings reset.', 'ok'); settingsModal('behavior'); }) }, 'Reset settings')];

  const account = close => {
    const u = S.update;
    const upd = h('span', { class: 'sub' }, u.state === 'ready' ? `Update ${u.version} is ready.` : u.state === 'downloading' ? `Downloading ${u.version}…` : 'You are up to date.');
    return [h('h2', {}, 'Account'), h('p', { class: 'sub' }, `You are signed in as ${nameOnly(Account.user.id)}. This is your Camel Studios account, the same one Camel Client and the games use.`),
      h('div', { class: 'sect' }, 'Updates'),
      h('div', { class: 'pavrow' }, h('span', {}, `Camelcord ${info.version}`), upd,
        h('button', { class: 'btn', onclick: async () => { upd.textContent = 'Checking…'; const s = await host.update.check(); S.update = s; upd.textContent = s.state === 'none' ? 'You are up to date.' : `Update ${s.version} found.`; renderUpdate(); } }, 'Check now'),
        u.state === 'ready' ? h('button', { class: 'btn gold', onclick: () => host.update.install() }, 'Restart to update') : null),
      h('p', { class: 'sub' }, 'Camelcord checks for updates by itself and installs them quietly.'),
      h('div', { class: 'foot' }, h('button', { class: 'btn red', onclick: async () => { close(); await leaveVoice(); await Friends.setPresence('offline'); Account.signOut(); } }, 'Sign out'))];
  };

  modal((box, close) => {
    const pane = h('div', { class: 'pane' }), nav = h('nav', {});
    const tabs = [['appearance', 'Appearance', appearance], ['profile', 'My profile', profile], ['notifications', 'Notifications', notifications], ['voice', 'Voice', voice], ['keybinds', 'Keybinds', keybinds], ['behavior', 'Behavior', behavior], ['account', 'Account', account]];
    const show = id => {
      nav.replaceChildren(h('h4', {}, 'Settings'), ...tabs.map(([k, label]) => h('button', { class: k === id ? 'on' : '', onclick: () => show(k) }, label)));
      pane.replaceChildren(...tabs.find(t => t[0] === id)[2](close));
    };
    box.append(nav, pane);
    show(tab);
  }, 'huge');
}

// ---------------------------------------------------------------- render + wiring
function render() {
  const me = Account.user; if (!me) return;
  // Repair the selection: a server we left, a room that was deleted
  if (S.sel !== 'home' && S.serversLoaded && !Servers.server(S.sel)) { S.sel = 'home'; S.view = { kind: 'friends' }; DMs.close(); Servers.close(); }
  if (S.sel !== 'home' && Servers.server(S.sel)) {
    const chans = Servers.channelsOf(S.sel), v = S.view;
    if (v.kind === 'ticket') { if (v.sid !== S.sel) { S.view = { kind: 'pending', sid: S.sel }; } else if (Servers.active?.cid !== v.cid) Servers.open(v.sid, v.cid); }
    else if (chans.length && (!v.cid || v.sid !== S.sel || !chans.some(c => c.id === v.cid))) {
      const first = chans.find(c => c.kind === 'text') || chans[0];
      S.view = { kind: first.kind, sid: S.sel, cid: first.id };
      if (first.kind === 'text') Servers.open(S.sel, first.id);
    } else if (v.kind === 'text' && Servers.active?.cid !== v.cid) Servers.open(v.sid, v.cid);
  } else if (S.sel === 'home' && S.view.kind === 'dm' && DMs.uid !== S.view.uid) DMs.open(S.view.uid);
  if (S.sel === 'home' && !['friends', 'dm'].includes(S.view.kind)) S.view = { kind: 'friends' };
  // A remembered conversation with someone who is no longer a friend
  if (S.view.kind === 'dm' && Friends.loaded && !friendsAccepted().some(f => f.uid === S.view.uid)) { S.view = { kind: 'friends' }; DMs.close(); }
  DMs.watch(friendsAccepted().map(f => f.uid));
  const want = new Set([me.uid, ...Friends.list.map(f => f.uid)]);
  const srv = S.sel !== 'home' ? Servers.server(S.sel) : null;
  for (const u of srv?.members || []) want.add(u);
  for (const u of Voice.participants.keys()) want.add(u);
  const wkey = [...want].sort().join(',');
  if (S.profKey !== wkey) { S.profKey = wkey; Profiles.watch(want); }
  Bots.sync();
  renderRail(); renderSide(); renderCenter(); renderMembers(); renderIncoming(); renderUpdate();
  const unread = friendsAccepted().filter(f => DMs.unread(f.uid)).length;
  document.title = unread ? `(${unread}) Camelcord` : 'Camelcord';
}

function showScreen(name) {
  for (const id of ['splash', 'login', 'app']) $('#' + id).classList.toggle('hidden', id !== name);
}
function wireLogin() {
  const msg = (t, ok) => { const m = $('#login-msg'); m.textContent = t || ''; m.className = 'login-msg' + (ok ? ' ok' : ''); };
  const mode = m => {
    $('#f-in').classList.toggle('hidden', m !== 'in'); $('#f-up').classList.toggle('hidden', m !== 'up'); $('#f-reset').classList.toggle('hidden', m !== 'reset');
    $('#login-title').textContent = { in: 'Welcome back', up: 'Join Camelcord', reset: 'Reset password' }[m];
    $('#login-sub').textContent = { in: 'Sign in with your Camel Studios account.', up: 'One Camel Studios account for Camelcord, Camel Client and every game.', reset: 'We will email you a link.' }[m];
    msg('');
  };
  $('#l-up').onclick = () => mode('up'); $('#l-in').onclick = () => mode('in'); $('#l-in2').onclick = () => mode('in'); $('#l-reset').onclick = () => mode('reset');
  const run = (form, fn) => form.addEventListener('submit', async e => {
    e.preventDefault(); const b = form.querySelector('button.go'); b.disabled = true; msg('');
    try { await fn(); } catch (err) { msg(nice(err)); } finally { b.disabled = false; }
  });
  run($('#f-in'), () => Account.signIn($('#in-email').value, $('#in-pass').value, $('#in-stay').checked));
  run($('#f-up'), () => Account.signUp($('#up-email').value, $('#up-pass').value, $('#up-name').value, '', true));
  run($('#f-reset'), async () => { await Account.reset($('#rs-email').value); msg('Reset link sent. Check your email.', true); });
}

// Keyboard: push-to-talk, mute / deafen shortcuts, search
function wireKeys() {
  const typing = e => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '');
  document.addEventListener('keydown', e => {
    S.lastActive = Date.now();
    if (Voice.ptt && e.code === Prefs.get('pttKey') && !e.repeat && (!typing(e) || e.code.startsWith('F') || /Control|Alt|Shift|Backquote/.test(e.code))) { Voice.pttHold(true); }
    if (e.ctrlKey && e.shiftKey && e.code === Prefs.get('muteKey')) { e.preventDefault(); Voice.setMuted(!Voice.muted); toast(Voice.muted ? 'Muted' : 'Unmuted'); }
    if (e.ctrlKey && e.shiftKey && e.code === Prefs.get('deafenKey')) { e.preventDefault(); Voice.setDeafened(!Voice.deafened); toast(Voice.deafened ? 'Deafened' : 'Undeafened'); }
    if (e.ctrlKey && e.code === 'KeyF' && !$('#app').classList.contains('hidden') && ['text', 'dm', 'ticket'].includes(S.view.kind)) {
      e.preventDefault(); S.searchOpen = true; schedule(); setTimeout(() => $('#c-search-in')?.focus(), 30);
    }
  });
  document.addEventListener('keyup', e => { if (Voice.ptt && e.code === Prefs.get('pttKey')) Voice.pttHold(false); });
  window.addEventListener('blur', () => Voice.pttHold(false));
  for (const ev of ['mousemove', 'mousedown', 'wheel']) document.addEventListener(ev, () => { S.lastActive = Date.now(); }, { passive: true });
  // Idle: after a quiet spell show as idle; any activity brings you back
  setInterval(async () => {
    if (!Account.user) return;
    const idleMs = Prefs.get('autoIdle') * 60000;
    if (S.status === 'online' && idleMs && Date.now() - S.lastActive > idleMs) await setStatus('idle', true);
    else if (S.status === 'idle' && S.autoIdle && Date.now() - S.lastActive < 5000) await setStatus(store.get('cc.status', 'online') === 'idle' ? 'idle' : 'online');
  }, 15000);
}

function boot() {
  initTheme(); Prefs.apply();
  for (const b of document.querySelectorAll('[data-win]')) b.onclick = () => host.win[b.dataset.win]();
  host.win.onFocus?.(f => { S.focused = f; if (f) host.attention(false); });
  wireLogin(); initCenter(); wireKeys();
  host.update.onState?.(u => { S.update = u; renderUpdate(); });
  host.update.state?.().then(u => { S.update = u; renderUpdate(); }).catch(() => {});

  Friends.onChange = DMs.onChange = Calls.onChange = Profiles.onChange = schedule;
  Servers.onChange = () => { S.serversLoaded = true; Bots.sync(); schedule(); };
  const quiet = (kind, id) => S.focused && ((kind === 'ch' && (S.view.kind === 'text' || S.view.kind === 'ticket') && S.view.cid === id) || (kind === 'dm' && S.view.kind === 'dm' && S.view.uid === id));
  DMs.onIncoming = (uid, m) => {
    if (quiet('dm', uid)) return;
    sfx.msg(); ping(nameOnly(idOf(uid)), m.text || 'Sent a picture');
  };
  Servers.onIncoming = (sid, ch, m) => {
    if (quiet('ch', ch.id) || Servers.isMuted(sid)) return;
    sfx.msg(); ping(`${m.bot ? 'Bot' : nameOnly(idOf(m.from))} in ${ch.name}`, m.text || 'Sent a picture');
  };
  setInterval(() => { if (Account.user) schedule(); }, 20000); // re-check who is still online / in voice, time left on giveaways

  Account.onChange = async user => {
    if (!user) {
      await Voice.leave(); Calls.stop(); Bots.stop(); Servers.stop(); DMs.stop(); Friends.stop(); Profiles.stop();
      S.centerKey = ''; S.profKey = ''; showScreen('login'); return;
    }
    Profiles.start(user); Friends.start(user); DMs.start(user); Servers.start(user); Calls.start(user); Bots.start(user);
    Voice.setPtt(Prefs.get('ptt'));
    if (S.status !== 'online') Friends.setPresence(S.status);
    showScreen('app'); S.centerKey = ''; schedule();
  };
  Account.start();
  window.addEventListener('beforeunload', () => { Friends.setPresence('offline'); });
  setTimeout(() => { if (!Account.ready) showScreen('login'); }, 6000);
}
boot();
if (IS_WEB && 'serviceWorker' in navigator && location.protocol.startsWith('http') && !new URLSearchParams(location.search).has('emu')) navigator.serviceWorker.register('sw.js').catch(() => {});
if (new URLSearchParams(location.search).has('emu')) window.__cc = { Voice, Calls, Friends, DMs, Servers, Account, Profiles, Themes, Prefs, Bots, S };
