// Settings that live on this device. Prefs.get('scale') etc.; Prefs.apply() pushes the visual ones to the page.
const KEY = 'cc.prefs';
export const DEFAULTS = {
  scale: 1,            // whole-app zoom
  chatSize: 14,        // message text size in px
  layout: 'bubbles',   // bubbles | list
  density: 'cozy',     // cozy | compact
  clock24: false,
  reduceMotion: false,
  notify: true,        // desktop notifications
  sounds: true,        // message blips
  ringSound: true,     // incoming call ring
  joinSounds: true,    // someone joins / leaves voice
  flash: true,         // flash the taskbar
  enterToSend: true,   // false: Ctrl+Enter sends
  autoIdle: 10,        // minutes until you show as idle (0 = never)
  startup: false,      // launch when Windows starts
  ptt: false, pttKey: 'KeyV',
  joinMuted: false,
  muteKey: 'KeyM',     // Ctrl+Shift+<key> toggles mute
  deafenKey: 'KeyD'
};
let cache = null;
const load = () => {
  if (cache) return cache;
  try { cache = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (_) { cache = { ...DEFAULTS }; }
  return cache;
};
export const Prefs = {
  get: k => load()[k],
  all: () => ({ ...load() }),
  set(k, v) {
    load()[k] = v;
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (_) {}
    this.apply();
    this.onChange?.(k, v);
  },
  reset() { cache = { ...DEFAULTS }; try { localStorage.removeItem(KEY); } catch (_) {} this.apply(); },
  onChange: null,
  apply() {
    const p = load(), root = document.documentElement, body = document.body;
    root.style.setProperty('--chat-size', p.chatSize + 'px');
    body.classList.toggle('layout-list', p.layout === 'list');
    body.classList.toggle('compact', p.density === 'compact');
    body.classList.toggle('reduce-motion', !!p.reduceMotion);
    if (window.camel?.zoom) window.camel.zoom(p.scale); else root.style.zoom = String(p.scale);
  }
};
