# AmpDock Desktop Player Design

## Goal

Build a true Windows desktop audio player whose player, equalizer, and playlist are three independent frameless windows. Each panel must sit directly on the desktop, detach freely, magnetically snap to the other panels or screen edges, and restore its last position. The playlist must resize from native window edges.

## Product Direction

AmpDock keeps the compact, information-dense spirit of classic modular players while using a quieter contemporary skin. The player should feel like an instrument, not a webpage: no browser tabs, browser canvas, page background, or native title bar is visible.

Feature research from the official AIMP and foobar2000 feature pages highlights persistent playlists, keyboard shortcuts, equalization, gapless playback, ReplayGain/normalization, and library organization as durable desktop-player expectations. Version 1 focuses on the subset that materially improves a local playlist workflow without turning the compact player into a library manager.

## Windows

- Player: fixed-size primary window, playback, visualizer, transport, seek, volume, import, panel visibility, always-on-top, minimize, and quit.
- Equalizer: fixed-size secondary window with ten bands, presets, bypass, reset, and its own hide control.
- Playlist: resizable secondary window with search, sorting, import, drag reorder, remove, clear, selection, duration, and its own hide control.

All windows use transparent frameless Electron BrowserWindows with local packaged content only. The body is transparent and the panel fills the native window, so there is no browser-colored area around it.

## Desktop Behavior

- Native dragging uses the panel title bar.
- A moved panel snaps within 18 px of another panel or work-area edge.
- Moving the player carries panels attached to its bottom or right; moving the equalizer carries a playlist attached below or right.
- Pulling a child panel away detaches it.
- Playlist native edge/corner resizing has a 420 x 260 minimum.
- Window bounds, visibility, always-on-top state, volume, EQ, repeat, shuffle, and playlist paths persist.

## Audio And Library

- Import multiple files with a native Windows picker.
- Import folders recursively, including locally synced cloud folders.
- Drag audio files or folders onto any panel.
- Read common metadata and cover art when available; fall back to parsed filenames.
- Support MP3, WAV, M4A, AAC, FLAC, OGG, and Opus where Chromium decoding is available.
- Keep one audio element in the player window and synchronize the other windows through narrow IPC messages.
- Apply a ten-band Web Audio equalizer and analyzer visualizer.
- Support repeat, shuffle, previous/next, seek, mute, and Media Session controls.

## Security

- `nodeIntegration` remains disabled.
- `contextIsolation` and renderer sandboxing remain enabled.
- A preload bridge exposes one validated method per IPC operation.
- Only packaged local files are loaded. Navigation and arbitrary popup creation are blocked.
- File access and metadata parsing happen in the main process.

## Visual System

- Near-black graphite surfaces, neutral borders, mint playback accent, amber time/progress accent, and cyan secondary state.
- Square, stable icon controls using Lucide icons and native tooltips.
- 4-6 px corner radii; no decorative page background, gradients, or floating marketing cards.
- Compact typography with tabular numerals and clear focus states.
- Every panel remains usable at its minimum size without overlap.

## Acceptance Criteria

- Launching the EXE shows only three app panels on the desktop.
- Each panel can be dragged independently and snaps on every edge.
- Attached child panels follow the parent while it moves.
- Playlist resizing works from native window edges and content reflows.
- Import, playback, seek, volume, previous/next, shuffle, repeat, EQ, playlist editing, search, sort, and persistence work.
- Closing the player quits the app; hiding secondary panels does not lose state.
- Automated core tests pass and packaged EXE smoke launch succeeds.
