# AmpDock

[![Release](https://img.shields.io/github/v/release/cybereun/ampdock?display_name=tag&sort=semver)](https://github.com/cybereun/ampdock/releases)
[![License](https://img.shields.io/github/license/cybereun/ampdock)](LICENSE)
[![Windows](https://img.shields.io/badge/platform-Windows%2010%20%2F%2011-0078D4?logo=windows)](https://github.com/cybereun/ampdock/releases)
[![Runtime](https://img.shields.io/badge/runtime-Microsoft%20Edge-0078D7?logo=microsoftedge&logoColor=white)](https://www.microsoft.com/edge)

AmpDock is a compact, local-first Windows audio player with three detachable panels: Player, ten-band Equalizer, and Playlist. It is built for people who prefer a dense, instrument-like desktop player over a cloud music service.

![AmpDock icon](assets/icon.svg)

## Highlights

- **Three independent panels** — Player, Equalizer, and Playlist open together and can be moved, hidden, restored, minimized, reset, or kept on top.
- **Local-only playback** — Audio is selected with Windows dialogs and is streamed only through an in-process `127.0.0.1` host. AmpDock does not upload your music.
- **Shared state** — Separate panel windows stay in sync for playlist, selected track, volume, shuffle, repeat, equalizer settings, and panel visibility.
- **Audio controls** — Play/pause, seek, previous/next, mute, volume, shuffle, repeat, playlist search, sort, reorder, remove, and clear.
- **Ten-band equalizer** — Flat, Warm, Clarity, Vocal, and Night presets plus per-band adjustment and bypass.
- **Common local formats** — MP3, WAV, M4A, AAC, FLAC, OGG, and Opus when supported by the installed Edge decoder.
- **No Electron runtime** — V1.0.0 packages use a small native Windows launcher and the installed Microsoft Edge runtime, avoiding the Electron GPU-startup conflict found on some Windows 11 systems.

## Install

### Installer (recommended)

1. Download `AmpDock-1.0.0-x64-installer.exe` from the [V1.0.0 release](https://github.com/cybereun/ampdock/releases/tag/V1.0.0).
2. Run it and choose the install directory if desired.
3. Start AmpDock from the Start menu or desktop shortcut.

### Portable

1. Download `AmpDock-1.0.0-x64-portable.exe` from the [V1.0.0 release](https://github.com/cybereun/ampdock/releases/tag/V1.0.0).
2. Put it in any writable folder and run it. Installation is not required.

Both builds target 64-bit Windows 10/11. Microsoft Edge must be installed; it is included with supported Windows versions. On launch, AmpDock opens Player, Equalizer, and Playlist as separate app windows.

## Getting started

1. Click **Add audio files** or **Add folder** in Player or Playlist.
2. Select a track in Playlist and double-click it, or use the Player controls.
3. Arrange the windows to suit your desktop. Use the Player toolbar to show/hide the other panels, pin all panels on top, or reset their layout.
4. Shape playback in the Equalizer panel.

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

Requirements: Windows 10/11 x64, Microsoft Edge, .NET Framework 4.x (bundled with Windows), Node.js/npm for the test suite, and NSIS for installer creation.

```powershell
git clone https://github.com/cybereun/ampdock.git
cd ampdock
npm install

# Native portable launcher smoke build
npm run pack:win

# Portable EXE and NSIS installer
npm run build:win
```

Artifacts are written to `dist-release/`:

- `AmpDock-1.0.0-x64-portable.exe`
- `AmpDock-1.0.0-x64-installer.exe`

Run quality checks with:

```powershell
npm test
node --check src/renderer.js
node --check native/edge-bridge.js
```

## Project structure

```text
native/
  AmpDockEdge.cs       Native launcher and loopback media/state host
  edge-bridge.js       Browser bridge for shared local state
  AmpDock.nsi          NSIS installer definition
src/
  index.html           Shared panel markup
  renderer.js          Player, equalizer, and playlist behavior
  styles.css           Panel visual system
  core.cjs             Testable playlist, formatting, and docking logic
tests/
  core.test.cjs        Node test suite
```

## License

AmpDock is released under the [MIT License](LICENSE).
