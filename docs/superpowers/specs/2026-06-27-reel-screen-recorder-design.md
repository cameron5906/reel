# Reel — Screen Recorder (Loom Alternative) — Design

**Date:** 2026-06-27
**Status:** Approved design, pre-implementation
**Working name:** Reel (changeable)

## Goal

A desktop screen recorder that replicates the core Loom experience without a subscription.
Record screen + a draggable webcam bubble + microphone + system audio, composited into a
single video file, then preview, trim, and export to MP4 — all local, no cloud, $0/mo.

## Scope

### In scope (v1)
- Capture sources: **full monitor** (multi-monitor picker) and **free-form region** (drag-to-select).
- **Webcam bubble**: draggable, circular, always-on-top, baked into the output file at its live position.
- **Audio**: microphone + system/desktop audio, mixed into one track.
- **Floating control toolbar**: timer, pause/resume, stop, restart, mic toggle, cam toggle.
- **Post-record**: preview player, trim (start/end), export to MP4 (H.264/AAC) or keep WebM,
  reveal in Explorer, copy file.
- **Library**: list of past recordings with thumbnail, duration, date.
- **Global hotkey** to stop recording.

### Out of scope (v1, parked)
- Cloud upload / shareable links / viewer page (this design is local-file only by user decision).
- **Single-window capture** (a window moves/resizes mid-recording, breaking bubble overlay math).
- Transcription, comments, reactions, drawing/annotation tools.
- macOS support (target is Windows; system-audio loopback path is Windows-specific).

## Architecture

### Approach
**Real-time canvas compositing (Approach A).** During recording, a hidden compositor paints the
screen feed and the webcam (clipped to a circle) onto an offscreen `<canvas>` every frame. Mic and
system audio are mixed via the Web Audio API into a single track. `canvas.captureStream()` + the
mixed audio feed a `MediaRecorder`, which streams WebM chunks to disk. ffmpeg transcodes to MP4 on
export. The file is exactly what the user sees (WYSIWYG); ffmpeg only transcodes, never composites.

Rejected: Approach B (record streams separately, composite in post with ffmpeg). Heavier/slower
export, A/V drift risk, less WYSIWYG.

### Stack
- **Electron** (multi-window) + **React** + **TypeScript** + **Vite** via `electron-vite`.
- `ffmpeg-static` bundled for transcode/trim/thumbnails.
- `electron-builder` for the Windows installer.
- **Vitest** for unit tests on pure logic.

### Windows
| Window | Visible | Role |
|---|---|---|
| Home | yes | Pick display/region, mic, webcam; toggle system audio; Record button; recordings library. |
| Webcam bubble | yes | Frameless, transparent, always-on-top, draggable circular live webcam preview. |
| Control toolbar | yes | Frameless, always-on-top mini bar: timer, pause/resume, stop, restart, mic/cam toggles. |
| Region selector | yes (transient) | Transparent full-screen overlay; drag a rectangle to define the capture region. |
| Editor | yes | Video player + trim handles + export/save/share. |
| Compositor | **no (hidden)** | The recording engine: grabs streams, paints canvas, mixes audio, runs MediaRecorder, writes to disk. |

### Recording flow
1. User selects source (full monitor or region), webcam, mic, and system-audio toggle in Home.
2. If Region: the Region selector overlay opens; user drags a rectangle. Coordinates + owning
   display are captured. Region is fixed for the duration of the recording.
3. User positions the webcam bubble, hits Record → 3-2-1 countdown.
4. The hidden **compositor** acquires:
   - **Screen stream** — full display via `desktopCapturer` + `getUserMedia({chromeMediaSource:'desktop'})`.
   - **System audio** — Windows requires desktop audio to be requested together with desktop video
     in the same `getUserMedia` call; we keep the loopback audio track.
   - **Webcam stream** — `getUserMedia({video:{deviceId}})`.
   - **Mic stream** — `getUserMedia({audio:{deviceId}})`.
   - **Mixed audio** — mic + system via Web Audio `MediaStreamAudioSourceNode`s →
     `MediaStreamAudioDestinationNode` → single track.
