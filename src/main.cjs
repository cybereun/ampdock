'use strict';

const { app, BrowserWindow, dialog, globalShortcut, ipcMain, screen } = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const {
  filterAudioPaths,
  findForwardFollowers,
  normalizeEqGains,
  parseTrackTitle,
  snapBounds,
  sortTracks
} = require('./core.cjs');

const PANEL_SIZES = {
  player: { width: 620, height: 264, minWidth: 620, minHeight: 264, resizable: false },
  equalizer: { width: 620, height: 248, minWidth: 620, minHeight: 248, resizable: false },
  playlist: { width: 620, height: 360, minWidth: 420, minHeight: 260, resizable: true }
};
const PANEL_ORDER = ['player', 'equalizer', 'playlist'];
const SNAP_THRESHOLD = 18;
const windows = new Map();
const panelByWebContentsId = new Map();
const movingProgrammatically = new Set();
let isQuitting = false;
let saveTimer = null;
let metadataModulePromise = null;

const defaultState = () => ({
  trackPaths: [],
  tracks: [],
  activeIndex: -1,
  volume: 0.78,
  muted: false,
  shuffle: false,
  repeatMode: 'off',
  eqEnabled: true,
  eqPreset: 'flat',
  eqGains: Array(10).fill(0),
  alwaysOnTop: false,
  windowBounds: {},
  panelVisibility: { equalizer: true, playlist: true }
});

let state = defaultState();

function storePath() {
  return path.join(app.getPath('userData'), 'state.json');
}

function readPersistedState() {
  try {
    const saved = JSON.parse(fs.readFileSync(storePath(), 'utf8'));
    state = {
      ...defaultState(),
      ...saved,
      tracks: [],
      trackPaths: filterAudioPaths(saved.trackPaths || []).filter((filePath) => fs.existsSync(filePath)),
      eqGains: normalizeEqGains(saved.eqGains),
      panelVisibility: { ...defaultState().panelVisibility, ...(saved.panelVisibility || {}) },
      windowBounds: saved.windowBounds && typeof saved.windowBounds === 'object' ? saved.windowBounds : {}
    };
    if (!['off', 'all', 'one'].includes(state.repeatMode)) state.repeatMode = 'off';
    state.volume = Math.max(0, Math.min(1, Number(state.volume) || 0));
  } catch {
    state = defaultState();
  }
}

function serializableState() {
  return {
    trackPaths: state.trackPaths,
    activeIndex: state.activeIndex,
    volume: state.volume,
    muted: state.muted,
    shuffle: state.shuffle,
    repeatMode: state.repeatMode,
    eqEnabled: state.eqEnabled,
    eqPreset: state.eqPreset,
    eqGains: state.eqGains,
    alwaysOnTop: state.alwaysOnTop,
    windowBounds: state.windowBounds,
    panelVisibility: state.panelVisibility
  };
}

function publicState() {
  return {
    tracks: state.tracks,
    activeIndex: state.activeIndex,
    volume: state.volume,
    muted: state.muted,
    shuffle: state.shuffle,
    repeatMode: state.repeatMode,
    eqEnabled: state.eqEnabled,
    eqPreset: state.eqPreset,
    eqGains: state.eqGains,
    alwaysOnTop: state.alwaysOnTop,
    panelVisibility: state.panelVisibility
  };
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(path.dirname(storePath()), { recursive: true });
    fs.writeFileSync(storePath(), JSON.stringify(serializableState(), null, 2), 'utf8');
  }, 180);
}

