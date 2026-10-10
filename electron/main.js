// Camelcord: the main process. A frameless window with our own title bar; the app itself
// is a plain web page that talks to Firebase and WebRTC.
const { app, BrowserWindow, ipcMain, shell, session, Notification, desktopCapturer } = require('electron');
const path = require('path');
const updater = require('./updater');

const DEV = !app.isPackaged;
let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1360, height: 840, minWidth: 940, minHeight: 600, frame: false, backgroundColor: '#14110e', title: 'Camelcord',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'), show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false }
  });
  win.loadFile(path.join(__dirname, '..', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.on('maximize', () => send('win:state', true));
  win.on('unmaximize', () => send('win:state', false));
  win.on('focus', () => send('win:focus', true));
  win.on('blur', () => send('win:focus', false));
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url); } });
  win.webContents.on('before-input-event', (e, input) => { if (DEV && input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools(); });
}
const send = (ch, v) => { if (win && !win.isDestroyed()) win.webContents.send(ch, v); };

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
  app.whenReady().then(() => {
    // Microphone for calls, notifications for messages; nothing else
    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(['media', 'notifications', 'display-capture'].includes(permission)));
    session.defaultSession.setPermissionCheckHandler((_wc, permission) => ['media', 'notifications', 'display-capture'].includes(permission));
    createWindow();
    updater.init(s => send('update:state', s));
  });
}
app.on('window-all-closed', () => app.quit());

ipcMain.on('win:min', () => win?.minimize());
ipcMain.on('win:max', () => { if (!win) return; win.isMaximized() ? win.unmaximize() : win.maximize(); });
ipcMain.on('win:close', () => win?.close());
ipcMain.handle('app:info', () => ({ version: app.getVersion(), dev: DEV }));
ipcMain.handle('open:url', (_e, url) => { if (/^https:\/\//.test(String(url))) shell.openExternal(url); });
// Screens and windows that can be shared
ipcMain.handle('screens:list', async () => {
  const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 180 }, fetchWindowIcons: false });
  return sources.filter(s => !/^Camelcord$/.test(s.name)).map(s => ({ id: s.id, name: s.name, screen: s.id.startsWith('screen:'), thumb: s.thumbnail.isEmpty() ? '' : s.thumbnail.toDataURL() }));
});
// Updates
ipcMain.handle('update:state', () => updater.state);
ipcMain.handle('update:check', async () => { await updater.check(); return updater.state; });
ipcMain.handle('update:install', () => updater.install());
// Launch when Windows starts
ipcMain.handle('app:startup', (_e, on) => { if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: !!on, args: ['--hidden'] }); return app.getLoginItemSettings().openAtLogin; });
// Flash the taskbar for a message or an incoming call while the window is in the background
ipcMain.on('app:attention', (_e, on) => { if (win && !win.isFocused()) win.flashFrame(!!on); });
ipcMain.on('app:notify', (_e, { title, body }) => {
  if (!Notification.isSupported() || (win && win.isFocused())) return;
  const n = new Notification({ title: String(title).slice(0, 80), body: String(body).slice(0, 200), silent: true });
  n.on('click', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
  n.show();
});
