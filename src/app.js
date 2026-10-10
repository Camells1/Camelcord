// Camelcord UI: sign in, servers, rooms, friends and direct messages, voice rooms and calls,
// plus themes, profiles, pictures, reactions and custom emoji (all free: "Camelcord Plus").
import { Account, nice } from './account.js';
import { Friends, DMs, pairOf } from './social.js';
import { Servers, COLORS, ICONS } from './servers.js';
import { Voice, Calls, AudioSettings } from './voice.js';
import { Profiles } from './profiles.js';
import { Themes, PRESETS, buildVars, initTheme, themeFromImage, shrinkImage } from './themes.js';

const host = window.camel || { win: { min() {}, max() {}, close() {}, onState() {}, onFocus() {} }, open: u => window.open(u, '_blank'), notify() {}, attention() {}, info: async () => ({ version: 'web' }) };

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
  volume: '<path d="M11 5L6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
  smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  chev: '<path d="M6 9l6 6 6-6"/>',
  crown: '<path d="M2 18h20M3 7l5 5 4-7 4 7 5-5-2 11H5z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  compass: '<circle cx="12" cy="12" r="10"/><path d="M16 8l-2 6-6 2 2-6z"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  signal: '<path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4v16"/>',
  msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  userplus: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/>'
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
const fmtTime = ms => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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
  setTimeout(() => t.remove(), 3600);
}
const fail = e => toast(nice(e), 'err');
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
};
// Pick a picture from disk
function pickFile(accept = 'image/*') {
  return new Promise(res => {
    const i = h('input', { type: 'file', accept, style: 'display:none' });
    i.addEventListener('change', () => { res(i.files[0] || null); i.remove(); });
    document.body.append(i); i.click();
  });
}

// Message text: **bold**, *italic*, `code`, links and :custom: emoji. Built from text nodes, never innerHTML.
function richText(text) {
  const frag = document.createDocumentFragment();
  for (const part of String(text).split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|https?:\/\/[^\s<]+|:[a-z0-9_]{2,20}:)/g)) {
    if (!part) continue;
    if (/^:[a-z0-9_]{2,20}:$/.test(part)) frag.append(emojiNode(part));
    else if (part.startsWith('`') && part.length > 2) frag.append(h('code', {}, part.slice(1, -1)));
    else if (part.startsWith('**') && part.length > 4) frag.append(h('b', {}, part.slice(2, -2)));
    else if (part.startsWith('*') && part.length > 2) frag.append(h('i', {}, part.slice(1, -1)));
    else if (/^https?:\/\//.test(part)) frag.append(h('a', { onclick: () => host.open(part) }, part));
    else frag.append(part);
  }
  return frag;
}

// ---------------------------------------------------------------- sounds
let actx = null;
function tone(freqs, dur = 0.11, vol = 0.05) {
  if (store.get('cc.sounds', '1') === '0') return;
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
const sfx = { msg: () => tone([880, 1175], 0.07), join: () => tone([523, 784], 0.1), leave: () => tone([659, 392], 0.1) };
let ringTimer = null;
function ring(on) {
  if (on && !ringTimer) { const go = () => tone([740, 988, 740, 988], 0.16, 0.06); go(); ringTimer = setInterval(go, 2200); host.attention(true); }
  if (!on && ringTimer) { clearInterval(ringTimer); ringTimer = null; host.attention(false); }
}

// ---------------------------------------------------------------- state
const S = {
  sel: 'home',                       // 'home' or a server id
  view: { kind: 'friends' },         // friends | dm {uid} | text {sid,cid} | voice {sid,cid}
  tab: 'online',                     // friends tab: online | all | pending | add
  raf: 0, centerKey: '', focused: true, presKey: '', serversLoaded: false, attach: '',
  hideMembers: store.get('cc.hidePeople', '0') === '1'
};
try { const n = JSON.parse(store.get('cc.nav', 'null')); if (n?.sel) { S.sel = n.sel; S.view = n.view || S.view; } } catch (_) {}
const drafts = new Map();
const schedule = () => { if (!S.raf) S.raf = requestAnimationFrame(() => { S.raf = 0; render(); }); };

function idOf(uid) {
  const me = Account.user;
  if (uid === me.uid) return me.id;
  const f = Friends.list.find(x => x.uid === uid); if (f) return f.id;
  for (const s of Servers.list) if (s.ids?.[uid]) return s.ids[uid];
  return Profiles.get(uid)?.id || 'Someone';
}
const friendsAccepted = () => Friends.list.filter(f => f.status === 'accepted');
const statusText = uid => ({ online: 'Online', ingame: 'Playing', offline: 'Offline' }[Friends.statusOf(uid)]);
const profileStatus = id => Profiles.forId(id)?.status || '';
function go(sel, view) {
  S.sel = sel; S.view = view;
  store.set('cc.nav', JSON.stringify({ sel, view }));
  if (view.kind === 'dm') DMs.open(view.uid); else DMs.close();
  if (view.kind === 'text') Servers.open(view.sid, view.cid); else Servers.close();
  schedule();
}
function openServer(sid) {
  const chans = Servers.channelsOf(sid), first = chans.find(c => c.kind === 'text') || chans[0];
  if (first) go(sid, { kind: first.kind, sid, cid: first.id });
  else { S.sel = sid; S.view = { kind: 'pending', sid }; schedule(); }
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
  const m = h('div', { class: 'menu' }, items.map(it => it === '-' ? h('hr') : h('button', { class: it.danger ? 'danger' : '', onclick: () => { closeOverlays(); it.fn(); } }, it.label, it.icon ? svgEl(it.icon) : null)));
  popup(m, x, y);
}
document.addEventListener('mousedown', e => {
  if (!e.target.closest('.menu, .card, .modal, .emoji-pop, [data-keep]')) for (const el of [...layer().children]) if (/\b(menu|card|emoji-pop)\b/.test(el.className)) el.remove();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOverlays(); });

const STD_EMOJI = '😀 😂 🤣 😊 😍 😎 🤔 😅 😭 😡 😴 🥳 👍 👎 👏 🙏 💪 🔥 ✨ ❤️ 💀 👀 🎉 🌟 🎮 🎵 🍕 🍔 ☕ 🏆 🚀 💯 ✅ ❌ 😈 🤝 🫡 🥲 😤 🤯 😬 🙃 😇 🤠 🧠 👾 🐪 🌵'.split(' ');
// An emoji picker next to a button: standard emoji, every custom emoji from your servers, and "add emoji"
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
  const me = Account.user, isMe = uid === me.uid, friend = Friends.isFriend(uid), st = isMe ? 'online' : Friends.statusOf(uid);
  const sid = S.sel !== 'home' ? S.sel : null, srv = sid && Servers.server(sid);
  const p = Profiles.forId(id) || Profiles.get(uid) || {};
  const name = nameOnly(id);
  const btn = (label, cls, fn) => h('button', { class: 'btn ' + cls, onclick: () => { closeOverlays(); fn(); } }, label);
  const btns = [];
  if (isMe) btns.push(btn('Edit profile', 'gold', () => settingsModal('profile')));
  if (!isMe && friend) { btns.push(btn('Message', 'gold', () => go('home', { kind: 'dm', uid }))); btns.push(btn('Call', 'green', () => startCall(uid))); }
  if (!isMe && !friend) btns.push(btn('Add friend', 'gold', () => Friends.addUid(uid, id).then(m => toast(m, 'ok')).catch(fail)));
  if (srv && srv.owner === me.uid && !isMe) btns.push(btn('Remove', 'red', () => Servers.kick(sid, uid).then(() => toast(`${name} was removed.`, 'ok')).catch(fail)));
  const card = h('div', { class: 'card' },
    h('div', { class: 'banner', style: p.banner ? `background-image:url('${p.banner}')` : `background:linear-gradient(135deg,${colorOf(id)},var(--bg2))` }),
    h('div', { class: 'in' }, avatar(id), h('h4', { style: `color:${nameColor(id)}` }, name),
      h('div', { class: 'st' }, (srv && srv.owner === uid ? '👑 Owner · ' : '') + (isMe ? 'This is you' : ({ online: 'Online', ingame: 'Playing', offline: 'Offline' }[st] || 'Offline')) + (p.status ? ' · ' + p.status : '')),
      p.bio ? h('div', { class: 'bio' }, p.bio) : null,
      btns.length ? h('div', { class: 'btns' }, btns) : null));
  popup(card, x, y);
}