function sendToPanel(panel, channel, payload) {
  const win = windows.get(panel);
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function broadcast(channel, payload) {
  for (const win of windows.values()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

function broadcastState() {
  broadcast('state:changed', publicState());
}

function validateSender(event) {
  const panel = panelByWebContentsId.get(event.sender.id);
  if (!panel || !windows.has(panel)) throw new Error('Unrecognized renderer');
  return panel;
}

function initialBounds() {
  const area = screen.getPrimaryDisplay().workArea;
  const totalHeight = PANEL_SIZES.player.height + PANEL_SIZES.equalizer.height + PANEL_SIZES.playlist.height;
  const x = Math.round(area.x + (area.width - PANEL_SIZES.player.width) / 2);
  const y = Math.max(area.y + 16, Math.round(area.y + (area.height - totalHeight) / 2));
  return {
    player: { x, y, width: PANEL_SIZES.player.width, height: PANEL_SIZES.player.height },
    equalizer: { x, y: y + PANEL_SIZES.player.height, width: PANEL_SIZES.equalizer.width, height: PANEL_SIZES.equalizer.height },
    playlist: { x, y: y + PANEL_SIZES.player.height + PANEL_SIZES.equalizer.height, width: PANEL_SIZES.playlist.width, height: PANEL_SIZES.playlist.height }
  };
}

function normalizeSavedBounds(panel, fallback) {
  const saved = state.windowBounds[panel];
  if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.y)) return fallback;
  const size = PANEL_SIZES[panel];
  const width = size.resizable ? Math.max(size.minWidth, Math.round(saved.width || size.width)) : size.width;
  const height = size.resizable ? Math.max(size.minHeight, Math.round(saved.height || size.height)) : size.height;
  const candidate = { x: Math.round(saved.x), y: Math.round(saved.y), width, height };
  const area = screen.getDisplayMatching(candidate).workArea;
  const visible = candidate.x < area.x + area.width - 60 && candidate.x + candidate.width > area.x + 60 &&
    candidate.y < area.y + area.height - 40 && candidate.y + candidate.height > area.y + 40;
  return visible ? candidate : fallback;
}

function panelItems() {
  return PANEL_ORDER.flatMap((id) => {
    const win = windows.get(id);
    return win && !win.isDestroyed() && win.isVisible() ? [{ id, bounds: win.getBounds() }] : [];
  });
}

function setBoundsGuarded(panel, bounds) {
  const win = windows.get(panel);
  if (!win || win.isDestroyed()) return;
  movingProgrammatically.add(panel);
  win.setBounds({
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: Math.round(bounds.width),
    height: Math.round(bounds.height)
  });
  setImmediate(() => movingProgrammatically.delete(panel));
}

function moveFollowers(panel, fromBounds, toBounds) {
  const items = panelItems();
  const followerIds = findForwardFollowers(panel, items);
  const dx = toBounds.x - fromBounds.x;
  const dy = toBounds.y - fromBounds.y;
  if (!dx && !dy) return;
  for (const id of followerIds) {
    const follower = windows.get(id);
    if (!follower || follower.isDestroyed()) continue;
    const bounds = follower.getBounds();
    setBoundsGuarded(id, { ...bounds, x: bounds.x + dx, y: bounds.y + dy });
  }
}

function snapPanel(panel) {
  const win = windows.get(panel);
  if (!win || win.isDestroyed() || movingProgrammatically.has(panel)) return;
  const current = win.getBounds();
  const targets = panelItems().filter((item) => item.id !== panel);
  const area = screen.getDisplayMatching(current).workArea;
  const snapped = snapBounds(current, targets, area, SNAP_THRESHOLD);
  if (snapped.bounds.x !== current.x || snapped.bounds.y !== current.y) {
    moveFollowers(panel, current, snapped.bounds);
    setBoundsGuarded(panel, snapped.bounds);
  }
  broadcast('windows:docking', dockingSnapshot());
  rememberBounds();
}

function dockingSnapshot() {
  const items = panelItems();
  const attached = {};
  for (const id of PANEL_ORDER) attached[id] = findForwardFollowers(id, items);
  return { attached };
}

function rememberBounds() {
  for (const [panel, win] of windows) {
    if (!win.isDestroyed() && !win.isMinimized()) state.windowBounds[panel] = win.getBounds();
  }
  scheduleSave();
}

function resetLayout() {
  const bounds = initialBounds();
  for (const panel of PANEL_ORDER) {
    const win = windows.get(panel);
    if (!win || win.isDestroyed()) continue;
    if (panel !== 'player') win.showInactive();
    setBoundsGuarded(panel, bounds[panel]);
  }
  state.panelVisibility = { equalizer: true, playlist: true };
  rememberBounds();
  broadcastState();
}

function createPanelWindow(panel, bounds) {
  const size = PANEL_SIZES[panel];
  const win = new BrowserWindow({
    ...bounds,
    minWidth: size.minWidth,
    minHeight: size.minHeight,
    resizable: size.resizable,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    show: false,
    skipTaskbar: panel !== 'player',
    title: panel === 'player' ? 'AmpDock' : `AmpDock ${panel}`,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  });

  windows.set(panel, win);
  panelByWebContentsId.set(win.webContents.id, panel);
  win.setAlwaysOnTop(state.alwaysOnTop, 'floating');
  win.loadFile(path.join(__dirname, 'index.html'), { query: { panel } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.on('page-title-updated', (event) => event.preventDefault());

  win.once('ready-to-show', () => {
    if (panel === 'player' || state.panelVisibility[panel] !== false) win.showInactive();
    if (panel === 'player') win.focus();
  });

  win.on('will-move', (_event, newBounds) => {
    if (movingProgrammatically.has(panel)) return;
    moveFollowers(panel, win.getBounds(), newBounds);
  });
  win.on('moved', () => snapPanel(panel));
  win.on('resized', rememberBounds);

  if (panel === 'player') {
    win.on('close', () => { isQuitting = true; });
    win.on('minimize', () => {
      for (const [id, child] of windows) if (id !== 'player' && child.isVisible()) child.minimize();
    });
    win.on('restore', () => {
      for (const [id, child] of windows) {
        if (id !== 'player' && state.panelVisibility[id] !== false) {
          child.restore();
          child.showInactive();
        }
      }
    });
    win.on('app-command', (_event, command) => {
      const actions = {
        'media-play-pause': 'toggle-play',
        'media-nexttrack': 'next',
        'media-previoustrack': 'previous',
        'media-stop': 'stop'
      };
      if (actions[command]) sendToPanel('player', 'player:action', { type: actions[command] });
    });
  } else {
    win.on('close', (event) => {
      if (isQuitting) return;
      event.preventDefault();
      win.hide();
      state.panelVisibility[panel] = false;
      scheduleSave();
      broadcastState();
    });
  }

  win.on('closed', () => {
    panelByWebContentsId.delete(win.webContents.id);
    windows.delete(panel);
  });
  return win;
}

async function getMetadataModule() {
  if (!metadataModulePromise) metadataModulePromise = import('music-metadata');
  return metadataModulePromise;
}

function imageMime(format) {
  if (!format) return 'image/jpeg';
  return format.includes('/') ? format : `image/${format}`;
}

async function buildTrack(filePath) {
  const fallback = parseTrackTitle(filePath);
  const track = {
    id: crypto.createHash('sha1').update(filePath.toLowerCase()).digest('hex').slice(0, 16),
    path: filePath,
    url: pathToFileURL(filePath).href,
    title: fallback.title,
    artist: fallback.artist,
    album: '',
    duration: 0,
    track: 0,
    cover: ''
  };
  try {
    const { parseFile } = await getMetadataModule();
    const metadata = await parseFile(filePath, { duration: true, skipCovers: false });
    track.title = metadata.common.title || track.title;
    track.artist = metadata.common.artist || metadata.common.albumartist || track.artist;
    track.album = metadata.common.album || '';
    track.duration = Math.max(0, metadata.format.duration || 0);
    track.track = metadata.common.track?.no || 0;
    const picture = metadata.common.picture?.[0];
    if (picture && picture.data && picture.data.length <= 3_000_000) {
      track.cover = `data:${imageMime(picture.format)};base64,${Buffer.from(picture.data).toString('base64')}`;
    }
  } catch {
    // Filename metadata is a complete fallback for unreadable or unsupported files.
  }
  return track;
}

async function scanInputPaths(inputPaths) {
  const discovered = [];
  const queue = Array.from(inputPaths || []);
  while (queue.length) {
    const current = queue.shift();
    try {
      const stat = fs.statSync(current);
      if (stat.isDirectory()) {
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) queue.push(path.join(current, entry.name));
      } else {
        discovered.push(current);
      }
    } catch {
      // Ignore paths that disappear while a folder is being scanned.
    }
  }
  return filterAudioPaths(discovered);
}

async function addPaths(inputPaths) {
  const found = await scanInputPaths(inputPaths);
  const known = new Set(state.trackPaths.map((item) => item.toLowerCase()));
  const incoming = found.filter((filePath) => !known.has(filePath.toLowerCase()));
  if (!incoming.length) return { added: 0, state: publicState() };
  const tracks = await Promise.all(incoming.map(buildTrack));
  state.trackPaths.push(...incoming);
  state.tracks.push(...tracks);
  if (state.activeIndex < 0) state.activeIndex = 0;
  scheduleSave();
  broadcastState();
  return { added: incoming.length, state: publicState() };
}

async function restoreLibrary() {
  state.tracks = await Promise.all(state.trackPaths.map(buildTrack));
  if (!state.tracks.length) state.activeIndex = -1;
  else state.activeIndex = Math.max(0, Math.min(state.activeIndex, state.tracks.length - 1));
  broadcastState();
}

function applyStatePatch(patch) {
  if (!patch || typeof patch !== 'object') return;
  if ('activeIndex' in patch) state.activeIndex = Math.max(-1, Math.min(Math.trunc(patch.activeIndex), state.tracks.length - 1));
  if ('volume' in patch) state.volume = Math.max(0, Math.min(1, Number(patch.volume) || 0));
  if ('muted' in patch) state.muted = Boolean(patch.muted);
  if ('shuffle' in patch) state.shuffle = Boolean(patch.shuffle);
  if ('repeatMode' in patch && ['off', 'all', 'one'].includes(patch.repeatMode)) state.repeatMode = patch.repeatMode;
  if ('eqEnabled' in patch) state.eqEnabled = Boolean(patch.eqEnabled);
  if ('eqPreset' in patch && typeof patch.eqPreset === 'string') state.eqPreset = patch.eqPreset.slice(0, 32);
  if ('eqGains' in patch) state.eqGains = normalizeEqGains(patch.eqGains);
  scheduleSave();
  broadcastState();
}

function handleWindowCommand(panel, command, target) {
  const win = windows.get(panel);
  if (!win || win.isDestroyed()) return;
  if (command === 'minimize') windows.get('player')?.minimize();
  if (command === 'close') panel === 'player' ? app.quit() : win.close();
  if (command === 'toggle-always-on-top') {
    state.alwaysOnTop = !state.alwaysOnTop;
    for (const item of windows.values()) item.setAlwaysOnTop(state.alwaysOnTop, 'floating');
    scheduleSave();
    broadcastState();
  }
  if (command === 'toggle-panel' && ['equalizer', 'playlist'].includes(target)) {
    const targetWindow = windows.get(target);
    if (!targetWindow) return;
    const shouldShow = !targetWindow.isVisible();
    shouldShow ? targetWindow.showInactive() : targetWindow.hide();
    state.panelVisibility[target] = shouldShow;
    scheduleSave();
    broadcastState();
  }
  if (command === 'reset-layout') resetLayout();
}

function installIpc() {
  ipcMain.handle('app:bootstrap', (event) => {
    const panel = validateSender(event);
    return { panel, state: publicState(), docking: dockingSnapshot(), platform: process.platform };
  });
  ipcMain.handle('library:choose-files', async (event) => {
    const panel = validateSender(event);
    const result = await dialog.showOpenDialog(windows.get(panel), {
      title: 'Add audio files',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'opus'] }]
    });
    return result.canceled ? { added: 0, state: publicState() } : addPaths(result.filePaths);
  });
  ipcMain.handle('library:choose-folder', async (event) => {
    const panel = validateSender(event);
    const result = await dialog.showOpenDialog(windows.get(panel), {
      title: 'Add an audio folder',
      properties: ['openDirectory']
    });
    return result.canceled ? { added: 0, state: publicState() } : addPaths(result.filePaths);
  });
  ipcMain.handle('library:add-paths', async (event, paths) => {
    validateSender(event);
    return addPaths(Array.isArray(paths) ? paths.filter((item) => typeof item === 'string') : []);
  });
  ipcMain.handle('library:remove', (event, ids) => {
    validateSender(event);
    const removeIds = new Set(Array.isArray(ids) ? ids : []);
    const activeId = state.tracks[state.activeIndex]?.id;
    const kept = state.tracks.filter((track) => !removeIds.has(track.id));
    state.tracks = kept;
    state.trackPaths = kept.map((track) => track.path);
    state.activeIndex = activeId ? kept.findIndex((track) => track.id === activeId) : -1;
    if (state.activeIndex < 0 && kept.length) state.activeIndex = Math.min(0, kept.length - 1);
    scheduleSave();
    broadcastState();
    return publicState();
  });
  ipcMain.handle('library:clear', (event) => {
    validateSender(event);
    state.tracks = [];
    state.trackPaths = [];
    state.activeIndex = -1;
    scheduleSave();
    broadcastState();
    sendToPanel('player', 'player:action', { type: 'stop' });
    return publicState();
  });
  ipcMain.handle('library:reorder', (event, from, to) => {
    validateSender(event);
    const source = Math.trunc(from);
    const destination = Math.trunc(to);
    if (source < 0 || destination < 0 || source >= state.tracks.length || destination >= state.tracks.length) return publicState();
    const activeId = state.tracks[state.activeIndex]?.id;
    const [track] = state.tracks.splice(source, 1);
    state.tracks.splice(destination, 0, track);
    state.trackPaths = state.tracks.map((item) => item.path);
    state.activeIndex = state.tracks.findIndex((item) => item.id === activeId);
    scheduleSave();
    broadcastState();
    return publicState();
  });
  ipcMain.handle('library:sort', (event, mode) => {
    validateSender(event);
    const activeId = state.tracks[state.activeIndex]?.id;
    state.tracks = sortTracks(state.tracks, mode);
    state.trackPaths = state.tracks.map((item) => item.path);
    state.activeIndex = state.tracks.findIndex((item) => item.id === activeId);
    scheduleSave();
    broadcastState();
    return publicState();
  });
  ipcMain.on('state:update', (event, patch) => {
    validateSender(event);
    applyStatePatch(patch);
  });
  ipcMain.on('player:dispatch', (event, action) => {
    validateSender(event);
    if (action && typeof action.type === 'string') sendToPanel('player', 'player:action', action);
  });
  ipcMain.on('window:command', (event, command, target) => {
    const panel = validateSender(event);
    handleWindowCommand(panel, command, target);
  });
}

