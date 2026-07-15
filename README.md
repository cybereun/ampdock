# AmpDock

[![Release](https://img.shields.io/github/v/release/cybereun/ampdock?display_name=tag)](https://github.com/cybereun/ampdock/releases)
[![Windows](https://img.shields.io/badge/platform-Windows%2010%20%2F%2011-0078D4?logo=windows)](https://github.com/cybereun/ampdock/releases)
[![License](https://img.shields.io/github/license/cybereun/ampdock)](LICENSE)
[![Runtime](https://img.shields.io/badge/runtime-native%20WPF-512BD4)](https://learn.microsoft.com/dotnet/desktop/wpf/)

**한국어(기본)** · [English](#english)

## 한국어

AmpDock은 Windows용 네이티브 데스크톱 오디오 플레이어입니다. 웹페이지, Microsoft Edge, Electron 또는 브라우저 번역 계층을 사용하지 않으며 WPF로 직접 실행됩니다.

### 주요 기능

- 플레이어, 10밴드 이퀄라이저, 플레이리스트로 구성된 3개의 네이티브 WPF 창
- 창 가장자리가 빈틈없이 붙고, 연결된 창이 함께 움직이는 자석 도킹
- 이퀄라이저와 플레이리스트의 `분리` 버튼을 이용한 개별 창 이동 및 자석 재활성화
- 실제 재생 음원의 저음·중음·고음에 반응하는 위·아래 막대형 파형
- 로컬 오디오 파일 추가 및 폴더 하위 항목 일괄 가져오기
- 재생·일시정지, 탐색, 이전·다음 곡, 셔플, 전체·한 곡 반복, 음소거 및 음량 조절
- Flat, Warm, Clarity, Vocal, Rock, Dance, Ballad, Jazz, Classical, Night, Piano, Guitar, Cello, Violin 프리셋을 제공하는 실제 10밴드 DSP 이퀄라이저
- 플레이리스트 검색, 더블 클릭 재생, 선택 항목 삭제 및 전체 목록 삭제
- 이퀄라이저·플레이리스트 표시 전환, 항상 위 표시 및 창 배치 초기화
- MP3, WAV, M4A, AAC, FLAC, OGG, Opus 지원(Windows에서 해당 코덱을 지원하는 경우)

### 설치 방법

[V1.0.1 릴리스 페이지](https://github.com/cybereun/ampdock/releases/tag/V1.0.1)에서 원하는 파일을 내려받으세요.

- `AmpDock-1.0.1-x64-installer.exe`: 관리자 권한 요청 없이 현재 사용자 계정에 설치합니다.
- `AmpDock-1.0.1-x64-portable.exe`: 설치가 필요 없는 단일 실행 파일입니다. 원하는 위치에 저장한 뒤 실행하세요.

### 사용 방법

1. `Files` 버튼으로 오디오 파일을 선택하거나 `Folder` 버튼으로 폴더 전체를 추가합니다.
2. 플레이리스트에서 곡을 더블 클릭하거나 재생 버튼을 누릅니다.
3. 이퀄라이저 프리셋을 선택하거나 각 주파수 슬라이더를 직접 조절합니다.
4. 창을 가까이 이동하면 자석처럼 붙으며, 붙은 창은 함께 움직입니다.
5. 이퀄라이저 또는 플레이리스트를 따로 옮기려면 제목 표시줄의 `분리` 버튼을 누릅니다. 다시 자석을 사용하려면 `자석` 버튼을 누릅니다.

### 단축키

| 단축키 | 기능 |
| --- | --- |
| `Space` | 재생 / 일시정지 |
| `Ctrl+O` | 오디오 파일 추가 |
| `Ctrl+Left` / `Ctrl+Right` | 이전 곡 / 다음 곡 |
| `M` | 음소거 전환 |

### 직접 빌드하기

Windows와 .NET Framework 4.8이 필요합니다. PowerShell에서 다음 명령을 실행하면 `release-final/` 폴더에 포터블 EXE와 설치형 EXE가 생성됩니다.

```powershell
powershell -ExecutionPolicy Bypass -File .\release.ps1
```

### 라이선스

[MIT License](LICENSE)로 배포됩니다. Copyright (c) 2026 cybereun.

---

## English

[한국어로 이동](#한국어)

AmpDock is a native Windows desktop audio player. It runs directly on WPF without a webpage, Microsoft Edge, Electron, or a browser translation layer.

### Features

- Three native WPF windows: Player, 10-band Equalizer, and Playlist
- Zero-gap magnetic docking with connected-window movement
- `Detach` controls for moving the Equalizer or Playlist independently and restoring magnetic docking
- A mirrored bar visualizer that responds to the bass, mids, and treble of the playing audio
- Local file import and recursive folder import
- Play/pause, seek, previous/next, shuffle, repeat all/one, mute, and volume controls
- A real 10-band DSP equalizer with Flat, Warm, Clarity, Vocal, Rock, Dance, Ballad, Jazz, Classical, Night, Piano, Guitar, Cello, and Violin presets
- Playlist search, double-click playback, selected-item removal, and playlist clearing
- Equalizer/Playlist visibility controls, always-on-top mode, and layout reset
- MP3, WAV, M4A, AAC, FLAC, OGG, and Opus support where the required Windows codec is available

### Installation

Download one of the files from the [V1.0.1 release page](https://github.com/cybereun/ampdock/releases/tag/V1.0.1).

- `AmpDock-1.0.1-x64-installer.exe`: installs for the current user without an administrator prompt.
- `AmpDock-1.0.1-x64-portable.exe`: a single-file portable build. Save it anywhere and run it without installation.

### Usage

1. Select audio with `Files`, or import an entire folder with `Folder`.
2. Double-click a playlist item or press the Play button.
3. Choose an equalizer preset or adjust the frequency sliders manually.
4. Move windows close together to dock them; connected windows move as a group.
5. Use `Detach` on the Equalizer or Playlist title bar to move that window independently. Use `Magnet` to enable docking again.

### Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Space` | Play / pause |
| `Ctrl+O` | Add audio files |
| `Ctrl+Left` / `Ctrl+Right` | Previous / next track |
| `M` | Toggle mute |

### Build from source

Windows and .NET Framework 4.8 are required. Run the following command in PowerShell to create portable and installer executables in `release-final/`:

```powershell
powershell -ExecutionPolicy Bypass -File .\release.ps1
```

### License

Distributed under the [MIT License](LICENSE). Copyright (c) 2026 cybereun.