// ---------------------------------------------------------------- calls
async function startCall(uid) {
  const f = Friends.list.find(x => x.uid === uid && x.status === 'accepted');
  if (!f) return;
  go('home', { kind: 'dm', uid });
  try { await Calls.call(f.pair, nameOnly(f.id)); } catch (e) { fail(e); }
}
async function joinVoice(sid, cid) {
  const ch = Servers.channelsOf(sid).find(c => c.id === cid), srv = Servers.server(sid);
  if (!ch) return;
  const path = Servers.channelPath(sid, cid);
  if (Voice.isIn(path)) return;
  if (Calls.outgoing) await Calls.hangup();
  await Voice.join(path, `${ch.name} · ${srv?.name || ''}`, 'channel', Account.user);
  if (Voice.error) toast(Voice.error, 'err');
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

// ---------------------------------------------------------------- server strip (top)
function renderRail() {
  const rail = $('#rail');
  const dmUnread = friendsAccepted().filter(f => DMs.unread(f.uid)).length + Friends.list.filter(f => f.incoming).length;
  const items = [];
  items.push(h('button', { class: 'rail-btn home' + (S.sel === 'home' ? ' active' : ''), title: 'Home', onclick: () => go('home', S.view.kind === 'dm' || S.view.kind === 'friends' ? S.view : { kind: 'friends' }) },
    camelSvg(26), dmUnread ? h('span', { class: 'badge' }, dmUnread) : null));
  items.push(h('div', { class: 'rail-sep' }));
  for (const s of Servers.list) {
    const unread = Servers.unreadServer(s.id) && S.sel !== s.id, active = S.sel === s.id;
    const style = s.img ? `background-image:linear-gradient(rgba(0,0,0,.25),rgba(0,0,0,.25)),url('${s.img}')` : `background-color:${s.color || COLORS[0]}`;
    items.push(h('button', { class: 'rail-btn' + (active ? ' active' : '') + (unread ? ' unread' : ''), title: s.name, style, onclick: () => openServer(s.id) },
      s.img ? null : (s.icon || nameOnly(s.name)[0]), active ? h('span', { class: 'nm' }, s.name) : null));
  }
  items.push(h('button', { class: 'rail-btn add', title: 'Create a server', onclick: createServerModal }, '+'));
  items.push(h('button', { class: 'rail-btn join', title: 'Join a server with an invite code', onclick: joinServerModal }, svgEl('compass')));
  rail.replaceChildren(...items);
}

// ---------------------------------------------------------------- left column
function userBar() {
  const me = Account.user;
  return h('div', { class: 'userbar' },
    h('div', { class: 'who', title: 'Settings and profile', onclick: () => settingsModal() }, avatar(me.id, '', 'online'),
      h('div', {}, h('b', {}, nameOnly(me.id)), h('span', {}, profileStatus(me.id) || 'Online'))),
    h('button', { class: 'ibtn' + (Voice.muted ? ' on' : ''), title: Voice.muted ? 'Unmute' : 'Mute', onclick: () => Voice.setMuted(!Voice.muted) }, svgEl(Voice.muted ? 'micoff' : 'mic')),
    h('button', { class: 'ibtn' + (Voice.deafened ? ' on' : ''), title: Voice.deafened ? 'Undeafen' : 'Deafen', onclick: () => Voice.setDeafened(!Voice.deafened) }, svgEl(Voice.deafened ? 'headoff' : 'head')),
    h('button', { class: 'ibtn', title: 'Settings', onclick: () => settingsModal() }, svgEl('sliders')));
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
        h('div', { class: 'label' }, nameOnly(f.id), h('span', { class: 'sub' }, inCall ? 'In a call' : (profileStatus(f.id) || (st === 'ingame' ? 'Playing' : st === 'online' ? 'Online' : 'Offline')))),
        h('div', { class: 'acts' }, h('button', { title: 'Call', onclick: e => { e.stopPropagation(); startCall(f.uid); } }, svgEl('phone')))));
    }
    scroll = h('div', { class: 'side-scroll' }, rows);
  } else {
    const srv = Servers.server(S.sel);
    if (!srv) { side.replaceChildren(userBar()); return; }
    const owner = srv.owner === me.uid;
    head = h('div', { class: 'side-head', onclick: e => serverMenu(srv, e.currentTarget.getBoundingClientRect()) }, h('span', { class: 'name' }, srv.name), svgEl('chev'));
    const chans = Servers.channelsOf(srv.id), text = chans.filter(c => c.kind === 'text'), voice = chans.filter(c => c.kind === 'voice');
    const rows = [];
    const label = (t, kind) => h('div', { class: 'side-label' }, t, owner ? h('button', { title: 'Add a room', onclick: () => channelModal(srv.id, kind) }, svgEl('plus')) : null);
    rows.push(label('Chat rooms', 'text'));
    for (const c of text) rows.push(h('div', { class: 'row ch' + (S.view.kind === 'text' && S.view.cid === c.id ? ' active' : '') + (Servers.unread(srv.id, c.id) ? ' unread' : ''), onclick: () => go(srv.id, { kind: 'text', sid: srv.id, cid: c.id }), oncontextmenu: e => { e.preventDefault(); channelMenu(e, srv, c); } },
      svgEl('room'), h('span', { class: 'label' }, c.name)));
    rows.push(label('Voice rooms', 'voice'));
    for (const c of voice) {
      const path = Servers.channelPath(srv.id, c.id), people = Servers.voiceOf(srv.id, c.id), here = Voice.isIn(path);
      rows.push(h('div', { class: 'row ch' + (S.view.kind === 'voice' && S.view.cid === c.id ? ' active' : '') + (here ? ' live' : ''), onclick: () => { go(srv.id, { kind: 'voice', sid: srv.id, cid: c.id }); joinVoice(srv.id, c.id); }, oncontextmenu: e => { e.preventDefault(); channelMenu(e, srv, c); } },
        svgEl('volume'), h('span', { class: 'label' }, c.name)));
      if (people.length) rows.push(h('div', { class: 'vusers' }, people.map(p => {
        const talking = here && Voice.speaking.has(p.uid);
        return h('div', { class: 'vuser' }, avatar(p.id || '', 'sm' + (talking ? ' talk' : '')),
          h('span', { class: 'name' }, nameOnly(p.id)), p.deafened ? svgEl('headoff') : p.muted ? svgEl('micoff') : null);
      })));
    }
    if (!chans.length) rows.push(h('div', { class: 'empty' }, 'Loading rooms…'));
    scroll = h('div', { class: 'side-scroll' }, rows);
  }
  side.replaceChildren(...[userBar(), head, scroll, voiceBar()].filter(Boolean));
}
function serverMenu(srv, rect) {
  const owner = srv.owner === Account.user.uid;
  const items = [{ label: 'Invite people', icon: 'userplus', fn: () => inviteModal(srv) }];
  if (owner) items.push({ label: 'Server settings', icon: 'sliders', fn: () => serverSettingsModal(srv) }, { label: 'Add a chat room', icon: 'room', fn: () => channelModal(srv.id, 'text') }, { label: 'Add a voice room', icon: 'volume', fn: () => channelModal(srv.id, 'voice') });
  else items.push({ label: 'Add custom emoji', icon: 'smile', fn: () => addEmojiFlow(srv.id) });
  items.push('-');
  items.push(owner ? { label: 'Delete server', icon: 'trash', danger: true, fn: () => confirmModal(`Delete ${srv.name}?`, 'This removes the server, its rooms and every message for everyone. This cannot be undone.', 'Delete server', () => Servers.remove(srv.id).then(() => { go('home', { kind: 'friends' }); toast('Server deleted.', 'ok'); }).catch(fail)) }
    : { label: 'Leave server', icon: 'logout', danger: true, fn: () => confirmModal(`Leave ${srv.name}?`, "You'll need a new invite to come back.", 'Leave server', () => { if (Voice.room?.path.startsWith(`cc_servers/${srv.id}/`)) Voice.leave(); Servers.leave(srv.id).then(() => go('home', { kind: 'friends' })).catch(fail); }) });
  menu(rect.left + 8, rect.bottom + 4, items);
}
function channelMenu(e, srv, c) {
  if (srv.owner !== Account.user.uid) return;
  menu(e.clientX, e.clientY, [{ label: 'Delete room', icon: 'trash', danger: true, fn: () => confirmModal(`Delete ${c.name}?`, 'Everything in this room will be gone for everyone.', 'Delete room', () => Servers.deleteChannel(srv.id, c.id).catch(fail)) }]);
}

