# AmpDock Edge runtime migration

## Goal

Replace the Electron release runtime with a small native Windows launcher that hosts the existing local UI in Microsoft Edge app windows. This avoids the Electron GPU bootstrap crash observed on the target Windows 11 build while retaining AmpDock's local-first behavior.

## Requirements

- Build a self-contained portable EXE that does not bundle or launch Electron.
- Build an NSIS installer containing the same launcher.
- Open Player, Equalizer, and Playlist as separate, responsive Edge app windows.
- Keep state and local audio access centralized in the native loopback host so separate Edge profiles stay synchronized.
- Provide native file/folder selection, local-only media streaming, window visibility controls, always-on-top, reset layout, and clean quit.
- Verify portable and installed copies on this machine before replacing the V1.0.0 release assets.

## Constraints

- Microsoft Edge is a Windows component and is required at runtime; the launcher reports a clear error when it is unavailable.
- The loopback host listens only on `127.0.0.1`; it never uploads imported media.
