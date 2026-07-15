(function () {
  'use strict';

  const panel = new URLSearchParams(location.search).get('panel') || 'player';
  document.body.dataset.panel = panel;

  const api = window.ampdock || createPreviewBridge(panel);
  let state = null;
  let controller = null;

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
    const whole = Math.floor(seconds);
    const hours = Math.floor(whole / 3600);
    const minutes = Math.floor((whole % 3600) / 60);
    const rest = whole % 60;
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  };

  const refreshIcons = () => {
    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
  };

  const activeTrack = () => state?.tracks?.[state.activeIndex] || null;

  async function addFiles() {
    const result = await api.chooseFiles();
    controller?.setStatus?.(result?.added ? `${result.added} ADDED` : 'READY');
  }

  async function addFolder() {
    controller?.setStatus?.('SCANNING');
    const result = await api.chooseFolder();
    controller?.setStatus?.(result?.added ? `${result.added} ADDED` : 'READY');
  }

  function wireWindowControls() {
    document.querySelectorAll('[data-window-command]').forEach((button) => {
      button.addEventListener('click', () => api.windowCommand(button.dataset.windowCommand));
    });
  }

  function wireDropImport() {
    const shell = document.querySelector(`[data-panel="${panel}"]`);
    if (!shell) return;
    shell.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      shell.classList.add('drop-active');
    });
    shell.addEventListener('dragleave', (event) => {
      if (!shell.contains(event.relatedTarget)) shell.classList.remove('drop-active');
    });
    shell.addEventListener('drop', async (event) => {
      event.preventDefault();
      shell.classList.remove('drop-active');
      const paths = [];
      if (typeof api.addFilesFromDrop === 'function') {
        controller?.setStatus?.('SCANNING');
        const result = await api.addFilesFromDrop(event.dataTransfer.files);
        controller?.setStatus?.(result?.added ? `${result.added} ADDED` : 'READY');
        return;
      }
      for (const file of Array.from(event.dataTransfer.files || [])) {
        try {
          const filePath = api.pathForFile(file);
          if (filePath) paths.push(filePath);
        } catch {
          // Browser preview files do not expose desktop paths.
        }
      }
      if (paths.length) {
        controller?.setStatus?.('SCANNING');
        const result = await api.addPaths(paths);
        controller?.setStatus?.(result?.added ? `${result.added} ADDED` : 'READY');
      }
    });
  }

  function createPlayerController() {
    const audio = document.getElementById('audio');
    const title = document.getElementById('track-title');
    const meta = document.getElementById('track-meta');
    const cover = document.getElementById('cover-art');
    const coverFrame = cover.closest('.cover-frame');
    const status = document.getElementById('player-status');
    const playButton = document.getElementById('play');
    const shuffleButton = document.getElementById('shuffle');
    const repeatButton = document.getElementById('repeat');
    const muteButton = document.getElementById('mute');
    const seek = document.getElementById('seek');
    const volume = document.getElementById('volume');
    const elapsed = document.getElementById('elapsed');
    const duration = document.getElementById('duration');
    const canvas = document.getElementById('visualizer');
    const context = canvas.getContext('2d');
    let loadedTrackId = '';
    let playing = false;
    let audioContext = null;
    let sourceNode = null;
    let analyser = null;
    let filters = [];
    let animationFrame = 0;

    const setStatus = (message) => { status.textContent = String(message || 'READY').toUpperCase(); };

    function updateMediaSession(track) {
      if (!('mediaSession' in navigator) || !track || !window.MediaMetadata) return;
      const artwork = track.cover ? [{ src: track.cover }] : [];
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist || 'Unknown artist',
        album: track.album || 'AmpDock',
        artwork
      });
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    }

    function ensureAudioGraph() {
      if (audioContext) return;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      audioContext = new AudioContextClass();
      sourceNode = audioContext.createMediaElementSource(audio);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.78;
      const frequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
      filters = frequencies.map((frequency) => {
        const filter = audioContext.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = frequency;
        filter.Q.value = 1.05;
        return filter;
      });
      let node = sourceNode;
      for (const filter of filters) {
        node.connect(filter);
        node = filter;
      }
      node.connect(analyser);
      analyser.connect(audioContext.destination);
      applyEqualizer();
    }

    function applyEqualizer() {
      filters.forEach((filter, index) => {
        filter.gain.value = state.eqEnabled ? Number(state.eqGains[index] || 0) : 0;
      });
    }

    function loadTrack(track) {
      if (!track) {
        audio.pause();
        audio.removeAttribute('src');
        loadedTrackId = '';
        playing = false;
        return;
      }
      if (loadedTrackId === track.id) return;
      loadedTrackId = track.id;
      playing = false;
      audio.src = track.url;
      audio.load();
      seek.value = '0';
      elapsed.textContent = '00:00';
    }

    async function play() {
      const track = activeTrack();
      if (!track) {
        setStatus('ADD AUDIO');
        return;
      }
      loadTrack(track);
      ensureAudioGraph();
      if (audioContext?.state === 'suspended') await audioContext.resume();
      try {
        await audio.play();
        playing = true;
        setStatus('PLAYING');
        render();
      } catch {
        playing = false;
        setStatus('PLAYBACK ERROR');
        render();
      }
    }

    function pause() {
      audio.pause();
      playing = false;
      setStatus('PAUSED');
      render();
    }

    function stop() {
      audio.pause();
      audio.currentTime = 0;
      playing = false;
      setStatus('STOPPED');
      render();
    }

    function playIndex(index) {
      if (index < 0 || index >= state.tracks.length) return;
      state.activeIndex = index;
      api.updateState({ activeIndex: index });
      loadTrack(activeTrack());
      play();
    }

    function next(automatic = false) {
      const count = state.tracks.length;
      if (!count) return;
      if (automatic && state.repeatMode === 'one') {
        audio.currentTime = 0;
        play();
        return;
      }
      if (automatic && state.repeatMode === 'off' && !state.shuffle && state.activeIndex === count - 1) {
        stop();
        return;
      }
      let index;
      if (state.shuffle && count > 1) {
        index = state.activeIndex;
        while (index === state.activeIndex) index = Math.floor(Math.random() * count);
      } else {
        index = (state.activeIndex + 1 + count) % count;
      }
      playIndex(index);
    }

    function previous() {
      if (audio.currentTime > 3) {
        audio.currentTime = 0;
        return;
      }
      const count = state.tracks.length;
      if (count) playIndex((state.activeIndex - 1 + count) % count);
    }

    function togglePlay() { playing ? pause() : play(); }

    function render() {
      const track = activeTrack();
      loadTrack(track);
      title.textContent = track?.title || 'No track loaded';
      meta.textContent = track ? [track.artist || 'Unknown artist', track.album].filter(Boolean).join(' / ') : 'Add local audio to begin';
      duration.textContent = formatTime(audio.duration || track?.duration || 0);
      audio.volume = Number(state.volume);
      audio.muted = Boolean(state.muted);
      volume.value = String(Math.round(state.volume * 100));
      shuffleButton.classList.toggle('active', Boolean(state.shuffle));
      repeatButton.classList.toggle('active', state.repeatMode !== 'off');
      repeatButton.classList.toggle('one', state.repeatMode === 'one');
      muteButton.classList.toggle('active', Boolean(state.muted));
      document.getElementById('toggle-top').classList.toggle('active', Boolean(state.alwaysOnTop));
      document.getElementById('toggle-equalizer').classList.toggle('active', state.panelVisibility.equalizer !== false);
      document.getElementById('toggle-playlist').classList.toggle('active', state.panelVisibility.playlist !== false);
      playButton.innerHTML = playing ? '<i data-lucide="pause"></i>' : '<i data-lucide="play"></i>';
      playButton.title = playing ? 'Pause' : 'Play';
      playButton.setAttribute('aria-label', playButton.title);
      if (track?.cover) {
        cover.src = track.cover;
        cover.alt = `${track.title} cover`;
        coverFrame.classList.add('has-cover');
      } else {
        cover.removeAttribute('src');
        cover.alt = '';
        coverFrame.classList.remove('has-cover');
      }
      applyEqualizer();
      updateMediaSession(track);
      refreshIcons();
    }

    function updateTimeline() {
      const total = audio.duration || activeTrack()?.duration || 0;
      elapsed.textContent = formatTime(audio.currentTime || 0);
      duration.textContent = formatTime(total);
      seek.value = total ? String(Math.round((audio.currentTime / total) * 1000)) : '0';
      if ('mediaSession' in navigator && total && Number.isFinite(audio.currentTime)) {
        try { navigator.mediaSession.setPositionState({ duration: total, playbackRate: audio.playbackRate, position: Math.min(audio.currentTime, total) }); } catch { /* Metadata may not be ready. */ }
      }
    }

    function drawVisualizer(time) {
      const width = canvas.width;
      const height = canvas.height;
      context.fillStyle = '#0b0e12';
      context.fillRect(0, 0, width, height);
      context.strokeStyle = '#1f2931';
      context.lineWidth = 1;
      for (let y = 18; y < height; y += 18) {
        context.beginPath();
        context.moveTo(0, y + 0.5);
        context.lineTo(width, y + 0.5);
        context.stroke();
      }
      const values = analyser && playing ? new Uint8Array(analyser.frequencyBinCount) : null;
      if (values) analyser.getByteFrequencyData(values);
      const bars = 24;
      const gap = 3;
      const barWidth = Math.floor((width - gap * (bars + 1)) / bars);
      for (let index = 0; index < bars; index += 1) {
        const idle = 10 + (Math.sin(time / 420 + index * 0.72) + 1) * 5;
        const amplitude = values ? Math.max(4, values[index] / 255 * (height - 9)) : idle;
        context.fillStyle = index > 19 ? '#ffc861' : index > 14 ? '#69d7f3' : '#72f1b8';
        context.fillRect(gap + index * (barWidth + gap), height - amplitude - 3, barWidth, amplitude);
      }
      animationFrame = requestAnimationFrame(drawVisualizer);
    }

    document.getElementById('play').addEventListener('click', togglePlay);
    document.getElementById('previous').addEventListener('click', previous);
    document.getElementById('next').addEventListener('click', () => next(false));
    document.getElementById('shuffle').addEventListener('click', () => api.updateState({ shuffle: !state.shuffle }));
    document.getElementById('repeat').addEventListener('click', () => {
      const nextMode = state.repeatMode === 'off' ? 'all' : state.repeatMode === 'all' ? 'one' : 'off';
      api.updateState({ repeatMode: nextMode });
    });
    document.getElementById('mute').addEventListener('click', () => api.updateState({ muted: !state.muted }));
    document.getElementById('add-files').addEventListener('click', addFiles);
    document.getElementById('add-folder').addEventListener('click', addFolder);
    document.getElementById('toggle-equalizer').addEventListener('click', () => api.windowCommand('toggle-panel', 'equalizer'));
    document.getElementById('toggle-playlist').addEventListener('click', () => api.windowCommand('toggle-panel', 'playlist'));
    document.getElementById('toggle-top').addEventListener('click', () => api.windowCommand('toggle-always-on-top'));

    volume.addEventListener('input', () => api.updateState({ volume: Number(volume.value) / 100, muted: false }));
    seek.addEventListener('input', () => {
      if (audio.duration) audio.currentTime = Number(seek.value) / 1000 * audio.duration;
    });
    audio.addEventListener('timeupdate', updateTimeline);
    audio.addEventListener('loadedmetadata', updateTimeline);
    audio.addEventListener('playing', () => { playing = true; render(); });
    audio.addEventListener('pause', () => { if (!audio.ended) { playing = false; render(); } });
    audio.addEventListener('ended', () => next(true));
    audio.addEventListener('error', () => { playing = false; setStatus('UNREADABLE FILE'); render(); });

    api.onPlayerAction((action) => {
      if (!action || !action.type) return;
      if (action.type === 'toggle-play') togglePlay();
      if (action.type === 'play') play();
      if (action.type === 'pause') pause();
      if (action.type === 'stop') stop();
      if (action.type === 'next') next(false);
      if (action.type === 'previous') previous();
      if (action.type === 'play-index') playIndex(Number(action.index));
    });

    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', play);
      navigator.mediaSession.setActionHandler('pause', pause);
      navigator.mediaSession.setActionHandler('previoustrack', previous);
      navigator.mediaSession.setActionHandler('nexttrack', () => next(false));
      navigator.mediaSession.setActionHandler('seekto', (details) => { if (Number.isFinite(details.seekTime)) audio.currentTime = details.seekTime; });
    }

    document.addEventListener('keydown', (event) => {
      if (event.target.matches('input, select')) return;
      if (event.code === 'Space') { event.preventDefault(); togglePlay(); }
      if (event.code === 'ArrowRight' && event.ctrlKey) next(false);
      if (event.code === 'ArrowLeft' && event.ctrlKey) previous();
      if (event.code === 'ArrowUp') api.updateState({ volume: Math.min(1, state.volume + 0.05), muted: false });
      if (event.code === 'ArrowDown') api.updateState({ volume: Math.max(0, state.volume - 0.05), muted: false });
      if (event.key.toLowerCase() === 'm') api.updateState({ muted: !state.muted });
      if (event.key.toLowerCase() === 'o' && event.ctrlKey) addFiles();
    });

    animationFrame = requestAnimationFrame(drawVisualizer);
    window.addEventListener('beforeunload', () => cancelAnimationFrame(animationFrame));
    return { render, setStatus };
  }

  function createEqualizerController() {
    const container = document.getElementById('equalizer');
    const enabled = document.getElementById('eq-enabled');
    const preset = document.getElementById('eq-preset');
    const frequencies = ['60', '170', '310', '600', '1K', '3K', '6K', '12K', '14K', '16K'];
    const presets = {
      flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      warm: [4, 3, 2, 1, 0, -1, -1, 0, 1, 1],
      clarity: [-2, -1, 0, 1, 2, 3, 4, 4, 3, 2],
      vocal: [-3, -2, -1, 1, 3, 4, 3, 1, 0, -1],
      night: [2, 2, 1, 0, -1, -2, -2, -1, 0, 1]
    };
    const sliders = [];
    const outputs = [];

    frequencies.forEach((frequency, index) => {
      const label = document.createElement('label');
      label.className = 'eq-band';
      const output = document.createElement('output');
      const input = document.createElement('input');
      const caption = document.createElement('span');
      output.textContent = '0';
      input.type = 'range';
      input.min = '-12';
      input.max = '12';
      input.step = '1';
      input.value = '0';
      input.setAttribute('aria-label', `${frequency} Hz gain`);
      caption.textContent = frequency;
      input.addEventListener('input', () => {
        const gains = sliders.map((item) => Number(item.value));
        output.textContent = Number(input.value) > 0 ? `+${input.value}` : input.value;
        preset.value = 'custom';
        api.updateState({ eqGains: gains, eqPreset: 'custom' });
      });
      label.append(output, input, caption);
      container.appendChild(label);
      sliders.push(input);
      outputs.push(output);
    });

    enabled.addEventListener('change', () => api.updateState({ eqEnabled: enabled.checked }));
    preset.addEventListener('change', () => {
      const gains = presets[preset.value];
      if (gains) api.updateState({ eqGains: gains, eqPreset: preset.value, eqEnabled: true });
    });
    document.getElementById('eq-reset').addEventListener('click', () => api.updateState({ eqGains: presets.flat, eqPreset: 'flat', eqEnabled: true }));

    function render() {
      enabled.checked = Boolean(state.eqEnabled);
      preset.value = presets[state.eqPreset] || state.eqPreset === 'custom' ? state.eqPreset : 'custom';
      container.classList.toggle('disabled', !state.eqEnabled);
      sliders.forEach((input, index) => {
        const gain = Number(state.eqGains[index] || 0);
        input.value = String(gain);
        outputs[index].textContent = gain > 0 ? `+${gain}` : String(gain);
      });
    }

    return { render };
  }

  function createPlaylistController() {
    const list = document.getElementById('playlist');
    const empty = document.getElementById('playlist-empty');
    const search = document.getElementById('playlist-search');
    const sort = document.getElementById('playlist-sort');
    const dock = document.getElementById('dock-indicator');
    let selectedId = '';
    let draggedIndex = -1;

    const makeIcon = (name) => {
      const element = document.createElement('i');
      element.dataset.lucide = name;
      return element;
    };

    function visibleTracks() {
      const query = search.value.trim().toLocaleLowerCase();
      return state.tracks
        .map((track, index) => ({ track, index }))
        .filter(({ track }) => !query || `${track.title} ${track.artist} ${track.album}`.toLocaleLowerCase().includes(query));
    }

    function render() {
      const visible = visibleTracks();
      list.replaceChildren();
      empty.classList.toggle('visible', visible.length === 0);
      empty.querySelector('strong').textContent = state.tracks.length ? 'No matching tracks' : 'Playlist is empty';
      empty.querySelector('span').textContent = state.tracks.length ? 'Try another search' : 'Drop audio here';
      document.getElementById('playlist-count').textContent = `${state.tracks.length} ${state.tracks.length === 1 ? 'TRACK' : 'TRACKS'}`;
      document.getElementById('playlist-duration').textContent = formatTime(state.tracks.reduce((sum, track) => sum + (track.duration || 0), 0));

      for (const { track, index } of visible) {
        const row = document.createElement('li');
        const number = document.createElement('span');
        const main = document.createElement('span');
        const trackTitle = document.createElement('strong');
        const artist = document.createElement('span');
        const album = document.createElement('span');
        const time = document.createElement('span');
        const remove = document.createElement('button');
        row.className = 'track-row';
        row.classList.toggle('active', index === state.activeIndex);
        row.classList.toggle('selected', track.id === selectedId);
        row.draggable = true;
        row.dataset.index = String(index);
        number.className = 'track-number';
        number.textContent = String(index + 1).padStart(2, '0');
        main.className = 'track-main';
        trackTitle.textContent = track.title;
        artist.textContent = track.artist || 'Unknown artist';
        main.append(trackTitle, artist);
        album.className = 'track-album';
        album.textContent = track.album || '-';
        time.className = 'track-time';
        time.textContent = formatTime(track.duration);
        remove.type = 'button';
        remove.className = 'icon-button remove-track';
        remove.title = 'Remove track';
        remove.setAttribute('aria-label', `Remove ${track.title}`);
        remove.appendChild(makeIcon('x'));
        remove.addEventListener('click', (event) => {
          event.stopPropagation();
          api.removeTracks([track.id]);
          if (selectedId === track.id) selectedId = '';
        });
        row.addEventListener('click', () => { selectedId = track.id; render(); });
        row.addEventListener('dblclick', () => api.dispatchPlayer({ type: 'play-index', index }));
        row.addEventListener('dragstart', (event) => {
          draggedIndex = index;
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', String(index));
        });
        row.addEventListener('dragover', (event) => { event.preventDefault(); row.classList.add('drag-over'); });
        row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
        row.addEventListener('drop', (event) => {
          event.preventDefault();
          event.stopPropagation();
          row.classList.remove('drag-over');
          if (draggedIndex >= 0 && draggedIndex !== index) api.reorderTrack(draggedIndex, index);
          draggedIndex = -1;
          sort.value = 'manual';
        });
        row.append(number, main, album, time, remove);
        list.appendChild(row);
      }
      refreshIcons();
    }

    search.addEventListener('input', render);
    sort.addEventListener('change', () => { if (sort.value !== 'manual') api.sortPlaylist(sort.value); });
    document.getElementById('playlist-add-files').addEventListener('click', addFiles);
    document.getElementById('playlist-add-folder').addEventListener('click', addFolder);
    document.getElementById('playlist-clear').addEventListener('click', () => {
      if (!state.tracks.length || window.confirm('Clear the entire playlist?')) api.clearPlaylist();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Delete' && selectedId) api.removeTracks([selectedId]);
      if (event.key === 'Enter' && selectedId) {
        const index = state.tracks.findIndex((track) => track.id === selectedId);
        if (index >= 0) api.dispatchPlayer({ type: 'play-index', index });
      }
      if (event.key.toLowerCase() === 'f' && event.ctrlKey) { event.preventDefault(); search.focus(); }
    });
    api.onDocking((snapshot) => {
      const attached = Object.values(snapshot?.attached || {}).some((ids) => ids.includes('playlist'));
      dock.classList.toggle('attached', attached);
    });
    return { render };
  }

  function applyState(nextState) {
    state = { ...state, ...nextState, panelVisibility: { ...(state?.panelVisibility || {}), ...(nextState.panelVisibility || {}) } };
    controller?.render?.();
  }

  async function init() {
    wireWindowControls();
    wireDropImport();
    const bootstrap = await api.bootstrap();
    state = bootstrap.state;
    if (panel === 'player') controller = createPlayerController();
    if (panel === 'equalizer') controller = createEqualizerController();
    if (panel === 'playlist') controller = createPlaylistController();
    api.onState(applyState);
    controller.render();
    refreshIcons();
  }

  function createPreviewBridge(previewPanel) {
    const listeners = [];
    const playerListeners = [];
    const now = {
      tracks: [
        { id: 'preview-1', title: 'Midnight Circuit', artist: 'Lumen Field', album: 'After Hours', duration: 247, url: '', cover: '' },
        { id: 'preview-2', title: 'Soft Machines', artist: 'North Arcade', album: 'Signal Bloom', duration: 193, url: '', cover: '' },
        { id: 'preview-3', title: 'Glassline', artist: 'Mira Coast', album: 'Parallel', duration: 316, url: '', cover: '' }
      ],
      activeIndex: 0,
      volume: 0.78,
      muted: false,
      shuffle: false,
      repeatMode: 'off',
      eqEnabled: true,
      eqPreset: 'flat',
      eqGains: [0, 2, 3, 1, 0, -1, 2, 3, 1, 0],
      alwaysOnTop: false,
      panelVisibility: { equalizer: true, playlist: true }
    };
    const emit = () => listeners.forEach((listener) => listener({ ...now }));
    return {
      bootstrap: async () => ({ panel: previewPanel, state: { ...now }, docking: { attached: { player: ['equalizer', 'playlist'] } } }),
      chooseFiles: async () => ({ added: 0, state: now }),
      chooseFolder: async () => ({ added: 0, state: now }),
      addPaths: async () => ({ added: 0, state: now }),
      removeTracks: async (ids) => { now.tracks = now.tracks.filter((track) => !ids.includes(track.id)); emit(); },
      clearPlaylist: async () => { now.tracks = []; now.activeIndex = -1; emit(); },
      reorderTrack: async () => now,
      sortPlaylist: async () => now,
      updateState: (patch) => { Object.assign(now, patch); emit(); },
      dispatchPlayer: (action) => playerListeners.forEach((listener) => listener(action)),
      windowCommand: () => {},
      pathForFile: () => '',
      onState: (callback) => { listeners.push(callback); return () => {}; },
      onPlayerAction: (callback) => { playerListeners.push(callback); return () => {}; },
      onDocking: (callback) => { callback({ attached: { player: ['equalizer', 'playlist'] } }); return () => {}; }
    };
  }

  init().catch((error) => {
    document.body.innerHTML = `<pre style="margin:0;padding:16px;color:#ff7979;background:#14191f;font:12px Consolas">AmpDock failed to start\n${String(error.message || error)}</pre>`;
  });
})();