// ---------------------------------------------------------------- center
function initCenter() {
  const c = $('#center');
  c.replaceChildren(h('div', { class: 'head', id: 'c-head' }), h('div', { class: 'page hidden', id: 'c-page' }), h('div', { class: 'stage hidden', id: 'c-stage' }), h('div', { class: 'msgs hidden', id: 'c-msgs' }), h('div', { class: 'composer hidden', id: 'c-comp' }));
  const ta = h('textarea', { id: 'c-input', rows: 1, maxlength: 4000,
    onkeydown: e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }, oninput: autoGrow,
    onpaste: e => { const f = [...(e.clipboardData?.files || [])].find(x => x.type.startsWith('image/')); if (f) { e.preventDefault(); attachFile(f); } } });
  $('#c-comp').append(h('div', { id: 'c-att' }), h('div', { class: 'box' },
    h('button', { class: 'ibtn', title: 'Send a picture or GIF', onclick: async () => { const f = await pickFile(); if (f) attachFile(f); } }, svgEl('image')),
    ta,
    h('button', { class: 'ibtn', 'data-keep': 1, title: 'Emoji', onclick: e => emojiPicker(e.currentTarget, ins => { ta.setRangeText(ins, ta.selectionStart, ta.selectionEnd, 'end'); ta.focus(); autoGrow(); }) }, svgEl('smile')),
    h('button', { class: 'ibtn send', title: 'Send', onclick: sendMessage }, svgEl('send'))));
  // Drop a picture anywhere on the chat
  let depth = 0;
  c.addEventListener('dragenter', e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { depth++; if (depth === 1) c.append(h('div', { class: 'drop', id: 'c-drop' }, 'Drop the picture to send it')); } });
  c.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) $('#c-drop')?.remove(); });
  c.addEventListener('dragover', e => e.preventDefault());
  c.addEventListener('drop', e => { e.preventDefault(); depth = 0; $('#c-drop')?.remove(); const f = [...(e.dataTransfer?.files || [])].find(x => x.type.startsWith('image/')); if (f && !$('#c-comp').classList.contains('hidden')) attachFile(f); });
}
function autoGrow() { const t = $('#c-input'); t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 180) + 'px'; }
async function attachFile(file) {
  try {
    S.attach = await shrinkImage(file, { max: 1600, quality: 0.82, maxChars: 880000 });
    paintAttach();
  } catch (e) { toast(e.message || 'Could not use that picture.', 'err'); }
}
function paintAttach() {
  const el = $('#c-att');
  el.replaceChildren(...(S.attach ? [h('div', { class: 'att-chip' }, h('img', { src: S.attach }), h('button', { class: 'ibtn', title: 'Remove', onclick: () => { S.attach = ''; paintAttach(); } }, svgEl('x')))] : []));
}
async function sendMessage() {
  const ta = $('#c-input'), text = ta.value.trim(), img = S.attach;
  if (!text && !img) return;
  ta.value = ''; autoGrow(); S.attach = ''; paintAttach();
  try {
    if (S.view.kind === 'dm') await DMs.send(text, img);
    else if (S.view.kind === 'text') await Servers.send(text, img);
  } catch (e) { ta.value = text; S.attach = img; paintAttach(); autoGrow(); toast(e.code === 'permission-denied' ? 'Slow down a little (or you were removed from this chat).' : nice(e), 'err'); }
}

