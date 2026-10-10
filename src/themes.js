// Themes: a theme is a hue, a saturation, an accent colour and dark/light. The whole palette
// (five backgrounds, text shades, accent pair) is derived from those, so a theme is tiny to store
// and a custom one can be made from nothing but a picture.
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

// ---- colour helpers
export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return [91, 140, 255];
  const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgbToHex = (r, g, b) => '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return [h, s * 100, l * 100];
}
export function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}
const luminance = hex => { const [r, g, b] = hexToRgb(hex).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

// ---- palette from a few numbers
export function buildVars(t) {
  const h = t.hue ?? 220, s = t.sat ?? 8, light = !!t.light;
  const accent = t.accent || '#5b8cff';
  const [ar, ag, ab] = hexToRgb(accent), [ah, as, al] = rgbToHsl(ar, ag, ab);
  const accent2 = t.accent2 || hslToHex(ah, as, clamp(al + (light ? 6 : -12), 8, 92));
  const hi = hslToHex(ah, as, clamp(al + (light ? -6 : 10), 8, 92));
  const dim = Math.min(s, 40);
  const v = light
    ? { '--bg0': hslToHex(h, s, 84), '--bg1': hslToHex(h, s, 90), '--bg2': hslToHex(h, s * 0.6, 97), '--bg3': hslToHex(h, s, 92), '--bg4': hslToHex(h, s, 86),
        '--line': hslToHex(h, s, 81), '--text': hslToHex(h, dim, 11), '--text2': hslToHex(h, dim, 18), '--dim': hslToHex(h, dim * 0.6, 34), '--mute': hslToHex(h, dim * 0.4, 50) }
    : { '--bg0': hslToHex(h, s, 7), '--bg1': hslToHex(h, s, 10), '--bg2': hslToHex(h, s, 14), '--bg3': hslToHex(h, s, 18), '--bg4': hslToHex(h, s, 23),
        '--line': hslToHex(h, s, 20), '--text': hslToHex(h, Math.min(s, 25), 95), '--text2': hslToHex(h, Math.min(s, 25), 86), '--dim': hslToHex(h, dim * 0.6, 68), '--mute': hslToHex(h, dim * 0.4, 48) };
  v['--gold'] = hi; v['--orange'] = accent2; v['--blue'] = accent;
  v['--on-accent'] = luminance(accent2) > 0.4 ? '#101114' : '#ffffff';
  // the gradient's lighter end decides the text colour on gradient buttons
  v['--on-accent'] = luminance(hi) > 0.32 ? '#0e1116' : '#ffffff';
  return v;
}

// ---- presets
const P = (id, name, hue, sat, accent, extra = {}) => ({ id, name, hue, sat, accent, ...extra });
export const PRESETS = [
  P('graphite', 'Graphite', 225, 6, '#5b8cff'),
  P('steel', 'Steel', 215, 10, '#6ea8e0'),
  P('charcoal', 'Charcoal', 0, 0, '#c8cbd2'),
  P('slate', 'Slate', 215, 16, '#4f8cf7'),
  P('oled', 'Pure black', 0, 0, '#5b8cff'),
  P('midnight', 'Midnight', 230, 34, '#6c7bff'),
  P('ocean', 'Ocean', 205, 38, '#27b2e6'),
  P('deepsea', 'Deep sea', 190, 45, '#2ad0c4'),
  P('arctic', 'Arctic', 200, 14, '#7cc4ff'),
  P('nord', 'Nord', 220, 16, '#88c0d0'),
  P('dracula', 'Dracula', 231, 16, '#bd93f9'),
  P('amethyst', 'Amethyst', 268, 28, '#a77bff'),
  P('grape', 'Grape', 285, 30, '#d16cff'),
  P('synthwave', 'Synthwave', 265, 40, '#ff4fd8', { accent2: '#7a5cff' }),
  P('cyberpunk', 'Cyberpunk', 275, 22, '#f9e700', { accent2: '#ff2e88' }),
  P('rose', 'Rose', 340, 22, '#ff6b9a'),
  P('crimson', 'Crimson', 355, 24, '#ff4b5c'),
  P('lava', 'Lava', 15, 26, '#ff6a2b'),
  P('sunset', 'Sunset', 18, 24, '#ff9a3c', { accent2: '#ff4f7b' }),
  P('gold', 'Gold', 40, 18, '#f2c04a'),
  P('desert', 'Desert', 32, 22, '#e8a63c', { accent2: '#ff8a3d' }),
  P('coffee', 'Coffee', 28, 20, '#c8935a'),
  P('forest', 'Forest', 140, 24, '#5dbb6e'),
  P('emerald', 'Emerald', 155, 30, '#2fd68b'),
  P('matrix', 'Matrix', 130, 30, '#2dff6a', { accent2: '#16b84a' }),
  P('lime', 'Lime', 90, 24, '#a6e22e'),
  P('mint', 'Mint', 165, 26, '#4ee0b8'),
  P('cotton', 'Cotton candy', 320, 30, '#ff8fd0', { accent2: '#6fc8ff' }),
  P('paper', 'Paper', 220, 8, '#3b6ef0', { light: true }),
  P('cloud', 'Cloud', 210, 14, '#2f8cf0', { light: true }),
  P('ice', 'Ice', 200, 30, '#1f9bd6', { light: true }),
  P('sakura', 'Sakura', 340, 30, '#e8517f', { light: true }),
  P('sandstone', 'Sandstone', 36, 28, '#c77a1e', { light: true }),
  P('sage', 'Sage', 140, 16, '#3f8f5b', { light: true })
];
export const DEFAULT_THEME = 'graphite';

// ---- custom themes (saved on this device)
const read = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (_) { return false; } };
export const Themes = {
  custom() { return read('cc.themes', []); },
  all() { return [...PRESETS, ...this.custom()]; },
  currentId() { return read('cc.theme', DEFAULT_THEME); },
  find(id) { return this.all().find(t => t.id === id) || PRESETS[0]; },
  save(theme) {
    const list = this.custom().filter(t => t.id !== theme.id); list.push(theme);
    if (!write('cc.themes', list)) throw new Error('Not enough room to save this wallpaper. Try a smaller picture or turn the wallpaper off.');
  },
  remove(id) { write('cc.themes', this.custom().filter(t => t.id !== id)); if (this.currentId() === id) this.use(DEFAULT_THEME); },
  use(id) { write('cc.theme', id); apply(this.find(id)); },
  apply(theme) { apply(theme); }
};
function apply(t) {
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(buildVars(t))) root.setProperty(k, v);
  root.setProperty('--grad', 'linear-gradient(135deg, var(--gold), var(--orange))');
  document.documentElement.style.colorScheme = t.light ? 'light' : 'dark';
  if (t.wall) { root.setProperty('--wall', `url("${t.wall}")`); root.setProperty('--dim-wall', `${t.wallDim ?? 82}%`); document.body.classList.add('has-wall'); }
  else { root.removeProperty('--wall'); document.body.classList.remove('has-wall'); }
}
export const initTheme = () => apply(Themes.find(Themes.currentId()));

