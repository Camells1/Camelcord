const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('camel', {
  win: {
    min: () => ipcRenderer.send('win:min'), max: () => ipcRenderer.send('win:max'), close: () => ipcRenderer.send('win:close'),
    onState: fn => ipcRenderer.on('win:state', (_e, v) => fn(v)),
    onFocus: fn => ipcRenderer.on('win:focus', (_e, v) => fn(v))
  },
  info: () => ipcRenderer.invoke('app:info'),
  open: url => ipcRenderer.invoke('open:url', url),
  attention: on => ipcRenderer.send('app:attention', on),
  notify: (title, body) => ipcRenderer.send('app:notify', { title, body }),
  zoom: f => { try { webFrame.setZoomFactor(Math.min(1.6, Math.max(0.6, +f || 1))); } catch (_) {} },
  screens: () => ipcRenderer.invoke('screens:list'),
  startup: on => ipcRenderer.invoke('app:startup', on),
  update: {
    state: () => ipcRenderer.invoke('update:state'),
    check: () => ipcRenderer.invoke('update:check'),
    install: () => ipcRenderer.invoke('update:install'),
    onState: fn => ipcRenderer.on('update:state', (_e, v) => fn(v))
  }
});
