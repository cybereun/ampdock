(() => {
  'use strict';
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;

  const panel = new URLSearchParams(location.search).get('panel') || 'player';
  const listeners = new Set();
  const playerListeners = new Set();
  let state;
  let fingerprint = '';
  let actionRevision = 0;

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const request = async (url, options) => {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`AmpDock bridge request failed (${response.status})`);
    return response.status === 204 ? null : response.json();
  };
  const emit = () => listeners.forEach((listener) => listener(clone(state)));
  const signature = (value) => JSON.stringify(value);
  const refresh = async () => {
    try {
      const next = await request('/api/state');
      const nextSignature = signature(next);
      if (nextSignature !== fingerprint) { state = next; fingerprint = nextSignature; emit(); }
      if ((next.playerActionRevision || 0) !== actionRevision) {
        actionRevision = next.playerActionRevision || 0;
        if (next.playerActionType) playerListeners.forEach((listener) => listener({ type: next.playerActionType, index: next.playerActionIndex }));
      }
    } catch { /* The host is shutting down. */ }
  };
  const persist = async () => {
    fingerprint = signature(state);
    const next = await request('/api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) });
    state = next; fingerprint = signature(next); emit();
  };
  const update = async (mutator) => { mutator(state); await persist(); };

  document.title = `AmpDock ${panel[0].toUpperCase()}${panel.slice(1)}`;
  window.ampdock = {
    bootstrap: async () => {
      state = await request('/api/state'); fingerprint = signature(state); actionRevision = state.playerActionRevision || 0;
      setInterval(refresh, 400);
      return { panel, state: clone(state), docking: { attached: {} }, platform: 'win32' };
    },
    chooseFiles: async () => { const result = await request('/api/choose?folder=0', { method: 'POST' }); state = result.state; fingerprint = signature(state); emit(); return result; },
    chooseFolder: async () => { const result = await request('/api/choose?folder=1', { method: 'POST' }); state = result.state; fingerprint = signature(state); emit(); return result; },
    addFilesFromDrop: async () => ({ added: 0, state: clone(state) }),
    addPaths: async () => ({ added: 0, state: clone(state) }),
    removeTracks: async (ids) => { const removed = new Set(ids || []); await update((next) => { next.tracks = next.tracks.filter((track) => !removed.has(track.id)); next.activeIndex = Math.min(next.activeIndex, next.tracks.length - 1); }); return clone(state); },
    clearPlaylist: async () => { await update((next) => { next.tracks = []; next.activeIndex = -1; }); return clone(state); },
    reorderTrack: async (from, to) => { await update((next) => { const [track] = next.tracks.splice(from, 1); if (track) next.tracks.splice(to, 0, track); }); return clone(state); },
    sortPlaylist: async (mode) => { await update((next) => { const active = next.tracks[next.activeIndex]?.id; const key = mode === 'duration' ? (track) => track.duration || 0 : (track) => String(track[mode] || '').toLocaleLowerCase(); if (mode !== 'manual') next.tracks.sort((a, b) => key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : 0); next.activeIndex = next.tracks.findIndex((track) => track.id === active); }); return clone(state); },
    updateState: (patch) => update((next) => { Object.assign(next, patch); next.panelVisibility = { ...next.panelVisibility, ...(patch.panelVisibility || {}) }; }),
    dispatchPlayer: async (action) => { const next = await request('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action) }); state = next; fingerprint = signature(next); actionRevision = next.playerActionRevision || 0; },
    windowCommand: async (command, target) => {
      if (command === 'close' && panel === 'player') { await request('/api/quit', { method: 'POST' }); return; }
      if (command === 'close') { await update((next) => { next.panelVisibility[panel] = false; }); await request(`/api/window?command=visibility&target=${panel}&visible=0`, { method: 'POST' }); return; }
      if (command === 'toggle-panel' && target) { const visible = !state.panelVisibility[target]; await update((next) => { next.panelVisibility[target] = visible; }); await request(`/api/window?command=visibility&target=${target}&visible=${visible ? 1 : 0}`, { method: 'POST' }); return; }
      if (command === 'toggle-always-on-top') { const value = !state.alwaysOnTop; await update((next) => { next.alwaysOnTop = value; }); await request(`/api/window?command=top&value=${value ? 1 : 0}`, { method: 'POST' }); return; }
      if (command === 'minimize') { await request('/api/window?command=minimize', { method: 'POST' }); return; }
      if (command === 'reset-layout') await request('/api/window?command=reset', { method: 'POST' });
    },
    pathForFile: (file) => file?.path || '',
    onState: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    onPlayerAction: (listener) => { playerListeners.add(listener); return () => playerListeners.delete(listener); },
    onDocking: (listener) => { listener({ attached: {} }); return () => {}; }
  };
})();