function viewKey() { const v = S.view; return v.kind + ':' + (v.uid || v.cid || v.sid || ''); }
function renderCenter() {
  const v = S.view, key = viewKey(), changed = key !== S.centerKey;
  const head = $('#c-head'), page = $('#c-page'), stage = $('#c-stage'), msgs = $('#c-msgs'), comp = $('#c-comp');
  if (changed) {
    const old = S.centerKey; if (old) drafts.set(old, $('#c-input').value);
    S.centerKey = key; $('#c-input').value = drafts.get(key) || ''; autoGrow(); S.firstFill = true; S.attach = ''; paintAttach();
  }
  const me = Account.user;
  let showPage = false, showStage = false, mini = false, showMsgs = false, showComp = false;
  let title = [];
  const peopleBtn = S.sel !== 'home' ? h('button', { class: 'ibtn' + (S.hideMembers ? '' : ' sel'), title: 'Show or hide people', onclick: () => { S.hideMembers = !S.hideMembers; store.set('cc.hidePeople', S.hideMembers ? '1' : '0'); schedule(); } }, svgEl('users')) : null;
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
    title = [avatar(id, 'sm', st), nameOnly(id), h('span', { class: 'status' }, profileStatus(id) || statusText(v.uid)), h('span', { class: 'grow' }),
      inCall ? h('button', { class: 'btn red', onclick: leaveVoice }, 'End call') : h('button', { class: 'ibtn', title: 'Start a voice call', onclick: () => startCall(v.uid) }, svgEl('phone'))];
    showMsgs = true; showComp = true;
    if (inCall) { showStage = true; mini = true; renderStage(stage, true); }
    renderMessages(msgs, DMs.messages, { sid: null }, nameOnly(id), DMs.error);
    $('#c-input').placeholder = `Message ${nameOnly(id)}`;
  } else if (v.kind === 'text') {
    const ch = Servers.channelsOf(v.sid).find(c => c.id === v.cid);
    title = [svgEl('room'), ch?.name || '…', h('span', { class: 'grow' }), peopleBtn];
    showMsgs = true; showComp = true;
    renderMessages(msgs, Servers.messages, { sid: v.sid, cid: v.cid }, ch?.name || '', Servers.error);
    $('#c-input').placeholder = `Message ${ch?.name || 'room'}`;
  } else if (v.kind === 'voice') {
    const ch = Servers.channelsOf(v.sid).find(c => c.id === v.cid);
    title = [svgEl('volume'), ch?.name || '…', h('span', { class: 'topic' }, 'Voice room'), h('span', { class: 'grow' }), peopleBtn];
    showStage = true; renderStage(stage, false);
  } else title = ['Loading…'];
  head.replaceChildren(...title.filter(Boolean));
  page.classList.toggle('hidden', !showPage);
  stage.classList.toggle('hidden', !showStage); stage.classList.toggle('mini', mini);
  msgs.classList.toggle('hidden', !showMsgs);
  comp.classList.toggle('hidden', !showComp);
  if (changed && showComp) setTimeout(() => $('#c-input').focus(), 0);
}

function toggleReaction(ctx, m, key) {
  const on = !(m.re?.[key] || []).includes(Account.user.uid);
  const p = ctx.sid ? Servers.react(ctx.sid, ctx.cid, m.id, key, on) : DMs.react(m.id, key, on);
  p.catch(fail);
}
function renderMessages(el, list, ctx, name, error) {
  const stick = S.firstFill || el.scrollHeight - el.scrollTop - el.clientHeight < 90;
  const me = Account.user, owner = ctx.sid && Servers.server(ctx.sid)?.owner === me.uid;
  const kids = [];
  if (error) kids.push(h('div', { class: 'note err', style: 'margin:12px 16px' }, error));
  if (list.length < 100) kids.push(h('div', { class: 'welcome' },
    h('div', { class: 'big' }, ctx.sid ? '💬' : '👋'), h('h2', {}, ctx.sid ? `Welcome to ${name}` : name),
    h('p', {}, ctx.sid ? 'This is the start of the room. Say something!' : 'This is the start of your conversation. Say hi!')));
  let prevDay = '';
  list.forEach((m, i) => {
    const prev = list[i - 1], next = list[i + 1], day = dayKey(m.at);
    if (day !== prevDay) { kids.push(h('div', { class: 'day' }, h('span', {}, dayLabel(m.at)))); prevDay = day; }
    const first = !(prev && prev.from === m.from && Math.abs(m.at - prev.at) <= 5 * 60 * 1000 && dayKey(prev.at) === day);
    const last = !(next && next.from === m.from && Math.abs(next.at - m.at) <= 5 * 60 * 1000 && dayKey(next.at) === day);
    const mine = m.from === me.uid, id = idOf(m.from);
    const canDelete = ctx.sid && (mine || owner) && !m.pending;
    const res = Object.entries(m.re || {}).filter(([, u]) => u.length);
    kids.push(h('div', { class: 'msg' + (first ? ' first' : '') + (mine ? ' mine' : '') + (m.pending ? ' pending' : '') },
      h('div', { class: 'gut' }, last && !mine ? h('div', { onclick: e => profileCard(m.from, id, e.clientX + 8, e.clientY) }, avatar(id)) : null),
      h('div', { class: 'bubble' },
        first && !mine ? h('span', { class: 'who', style: `color:${nameColor(id)}`, onclick: e => profileCard(m.from, id, e.clientX + 8, e.clientY) }, nameOnly(id)) : null,
        m.text ? h('div', { class: 'text' }, richText(m.text)) : null,
        m.img ? h('img', { class: 'attach', src: m.img, onclick: () => lightbox(m.img) }) : null,
        res.length ? h('div', { class: 'res' }, res.map(([k, u]) => h('button', { class: 're' + (u.includes(me.uid) ? ' me' : ''), onclick: () => toggleReaction(ctx, m, k) }, emojiNode(reShow(k)), String(u.length)))) : null,
        h('span', { class: 'when' }, fmtTime(m.at))),
      m.pending ? null : h('div', { class: 'tools' },
        h('button', { title: 'React', 'data-keep': 1, onclick: e => emojiPicker(e.currentTarget, em => toggleReaction(ctx, m, reKey(em))) }, svgEl('smile')),
        canDelete ? h('button', { class: 'del', title: 'Delete message', onclick: () => Servers.deleteMessage(ctx.sid, ctx.cid, m.id).catch(fail) }, svgEl('trash')) : null)));
  });
  el.replaceChildren(...kids);
  if (stick) el.scrollTop = el.scrollHeight;
  S.firstFill = false;
}

