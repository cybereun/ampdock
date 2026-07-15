# AmpDock

[![Release](https://img.shields.io/github/v/release/cybereun/ampdock?display_name=tag&sort=semver)](https://github.com/cybereun/ampdock/releases)
[![License](https://img.shields.io/github/license/cybereun/ampdock)](LICENSE)
[![Windows](https://img.shields.io/badge/platform-Windows%2010%20%2F%2011-0078D4?logo=windows)](https://github.com/cybereun/ampdock/releases)
[![Electron](https://img.shields.io/badge/Electron-43-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)

A compact, local-first Windows audio player built as three detachable desktop panels: a player, a ten-band equalizer, and a searchable playlist. AmpDock keeps the dense, instrument-like feel of classic modular audio players without turning your local music collection into a cloud service.

![AmpDock icon](assets/icon.svg)

## Features

- **Three independent panels** — Move the player, equalizer, and playlist separately; hide secondary panels without stopping playback.
- **Desktop docking** — Panels magnetically snap to one another and to screen edges. Attached panels follow their parent when moved, while detached panels stay independent.
- **Local audio workflow** — Import multiple files or recursively scan folders. Drag files or folders onto any panel to add them to the playlist.
- **Common formats** — MP3, WAV, M4A, AAC, FLAC, OGG, and Opus when supported by Chromium's decoder.
- **Metadata-aware playback** — Reads title, artist, album, duration, embedded cover art, and track number when available; filenames are a graceful fallback.
- **Playback essentials** — Seek, volume, mute, previous/next, shuffle, repeat-one/repeat-all, media keys, and Media Session integration.
- **Ten-band equalizer** — Flat, Warm, Clarity, Vocal, and Night presets; individual band controls, bypass, and reset.
- **Playlist tools** — Search, sort, drag reorder, select, remove, clear, track count, and total duration.
- **Persistent state** — Restores panel bounds, visibility, docking layout, playlist paths, active track, volume, playback options, and equalizer settings.
- **Secure Electron shell** — Sandboxed renderers, context isolation, validated IPC, blocked popup/navigation paths, and local packaged content only.

## Install

### Option 1: Installer (recommended)

1. Download `AmpDock-1.0.0-x64-installer.exe` from the [V1.0.0 release](https://github.com/cybereun/ampdock/releases/tag/V1.0.0).
2. Run the installer and choose an installation directory if desired.
3. Launch AmpDock from the Start menu or desktop shortcut.

### Option 2: Portable executable

1. Download `AmpDock-1.0.0-x64-portable.exe` from the [V1.0.0 release](https://github.com/cybereun/ampdock/releases/tag/V1.0.0).
2. Place it in any writable folder and run it. No installation is required.

Both packages target 64-bit Windows 10 or Windows 11. AmpDock runs entirely locally; importing and playback do not upload your music files.

## Getting started

1. Use the **Add files** or **Add folder** button, or drop audio files/folders onto a panel.
2. Select a row in the playlist and double-click it to play.
3. Drag title bars to arrange the panels. Move within 18 px of an edge to dock.
4. Use the equalizer panel to choose a preset or shape the ten frequency bands.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| <kbd>Space</kbd> | Play or pause |
| <kbd>Ctrl</kbd> + <kbd>Left</kbd> | Previous track |
| <kbd>Ctrl</kbd> + <kbd>Right</kbd> | Next track |
| <kbd>Up</kbd> / <kbd>Down</kbd> | Increase / decrease volume |
| <kbd>M</kbd> | Mute or unmute |
| <kbd>Ctrl</kbd> + <kbd>O</kbd> | Add audio files |

## Build from source

### Requirements

- Windows 10/11 x64
- Node.js 24 or later
- npm 11 or later

> npm can have trouble operating directly in some synced folders whose absolute path contains non-ASCII characters. If that happens, copy or clone the project to an ASCII-only path such as `C:\\dev\\AmpDock` before installing dependencies.

```powershell
git clone https://github.com/cybereun/ampdock.git
cd ampdock
npm install
npm start
```

### Quality checks

```powershell
npm test
node --check src/main.cjs
node --check src/preload.cjs
node --check src/renderer.js
```

### Windows packages

```powershell
# Unpacked application for smoke testing
npm run pack:win

# NSIS installer and standalone portable executable
npm run build:win
```

The generated artifacts are written to `dist/`:

- `AmpDock-1.0.0-x64-installer.exe`
- `AmpDock-1.0.0-x64-portable.exe`

## Project structure

```text
src/
  main.cjs       Electron windows, IPC, persistence, metadata, docking
  preload.cjs    Minimal sandboxed renderer bridge
  renderer.js    Player, equalizer, and playlist behavior
  core.cjs       Testable playlist, formatting, and docking logic
  index.html     Shared panel markup
  styles.css     Panel visual system and responsive playlist layout
tests/
  core.test.cjs  Node test suite for pure core behavior
assets/
  icon.ico       Windows application icon
```

## License

AmpDock is released under the [MIT License](LICENSE).