async function captureWindowsIfRequested() {
  const directory = process.env.AMPDOCK_CAPTURE_DIR;
  if (!directory) return;
  fs.mkdirSync(directory, { recursive: true });
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const bounds = {};
  for (const [panel, win] of windows) {
    if (!win.isVisible()) win.showInactive();
    const image = await win.webContents.capturePage();
    fs.writeFileSync(path.join(directory, `${panel}.png`), image.toPNG());
    bounds[panel] = win.getBounds();
  }
  fs.writeFileSync(path.join(directory, 'bounds.json'), JSON.stringify(bounds, null, 2));
  app.quit();
}

function registerMediaKeys() {
  const bindings = [
    ['MediaPlayPause', 'toggle-play'],
    ['MediaNextTrack', 'next'],
    ['MediaPreviousTrack', 'previous'],
    ['MediaStop', 'stop']
  ];
  for (const [accelerator, type] of bindings) {
    try { globalShortcut.register(accelerator, () => sendToPanel('player', 'player:action', { type })); } catch { /* OS owns this key. */ }
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

// CI and capture-only smoke runs can execute on hosts without a usable GPU.
// Keep normal desktop launches hardware accelerated.
if (process.env.AMPDOCK_DISABLE_GPU === '1' || process.env.AMPDOCK_CAPTURE_DIR) app.disableHardwareAcceleration();

app.on('second-instance', () => {
  const player = windows.get('player');
  if (player?.isMinimized()) player.restore();
  player?.show();
  player?.focus();
});

app.whenReady().then(async () => {
  readPersistedState();
  installIpc();
  const defaults = initialBounds();
  for (const panel of PANEL_ORDER) createPanelWindow(panel, normalizeSavedBounds(panel, defaults[panel]));
  registerMediaKeys();
  restoreLibrary();
  await captureWindowsIfRequested();
});

app.on('activate', () => {
  const player = windows.get('player');
  player?.show();
  player?.focus();
});

app.on('before-quit', () => {
  isQuitting = true;
  clearTimeout(saveTimer);
  try {
    rememberBounds();
    fs.mkdirSync(path.dirname(storePath()), { recursive: true });
    fs.writeFileSync(storePath(), JSON.stringify(serializableState(), null, 2), 'utf8');
  } catch { /* Best effort during shutdown. */ }
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => app.quit());