// A voice room: server voice room (full) or a call inside a DM (mini)
function renderStage(el, mini) {
  const me = Account.user, v = S.view;
  let path, tiles = [], connected = false;
  if (mini) path = `cc_calls/${pairOf(me.uid, v.uid)}`; else path = Servers.channelPath(v.sid, v.cid);
  connected = Voice.isIn(path);
  if (connected) {
    const seen = new Set([me.uid]);
    tiles.push({ uid: me.uid, id: me.id, muted: Voice.muted, deafened: Voice.deafened, talking: Voice.speaking.has(me.uid), conn: 'connected' });
    for (const p of Voice.participants.values()) if (!seen.has(p.uid)) { seen.add(p.uid); tiles.push({ ...p, talking: Voice.speaking.has(p.uid), conn: Voice.conn.get(p.uid) || 'connecting' }); }
    if (mini && !seen.has(v.uid)) tiles.push({ uid: v.uid, id: idOf(v.uid), ringing: true });
  } else if (!mini) {
    for (const p of Servers.voiceOf(v.sid, v.cid)) tiles.push({ uid: p.uid, id: p.id, muted: p.muted, deafened: p.deafened });
  }
  const tile = t => h('div', { class: 'tile' + (t.talking ? ' talk' : '') + (t.ringing ? ' ring' : ''), style: `--tint:${colorOf(t.id)}`, onclick: e => profileCard(t.uid, t.id, e.clientX, e.clientY) },
    avatar(t.id), t.conn === 'connecting' && t.uid !== me.uid ? h('span', { class: 'conn' }, 'connecting…') : null,
    h('div', { class: 'nm' }, h('span', {}, nameOnly(t.id) + (t.ringing ? ' (calling…)' : '')), t.deafened ? svgEl('headoff') : t.muted ? svgEl('micoff') : null));
  const hint = Voice.error && connected ? h('div', { class: 'stage-hint err' }, Voice.error) : (connected && Voice.noMic ? h('div', { class: 'stage-hint err' }, 'No microphone found: you can listen but not talk.') : h('div', { class: 'stage-hint' }, ''));
  const ctl = connected
    ? h('div', { class: 'controls' },
      h('button', { class: 'cbtn' + (Voice.muted ? ' off' : ''), title: Voice.muted ? 'Unmute' : 'Mute', onclick: () => Voice.setMuted(!Voice.muted) }, svgEl(Voice.muted ? 'micoff' : 'mic')),
      h('button', { class: 'cbtn' + (Voice.deafened ? ' off' : ''), title: Voice.deafened ? 'Undeafen' : 'Deafen', onclick: () => Voice.setDeafened(!Voice.deafened) }, svgEl(Voice.deafened ? 'headoff' : 'head')),
      h('button', { class: 'cbtn end', title: 'Leave', onclick: leaveVoice }, svgEl('phone', 'hang')))
    : h('div', { class: 'controls' }, h('button', { class: 'cbtn join', onclick: () => joinVoice(v.sid, v.cid) }, svgEl('phone'), 'Join voice'));
  el.replaceChildren(h('div', { class: 'tiles' }, tiles.length ? tiles.map(tile) : h('div', { class: 'empty' }, 'Nobody is here yet. Be the first to join!')), hint, ctl);
}

