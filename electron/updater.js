// Auto-updates from GitHub Releases: checks /releases/latest, downloads the Setup exe in the
// background, tells the window it is ready, and installs it silently into the same folder
// (when you press "Restart to update", or on the next quit if you never do).
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const REPO = 'Camells1/Camelcord';
const ASSET = /^Camelcord-Setup-.*\.exe$/i;
const EVERY = 20 * 60 * 1000;

let state = { state: 'none', version: '', progress: 0, error: '' };
let notify = () => {};
let readyFile = null, timer = null, busy = false;

const newer = (a, b) => {
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0), pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) > (pb[i] || 0)) return true; if ((pa[i] || 0) < (pb[i] || 0)) return false; }
  return false;
};
const set = patch => { state = { ...state, ...patch }; notify(state); };

async function download(url, file, onProgress) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Camelcord' }, redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error('Download failed (' + res.status + ')');
  const total = +res.headers.get('content-length') || 0;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const part = file + '.part', out = fs.createWriteStream(part);
  let got = 0, last = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    got += value.length;
    if (!out.write(Buffer.from(value))) await new Promise(r => out.once('drain', r));
    if (Date.now() - last > 250) { last = Date.now(); onProgress(total ? got / total : 0); }
  }
  await new Promise(r => out.end(r));
  fs.renameSync(part, file);
}

async function check() {
  if (!app.isPackaged || busy || state.state === 'ready') return;
  busy = true;
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { 'User-Agent': 'Camelcord', Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error('GitHub ' + res.status);
    const rel = await res.json();
    const version = String(rel.tag_name || '').replace(/^v/, '');
    const asset = (rel.assets || []).find(a => ASSET.test(a.name));
    if (!version || !asset || !newer(version, app.getVersion())) { set({ state: 'none', version: '', error: '' }); return; }
    const file = path.join(app.getPath('userData'), 'updates', asset.name);
    set({ state: 'downloading', version, progress: 0, error: '' });
    if (!fs.existsSync(file)) await download(asset.browser_download_url, file, p => set({ progress: p }));
    readyFile = file;
    set({ state: 'ready', version, progress: 1 });
  } catch (e) {
    set({ state: 'none', error: String(e.message || e) });
  } finally { busy = false; }
}

// Run the installer silently into the folder this copy lives in. relaunch: start the app when done.
function runInstaller(relaunch) {
  if (!readyFile || !fs.existsSync(readyFile)) return false;
  const dir = path.dirname(process.execPath);
  const args = ['/S', ...(relaunch ? ['--force-run'] : []), '/D=' + dir];
  try { spawn(readyFile, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref(); return true; } catch (_) { return false; }
}

function init(send) {
  notify = send;
  if (!app.isPackaged) return;
  setTimeout(check, 8000);
  timer = setInterval(check, EVERY);
  // Closed the app without pressing the button: still install what we downloaded
  app.on('quit', () => { if (readyFile && !installing) runInstaller(false); });
}
let installing = false;
function install() {
  installing = true;
  if (runInstaller(true)) { setTimeout(() => app.quit(), 300); return true; }
  installing = false;
  return false;
}

module.exports = { init, check, install, get state() { return state; } };
