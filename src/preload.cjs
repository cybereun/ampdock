'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

function subscribe(channel, callback) {
  if (typeof callback !== 'function') return () => {};
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('ampdock', {
  bootstrap: () => ipcRenderer.invoke('app:bootstrap'),
  chooseFiles: () => ipcRenderer.invoke('library:choose-files'),
  chooseFolder: () => ipcRenderer.invoke('library:choose-folder'),
  addPaths: (paths) => ipcRenderer.invoke('library:add-paths', paths),
  removeTracks: (ids) => ipcRenderer.invoke('library:remove', ids),
  clearPlaylist: () => ipcRenderer.invoke('library:clear'),
  reorderTrack: (from, to) => ipcRenderer.invoke('library:reorder', from, to),
  sortPlaylist: (mode) => ipcRenderer.invoke('library:sort', mode),
  updateState: (patch) => ipcRenderer.send('state:update', patch),
  dispatchPlayer: (action) => ipcRenderer.send('player:dispatch', action),
  windowCommand: (command, target) => ipcRenderer.send('window:command', command, target),
  pathForFile: (file) => webUtils.getPathForFile(file),
  onState: (callback) => subscribe('state:changed', callback),
  onPlayerAction: (callback) => subscribe('player:action', callback),
  onDocking: (callback) => subscribe('windows:docking', callback)
});