function renderFriendsPage(el) {
  const kids = [];
  if (Friends.error) kids.push(h('div', { class: 'note err' }, Friends.error));
  const row = (f, acts) => {
    const st = Friends.statusOf(f.uid);
    return h('div', { class: 'frow' }, avatar(f.id, 'lg', f.status === 'accepted' ? st : ''),
      h('div', { class: 'nm' }, h('b', { style: `color:${nameColor(f.id)}` }, nameOnly(f.id)),
        h('span', {}, f.status === 'pending' ? (f.incoming ? 'Wants to be friends' : 'Request sent') : (profileStatus(f.id) || statusText(f.uid)))),
      h('div', { class: 'acts' }, acts));
  };
  if (S.tab === 'add') {
    if (el.dataset.tab === 'add' && el.querySelector('input')) return; // keep the typing box steady
    const input = h('input', { placeholder: 'Their username', maxlength: 24, onkeydown: e => { if (e.key === 'Enter') go2(); } });
    const out = h('div');
    const go2 = async () => {
      try { const m = await Friends.add(input.value); out.replaceChildren(h('div', { class: 'note ok' }, m)); input.value = ''; }
      catch (e) { out.replaceChildren(h('div', { class: 'note err' }, nice(e))); }
    };
    kids.push(h('h3', {}, 'Add a friend'), h('p', { style: 'color:var(--dim);margin:0 0 14px' }, `Type their username. Yours is ${nameOnly(Account.user.id)}.`),
      h('div', { class: 'addbox' }, input, h('button', { class: 'btn gold', onclick: go2 }, 'Send request')), out);
  } else {
    const all = Friends.list;
    let list, label;
    if (S.tab === 'pending') { list = all.filter(f => f.status === 'pending'); label = `Pending — ${list.length}`; }
    else if (S.tab === 'all') { list = all.filter(f => f.status === 'accepted'); label = `All friends — ${list.length}`; }
    else { list = all.filter(f => f.status === 'accepted' && Friends.statusOf(f.uid) !== 'offline'); label = `Online — ${list.length}`; }
    kids.push(h('h3', {}, label));
    if (!list.length) kids.push(h('div', { class: 'empty' }, S.tab === 'pending' ? 'No pending requests.' : S.tab === 'all' ? 'No friends yet. Use “Add friend” to find someone.' : 'Nobody is online right now.'));
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
      kids.push(row(f, acts));
    }
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
  if (!srv) { el.replaceChildren(); return; }
  const rows = srv.members.map(uid => ({ uid, id: srv.ids?.[uid] || idOf(uid), st: uid === Account.user.uid ? 'online' : Friends.statusOf(uid) }));
  const byName = (a, b) => nameOnly(a.id).localeCompare(nameOnly(b.id));
  const on = rows.filter(r => r.st !== 'offline').sort(byName), off = rows.filter(r => r.st === 'offline').sort(byName);
  const mk = r => h('div', { class: 'member' + (r.st === 'offline' ? ' off' : ''), onclick: e => profileCard(r.uid, r.id, e.clientX - 310, e.clientY) },
    avatar(r.id, '', r.st), h('span', { class: 'nm', style: Profiles.forId(r.id)?.nameColor ? `color:${nameColor(r.id)}` : '' }, nameOnly(r.id), profileStatus(r.id) ? h('small', {}, profileStatus(r.id)) : null),
    srv.owner === r.uid ? svgEl('crown', 'crown') : null);
  el.replaceChildren(...[h('div', { class: 'm-label' }, `Online — ${on.length}`), ...on.map(mk), off.length ? h('div', { class: 'm-label' }, `Offline — ${off.length}`) : null, ...off.map(mk)].filter(Boolean));
  const key = srv.members.join(',');
  if (S.presKey !== key) { S.presKey = key; Friends.watchPresence(srv.members.filter(u => u !== Account.user.uid), 'server'); }
}

// ---------------------------------------------------------------- incoming call card
function renderIncoming() {
  let el = $('#inc');
  const c = Calls.incoming;
  if (!c || Voice.room?.path === `cc_calls/${c.id}`) { el?.remove(); ring(false); return; }
  const f = Friends.list.find(x => x.uid === c.from), id = f?.id || idOf(c.from);
  ring(true);
  const node = h('div', { class: 'incoming', id: 'inc' }, avatar(id), h('b', {}, nameOnly(id)), h('span', {}, 'is calling you…'),
    h('div', { class: 'btns' },
      h('button', { class: 'cbtn end', title: 'Decline', onclick: () => Calls.decline() }, svgEl('phone', 'hang')),
      h('button', { class: 'cbtn', style: 'background:var(--green);color:#07140d', title: 'Answer', onclick: async () => { go('home', { kind: 'dm', uid: c.from }); await Calls.answer(nameOnly(id)); if (Voice.error) toast(Voice.error, 'err'); } }, svgEl('phone'))));
  if (el) el.replaceWith(node); else layer().append(node);
}

