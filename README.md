# AmpDock

[![Release](https://img.shields.io/github/v/release/cybereun/ampdock?display_name=tag)](https://github.com/cybereun/ampdock/releases)
[![Windows](https://img.shields.io/badge/platform-Windows%2010%20%2F%2011-0078D4?logo=windows)](https://github.com/cybereun/ampdock/releases)
[![License](https://img.shields.io/github/license/cybereun/ampdock)](LICENSE)
[![Runtime](https://img.shields.io/badge/runtime-native%20WPF-512BD4)](https://learn.microsoft.com/dotnet/desktop/wpf/)

AmpDock is a native Windows desktop audio player. V1.0.1 is a complete rewrite: it does not use a webpage, Microsoft Edge, Electron, or a browser translation layer.

## Features

- Three native WPF windows: Player, 10-band Equalizer, and Playlist.
- Magnetic docking: panels snap to each other's aligned edges and attached panels move together.
- Local file and recursive-folder import.
- Playback, seek, previous/next, shuffle, repeat off/all/one, mute, volume, and keyboard shortcuts.
- Actual 10-band DSP equalizer with Flat, Warm, Clarity, Vocal, and Night presets.
- Searchable playlist, double-click to play, remove selected item, clear playlist, panel show/hide, always-on-top, and reset layout.
- MP3, WAV, M4A, AAC, FLAC, OGG, and Opus where Windows codecs support the file.

## Install

Download either artifact from the [V1.0.1 release](https://github.com/cybereun/ampdock/releases/tag/V1.0.1).

- `AmpDock-1.0.1-x64-installer.exe` installs per user without an administrator prompt.
- `AmpDock-1.0.1-x64-portable.exe` is a single file; place it anywhere and run it.

## Shortcuts

| Shortcut | Action |
| --- | --- |
| `Space` | Play / pause |
| `Ctrl+O` | Add audio files |
| `Ctrl+Left` / `Ctrl+Right` | Previous / next |
| `M` | Mute |

## Build

Run `powershell -ExecutionPolicy Bypass -File .\release.ps1` on Windows with .NET Framework 4.8 installed. It creates portable and installer artifacts in `release-final/`.

## License

MIT License. Copyright (c) 2026 cybereun.