// ---- a theme from a picture
// Reads the picture at thumbnail size, finds the colour that carries it (the accent) and the overall
// tint (the background hue), and keeps a small compressed copy to use as a wallpaper.
export async function themeFromImage(file, { light = false } = {}) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That file is not a picture I can read.')); i.src = url; });
    const small = document.createElement('canvas'); small.width = small.height = 48;
    const sx = small.getContext('2d', { willReadFrequently: true });
    sx.drawImage(img, 0, 0, 48, 48);
    const px = sx.getImageData(0, 0, 48, 48).data;
    // 12 hue buckets weighted by how vivid and mid-bright each pixel is
    const bucket = Array.from({ length: 12 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
    let tint = { w: 0, hx: 0, hy: 0, s: 0 }, n = 0, lum = 0;
    for (let i = 0; i < px.length; i += 4) {
      const [r, g, b] = [px[i], px[i + 1], px[i + 2]], [h, s, l] = rgbToHsl(r, g, b);
      lum += l; n++;
      const w = (s / 100) * (1 - Math.abs(l - 55) / 55);
      if (w <= 0.02) continue;
      const k = bucket[Math.floor(h / 30) % 12]; k.w += w; k.r += r * w; k.g += g * w; k.b += b * w;
      tint.w += w; tint.hx += Math.cos(h * Math.PI / 180) * w; tint.hy += Math.sin(h * Math.PI / 180) * w; tint.s += s * w;
    }
    const best = bucket.reduce((a, b) => (b.w > a.w ? b : a));
    let accent = '#5b8cff', hue = 220, sat = 8;
    if (best.w > 0) {
      let [h, s, l] = rgbToHsl(best.r / best.w, best.g / best.w, best.b / best.w);
      accent = hslToHex(h, clamp(s, 55, 95), light ? clamp(l, 32, 48) : clamp(l, 52, 68));
      hue = h;
    }
    if (tint.w > 0) { hue = (Math.atan2(tint.hy, tint.hx) * 180 / Math.PI + 360) % 360; sat = clamp((tint.s / tint.w) * 0.45, 8, 38); }
    // a compressed copy for the wallpaper
    const scale = Math.min(1, 1600 / img.width), big = document.createElement('canvas');
    big.width = Math.round(img.width * scale); big.height = Math.round(img.height * scale);
    big.getContext('2d').drawImage(img, 0, 0, big.width, big.height);
    let q = 0.72, wall = big.toDataURL('image/jpeg', q);
    while (wall.length > 700000 && q > 0.3) { q -= 0.1; wall = big.toDataURL('image/jpeg', q); }
    return { hue: Math.round(hue), sat: Math.round(sat), accent, light, wall, avgLight: lum / n };
  } finally { URL.revokeObjectURL(url); }
}

// Shrink an uploaded picture to fit in a database document (avatars, banners, emoji, attachments).
// GIFs that already fit are kept as they are so they stay animated.
export async function shrinkImage(file, { max = 256, quality = 0.85, maxChars = 90000, keepGif = true, square = false } = {}) {
  const asData = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
  if (keepGif && file.type === 'image/gif') { const d = await asData(file); if (d.length <= maxChars) return d; }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That file is not a picture I can read.')); i.src = url; });
    let w = img.width, h = img.height, sx = 0, sy = 0, sw = w, sh = h;
    if (square) { const s = Math.min(w, h); sx = (w - s) / 2; sy = (h - s) / 2; sw = sh = s; w = h = s; }
    const k = Math.min(1, max / Math.max(w, h)), cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
    const png = file.type === 'image/png' || file.type === 'image/gif' || file.type === 'image/webp';
    let out = png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', quality);
    if (png && out.length > maxChars) out = c.toDataURL('image/jpeg', quality);
    let q = quality; while (out.length > maxChars && q > 0.3) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
    if (out.length > maxChars) throw new Error('That picture is too detailed to fit. Try a smaller one.');
    return out;
  } finally { URL.revokeObjectURL(url); }
}