// ---------------------------------------------------------------- modals
function confirmModal(title, text, label, fn) {
  modal((box, close) => box.append(h('h2', {}, title), h('p', { class: 'sub' }, text),
    h('div', { class: 'foot' }, h('button', { class: 'btn ghost', onclick: close }, 'Cancel'), h('button', { class: 'btn red', onclick: () => { close(); fn(); } }, label))));
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
      try { const sid = await Servers.create(name.value, icon, color, img); close(); toast('Server created!', 'ok'); afterJoin(sid); }
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
        if (!found) {
          found = await Servers.peekInvite(code.value);
          out.replaceChildren(h('div', { class: 'preview' }, h('div', { class: 'rail-btn', style: `background-color:${found.color};cursor:default;width:44px` }, found.icon), h('div', {}, h('b', {}, found.name), h('div', { style: 'color:var(--dim);font-size:12.5px' }, 'You have been invited to join'))));
          btn.textContent = `Join ${found.name}`;
        } else { const sid = await Servers.join(found.code); close(); toast(`Joined ${found.name}!`, 'ok'); afterJoin(sid); }
      } catch (e) { found = null; btn.textContent = 'Find server'; out.replaceChildren(h('div', { class: 'note err' }, nice(e))); }
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
    let k = kind || 'text';
    const name = h('input', { maxlength: 24 });
    const choice = h('div', { class: 'choice' });
    const paint = () => {
      choice.replaceChildren(h('button', { class: k === 'text' ? 'sel' : '', onclick: () => { k = 'text'; paint(); } }, svgEl('room'), 'Chat'), h('button', { class: k === 'voice' ? 'sel' : '', onclick: () => { k = 'voice'; paint(); } }, svgEl('volume'), 'Voice'));
      name.placeholder = k === 'text' ? 'new-room' : 'New voice room';
    };
    const make = h('button', { class: 'btn gold', onclick: async () => { try { await Servers.addChannel(sid, name.value, k); close(); } catch (e) { fail(e); } } }, 'Add room');
    name.addEventListener('keydown', e => { if (e.key === 'Enter') make.click(); });
    box.append(h('h2', {}, 'Add a room'), h('p', { class: 'sub' }, ''), choice, h('label', { class: 'f' }, 'Room name', name), h('div', { class: 'foot' }, h('button', { class: 'btn ghost', onclick: close }, 'Cancel'), make));
    paint(); setTimeout(() => name.focus(), 0);
  });
}
function serverSettingsModal(srv) {
  modal((box, close) => {
    const name = h('input', { maxlength: 30, value: srv.name });
    const iconRow = h('div', { class: 'pavrow' });
    const paintIcon = () => iconRow.replaceChildren(
      h('div', { class: 'rail-btn', style: srv.img ? `background-image:url('${srv.img}');width:48px;height:48px;cursor:default` : `background-color:${srv.color};width:48px;height:48px;cursor:default` }, srv.img ? null : srv.icon),
      h('button', { class: 'btn', onclick: async () => { const f = await pickFile(); if (!f) return; try { srv.img = await shrinkImage(f, { max: 128, square: true, maxChars: 38000 }); await Servers.setIconImage(srv.id, srv.img); paintIcon(); } catch (e) { fail(e); } } }, 'Upload picture'),
      srv.img ? h('button', { class: 'btn ghost', onclick: async () => { srv.img = ''; await Servers.setIconImage(srv.id, '').catch(fail); paintIcon(); } }, 'Remove') : null);
    paintIcon();
    const emojis = [...Servers.emoji.values()].filter(c => c.sid === srv.id);
    const emojiRow = c => h('div', { class: 'frow' }, h('img', { class: 'cemoji', src: c.img, style: 'width:32px;height:32px' }), h('div', { class: 'nm' }, h('b', {}, ':' + c.name + ':')),
      h('button', { class: 'btn ghost', onclick: e => Servers.deleteEmoji(srv.id, c.name).then(() => e.target.closest('.frow').remove()).catch(fail) }, 'Delete'));
    const members = srv.members.map(uid => {
      const id = srv.ids?.[uid] || idOf(uid);
      return h('div', { class: 'frow' }, avatar(id), h('div', { class: 'nm' }, h('b', {}, nameOnly(id))), uid === srv.owner ? svgEl('crown', 'crown') : h('button', { class: 'btn ghost', onclick: e => { Servers.kick(srv.id, uid).then(() => e.target.closest('.frow').remove()).catch(fail); } }, 'Remove'));
    });
    box.append(h('h2', {}, 'Server settings'), h('p', { class: 'sub' }, ''), h('label', { class: 'f' }, 'Server name', name), h('label', { class: 'f' }, 'Server picture', iconRow),
      h('div', { class: 'sect' }, `Custom emoji — ${emojis.length}`), ...(emojis.length ? emojis.map(emojiRow) : [h('p', { class: 'sub' }, 'None yet. Anyone in the server can add some from the emoji picker.')]),
      h('div', { class: 'sect' }, `People — ${srv.members.length}`), ...members,
      h('div', { class: 'foot' }, h('button', { class: 'btn ghost', onclick: close }, 'Close'), h('button', { class: 'btn gold', onclick: () => Servers.rename(srv.id, name.value).then(() => { close(); toast('Saved.', 'ok'); }).catch(fail) }, 'Save')));
  }, 'wide');
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

// ---- settings: appearance, profile, voice, account
async function settingsModal(tab = 'appearance') {
  let inputs = [], outputs = [];
  try { const devs = await navigator.mediaDevices.enumerateDevices(); inputs = devs.filter(d => d.kind === 'audioinput'); outputs = devs.filter(d => d.kind === 'audiooutput'); } catch (_) {}
  const info = await host.info();

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
    return [h('h2', {}, 'Appearance'), h('p', { class: 'sub' }, `${PRESETS.length} built-in themes, or make your own. Give it any picture and it picks the colours (and can use the picture as your chat wallpaper).`), grid];
  };

  const profile = () => {
    const me = Account.user, cur = Profiles.get(me.uid) || {};
    const d = { avatar: cur.avatar || '', banner: cur.banner || '', bio: cur.bio || '', status: cur.status || '', nameColor: cur.nameColor || '' };
    const prev = h('div', { class: 'card', style: 'position:static;width:100%;max-width:320px;animation:none' });
    const paintPrev = () => {
      prev.replaceChildren(h('div', { class: 'banner', style: d.banner ? `background-image:url('${d.banner}')` : `background:linear-gradient(135deg,${colorOf(me.id)},var(--bg2))` }),
        h('div', { class: 'in' }, h('div', { class: 'av' + (d.avatar ? ' has-img' : ''), style: d.avatar ? `background-image:url('${d.avatar}')` : `background:${colorOf(me.id)}` }, d.avatar ? null : (nameOnly(me.id)[0] || '?').toUpperCase()),
          h('h4', { style: d.nameColor ? `color:${d.nameColor}` : '' }, nameOnly(me.id)), h('div', { class: 'st' }, d.status || 'Online'), d.bio ? h('div', { class: 'bio' }, d.bio) : null));
    };
    const upload = (key, opts) => async () => { const f = await pickFile(); if (!f) return; try { d[key] = await shrinkImage(f, opts); paintPrev(); } catch (e) { fail(e); } };
    const status = h('input', { value: d.status, maxlength: 60, placeholder: 'What are you up to?', oninput: e => { d.status = e.target.value; paintPrev(); } });
    const bio = h('textarea', { rows: 3, maxlength: 190, style: 'width:100%;resize:none', oninput: e => { d.bio = e.target.value; paintPrev(); } }); bio.value = d.bio;
    const color = h('input', { type: 'color', value: d.nameColor || '#5b8cff', oninput: e => { d.nameColor = e.target.value; paintPrev(); } });
    paintPrev();
    return [h('h2', {}, 'My profile'), h('p', { class: 'sub' }, 'Everyone you share a server or a friendship with sees this.'),
      h('div', { class: 'plusbox' }, h('b', {}, '✦ Camelcord Plus is on for everyone'), h('p', {}, 'Animated GIF avatars, profile banners, name colours, custom themes and wallpapers, custom emoji, picture and GIF sharing, reactions, 4000-character messages and server pictures. No subscription.')),
      h('div', { class: 'profile-edit' },
        h('div', { class: 'pavrow' }, prev),
        h('div', { class: 'pavrow' }, h('button', { class: 'btn', onclick: upload('avatar', { max: 256, square: true, maxChars: 110000 }) }, 'Upload avatar (GIFs work)'), h('button', { class: 'btn ghost', onclick: () => { d.avatar = ''; paintPrev(); } }, 'Remove')),
        h('div', { class: 'pavrow' }, h('button', { class: 'btn', onclick: upload('banner', { max: 720, maxChars: 280000 }) }, 'Upload banner'), h('button', { class: 'btn ghost', onclick: () => { d.banner = ''; paintPrev(); } }, 'Remove')),
        h('label', { class: 'f' }, 'Status', status), h('label', { class: 'f' }, 'About me', bio),
        h('div', { class: 'pavrow' }, h('span', { style: 'color:var(--dim)' }, 'Name colour'), color, h('button', { class: 'btn ghost', onclick: () => { d.nameColor = ''; paintPrev(); } }, 'Default')),
        h('div', { class: 'foot' }, h('button', { class: 'btn gold', onclick: async () => { try { await Profiles.save({ ...d, accent: '' }); toast('Profile saved.', 'ok'); } catch (e) { fail(e); } } }, 'Save profile')))];
  };

  const voice = () => {
    const cfg = AudioSettings.get();
    const sel = (list, cur, fn, none) => h('select', { onchange: e => fn(e.target.value) }, h('option', { value: '' }, none), ...list.map((dv, i) => h('option', { value: dv.deviceId, selected: dv.deviceId === cur }, dv.label || `Device ${i + 1}`)));
    const sounds = h('input', { type: 'checkbox', checked: store.get('cc.sounds', '1') !== '0', onchange: e => store.set('cc.sounds', e.target.checked ? '1' : '0') });
    const turn = h('textarea', { rows: 3, style: 'width:100%;font-family:Consolas,monospace;font-size:12px', placeholder: '{"urls":"turn:example.com:3478","username":"…","credential":"…"}' });
    turn.value = store.get('cc.turn', '') || '';
    return [h('h2', {}, 'Voice'), h('p', { class: 'sub' }, ''),
      h('label', { class: 'f' }, 'Microphone', sel(inputs, cfg.input, id => Voice.active ? Voice.changeInput(id) : AudioSettings.set({ input: id }), 'Default microphone')),
      h('label', { class: 'f' }, 'Speakers', sel(outputs, cfg.output, id => Voice.setOutput(id), 'Default speakers')),
      h('label', { style: 'display:flex;gap:8px;align-items:center;margin-bottom:6px' }, sounds, 'Play sounds for messages, calls and people joining'),
      h('div', { class: 'sect' }, 'Advanced: relay server (TURN)'),
      h('p', { class: 'sub', style: 'margin-bottom:8px;font-size:12.5px' }, 'Only needed if a friend can’t hear you on strict networks. Paste a TURN server as JSON.'), turn,
      h('div', { class: 'foot' }, h('button', { class: 'btn gold', onclick: () => { const t = turn.value.trim(); if (t) { try { JSON.parse(t); } catch (_) { return toast('That TURN setting is not valid JSON.', 'err'); } } store.set('cc.turn', t); toast('Saved.', 'ok'); } }, 'Save'))];
  };

  const account = close => [h('h2', {}, 'Account'), h('p', { class: 'sub' }, `You are signed in as ${nameOnly(Account.user.id)}. This is your Camel Studios account, the same one Camel Client and the games use.`),
    h('div', { class: 'sect' }, 'About'), h('p', { class: 'sub' }, `Camelcord ${info.version}`),
    h('div', { class: 'foot' }, h('button', { class: 'btn red', onclick: async () => { close(); await leaveVoice(); await Friends.setPresence('offline'); Account.signOut(); } }, 'Sign out'))];

  modal((box, close) => {
    const pane = h('div', { class: 'pane' });
    const nav = h('nav', {});
    const tabs = [['appearance', 'Appearance', appearance], ['profile', 'My profile', profile], ['voice', 'Voice', voice], ['account', 'Account', account]];
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
    if (chans.length && (!v.cid || v.sid !== S.sel || !chans.some(c => c.id === v.cid))) {
      const first = chans.find(c => c.kind === 'text') || chans[0];
      S.view = { kind: first.kind, sid: S.sel, cid: first.id };
      if (first.kind === 'text') Servers.open(S.sel, first.id);
    } else if (v.kind === 'text' && Servers.active?.cid !== v.cid) Servers.open(v.sid, v.cid);
  } else if (S.sel === 'home' && S.view.kind === 'dm' && DMs.uid !== S.view.uid) DMs.open(S.view.uid);
  if (S.sel === 'home' && !['friends', 'dm'].includes(S.view.kind)) S.view = { kind: 'friends' };
  DMs.watch(friendsAccepted().map(f => f.uid));
  // Profiles of everyone on screen
  const want = new Set([me.uid, ...Friends.list.map(f => f.uid)]);
  const srv = S.sel !== 'home' ? Servers.server(S.sel) : null;
  for (const u of srv?.members || []) want.add(u);
  for (const u of Voice.participants.keys()) want.add(u);
  const wkey = [...want].sort().join(',');
  if (S.profKey !== wkey) { S.profKey = wkey; Profiles.watch(want); }
  renderRail(); renderSide(); renderCenter(); renderMembers(); renderIncoming();
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

function boot() {
  initTheme();
  for (const b of document.querySelectorAll('[data-win]')) b.onclick = () => host.win[b.dataset.win]();
  host.win.onFocus?.(f => { S.focused = f; if (f) host.attention(false); });
  wireLogin(); initCenter();

  Friends.onChange = DMs.onChange = Calls.onChange = Profiles.onChange = schedule;
  Servers.onChange = () => { S.serversLoaded = true; schedule(); };
  const quiet = (kind, id) => S.focused && ((kind === 'ch' && S.view.kind === 'text' && S.view.cid === id) || (kind === 'dm' && S.view.kind === 'dm' && S.view.uid === id));
  DMs.onIncoming = (uid, m) => {
    if (quiet('dm', uid)) return;
    sfx.msg(); host.notify(nameOnly(idOf(uid)), m.text || 'Sent a picture');
  };
  Servers.onIncoming = (sid, ch, m) => {
    if (quiet('ch', ch.id)) return;
    sfx.msg(); host.notify(`${nameOnly(idOf(m.from))} in ${ch.name}`, m.text || 'Sent a picture');
  };
  setInterval(() => { if (Account.user) schedule(); }, 20000); // re-check who is still online / in voice

  Account.onChange = async user => {
    if (!user) {
      await Voice.leave(); Calls.stop(); Servers.stop(); DMs.stop(); Friends.stop(); Profiles.stop();
      S.centerKey = ''; S.profKey = ''; showScreen('login'); return;
    }
    Profiles.start(user); Friends.start(user); DMs.start(user); Servers.start(user); Calls.start(user);
    showScreen('app'); S.centerKey = ''; schedule();
  };
  Account.start();
  window.addEventListener('beforeunload', () => { Friends.setPresence('offline'); });
  setTimeout(() => { if (!Account.ready) showScreen('login'); }, 6000);
}
boot();
if (new URLSearchParams(location.search).has('emu')) window.__cc = { Voice, Calls, Friends, DMs, Servers, Account, Profiles, Themes };
