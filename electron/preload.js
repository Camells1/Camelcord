const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('camel', {
  win: {
    min: () => ipcRenderer.send('win:min'), max: () => ipcRenderer.send('win:max'), close: () => ipcRenderer.send('win:close'),
    onState: fn => ipcRenderer.on('win:state', (_e, v) => fn(v)),
    onFocus: fn => ipcRenderer.on('win:focus', (_e, v) => fn(v))
  },
  info: () => ipcRenderer.invoke('app:info'),
  open: url => ipcRenderer.invoke('open:url', url),
  attention: on => ipcRenderer.send('app:attention', on),
  notify: (title, body) => ipcRenderer.send('app:notify', { title, body })
});