5. Per animation frame (~30fps): draw screen frame (cropped to region rect if regional) onto a
   canvas sized to the capture rect; then draw the webcam clipped to a circle at the bubble's live
   position. Main process forwards the bubble window's screen bounds as the user drags; the
   compositor maps them into canvas coordinates.
6. `canvas.captureStream(30)` + mixed audio track → `MediaRecorder` → WebM chunks streamed to a
   temp file on disk (not buffered in memory).
7. On Stop, the raw WebM is finalized and the Editor opens with its path.

### Coordinate mapping (the core math, unit-tested)
- Capture rect in screen coords: full display bounds, or the selected region.
- Canvas sized to capture rect (capped to a max resolution/fps for performance).
- `scaleX = canvasWidth / captureRect.width`, `scaleY = canvasHeight / captureRect.height`.
- Screen source draw: `drawImage(screenVideo, captureRect.x - display.x, captureRect.y - display.y,
  captureRect.w, captureRect.h, 0, 0, canvasWidth, canvasHeight)`.
- Bubble draw position on canvas:
  `bubbleCanvasX = (bubble.screenX - display.x - (captureRect.x - display.x)) * scaleX`
  (i.e. relative to the capture rect origin), likewise Y; size scaled the same way; clipped to a circle.

### IPC & security
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox` where feasible.
- All main↔renderer communication through a typed `preload` `contextBridge` API.
- Shared IPC contract types live in `shared/`.
- Main process owns: window lifecycle, `desktopCapturer.getSources`, `screen` module
  (display + bubble bounds), file dialogs, ffmpeg child processes, `globalShortcut`.

## Editor, export, library

### Editor
- HTML5 `<video>` plays the raw WebM.
- **Trim**: timeline with draggable in/out handles + scrubber; non-destructive (stores in/out points).
- **Export**: MP4 (H.264/AAC via `ffmpeg-static`) or keep WebM (instant, no transcode). Trim applied
  during export via ffmpeg `-ss`/`-to`.
- **Save/Share**: save to library folder or "Save As…"; Reveal in Explorer; Copy file.
- Export runs in the **main process** (child process); progress piped to the UI over IPC.

### Library
- Default folder `Videos/Reel` (configurable). Home lists recordings with first-frame thumbnail
  (ffmpeg), duration, and date. Click to re-open in editor, reveal, or delete.

## Error handling
- Cam/mic/screen permission denied → clear inline message + retry; never a silent fail.
- ffmpeg failure → retain the raw WebM (a recording is never lost); surface the error.
- Recording streamed to disk, not held in memory → long recordings don't OOM.
- Device unplugged mid-record → stop gracefully and save what exists.

## Testing
- **Unit (Vitest)** on pure logic, where bugs hide and a GUI isn't needed:
  - coordinate mapping (screen → canvas → region, bubble placement),
  - trim points → ffmpeg arguments,
  - filename/path helpers.
- **Manual smoke testing** for capture/IPC/hardware glue (OS- and device-bound; not worth brittle
  E2E in v1).

## Project layout
```
reel/
├─ electron/
│  ├─ main.ts            # window mgmt, lifecycle
│  ├─ preload.ts         # typed contextBridge API
│  ├─ ipc/               # handlers: capture sources, ffmpeg, files, hotkeys
│  ├─ ffmpeg/            # transcode, trim, thumbnail
│  └─ windows/           # factory per window (home, bubble, toolbar, editor, region, compositor)
├─ src/
│  ├─ windows/           # one React entry per window
│  ├─ recorder/          # compositor engine: streams, canvas paint loop, audio mix, MediaRecorder
│  ├─ components/        # shared UI
│  ├─ lib/               # pure logic (coords, ffmpeg-args, paths) ← unit tested
│  └─ store/             # recording state
├─ shared/               # types shared across main/renderer (IPC contracts)
└─ electron.vite.config.ts
```

## Build milestones (each independently runnable)
1. Scaffold + windows open + device/source selection working.
2. Compositor records screen → WebM to disk (no bubble yet).
3. Webcam bubble overlay + live coordinate mapping baked into the file.
4. Audio mixing (mic + system).
5. Region selector + crop path.
6. Editor: preview + trim + MP4 export.
7. Library + reveal/copy + global hotkey to stop.
8. Package Windows installer + polish.
