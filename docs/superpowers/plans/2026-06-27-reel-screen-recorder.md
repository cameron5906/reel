# Reel Screen Recorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local, subscription-free Loom alternative: record a monitor or free-form region with a draggable webcam bubble plus mixed mic + system audio, composited live into one file, then preview, trim, and export to MP4.

**Architecture:** Electron multi-window app. A hidden "compositor" renderer paints the screen feed (cropped to the capture rect) and the webcam (clipped to a circle at the bubble's live position) onto an offscreen canvas every frame, mixes mic + system audio via Web Audio, and feeds `canvas.captureStream()` + the audio track to a `MediaRecorder` that streams WebM to disk. ffmpeg (`ffmpeg-static`) transcodes/trims to MP4 on export. Pure coordinate/ffmpeg/path logic lives in `src/lib` and is unit-tested; capture/IPC glue is manually smoke-tested.

**Tech Stack:** Electron, React, TypeScript, Vite (via `electron-vite`), `ffmpeg-static`, `electron-builder`, Vitest.

## Global Constraints

- **Platform:** Windows only (v1). System-audio loopback path is Windows-specific.
- **Electron security:** every `BrowserWindow` uses `contextIsolation: true`, `nodeIntegration: false`. All main↔renderer traffic goes through the typed `preload` `contextBridge` API. Renderers never `require` Node.
- **Capture targets (v1):** full monitor (multi-monitor picker) and free-form region only. No single-window capture.
- **Output:** raw recording is always WebM on disk; MP4 (H.264/AAC) is produced only by ffmpeg at export. A recording is never lost to an ffmpeg failure.
- **Coordinates:** Electron `screen` bounds are in DIPs; captured video frames are physical pixels. Always multiply DIP rects by `display.scaleFactor` before mapping onto the canvas.
- **Pure logic in `src/lib`** (coords, ffmpeg-args, paths) is the only code under unit test (Vitest). Hardware/IPC glue uses the manual verification checklists in each task.
- **Memory:** recording chunks stream to disk, never buffered fully in memory.
- **Build tool:** `electron-vite` with separate `main` / `preload` / `renderer` builds; package via `electron-builder` to an NSIS Windows installer.

---

## File Structure

```
reel/
├─ electron/
│  ├─ main.ts                 # app lifecycle, registers ipc handlers, owns windows
│  ├─ preload.ts              # contextBridge -> window.reel typed API
│  ├─ windows/
│  │  ├─ registry.ts          # singleton map of open windows + helpers
│  │  ├─ home.ts              # createHomeWindow
│  │  ├─ bubble.ts            # createBubbleWindow (frameless/transparent/draggable)
│  │  ├─ toolbar.ts           # createToolbarWindow
│  │  ├─ region.ts            # createRegionWindow (fullscreen transparent overlay)
│  │  ├─ editor.ts            # createEditorWindow
│  │  └─ compositor.ts        # createCompositorWindow (hidden)
│  ├─ ipc/
│  │  ├─ sources.ts           # displays + desktopCapturer source ids
│  │  ├─ recording.ts         # orchestrates start/stop across windows
│  │  ├─ files.ts             # save dialog, reveal, copy, library listing, delete
│  │  └─ ffmpeg.ts            # transcode/trim/thumbnail via child_process
│  └─ ffmpeg/
│     └─ run.ts               # spawn ffmpeg-static, parse progress
├─ src/
│  ├─ windows/
│  │  ├─ home/                # Home React entry + components
│  │  ├─ bubble/              # Bubble React entry
│  │  ├─ toolbar/             # Toolbar React entry
│  │  ├─ region/              # Region selector React entry
│  │  ├─ editor/              # Editor React entry + components
│  │  └─ compositor/          # Compositor React entry (drives recorder engine)
│  ├─ recorder/
│  │  ├─ engine.ts            # RecorderEngine: streams, paint loop, audio mix, MediaRecorder
│  │  ├─ streams.ts           # getUserMedia helpers (screen/webcam/mic/system)
│  │  └─ audio-mix.ts         # Web Audio mixing
│  ├─ lib/
│  │  ├─ coords.ts            # physicalCrop, fitCanvas, mapBubbleToCanvas  (UNIT TESTED)
│  │  ├─ ffmpeg-args.ts       # buildTranscodeArgs, buildThumbnailArgs       (UNIT TESTED)
│  │  └─ paths.ts             # sanitizeFilename, defaultRecordingName        (UNIT TESTED)
│  ├─ store/
│  │  └─ settings.ts          # RecordingSettings types + defaults
│  └─ components/             # shared UI (Button, Select, etc.)
├─ shared/
│  └─ types.ts                # Rect, DisplayInfo, CaptureTarget, RecordingSettings, IPC contract
├─ tests/
│  ├─ coords.test.ts
│  ├─ ffmpeg-args.test.ts
│  └─ paths.test.ts
├─ electron.vite.config.ts
├─ electron-builder.yml
├─ tsconfig.json
├─ tsconfig.node.json
├─ vitest.config.ts
└─ package.json
```

---

## Task 1: Scaffold the electron-vite + React + TS project

**Files:**
- Create: `package.json`, `electron.vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `vitest.config.ts`
- Create: `electron/main.ts`, `electron/preload.ts`
- Create: `src/windows/home/index.html`, `src/windows/home/main.tsx`, `src/windows/home/App.tsx`
- Create: `shared/types.ts`

**Interfaces:**
- Produces: a launchable Electron app whose Home window renders a React page. `electron/main.ts` exports nothing but creates a window on `app.whenReady()`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "reel",
  "version": "0.1.0",
  "description": "Local screen recorder with webcam bubble",
  "main": "out/main/main.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.node.json",
    "package": "electron-vite build && electron-builder --win"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "electron": "^33.2.0",
    "electron-builder": "^25.1.8",
    "electron-vite": "^2.3.0",
    "typescript": "^5.7.2",
    "vite": "^5.4.11",
    "vitest": "^2.1.8"
  },
  "dependencies": {
    "ffmpeg-static": "^5.2.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json` (renderer) and `tsconfig.node.json` (main/preload)**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "baseUrl": ".",
    "paths": { "@shared/*": ["shared/*"], "@/*": ["src/*"] }
  },
  "include": ["src", "shared", "tests"]
}
```

`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": { "@shared/*": ["shared/*"] }
  },
  "include": ["electron"]
}
```

- [ ] **Step 3: Create `electron.vite.config.ts`**

```ts
import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const alias = { '@shared': resolve('shared'), '@': resolve('src') }

export default defineConfig({
  main: { build: { lib: { entry: 'electron/main.ts' } }, resolve: { alias } },
  preload: { build: { lib: { entry: 'electron/preload.ts' } }, resolve: { alias } },
  renderer: {
    root: 'src',
    resolve: { alias },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          home: resolve('src/windows/home/index.html')
        }
      }
    }
  }
})
```

- [ ] **Step 4: Create `shared/types.ts` (initial)**

```ts
export interface Rect { x: number; y: number; width: number; height: number }

export interface DisplayInfo {
  id: number
  label: string
  bounds: Rect          // DIPs
  scaleFactor: number
  sourceId: string      // desktopCapturer source id for this display
}
```

- [ ] **Step 5: Create the Home renderer files**

`src/windows/home/index.html`:
```html
<!doctype html>
<html>
  <head><meta charset="UTF-8" /><title>Reel</title></head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

`src/windows/home/main.tsx`:
```tsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

createRoot(document.getElementById('root')!).render(<App />)
```

`src/windows/home/App.tsx`:
```tsx
import React from 'react'

export function App() {
  return <h1 style={{ fontFamily: 'system-ui', padding: 24 }}>Reel</h1>
}
```

- [ ] **Step 6: Create `electron/preload.ts` (stub) and `electron/main.ts`**

`electron/preload.ts`:
```ts
import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('reel', {})
```

`electron/main.ts`:
```ts
import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'

const isDev = !!process.env['ELECTRON_RENDERER_URL']

function createHome() {
  const win = new BrowserWindow({
    width: 980,
    height: 680,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  if (isDev) win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/windows/home/index.html`)
  else win.loadFile(join(__dirname, '../renderer/windows/home/index.html'))
}

app.whenReady().then(() => {
  createHome()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createHome()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 7: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: { alias: { '@shared': resolve('shared'), '@': resolve('src') } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] }
})
```

- [ ] **Step 8: Install and run**

Run: `npm install`
Run: `npm run dev`
Expected: an Electron window opens showing the heading "Reel". Close it.

- [ ] **Step 9: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold electron-vite + react + ts project"
```

---

## Task 2: Pure logic — coordinate mapping (`src/lib/coords.ts`)

**Files:**
- Create: `src/lib/coords.ts`
- Test: `tests/coords.test.ts`

**Interfaces:**
- Consumes: `Rect`, `DisplayInfo` from `@shared/types`.
- Produces:
  - `physicalCrop(captureRect: Rect, display: { bounds: Rect; scaleFactor: number }): Rect` — converts a DIP capture rect into the physical-pixel source-crop rect relative to the display's top-left.
  - `fitCanvas(crop: Rect, maxLongEdge: number): { width: number; height: number; scale: number }` — canvas size capped to `maxLongEdge`, plus the applied scale.
  - `mapBubbleToCanvas(bubble: Rect, captureRect: Rect, scaleFactor: number, canvasScale: number): Rect` — maps a DIP bubble rect into canvas pixel coords relative to the capture rect origin.

- [ ] **Step 1: Write the failing tests**

`tests/coords.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { physicalCrop, fitCanvas, mapBubbleToCanvas } from '@/lib/coords'

const display = { bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1 }

describe('physicalCrop', () => {
  it('full display at scale 1 maps to physical pixels at origin', () => {
    expect(physicalCrop({ x: 0, y: 0, width: 1920, height: 1080 }, display))
      .toEqual({ x: 0, y: 0, width: 1920, height: 1080 })
  })

  it('region offsets by display origin and multiplies by scaleFactor', () => {
    const d = { bounds: { x: -1920, y: 0, width: 1920, height: 1080 }, scaleFactor: 1.5 }
    expect(physicalCrop({ x: -1920 + 100, y: 200, width: 640, height: 360 }, d))
      .toEqual({ x: 150, y: 300, width: 960, height: 540 })
  })
})

describe('fitCanvas', () => {
  it('does not upscale when below the cap', () => {
    expect(fitCanvas({ x: 0, y: 0, width: 1280, height: 720 }, 1920))
      .toEqual({ width: 1280, height: 720, scale: 1 })
  })

  it('scales down to the cap on the long edge, preserving aspect', () => {
    expect(fitCanvas({ x: 0, y: 0, width: 3840, height: 2160 }, 1920))
      .toEqual({ width: 1920, height: 1080, scale: 0.5 })
  })
})

describe('mapBubbleToCanvas', () => {
  it('places a bubble relative to capture origin and scales it', () => {
    // capture region starts at screen (100,200); bubble at (300,400) DIP, scale 2, canvasScale 0.5
    const r = mapBubbleToCanvas(
      { x: 300, y: 400, width: 160, height: 160 },
      { x: 100, y: 200, width: 640, height: 360 },
      2,
      0.5
    )
    expect(r).toEqual({ x: 200, y: 200, width: 160, height: 160 })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- coords`
Expected: FAIL — `Cannot find module '@/lib/coords'`.

- [ ] **Step 3: Implement `src/lib/coords.ts`**

```ts
import type { Rect } from '@shared/types'

export function physicalCrop(
  captureRect: Rect,
  display: { bounds: Rect; scaleFactor: number }
): Rect {
  const s = display.scaleFactor
  return {
    x: (captureRect.x - display.bounds.x) * s,
    y: (captureRect.y - display.bounds.y) * s,
    width: captureRect.width * s,
    height: captureRect.height * s
  }
}

export function fitCanvas(crop: Rect, maxLongEdge: number) {
  const longest = Math.max(crop.width, crop.height)
  const scale = longest > maxLongEdge ? maxLongEdge / longest : 1
  return {
    width: Math.round(crop.width * scale),
    height: Math.round(crop.height * scale),
    scale
  }
}

export function mapBubbleToCanvas(
  bubble: Rect,
  captureRect: Rect,
  scaleFactor: number,
  canvasScale: number
): Rect {
  const s = scaleFactor * canvasScale
  return {
    x: (bubble.x - captureRect.x) * s,
    y: (bubble.y - captureRect.y) * s,
    width: bubble.width * s,
    height: bubble.height * s
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- coords`
Expected: PASS (7 assertions across 3 suites).

- [ ] **Step 5: Commit**

```bash
git add src/lib/coords.ts tests/coords.test.ts
git commit -m "feat: coordinate mapping for capture crop and bubble overlay"
```

---

## Task 3: Pure logic — ffmpeg argument builders (`src/lib/ffmpeg-args.ts`)

**Files:**
- Create: `src/lib/ffmpeg-args.ts`
- Test: `tests/ffmpeg-args.test.ts`

**Interfaces:**
- Produces:
  - `interface TranscodeOptions { input: string; output: string; format: 'mp4' | 'webm'; trimStart?: number; trimEnd?: number }`
  - `buildTranscodeArgs(o: TranscodeOptions): string[]`
  - `buildThumbnailArgs(input: string, output: string, atSeconds: number): string[]`

- [ ] **Step 1: Write the failing tests**

`tests/ffmpeg-args.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildTranscodeArgs, buildThumbnailArgs } from '@/lib/ffmpeg-args'

describe('buildTranscodeArgs', () => {
  it('transcodes webm to mp4 with H.264/AAC, no trim', () => {
    expect(buildTranscodeArgs({ input: 'in.webm', output: 'out.mp4', format: 'mp4' })).toEqual([
      '-y', '-i', 'in.webm',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k',
      'out.mp4'
    ])
  })

  it('applies trim with -ss before -i and -to as duration after', () => {
    const args = buildTranscodeArgs({ input: 'in.webm', output: 'out.mp4', format: 'mp4', trimStart: 2, trimEnd: 5 })
    expect(args.slice(0, 6)).toEqual(['-y', '-ss', '2', '-i', 'in.webm', '-t'])
    expect(args[6]).toBe('3') // duration = trimEnd - trimStart
    expect(args).toContain('out.mp4')
  })

  it('webm output stream-copies when no trim', () => {
    expect(buildTranscodeArgs({ input: 'in.webm', output: 'out.webm', format: 'webm' })).toEqual([
      '-y', '-i', 'in.webm', '-c', 'copy', 'out.webm'
    ])
  })
})

describe('buildThumbnailArgs', () => {
  it('grabs a single frame at the given time', () => {
    expect(buildThumbnailArgs('in.webm', 'thumb.jpg', 1.5)).toEqual([
      '-y', '-ss', '1.5', '-i', 'in.webm', '-frames:v', '1', '-q:v', '3', 'thumb.jpg'
    ])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- ffmpeg-args`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/ffmpeg-args.ts`**

```ts
export interface TranscodeOptions {
  input: string
  output: string
  format: 'mp4' | 'webm'
  trimStart?: number
  trimEnd?: number
}

function trimFlags(o: TranscodeOptions): string[] {
  const flags: string[] = []
  if (o.trimStart != null) flags.push('-ss', String(o.trimStart))
  return flags
}

function durationFlags(o: TranscodeOptions): string[] {
  if (o.trimStart != null && o.trimEnd != null) {
    return ['-t', String(o.trimEnd - o.trimStart)]
  }
  if (o.trimEnd != null) return ['-t', String(o.trimEnd)]
  return []
}

export function buildTranscodeArgs(o: TranscodeOptions): string[] {
  const hasTrim = o.trimStart != null || o.trimEnd != null
  if (o.format === 'webm' && !hasTrim) {
    return ['-y', '-i', o.input, '-c', 'copy', o.output]
  }
  return [
    '-y',
    ...trimFlags(o),
    '-i', o.input,
    ...durationFlags(o),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k',
    o.output
  ]
}

export function buildThumbnailArgs(input: string, output: string, atSeconds: number): string[] {
  return ['-y', '-ss', String(atSeconds), '-i', input, '-frames:v', '1', '-q:v', '3', output]
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- ffmpeg-args`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ffmpeg-args.ts tests/ffmpeg-args.test.ts
git commit -m "feat: ffmpeg argument builders for transcode/trim/thumbnail"
```

---

## Task 4: Pure logic — path/name helpers (`src/lib/paths.ts`)

**Files:**
- Create: `src/lib/paths.ts`
- Test: `tests/paths.test.ts`

**Interfaces:**
- Produces:
  - `sanitizeFilename(name: string): string` — strips characters illegal on Windows.
  - `defaultRecordingName(date: Date): string` — e.g. `Reel-2026-06-27_14-09-03`.

- [ ] **Step 1: Write the failing tests**

`tests/paths.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { sanitizeFilename, defaultRecordingName } from '@/lib/paths'

describe('sanitizeFilename', () => {
  it('replaces Windows-illegal characters with underscores', () => {
    expect(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j')
  })
  it('trims trailing dots and spaces', () => {
    expect(sanitizeFilename('demo.  ')).toBe('demo')
  })
})

describe('defaultRecordingName', () => {
  it('formats a stable, sortable name', () => {
    const d = new Date('2026-06-27T14:09:03')
    expect(defaultRecordingName(d)).toBe('Reel-2026-06-27_14-09-03')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- paths`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/paths.ts`**

```ts
export function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').replace(/[. ]+$/, '')
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function defaultRecordingName(date: Date): string {
  const d = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const t = `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  return `Reel-${d}_${t}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- paths`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/paths.ts tests/paths.test.ts
git commit -m "feat: filename sanitizer and default recording name"
```

---

## Task 5: Shared IPC contract + typed preload bridge

**Files:**
- Modify: `shared/types.ts`
- Create: `src/store/settings.ts`
- Modify: `electron/preload.ts`
- Create: `src/global.d.ts`

**Interfaces:**
- Produces the `ReelApi` surface on `window.reel`, consumed by every renderer task that follows:
  - `getDisplays(): Promise<DisplayInfo[]>`
  - `selectRegion(): Promise<Rect | null>`
  - `startRecording(settings: RecordingSettings): Promise<void>`
  - `stopRecording(): Promise<void>`
  - `onBubbleBounds(cb: (rect: Rect) => void): () => void`
  - `reportBubbleBounds(rect: Rect): void`
  - `saveRecording(req: SaveRequest): Promise<SaveResult>`
  - `listRecordings(): Promise<RecordingMeta[]>`
  - `revealInExplorer(path: string): void`
  - `copyFile(path: string): Promise<void>`
  - `onRecorderCommand(cb: (cmd: RecorderCommand) => void): () => void`
  - `sendRecorderCommand(cmd: RecorderCommand): void`
  - `onExportProgress(cb: (pct: number) => void): () => void`

- [ ] **Step 1: Extend `shared/types.ts`**

```ts
export interface Rect { x: number; y: number; width: number; height: number }

export interface DisplayInfo {
  id: number
  label: string
  bounds: Rect
  scaleFactor: number
  sourceId: string
}

export type CaptureTarget =
  | { kind: 'display'; displayId: number }
  | { kind: 'region'; displayId: number; rect: Rect }

export interface RecordingSettings {
  target: CaptureTarget
  micDeviceId: string | null
  webcamDeviceId: string | null
  systemAudio: boolean
  bubble: { enabled: boolean; sizePx: number }   // sizePx = diameter in DIPs
  maxLongEdge: number                             // canvas cap, default 1920
}

export type RecorderCommand =
  | { type: 'start'; settings: RecordingSettings; sourceId: string; display: DisplayInfo }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'stop' }

export interface SaveRequest {
  tempPath: string                 // raw webm temp file
  format: 'mp4' | 'webm'
  trimStart?: number
  trimEnd?: number
  suggestedName: string
}

export interface SaveResult { saved: boolean; path?: string }

export interface RecordingMeta {
  path: string
  name: string
  thumbnailPath: string | null
  durationSec: number | null
  createdMs: number
  sizeBytes: number
}
```

- [ ] **Step 2: Create `src/store/settings.ts`**

```ts
import type { RecordingSettings } from '@shared/types'

export const defaultSettings: RecordingSettings = {
  target: { kind: 'display', displayId: 0 },
  micDeviceId: null,
  webcamDeviceId: null,
  systemAudio: true,
  bubble: { enabled: true, sizePx: 180 },
  maxLongEdge: 1920
}
```

- [ ] **Step 3: Implement the preload bridge in `electron/preload.ts`**

```ts
import { contextBridge, ipcRenderer } from 'electron'
import type {
  DisplayInfo, Rect, RecordingSettings, RecorderCommand,
  SaveRequest, SaveResult, RecordingMeta
} from '@shared/types'

const api = {
  getDisplays: (): Promise<DisplayInfo[]> => ipcRenderer.invoke('sources:displays'),
  selectRegion: (): Promise<Rect | null> => ipcRenderer.invoke('region:select'),

  startRecording: (settings: RecordingSettings): Promise<void> =>
    ipcRenderer.invoke('recording:start', settings),
  stopRecording: (): Promise<void> => ipcRenderer.invoke('recording:stop'),

  reportBubbleBounds: (rect: Rect): void => { ipcRenderer.send('bubble:bounds', rect) },
  onBubbleBounds: (cb: (rect: Rect) => void) => {
    const h = (_: unknown, r: Rect) => cb(r)
    ipcRenderer.on('bubble:bounds', h)
    return () => ipcRenderer.removeListener('bubble:bounds', h)
  },

  sendRecorderCommand: (cmd: RecorderCommand): void => { ipcRenderer.send('recorder:cmd', cmd) },
  onRecorderCommand: (cb: (cmd: RecorderCommand) => void) => {
    const h = (_: unknown, c: RecorderCommand) => cb(c)
    ipcRenderer.on('recorder:cmd', h)
    return () => ipcRenderer.removeListener('recorder:cmd', h)
  },

  recordingFinished: (tempPath: string, durationSec: number): void => {
    ipcRenderer.send('recording:finished', { tempPath, durationSec })
  },
  onRecordingFinished: (cb: (p: { tempPath: string; durationSec: number }) => void) => {
    const h = (_: unknown, p: { tempPath: string; durationSec: number }) => cb(p)
    ipcRenderer.on('recording:finished', h)
    return () => ipcRenderer.removeListener('recording:finished', h)
  },

  saveRecording: (req: SaveRequest): Promise<SaveResult> => ipcRenderer.invoke('files:save', req),
  listRecordings: (): Promise<RecordingMeta[]> => ipcRenderer.invoke('files:list'),
  deleteRecording: (path: string): Promise<void> => ipcRenderer.invoke('files:delete', path),
  revealInExplorer: (path: string): void => { ipcRenderer.send('files:reveal', path) },
  copyFile: (path: string): Promise<void> => ipcRenderer.invoke('files:copy', path),

  onExportProgress: (cb: (pct: number) => void) => {
    const h = (_: unknown, pct: number) => cb(pct)
    ipcRenderer.on('export:progress', h)
    return () => ipcRenderer.removeListener('export:progress', h)
  }
}

export type ReelApi = typeof api
contextBridge.exposeInMainWorld('reel', api)
```

- [ ] **Step 4: Create `src/global.d.ts` so renderers see `window.reel`**

```ts
import type { ReelApi } from '../electron/preload'

declare global {
  interface Window { reel: ReelApi }
}
export {}
```

- [ ] **Step 5: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors. (Handlers are added in later tasks; the contract compiles now.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: shared IPC contract, settings defaults, typed preload bridge"
```

---

## Task 6: Display enumeration IPC + window registry

**Files:**
- Create: `electron/windows/registry.ts`
- Create: `electron/ipc/sources.ts`
- Modify: `electron/main.ts`

**Interfaces:**
- Consumes: `DisplayInfo` from `@shared/types`.
- Produces:
  - `registry` with `get(name)`, `set(name, win)`, `close(name)`, `broadcast(channel, payload)`.
  - IPC handler `sources:displays` returning `DisplayInfo[]` by joining `screen.getAllDisplays()` with `desktopCapturer.getSources({ types: ['screen'] })`.

- [ ] **Step 1: Implement `electron/windows/registry.ts`**

```ts
import type { BrowserWindow } from 'electron'

const windows = new Map<string, BrowserWindow>()

export const registry = {
  set(name: string, win: BrowserWindow) {
    windows.set(name, win)
    win.on('closed', () => windows.delete(name))
  },
  get(name: string): BrowserWindow | undefined {
    return windows.get(name)
  },
  close(name: string) {
    windows.get(name)?.close()
  },
  broadcast(channel: string, payload: unknown) {
    for (const win of windows.values()) {
      if (!win.isDestroyed()) win.webContents.send(channel, payload)
    }
  }
}
```

- [ ] **Step 2: Implement `electron/ipc/sources.ts`**

```ts
import { ipcMain, screen, desktopCapturer } from 'electron'
import type { DisplayInfo } from '@shared/types'

export function registerSourceHandlers() {
  ipcMain.handle('sources:displays', async (): Promise<DisplayInfo[]> => {
    const displays = screen.getAllDisplays()
    const sources = await desktopCapturer.getSources({ types: ['screen'] })
    return displays.map((d, i) => {
      // desktopCapturer screen source ids look like "screen:<display_id>:0"
      const match = sources.find((s) => s.display_id === String(d.id)) ?? sources[i]
      return {
        id: d.id,
        label: d.label || `Display ${i + 1}`,
        bounds: { x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height },
        scaleFactor: d.scaleFactor,
        sourceId: match?.id ?? ''
      }
    })
  })
}
```

- [ ] **Step 3: Wire handler registration into `electron/main.ts`**

Add near the top imports:
```ts
import { registerSourceHandlers } from './ipc/sources'
import { registry } from './windows/registry'
```
Inside `app.whenReady().then(() => { ... })`, before `createHome()`:
```ts
  registerSourceHandlers()
```
And in `createHome`, after creating `win`, register it:
```ts
  registry.set('home', win)
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`
In the opened window, open DevTools (Ctrl+Shift+I) and run in the console:
```js
await window.reel.getDisplays()
```
Expected: an array with one entry per monitor, each having `bounds`, `scaleFactor`, and a non-empty `sourceId`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: window registry and display enumeration over IPC"
```

---

## Task 7: Home UI — device & source selection

**Files:**
- Create: `src/windows/home/components/SourcePicker.tsx`
- Create: `src/windows/home/components/DevicePicker.tsx`
- Create: `src/windows/home/hooks/useMediaDevices.ts`
- Modify: `src/windows/home/App.tsx`
- Create: `src/windows/home/home.css`

**Interfaces:**
- Consumes: `window.reel.getDisplays`, `window.reel.selectRegion`, `defaultSettings`.
- Produces: Home holds a `RecordingSettings` in React state and a Record button (wired to start recording in Task 9). Webcam/mic device ids come from `navigator.mediaDevices.enumerateDevices()` in the renderer.

- [ ] **Step 1: Implement `useMediaDevices` hook**

`src/windows/home/hooks/useMediaDevices.ts`:
```ts
import { useEffect, useState } from 'react'

export interface DeviceList { mics: MediaDeviceInfo[]; cams: MediaDeviceInfo[] }

export function useMediaDevices(): DeviceList {
  const [devices, setDevices] = useState<DeviceList>({ mics: [], cams: [] })
  useEffect(() => {
    async function load() {
      // Prompt once so device labels are populated.
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        s.getTracks().forEach((t) => t.stop())
      } catch { /* user can still pick "none" */ }
      const all = await navigator.mediaDevices.enumerateDevices()
      setDevices({
        mics: all.filter((d) => d.kind === 'audioinput'),
        cams: all.filter((d) => d.kind === 'videoinput')
      })
    }
    load()
    navigator.mediaDevices.addEventListener('devicechange', load)
    return () => navigator.mediaDevices.removeEventListener('devicechange', load)
  }, [])
  return devices
}
```

- [ ] **Step 2: Implement `DevicePicker.tsx`**

```tsx
import React from 'react'

interface Props {
  label: string
  devices: MediaDeviceInfo[]
  value: string | null
  onChange: (id: string | null) => void
  allowNone?: boolean
}

export function DevicePicker({ label, devices, value, onChange, allowNone }: Props) {
  return (
    <label className="field">
      <span>{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      >
        {allowNone && <option value="">None</option>}
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || 'Unnamed device'}
          </option>
        ))}
      </select>
    </label>
  )
}
```

- [ ] **Step 3: Implement `SourcePicker.tsx`**

```tsx
import React from 'react'
import type { CaptureTarget, DisplayInfo, Rect } from '@shared/types'

interface Props {
  displays: DisplayInfo[]
  target: CaptureTarget
  onChange: (t: CaptureTarget) => void
}

export function SourcePicker({ displays, target, onChange }: Props) {
  async function pickRegion() {
    const rect: Rect | null = await window.reel.selectRegion()
    if (!rect) return
    const display = displays.find(
      (d) =>
        rect.x >= d.bounds.x &&
        rect.y >= d.bounds.y &&
        rect.x < d.bounds.x + d.bounds.width &&
        rect.y < d.bounds.y + d.bounds.height
    ) ?? displays[0]
    onChange({ kind: 'region', displayId: display.id, rect })
  }

  return (
    <div className="source-picker">
      <div className="seg">
        <button
          className={target.kind === 'display' ? 'active' : ''}
          onClick={() => onChange({ kind: 'display', displayId: displays[0]?.id ?? 0 })}
        >
          Full monitor
        </button>
        <button
          className={target.kind === 'region' ? 'active' : ''}
          onClick={pickRegion}
        >
          {target.kind === 'region'
            ? `Region ${target.rect.width}×${target.rect.height}`
            : 'Select region…'}
        </button>
      </div>

      {target.kind === 'display' && displays.length > 1 && (
        <select
          value={target.displayId}
          onChange={(e) => onChange({ kind: 'display', displayId: Number(e.target.value) })}
        >
          {displays.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Rewrite `App.tsx` to hold settings state**

```tsx
import React, { useEffect, useState } from 'react'
import type { DisplayInfo, RecordingSettings } from '@shared/types'
import { defaultSettings } from '@/store/settings'
import { useMediaDevices } from './hooks/useMediaDevices'
import { SourcePicker } from './components/SourcePicker'
import { DevicePicker } from './components/DevicePicker'
import './home.css'

export function App() {
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [settings, setSettings] = useState<RecordingSettings>(defaultSettings)
  const { mics, cams } = useMediaDevices()

  useEffect(() => { window.reel.getDisplays().then(setDisplays) }, [])

  function update(patch: Partial<RecordingSettings>) {
    setSettings((s) => ({ ...s, ...patch }))
  }

  async function startRecording() {
    await window.reel.startRecording(settings)
  }

  return (
    <div className="home">
      <h1>Reel</h1>

      <section>
        <h2>Capture</h2>
        <SourcePicker displays={displays} target={settings.target} onChange={(target) => update({ target })} />
      </section>

      <section className="grid">
        <DevicePicker label="Camera" devices={cams} value={settings.webcamDeviceId}
          allowNone onChange={(id) => update({ webcamDeviceId: id, bubble: { ...settings.bubble, enabled: !!id } })} />
        <DevicePicker label="Microphone" devices={mics} value={settings.micDeviceId}
          allowNone onChange={(micDeviceId) => update({ micDeviceId })} />
        <label className="field check">
          <input type="checkbox" checked={settings.systemAudio}
            onChange={(e) => update({ systemAudio: e.target.checked })} />
          <span>System audio</span>
        </label>
      </section>

      <button className="record" disabled={displays.length === 0} onClick={startRecording}>
        ● Record
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Add minimal styling `home.css`**

```css
:root { color-scheme: light dark; }
body { margin: 0; font-family: system-ui, sans-serif; }
.home { padding: 24px; max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
h1 { margin: 0; }
section { display: flex; flex-direction: column; gap: 10px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: end; }
.field { display: flex; flex-direction: column; gap: 6px; font-size: 14px; }
.field.check { flex-direction: row; align-items: center; gap: 8px; }
select, button { padding: 8px 10px; border-radius: 8px; font-size: 14px; }
.seg { display: flex; gap: 8px; }
.seg .active { outline: 2px solid #4f7cff; }
.record { align-self: flex-start; background: #e5484d; color: #fff; border: none; padding: 12px 22px; font-size: 16px; border-radius: 10px; cursor: pointer; }
.record:disabled { opacity: .5; cursor: default; }
```

- [ ] **Step 6: Manual verification**

Run: `npm run dev`
Expected: Home shows Capture toggle (Full monitor / Select region), Camera + Microphone dropdowns populated with real device names (after granting permission), and a System audio checkbox. The Record button is enabled. Clicking Record currently throws (no `recording:start` handler yet) — that's expected and fixed in Task 9.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: home UI for capture source and device selection"
```

---

## Task 8: Compositor window + screen-only recording to disk

**Files:**
- Create: `electron/windows/compositor.ts`
- Create: `electron/ipc/recording.ts`
- Create: `src/recorder/streams.ts`
- Create: `src/recorder/engine.ts`
- Create: `src/windows/compositor/index.html`
- Create: `src/windows/compositor/main.tsx`
- Modify: `electron.vite.config.ts` (add compositor input)
- Modify: `electron/main.ts` (register recording handlers)

**Interfaces:**
- Consumes: `RecorderCommand`, `RecordingSettings`, `DisplayInfo`, `physicalCrop`, `fitCanvas`.
- Produces:
  - `createCompositorWindow()` — hidden `BrowserWindow`.
  - `registerRecordingHandlers()` — handles `recording:start` (opens compositor, sends `start` command) and `recording:stop`.
  - `RecorderEngine` class with `start(cmd)`, `stop(): Promise<{ tempPath, durationSec }>`. **This task records the cropped screen only** (no bubble/audio yet).

- [ ] **Step 1: Add the compositor entry to `electron.vite.config.ts`**

In `rollupOptions.input`, add:
```ts
          compositor: resolve('src/windows/compositor/index.html')
```

- [ ] **Step 2: Implement `electron/windows/compositor.ts`**

```ts
import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { registry } from './registry'

export function createCompositorWindow(): BrowserWindow {
  const existing = registry.get('compositor')
  if (existing) return existing
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  })
  const isDev = !!process.env['ELECTRON_RENDERER_URL']
  if (isDev) win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/windows/compositor/index.html`)
  else win.loadFile(join(__dirname, '../renderer/windows/compositor/index.html'))
  registry.set('compositor', win)
  return win
}
```

- [ ] **Step 3: Implement `src/recorder/streams.ts`**

```ts
import type { RecordingSettings } from '@shared/types'

// Screen capture (and, when requested, system loopback audio) via the desktop source id.
export async function getScreenStream(sourceId: string, systemAudio: boolean): Promise<MediaStream> {
  const constraints: any = {
    audio: systemAudio
      ? { mandatory: { chromeMediaSource: 'desktop' } }
      : false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId,
        maxFrameRate: 30
      }
    }
  }
  return navigator.mediaDevices.getUserMedia(constraints)
}

export async function getWebcamStream(deviceId: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { deviceId: { exact: deviceId }, width: 640, height: 480 }
  })
}

export async function getMicStream(deviceId: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } })
}

export function pickMimeType(): string {
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
  return candidates.find((c) => MediaRecorder.isTypeSupported(c)) ?? 'video/webm'
}
```

- [ ] **Step 4: Implement `src/recorder/engine.ts` (screen-only for now)**

```ts
import type { RecorderCommand, Rect, DisplayInfo, RecordingSettings } from '@shared/types'
import { physicalCrop, fitCanvas } from '@/lib/coords'
import { getScreenStream, pickMimeType } from './streams'

export class RecorderEngine {
  private screen?: MediaStream
  private canvas = document.createElement('canvas')
  private ctx = this.canvas.getContext('2d')!
  private screenVideo = document.createElement('video')
  private recorder?: MediaRecorder
  private chunks: Blob[] = []
  private raf = 0
  private crop: Rect = { x: 0, y: 0, width: 0, height: 0 }
  private startMs = 0

  async start(cmd: Extract<RecorderCommand, { type: 'start' }>) {
    const { settings, sourceId, display } = cmd
    this.screen = await getScreenStream(sourceId, settings.systemAudio)

    this.crop = physicalCrop(captureRect(settings, display), display)
    const canvasSize = fitCanvas(this.crop, settings.maxLongEdge)
    this.canvas.width = canvasSize.width
    this.canvas.height = canvasSize.height

    await playStream(this.screenVideo, new MediaStream(this.screen.getVideoTracks()))

    const out = this.canvas.captureStream(30)
    this.recorder = new MediaRecorder(out, { mimeType: pickMimeType(), videoBitsPerSecond: 8_000_000 })
    this.recorder.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data) }
    this.chunks = []
    this.recorder.start(1000)
    this.startMs = performance.now()
    this.loop()
  }

  private loop = () => {
    const { x, y, width, height } = this.crop
    this.ctx.drawImage(this.screenVideo, x, y, width, height, 0, 0, this.canvas.width, this.canvas.height)
    this.raf = requestAnimationFrame(this.loop)
  }

  async stop(): Promise<{ blob: Blob; durationSec: number }> {
    cancelAnimationFrame(this.raf)
    const durationSec = (performance.now() - this.startMs) / 1000
    const blob = await this.finalize()
    this.screen?.getTracks().forEach((t) => t.stop())
    return { blob, durationSec }
  }

  private finalize(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.recorder) return resolve(new Blob())
      this.recorder.onstop = () => resolve(new Blob(this.chunks, { type: 'video/webm' }))
      this.recorder.stop()
    })
  }
}

function captureRect(settings: RecordingSettings, display: DisplayInfo): Rect {
  return settings.target.kind === 'region' ? settings.target.rect : display.bounds
}

function playStream(video: HTMLVideoElement, stream: MediaStream): Promise<void> {
  video.srcObject = stream
  video.muted = true
  return new Promise((resolve) => {
    video.onloadedmetadata = () => video.play().then(() => resolve())
  })
}
```

- [ ] **Step 5: Implement the compositor renderer `src/windows/compositor/index.html` + `main.tsx`**

`index.html`:
```html
<!doctype html>
<html><head><meta charset="UTF-8" /><title>compositor</title></head>
<body><script type="module" src="./main.tsx"></script></body></html>
```

`main.tsx`:
```tsx
import { RecorderEngine } from '@/recorder/engine'

const engine = new RecorderEngine()

const off = window.reel.onRecorderCommand(async (cmd) => {
  if (cmd.type === 'start') {
    try { await engine.start(cmd) } catch (err) { console.error('start failed', err) }
  } else if (cmd.type === 'stop') {
    const { blob, durationSec } = await engine.stop()
    const buf = new Uint8Array(await blob.arrayBuffer())
    const tempPath = await window.reel.writeTemp(buf)
    window.reel.recordingFinished(tempPath, durationSec)
  }
})
window.addEventListener('beforeunload', off)
```

- [ ] **Step 6: Add `writeTemp` to the preload bridge and a handler**

In `electron/preload.ts`, add to `api`:
```ts
  writeTemp: (bytes: Uint8Array): Promise<string> => ipcRenderer.invoke('files:writeTemp', bytes),
```
(The `files:writeTemp` handler is created in Task 12's files module; for this task add a temporary inline handler in `electron/ipc/recording.ts` Step 7.)

- [ ] **Step 7: Implement `electron/ipc/recording.ts`**

```ts
import { app, ipcMain } from 'electron'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { RecordingSettings, DisplayInfo } from '@shared/types'
import { registry } from '../windows/registry'
import { createCompositorWindow } from '../windows/compositor'

export function registerRecordingHandlers() {
  ipcMain.handle('recording:start', async (_e, settings: RecordingSettings) => {
    const { screen, desktopCapturer } = await import('electron')
    const displays = screen.getAllDisplays()
    const display = displays.find((d) => d.id === settings.target.displayId) ?? displays[0]
    const sources = await desktopCapturer.getSources({ types: ['screen'] })
    const source = sources.find((s) => s.display_id === String(display.id)) ?? sources[0]

    const info: DisplayInfo = {
      id: display.id,
      label: display.label,
      bounds: display.bounds,
      scaleFactor: display.scaleFactor,
      sourceId: source.id
    }

    const comp = createCompositorWindow()
    const send = () => comp.webContents.send('recorder:cmd',
      { type: 'start', settings, sourceId: source.id, display: info })
    if (comp.webContents.isLoading()) comp.webContents.once('did-finish-load', send)
    else send()
  })

  ipcMain.handle('recording:stop', async () => {
    registry.get('compositor')?.webContents.send('recorder:cmd', { type: 'stop' })
  })

  ipcMain.handle('files:writeTemp', async (_e, bytes: Uint8Array) => {
    const tempPath = join(app.getPath('temp'), `reel-${process.hrtime.bigint()}.webm`)
    await writeFile(tempPath, Buffer.from(bytes))
    return tempPath
  })

  ipcMain.on('recording:finished', (_e, payload: { tempPath: string; durationSec: number }) => {
    registry.broadcast('recording:finished', payload)
  })
}
```

Add the matching preload methods if missing (`recordingFinished`, `onRecordingFinished` were added in Task 5).

- [ ] **Step 8: Register handlers in `electron/main.ts`**

Add import and call inside `app.whenReady()`:
```ts
import { registerRecordingHandlers } from './ipc/recording'
// ...
  registerRecordingHandlers()
```

- [ ] **Step 9: Manual verification**

Run: `npm run dev`
1. On Home, choose Full monitor, click Record.
2. In DevTools console of the Home window run `await window.reel.stopRecording()` after ~5 seconds.
3. Watch the terminal/console for the temp path logged from the `recording:finished` broadcast (temporarily add `window.reel.onRecordingFinished(console.log)` in the Home console first).
4. Open that `.webm` in a player.
Expected: a ~5s video of your monitor (cropped to full display), no audio/bubble yet.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: hidden compositor records cropped screen to webm on disk"
```

---

## Task 9: Webcam bubble window + live bounds forwarding + start/stop UX

**Files:**
- Create: `electron/windows/bubble.ts`
- Create: `src/windows/bubble/index.html`, `src/windows/bubble/main.tsx`, `src/windows/bubble/Bubble.tsx`, `src/windows/bubble/bubble.css`
- Modify: `electron.vite.config.ts` (add bubble input)
- Modify: `electron/ipc/recording.ts` (open bubble on start, forward bounds, close on stop)

**Interfaces:**
- Consumes: `window.reel.reportBubbleBounds`, the bubble's own `getUserMedia` webcam preview.
- Produces: a draggable circular webcam window. Main listens to its `move`/`resize` and broadcasts `bubble:bounds` (screen-coord `Rect`) to the compositor.

- [ ] **Step 1: Add bubble entry to `electron.vite.config.ts` `rollupOptions.input`**

```ts
          bubble: resolve('src/windows/bubble/index.html')
```

- [ ] **Step 2: Implement `electron/windows/bubble.ts`**

```ts
import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { registry } from './registry'

export function createBubbleWindow(sizePx: number): BrowserWindow {
  const primary = screen.getPrimaryDisplay()
  const win = new BrowserWindow({
    width: sizePx,
    height: sizePx,
    x: primary.bounds.x + 60,
    y: primary.bounds.y + primary.bounds.height - sizePx - 80,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  win.setAlwaysOnTop(true, 'screen-saver')

  const report = () => {
    const b = win.getBounds()
    registry.broadcast('bubble:bounds', { x: b.x, y: b.y, width: b.width, height: b.height })
  }
  win.on('move', report)
  win.on('resize', report)
  win.webContents.on('did-finish-load', report)

  const isDev = !!process.env['ELECTRON_RENDERER_URL']
  if (isDev) win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/windows/bubble/index.html`)
  else win.loadFile(join(__dirname, '../renderer/windows/bubble/index.html'))
  registry.set('bubble', win)
  return win
}
```

- [ ] **Step 3: Implement the bubble renderer**

`src/windows/bubble/index.html`:
```html
<!doctype html>
<html><head><meta charset="UTF-8" /><title>bubble</title></head>
<body><div id="root"></div><script type="module" src="./main.tsx"></script></body></html>
```

`src/windows/bubble/main.tsx`:
```tsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import { Bubble } from './Bubble'
import './bubble.css'

const params = new URLSearchParams(location.search)
createRoot(document.getElementById('root')!).render(
  <Bubble deviceId={params.get('cam') ?? undefined} />
)
```

`src/windows/bubble/Bubble.tsx`:
```tsx
import React, { useEffect, useRef } from 'react'

export function Bubble({ deviceId }: { deviceId?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    let stream: MediaStream
    navigator.mediaDevices
      .getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId } } : true })
      .then((s) => { stream = s; if (videoRef.current) videoRef.current.srcObject = s })
      .catch((e) => console.error('bubble cam failed', e))
    return () => stream?.getTracks().forEach((t) => t.stop())
  }, [deviceId])

  return <video ref={videoRef} autoPlay muted playsInline className="cam" />
}
```

`src/windows/bubble/bubble.css`:
```css
html, body { margin: 0; height: 100%; background: transparent; overflow: hidden; }
#root { height: 100vh; }
.cam {
  width: 100vw; height: 100vh; object-fit: cover;
  border-radius: 50%;
  border: 3px solid rgba(255,255,255,.85);
  box-shadow: 0 6px 24px rgba(0,0,0,.35);
  -webkit-app-region: drag;     /* whole bubble is draggable */
}
```

- [ ] **Step 4: Open/close the bubble from `recording:start` / `recording:stop`**

In `electron/ipc/recording.ts`, import and use the bubble:
```ts
import { createBubbleWindow } from '../windows/bubble'
```
Inside `recording:start`, after computing settings, before sending the start command:
```ts
    if (settings.bubble.enabled && settings.webcamDeviceId) {
      const bubble = createBubbleWindow(settings.bubble.sizePx)
      bubble.webContents.once('did-finish-load', () => {
        bubble.loadURL(
          (process.env['ELECTRON_RENDERER_URL']
            ? `${process.env['ELECTRON_RENDERER_URL']}/windows/bubble/index.html`
            : bubble.webContents.getURL()
          ) + `?cam=${encodeURIComponent(settings.webcamDeviceId)}`
        )
      })
    }
```
> Note: simpler alternative — pass the cam id by reading it in the bubble from a query param set at creation. To keep one code path, modify `createBubbleWindow(sizePx, camId)` to append `?cam=` to the loaded URL directly. Use that signature:

Replace `createBubbleWindow` signature with `createBubbleWindow(sizePx: number, camId: string)` and append `?cam=${encodeURIComponent(camId)}` to both the dev URL and (via `loadFile`'s `search` option) the prod load:
```ts
  if (isDev) win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/windows/bubble/index.html?cam=${encodeURIComponent(camId)}`)
  else win.loadFile(join(__dirname, '../renderer/windows/bubble/index.html'), { search: `cam=${encodeURIComponent(camId)}` })
```
And call `createBubbleWindow(settings.bubble.sizePx, settings.webcamDeviceId)` in `recording:start`.

Inside `recording:stop`, after sending the stop command:
```ts
    registry.close('bubble')
```

- [ ] **Step 5: Manual verification**

Run: `npm run dev`
1. Pick a camera on Home, click Record.
Expected: a circular live webcam bubble appears bottom-left, always on top, and you can drag it anywhere (including across monitors).
2. In the compositor window's DevTools console (open via `registry`—or temporarily set compositor `show:true`), confirm `bubble:bounds` events arrive as you drag (add `window.reel.onBubbleBounds(console.log)`).
3. `await window.reel.stopRecording()` → bubble closes.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: draggable circular webcam bubble with live bounds forwarding"
```

---

## Task 10: Composite the bubble into the recording

**Files:**
- Modify: `src/recorder/engine.ts`

**Interfaces:**
- Consumes: `mapBubbleToCanvas`, `getWebcamStream`, `bubble:bounds` events.
- Produces: the output file now shows the webcam clipped to a circle at the bubble's live, correctly-mapped position.

- [ ] **Step 1: Extend `RecorderEngine` to track bubble bounds and draw the webcam**

In `src/recorder/engine.ts`, add fields:
```ts
  private webcam?: MediaStream
  private webcamVideo = document.createElement('video')
  private bubbleBounds?: Rect
  private offBubble?: () => void
  private settings?: RecordingSettings
  private display?: DisplayInfo
  private canvasScale = 1
```
Add imports:
```ts
import { physicalCrop, fitCanvas, mapBubbleToCanvas } from '@/lib/coords'
import { getScreenStream, getWebcamStream, pickMimeType } from './streams'
```

- [ ] **Step 2: Acquire the webcam and subscribe to bounds in `start`**

In `start`, after computing `canvasSize`, store context and start the webcam:
```ts
    this.settings = settings
    this.display = display
    this.canvasScale = canvasSize.scale

    if (settings.bubble.enabled && settings.webcamDeviceId) {
      this.webcam = await getWebcamStream(settings.webcamDeviceId)
      await playStream(this.webcamVideo, this.webcam)
      this.offBubble = window.reel.onBubbleBounds((r) => { this.bubbleBounds = r })
    }
```

- [ ] **Step 3: Draw the circular webcam in the paint loop**

Replace `loop` with:
```ts
  private loop = () => {
    const { x, y, width, height } = this.crop
    this.ctx.drawImage(this.screenVideo, x, y, width, height, 0, 0, this.canvas.width, this.canvas.height)

    if (this.bubbleBounds && this.settings && this.display) {
      const b = mapBubbleToCanvas(
        this.bubbleBounds,
        captureRect(this.settings, this.display),
        this.display.scaleFactor,
        this.canvasScale
      )
      const r = Math.min(b.width, b.height) / 2
      const cx = b.x + b.width / 2
      const cy = b.y + b.height / 2
      this.ctx.save()
      this.ctx.beginPath()
      this.ctx.arc(cx, cy, r, 0, Math.PI * 2)
      this.ctx.clip()
      // cover-fit the webcam into the circle's bounding box
      const vw = this.webcamVideo.videoWidth || 1
      const vh = this.webcamVideo.videoHeight || 1
      const side = Math.min(vw, vh)
      this.ctx.drawImage(
        this.webcamVideo,
        (vw - side) / 2, (vh - side) / 2, side, side,
        cx - r, cy - r, r * 2, r * 2
      )
      this.ctx.restore()
    }
    this.raf = requestAnimationFrame(this.loop)
  }
```

- [ ] **Step 4: Clean up webcam + listener in `stop`**

In `stop`, before returning, add:
```ts
    this.offBubble?.()
    this.webcam?.getTracks().forEach((t) => t.stop())
```

- [ ] **Step 5: Manual verification**

Run: `npm run dev`
1. Pick camera + Full monitor, Record, drag the bubble to a couple of positions, stop.
2. Open the resulting `.webm`.
Expected: the webcam appears as a clean circle baked into the video, and its position in the file matches where you dragged the bubble. Test again with a **Region** target (after Task 13) to confirm region-relative placement — for now, full-monitor placement should be pixel-accurate.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: composite circular webcam bubble into recording at live position"
```

---

## Task 11: Audio mixing (mic + system)

**Files:**
- Create: `src/recorder/audio-mix.ts`
- Modify: `src/recorder/engine.ts`

**Interfaces:**
- Produces: `mixAudio(sources: MediaStream[]): { track: MediaStreamTrack; close: () => void }` — merges any number of audio-bearing streams into one track via Web Audio.

- [ ] **Step 1: Implement `src/recorder/audio-mix.ts`**

```ts
export function mixAudio(sources: MediaStream[]): { track: MediaStreamTrack; close: () => void } {
  const ctx = new AudioContext()
  const dest = ctx.createMediaStreamDestination()
  for (const s of sources) {
    if (s.getAudioTracks().length === 0) continue
    ctx.createMediaStreamSource(s).connect(dest)
  }
  return {
    track: dest.stream.getAudioTracks()[0],
    close: () => { ctx.close().catch(() => {}) }
  }
}
```

- [ ] **Step 2: Use it in `RecorderEngine.start`**

Add fields:
```ts
  private mic?: MediaStream
  private audioMix?: { track: MediaStreamTrack; close: () => void }
```
Import:
```ts
import { getScreenStream, getWebcamStream, getMicStream, pickMimeType } from './streams'
import { mixAudio } from './audio-mix'
```
In `start`, after the screen stream is acquired and before creating the MediaRecorder, build the audio:
```ts
    const audioSources: MediaStream[] = []
    if (settings.systemAudio && this.screen.getAudioTracks().length) {
      audioSources.push(new MediaStream(this.screen.getAudioTracks()))
    }
    if (settings.micDeviceId) {
      this.mic = await getMicStream(settings.micDeviceId)
      audioSources.push(this.mic)
    }
```
Change the output stream construction:
```ts
    const out = this.canvas.captureStream(30)
    if (audioSources.length) {
      this.audioMix = mixAudio(audioSources)
      out.addTrack(this.audioMix.track)
    }
```

- [ ] **Step 3: Clean up audio in `stop`**

Add to `stop` cleanup:
```ts
    this.mic?.getTracks().forEach((t) => t.stop())
    this.audioMix?.close()
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`
1. Enable System audio + pick a Microphone. Play music in another app, Record ~8s while talking, stop.
2. Open the `.webm`.
Expected: both your voice and the system audio are audible and roughly in sync with the video.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: mix microphone and system audio into the recording"
```

---

## Task 12: Control toolbar window

**Files:**
- Create: `electron/windows/toolbar.ts`
- Create: `src/windows/toolbar/index.html`, `src/windows/toolbar/main.tsx`, `src/windows/toolbar/Toolbar.tsx`, `src/windows/toolbar/toolbar.css`
- Modify: `electron.vite.config.ts` (add toolbar input)
- Modify: `electron/ipc/recording.ts` (open/close toolbar; handle pause/resume passthrough)
- Modify: `src/recorder/engine.ts` (pause/resume)

**Interfaces:**
- Consumes: `window.reel.stopRecording`, plus new `window.reel.pauseRecording()` / `resumeRecording()`.
- Produces: an always-on-top control bar; the engine supports `pause()`/`resume()` on the `MediaRecorder`.

- [ ] **Step 1: Add `pauseRecording`/`resumeRecording` to preload + recording IPC**

In `electron/preload.ts` `api`:
```ts
  pauseRecording: (): void => { ipcRenderer.send('recorder:cmd', { type: 'pause' }) },
  resumeRecording: (): void => { ipcRenderer.send('recorder:cmd', { type: 'resume' }) },
```
In `electron/ipc/recording.ts`, forward `recorder:cmd` sent from the toolbar to the compositor:
```ts
  ipcMain.on('recorder:cmd', (_e, cmd) => {
    registry.get('compositor')?.webContents.send('recorder:cmd', cmd)
  })
```

- [ ] **Step 2: Handle pause/resume in `RecorderEngine`**

In `src/windows/compositor/main.tsx`, extend the command switch:
```tsx
  else if (cmd.type === 'pause') engine.pause()
  else if (cmd.type === 'resume') engine.resume()
```
In `engine.ts`, add:
```ts
  pause() { this.recorder?.state === 'recording' && this.recorder.pause() }
  resume() { this.recorder?.state === 'paused' && this.recorder.resume() }
```

- [ ] **Step 3: Add toolbar entry to `electron.vite.config.ts`**

```ts
          toolbar: resolve('src/windows/toolbar/index.html')
```

- [ ] **Step 4: Implement `electron/windows/toolbar.ts`**

```ts
import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { registry } from './registry'

export function createToolbarWindow(): BrowserWindow {
  const primary = screen.getPrimaryDisplay()
  const width = 280, height = 56
  const win = new BrowserWindow({
    width, height,
    x: primary.bounds.x + Math.round((primary.bounds.width - width) / 2),
    y: primary.bounds.y + primary.bounds.height - height - 24,
    frame: false, transparent: true, resizable: false,
    alwaysOnTop: true, skipTaskbar: true, hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true, nodeIntegration: false
    }
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  const isDev = !!process.env['ELECTRON_RENDERER_URL']
  if (isDev) win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/windows/toolbar/index.html`)
  else win.loadFile(join(__dirname, '../renderer/windows/toolbar/index.html'))
  registry.set('toolbar', win)
  return win
}
```

- [ ] **Step 5: Implement the toolbar renderer**

`index.html`:
```html
<!doctype html>
<html><head><meta charset="UTF-8" /><title>toolbar</title></head>
<body><div id="root"></div><script type="module" src="./main.tsx"></script></body></html>
```
`main.tsx`:
```tsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import { Toolbar } from './Toolbar'
import './toolbar.css'
createRoot(document.getElementById('root')!).render(<Toolbar />)
```
`Toolbar.tsx`:
```tsx
import React, { useEffect, useState } from 'react'

export function Toolbar() {
  const [elapsed, setElapsed] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    const id = setInterval(() => { if (!paused) setElapsed((e) => e + 1) }, 1000)
    return () => clearInterval(id)
  }, [paused])

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')

  function togglePause() {
    if (paused) window.reel.resumeRecording()
    else window.reel.pauseRecording()
    setPaused((p) => !p)
  }

  return (
    <div className="bar">
      <span className="dot" />
      <span className="time">{mm}:{ss}</span>
      <button onClick={togglePause}>{paused ? '▶' : '❚❚'}</button>
      <button className="stop" onClick={() => window.reel.stopRecording()}>■</button>
    </div>
  )
}
```
`toolbar.css`:
```css
html, body { margin: 0; background: transparent; overflow: hidden; }
.bar {
  display: flex; align-items: center; gap: 12px;
  height: 56px; padding: 0 16px; border-radius: 28px;
  background: rgba(20,20,24,.92); color: #fff;
  -webkit-app-region: drag; font-family: system-ui;
}
.bar button { -webkit-app-region: no-drag; background: #2c2c34; color: #fff; border: none; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; font-size: 14px; }
.bar .stop { background: #e5484d; }
.dot { width: 10px; height: 10px; border-radius: 50%; background: #e5484d; animation: pulse 1.2s infinite; }
.time { font-variant-numeric: tabular-nums; min-width: 48px; }
@keyframes pulse { 50% { opacity: .3; } }
```

- [ ] **Step 6: Open/close toolbar in recording IPC**

In `electron/ipc/recording.ts`: import `createToolbarWindow`, call it in `recording:start` (always), and `registry.close('toolbar')` in `recording:stop`.

- [ ] **Step 7: Manual verification**

Run: `npm run dev`
1. Record. Expected: a rounded control bar appears bottom-center, always on top, draggable, with a ticking timer.
2. Click pause (timer stops, recorder pauses), resume, then stop.
3. Open the `.webm`: the paused span should be absent from the recording.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: always-on-top control toolbar with pause/resume/stop"
```

---

## Task 13: Region selector overlay + crop verification

**Files:**
- Create: `electron/windows/region.ts`
- Create: `src/windows/region/index.html`, `src/windows/region/main.tsx`, `src/windows/region/Region.tsx`, `src/windows/region/region.css`
- Modify: `electron.vite.config.ts` (add region input)
- Create: IPC handler `region:select` in `electron/ipc/sources.ts`

**Interfaces:**
- Consumes: nothing new from renderer beyond `window.reel.selectRegion()` (already in preload).
- Produces: `region:select` opens a fullscreen transparent overlay spanning the display the cursor is on; the user drags a rectangle; resolves to a screen-coordinate `Rect` (or `null` if cancelled).

- [ ] **Step 1: Add region entry to `electron.vite.config.ts`**

```ts
          region: resolve('src/windows/region/index.html')
```

- [ ] **Step 2: Implement `electron/windows/region.ts`**

```ts
import { BrowserWindow, screen, ipcMain } from 'electron'
import { join } from 'node:path'
import type { Rect } from '@shared/types'

export function selectRegion(): Promise<Rect | null> {
  return new Promise((resolve) => {
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    const win = new BrowserWindow({
      x: display.bounds.x, y: display.bounds.y,
      width: display.bounds.width, height: display.bounds.height,
      frame: false, transparent: true, alwaysOnTop: true,
      skipTaskbar: true, hasShadow: false, enableLargerThanScreen: true,
      webPreferences: {
        preload: join(__dirname, '../preload/preload.js'),
        contextIsolation: true, nodeIntegration: false
      }
    })
    win.setAlwaysOnTop(true, 'screen-saver')

    const done = (_e: unknown, rect: Rect | null) => {
      ipcMain.removeListener('region:done', done)
      if (rect) {
        // Renderer reports rect relative to overlay (0,0). Convert to screen coords.
        resolve({ x: rect.x + display.bounds.x, y: rect.y + display.bounds.y, width: rect.width, height: rect.height })
      } else resolve(null)
      if (!win.isDestroyed()) win.close()
    }
    ipcMain.on('region:done', done)

    const isDev = !!process.env['ELECTRON_RENDERER_URL']
    if (isDev) win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/windows/region/index.html`)
    else win.loadFile(join(__dirname, '../renderer/windows/region/index.html'))
  })
}
```

- [ ] **Step 3: Wire `region:select` in `electron/ipc/sources.ts`**

Add import and handler:
```ts
import { selectRegion } from '../windows/region'
// inside registerSourceHandlers():
  ipcMain.handle('region:select', () => selectRegion())
```

- [ ] **Step 4: Add `regionDone` to preload**

In `electron/preload.ts` `api`:
```ts
  regionDone: (rect: import('@shared/types').Rect | null): void => { ipcRenderer.send('region:done', rect) },
```

- [ ] **Step 5: Implement the region renderer**

`index.html`:
```html
<!doctype html>
<html><head><meta charset="UTF-8" /><title>region</title></head>
<body><div id="root"></div><script type="module" src="./main.tsx"></script></body></html>
```
`main.tsx`:
```tsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import { Region } from './Region'
import './region.css'
createRoot(document.getElementById('root')!).render(<Region />)
```
`Region.tsx`:
```tsx
import React, { useRef, useState } from 'react'

export function Region() {
  const [start, setStart] = useState<{ x: number; y: number } | null>(null)
  const [cur, setCur] = useState<{ x: number; y: number } | null>(null)
  const dragging = useRef(false)

  function rect() {
    if (!start || !cur) return null
    return {
      x: Math.min(start.x, cur.x),
      y: Math.min(start.y, cur.y),
      width: Math.abs(cur.x - start.x),
      height: Math.abs(cur.y - start.y)
    }
  }

  function onDown(e: React.MouseEvent) { dragging.current = true; setStart({ x: e.clientX, y: e.clientY }); setCur({ x: e.clientX, y: e.clientY }) }
  function onMove(e: React.MouseEvent) { if (dragging.current) setCur({ x: e.clientX, y: e.clientY }) }
  function onUp() {
    dragging.current = false
    const r = rect()
    if (r && r.width > 10 && r.height > 10) window.reel.regionDone(r)
    else window.reel.regionDone(null)
  }

  React.useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') window.reel.regionDone(null) }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [])

  const r = rect()
  return (
    <div className="overlay" onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp}>
      <div className="hint">Drag to select a region · Esc to cancel</div>
      {r && <div className="sel" style={{ left: r.x, top: r.y, width: r.width, height: r.height }}>
        <span className="size">{r.width}×{r.height}</span>
      </div>}
    </div>
  )
}
```
`region.css`:
```css
html, body { margin: 0; height: 100%; background: transparent; overflow: hidden; cursor: crosshair; }
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.25); }
.hint { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); color: #fff; font-family: system-ui; background: rgba(0,0,0,.6); padding: 6px 12px; border-radius: 8px; }
.sel { position: fixed; border: 2px solid #4f7cff; background: rgba(79,124,255,.12); box-shadow: 0 0 0 99999px rgba(0,0,0,.25); }
.size { position: absolute; top: -24px; left: 0; color: #fff; font-family: system-ui; font-size: 12px; background: #4f7cff; padding: 2px 6px; border-radius: 6px; }
```

- [ ] **Step 6: Manual verification**

Run: `npm run dev`
1. On Home, click "Select region…", drag a box on your ultrawide, release.
Expected: Home shows "Region W×H" with your dimensions.
2. Click Record, drag the bubble inside the region, stop.
3. Open the `.webm`.
Expected: the video is cropped to exactly your selected region, and the bubble sits correctly relative to that region (not the whole monitor).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: free-form region selector overlay with region-cropped capture"
```

---

## Task 14: Editor window — preview + trim

**Files:**
- Create: `electron/windows/editor.ts`
- Create: `src/windows/editor/index.html`, `src/windows/editor/main.tsx`, `src/windows/editor/Editor.tsx`, `src/windows/editor/TrimBar.tsx`, `src/windows/editor/editor.css`
- Modify: `electron.vite.config.ts` (add editor input)
- Modify: `electron/ipc/recording.ts` (open editor when recording finishes)

**Interfaces:**
- Consumes: `window.reel.onRecordingFinished`, the temp webm path.
- Produces: editor shows the recording with a scrubber and draggable in/out trim handles; "Save" (Task 15) reads `trimStart`/`trimEnd` state.

- [ ] **Step 1: Add editor entry to `electron.vite.config.ts`**

```ts
          editor: resolve('src/windows/editor/index.html')
```

- [ ] **Step 2: Implement `electron/windows/editor.ts`**

```ts
import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { registry } from './registry'

export function createEditorWindow(tempPath: string, durationSec: number): BrowserWindow {
  const win = new BrowserWindow({
    width: 960, height: 720,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true, nodeIntegration: false,
      webSecurity: false   // allow file:// playback of the temp recording
    }
  })
  const q = `tempPath=${encodeURIComponent(tempPath)}&duration=${durationSec}`
  const isDev = !!process.env['ELECTRON_RENDERER_URL']
  if (isDev) win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/windows/editor/index.html?${q}`)
  else win.loadFile(join(__dirname, '../renderer/windows/editor/index.html'), { search: q })
  registry.set('editor', win)
  return win
}
```

- [ ] **Step 3: Open the editor on `recording:finished`**

In `electron/ipc/recording.ts`, replace the `recording:finished` handler body to also open the editor and close overlays:
```ts
  ipcMain.on('recording:finished', (_e, payload: { tempPath: string; durationSec: number }) => {
    registry.close('bubble')
    registry.close('toolbar')
    createEditorWindow(payload.tempPath, payload.durationSec)
  })
```
Add `import { createEditorWindow } from '../windows/editor'`.

- [ ] **Step 4: Implement the editor renderer shell**

`index.html`:
```html
<!doctype html>
<html><head><meta charset="UTF-8" /><title>Editor</title></head>
<body><div id="root"></div><script type="module" src="./main.tsx"></script></body></html>
```
`main.tsx`:
```tsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import { Editor } from './Editor'
import './editor.css'

const p = new URLSearchParams(location.search)
createRoot(document.getElementById('root')!).render(
  <Editor tempPath={p.get('tempPath')!} duration={Number(p.get('duration') ?? 0)} />
)
```

- [ ] **Step 5: Implement `TrimBar.tsx`**

```tsx
import React from 'react'

interface Props {
  duration: number
  inSec: number
  outSec: number
  playhead: number
  onChange: (next: { inSec: number; outSec: number }) => void
  onScrub: (sec: number) => void
}

export function TrimBar({ duration, inSec, outSec, playhead, onChange, onScrub }: Props) {
  const ref = React.useRef<HTMLDivElement>(null)
  const pct = (s: number) => (duration ? (s / duration) * 100 : 0)

  function posToSec(clientX: number) {
    const el = ref.current!
    const r = el.getBoundingClientRect()
    return Math.max(0, Math.min(duration, ((clientX - r.left) / r.width) * duration))
  }

  function dragHandle(which: 'in' | 'out') {
    return (e: React.MouseEvent) => {
      e.stopPropagation()
      const move = (ev: MouseEvent) => {
        const sec = posToSec(ev.clientX)
        if (which === 'in') onChange({ inSec: Math.min(sec, outSec - 0.1), outSec })
        else onChange({ inSec, outSec: Math.max(sec, inSec + 0.1) })
      }
      const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    }
  }

  return (
    <div className="trim" ref={ref} onMouseDown={(e) => onScrub(posToSec(e.clientX))}>
      <div className="trim-dim" style={{ left: 0, width: `${pct(inSec)}%` }} />
      <div className="trim-dim" style={{ right: 0, width: `${100 - pct(outSec)}%` }} />
      <div className="trim-range" style={{ left: `${pct(inSec)}%`, width: `${pct(outSec) - pct(inSec)}%` }} />
      <div className="playhead" style={{ left: `${pct(playhead)}%` }} />
      <div className="handle" style={{ left: `${pct(inSec)}%` }} onMouseDown={dragHandle('in')} />
      <div className="handle" style={{ left: `${pct(outSec)}%` }} onMouseDown={dragHandle('out')} />
    </div>
  )
}
```

- [ ] **Step 6: Implement `Editor.tsx`**

```tsx
import React, { useEffect, useRef, useState } from 'react'
import { TrimBar } from './TrimBar'

export function Editor({ tempPath, duration }: { tempPath: string; duration: number }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [dur, setDur] = useState(duration)
  const [trim, setTrim] = useState({ inSec: 0, outSec: duration })
  const [playhead, setPlayhead] = useState(0)

  useEffect(() => {
    const v = videoRef.current!
    const onMeta = () => {
      if (isFinite(v.duration)) { setDur(v.duration); setTrim((t) => ({ inSec: 0, outSec: v.duration })) }
    }
    const onTime = () => {
      setPlayhead(v.currentTime)
      if (v.currentTime >= trim.outSec) v.pause()
    }
    v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('timeupdate', onTime)
    return () => { v.removeEventListener('loadedmetadata', onMeta); v.removeEventListener('timeupdate', onTime) }
  }, [trim.outSec])

  function play() {
    const v = videoRef.current!
    if (v.currentTime < trim.inSec || v.currentTime >= trim.outSec) v.currentTime = trim.inSec
    v.play()
  }

  return (
    <div className="editor">
      <video ref={videoRef} src={`file://${tempPath}`} controls={false} className="preview" />
      <div className="controls">
        <button onClick={play}>▶ Play</button>
        <span className="meta">Trim: {trim.inSec.toFixed(1)}s – {trim.outSec.toFixed(1)}s</span>
        {/* Save button added in Task 15 */}
      </div>
      <TrimBar
        duration={dur}
        inSec={trim.inSec}
        outSec={trim.outSec}
        playhead={playhead}
        onChange={setTrim}
        onScrub={(s) => { videoRef.current!.currentTime = s }}
      />
    </div>
  )
}
```

- [ ] **Step 7: Implement `editor.css`**

```css
html, body { margin: 0; font-family: system-ui; background: #111; color: #eee; }
.editor { display: flex; flex-direction: column; gap: 16px; padding: 16px; height: 100vh; box-sizing: border-box; }
.preview { width: 100%; flex: 1; min-height: 0; background: #000; border-radius: 8px; object-fit: contain; }
.controls { display: flex; align-items: center; gap: 16px; }
.controls button { background: #4f7cff; color: #fff; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; }
.trim { position: relative; height: 44px; background: #222; border-radius: 8px; overflow: hidden; user-select: none; }
.trim-dim { position: absolute; top: 0; bottom: 0; background: rgba(0,0,0,.55); }
.trim-range { position: absolute; top: 0; bottom: 0; background: rgba(79,124,255,.18); }
.playhead { position: absolute; top: 0; bottom: 0; width: 2px; background: #fff; }
.handle { position: absolute; top: 0; bottom: 0; width: 10px; margin-left: -5px; background: #4f7cff; cursor: ew-resize; border-radius: 4px; }
```

- [ ] **Step 8: Manual verification**

Run: `npm run dev`
1. Record a short clip, stop.
Expected: the editor window opens automatically and plays back the recording.
2. Drag the in/out handles; the dimmed regions and "Trim: a – b" update; clicking the bar scrubs; Play respects the in/out range.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: editor window with preview and trim handles"
```

---

## Task 15: Export to MP4/WebM via ffmpeg + progress

**Files:**
- Create: `electron/ffmpeg/run.ts`
- Create: `electron/ipc/files.ts`
- Modify: `electron/main.ts` (register file handlers)
- Modify: `src/windows/editor/Editor.tsx` (Save button + progress)

**Interfaces:**
- Consumes: `buildTranscodeArgs`, `sanitizeFilename`, `defaultRecordingName`, `SaveRequest`, `SaveResult`.
- Produces:
  - `runFfmpeg(args, onProgress?): Promise<void>` resolving on exit code 0.
  - `files:save` handler: shows a Save dialog, transcodes/trims to the chosen path, emits `export:progress`, returns `SaveResult`.

- [ ] **Step 1: Implement `electron/ffmpeg/run.ts`**

```ts
import { spawn } from 'node:child_process'
import ffmpegPath from 'ffmpeg-static'

export function runFfmpeg(args: string[], onProgress?: (sec: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const bin = (ffmpegPath as unknown as string).replace('app.asar', 'app.asar.unpacked')
    const proc = spawn(bin, args)
    let stderr = ''
    proc.stderr.on('data', (d) => {
      const s = d.toString()
      stderr += s
      const m = s.match(/time=(\d+):(\d+):(\d+\.\d+)/)
      if (m && onProgress) onProgress(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]))
    })
    proc.on('error', reject)
    proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`)))
  })
}
```

- [ ] **Step 2: Implement `electron/ipc/files.ts`**

```ts
import { app, ipcMain, dialog, shell, clipboard, BrowserWindow } from 'electron'
import { writeFile, readdir, stat, unlink, mkdir } from 'node:fs/promises'
import { join, basename } from 'node:path'
import type { SaveRequest, SaveResult, RecordingMeta } from '@shared/types'
import { buildTranscodeArgs, buildThumbnailArgs } from '@/lib/ffmpeg-args'
import { sanitizeFilename } from '@/lib/paths'
import { runFfmpeg } from '../ffmpeg/run'

function libraryDir(): string {
  return join(app.getPath('videos'), 'Reel')
}

export function registerFileHandlers() {
  ipcMain.handle('files:writeTemp', async (_e, bytes: Uint8Array) => {
    const tempPath = join(app.getPath('temp'), `reel-${process.hrtime.bigint()}.webm`)
    await writeFile(tempPath, Buffer.from(bytes))
    return tempPath
  })

  ipcMain.handle('files:save', async (e, req: SaveRequest): Promise<SaveResult> => {
    await mkdir(libraryDir(), { recursive: true })
    const ext = req.format
    const defaultPath = join(libraryDir(), `${sanitizeFilename(req.suggestedName)}.${ext}`)
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
    })
    if (canceled || !filePath) return { saved: false }

    const win = BrowserWindow.fromWebContents(e.sender)
    const args = buildTranscodeArgs({
      input: req.tempPath, output: filePath, format: req.format,
      trimStart: req.trimStart, trimEnd: req.trimEnd
    })
    const total = (req.trimEnd ?? 0) - (req.trimStart ?? 0)
    await runFfmpeg(args, (sec) => {
      if (total > 0) win?.webContents.send('export:progress', Math.min(100, Math.round((sec / total) * 100)))
    })

    // best-effort thumbnail
    try {
      const thumb = filePath.replace(/\.[^.]+$/, '.jpg')
      await runFfmpeg(buildThumbnailArgs(filePath, thumb, 1))
    } catch { /* ignore */ }

    win?.webContents.send('export:progress', 100)
    return { saved: true, path: filePath }
  })

  ipcMain.handle('files:list', async (): Promise<RecordingMeta[]> => {
    await mkdir(libraryDir(), { recursive: true })
    const entries = await readdir(libraryDir())
    const vids = entries.filter((f) => f.endsWith('.mp4') || f.endsWith('.webm'))
    const metas = await Promise.all(vids.map(async (f) => {
      const path = join(libraryDir(), f)
      const s = await stat(path)
      const thumb = join(libraryDir(), f.replace(/\.[^.]+$/, '.jpg'))
      let thumbnailPath: string | null = null
      try { await stat(thumb); thumbnailPath = thumb } catch { /* none */ }
      return { path, name: basename(f), thumbnailPath, durationSec: null, createdMs: s.birthtimeMs, sizeBytes: s.size }
    }))
    return metas.sort((a, b) => b.createdMs - a.createdMs)
  })

  ipcMain.handle('files:delete', async (_e, path: string) => { await unlink(path).catch(() => {}) })
  ipcMain.on('files:reveal', (_e, path: string) => { shell.showItemInFolder(path) })
  ipcMain.handle('files:copy', async (_e, path: string) => {
    clipboard.writeText(path) // also place the path; file copy below
    const { nativeImage } = await import('electron')
    void nativeImage
  })
}
```
> Note: `clipboard.writeText(path)` is the reliable cross-app behavior on Windows; "copy actual file object" is non-trivial and is intentionally limited to copying the path. Reveal-in-Explorer covers the drag-to-share workflow.

- [ ] **Step 3: Register file handlers in `electron/main.ts`**

```ts
import { registerFileHandlers } from './ipc/files'
// inside app.whenReady():
  registerFileHandlers()
```
Remove the temporary `files:writeTemp` handler from `electron/ipc/recording.ts` (now owned by `files.ts`) to avoid a duplicate-handler crash.

- [ ] **Step 4: Add Save UI to `Editor.tsx`**

Add state and handler inside `Editor`:
```tsx
  const [format, setFormat] = useState<'mp4' | 'webm'>('mp4')
  const [progress, setProgress] = useState<number | null>(null)

  useEffect(() => window.reel.onExportProgress(setProgress), [])

  async function save() {
    setProgress(0)
    const res = await window.reel.saveRecording({
      tempPath, format, trimStart: trim.inSec, trimEnd: trim.outSec,
      suggestedName: 'Reel-recording'
    })
    setProgress(null)
    if (res.saved && res.path) {
      window.reel.revealInExplorer(res.path)
    }
  }
```
Add to the `.controls` JSX, after the meta span:
```tsx
        <select value={format} onChange={(e) => setFormat(e.target.value as 'mp4' | 'webm')}>
          <option value="mp4">MP4</option>
          <option value="webm">WebM</option>
        </select>
        <button onClick={save} disabled={progress !== null}>
          {progress === null ? 'Save' : `Exporting ${progress}%`}
        </button>
```

- [ ] **Step 5: Manual verification**

Run: `npm run dev`
1. Record, trim, choose MP4, click Save, pick a location.
Expected: progress counts up, then Explorer opens with the new `.mp4` selected; it plays in any player and respects the trim.
2. Repeat with WebM (instant when untrimmed via stream copy).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: ffmpeg export to mp4/webm with trim and progress"
```

---

## Task 16: Recordings library on Home

**Files:**
- Create: `src/windows/home/components/Library.tsx`
- Modify: `src/windows/home/App.tsx`

**Interfaces:**
- Consumes: `window.reel.listRecordings`, `revealInExplorer`, `deleteRecording`, `copyFile`.
- Produces: a list of saved recordings with thumbnail, size, date, and reveal/copy/delete actions.

- [ ] **Step 1: Implement `Library.tsx`**

```tsx
import React, { useEffect, useState } from 'react'
import type { RecordingMeta } from '@shared/types'

export function Library() {
  const [items, setItems] = useState<RecordingMeta[]>([])
  async function refresh() { setItems(await window.reel.listRecordings()) }
  useEffect(() => { refresh() }, [])

  if (items.length === 0) return <p className="empty">No recordings yet.</p>

  return (
    <ul className="library">
      {items.map((r) => (
        <li key={r.path}>
          {r.thumbnailPath
            ? <img src={`file://${r.thumbnailPath}`} alt="" />
            : <div className="noimg" />}
          <div className="info">
            <strong>{r.name}</strong>
            <span>{new Date(r.createdMs).toLocaleString()} · {(r.sizeBytes / 1e6).toFixed(1)} MB</span>
          </div>
          <div className="actions">
            <button onClick={() => window.reel.revealInExplorer(r.path)}>Reveal</button>
            <button onClick={() => window.reel.copyFile(r.path)}>Copy path</button>
            <button onClick={async () => { await window.reel.deleteRecording(r.path); refresh() }}>Delete</button>
          </div>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 2: Add the library to `App.tsx`**

Import and render below the Record button:
```tsx
import { Library } from './components/Library'
// ...
      <section>
        <h2>Recordings</h2>
        <Library />
      </section>
```
Append to `home.css`:
```css
.library { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.library li { display: grid; grid-template-columns: 96px 1fr auto; gap: 12px; align-items: center; padding: 8px; border: 1px solid #8883; border-radius: 10px; }
.library img, .library .noimg { width: 96px; height: 54px; object-fit: cover; border-radius: 6px; background: #8882; }
.library .info { display: flex; flex-direction: column; }
.library .actions { display: flex; gap: 6px; }
.empty { opacity: .6; }
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`
1. After saving at least one recording, the Recordings list shows it with thumbnail, date, size.
2. Reveal opens Explorer; Delete removes it and the list refreshes.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: recordings library with reveal/copy/delete"
```

---

## Task 17: Global hotkey to stop recording

**Files:**
- Create: `electron/ipc/hotkeys.ts`
- Modify: `electron/main.ts`
- Modify: `electron/ipc/recording.ts` (register/unregister around a session)

**Interfaces:**
- Produces: `Ctrl+Shift+S` stops the active recording from anywhere (needed because the screen may be fully covered while recording).

- [ ] **Step 1: Implement `electron/ipc/hotkeys.ts`**

```ts
import { globalShortcut } from 'electron'
import { registry } from '../windows/registry'

const STOP_ACCELERATOR = 'CommandOrControl+Shift+S'

export function registerStopHotkey() {
  globalShortcut.register(STOP_ACCELERATOR, () => {
    registry.get('compositor')?.webContents.send('recorder:cmd', { type: 'stop' })
    registry.close('bubble')
    registry.close('toolbar')
  })
}

export function unregisterStopHotkey() {
  globalShortcut.unregister(STOP_ACCELERATOR)
}
```

- [ ] **Step 2: Register/unregister around a recording session**

In `electron/ipc/recording.ts`:
- import `{ registerStopHotkey, unregisterStopHotkey }`
- call `registerStopHotkey()` at the end of `recording:start`
- call `unregisterStopHotkey()` in the `recording:finished` handler

Also ensure cleanup on quit in `electron/main.ts`:
```ts
import { globalShortcut } from 'electron'
app.on('will-quit', () => globalShortcut.unregisterAll())
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`
1. Start a full-screen recording, switch to another fullscreen app, press `Ctrl+Shift+S`.
Expected: recording stops, overlays close, the editor opens with the clip.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: global hotkey (Ctrl+Shift+S) to stop recording"
```

---

## Task 18: Package a Windows installer

**Files:**
- Create: `electron-builder.yml`
- Create: `build/` icon placeholder note
- Modify: `package.json` (ensure `package` script + `asarUnpack` for ffmpeg)

**Interfaces:**
- Produces: an NSIS installer in `release/` that runs the app with ffmpeg bundled.

- [ ] **Step 1: Create `electron-builder.yml`**

```yaml
appId: com.reel.recorder
productName: Reel
directories:
  output: release
  buildResources: build
files:
  - out/**/*
  - package.json
asarUnpack:
  - "**/node_modules/ffmpeg-static/**"
win:
  target:
    - nsis
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
```

- [ ] **Step 2: Confirm the `package` script and main entry**

Ensure `package.json` has `"main": "out/main/main.js"` and `"package": "electron-vite build && electron-builder --win"` (added in Task 1).

- [ ] **Step 3: Build the installer**

Run: `npm run package`
Expected: `release/Reel Setup 0.1.0.exe` is produced with no errors.

- [ ] **Step 4: Manual verification**

1. Run the installer, launch the installed app.
2. Perform a full recording → trim → export to MP4.
Expected: ffmpeg export works in the packaged app (verifies `asarUnpack` + the `app.asar.unpacked` path fix in `runFfmpeg`).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "build: package Reel as a Windows NSIS installer with bundled ffmpeg"
```

---

## Self-Review Notes (coverage check against the spec)

- **Full monitor + region capture** → Tasks 6, 7 (selection), 8 (crop), 13 (region overlay). ✓
- **Webcam bubble baked in at live position** → Tasks 9, 10. ✓
- **Mic + system audio mixed** → Task 11. ✓
- **Floating control toolbar (pause/resume/stop)** → Task 12. ✓
- **Preview + trim** → Task 14. ✓
- **Export MP4/WebM, reveal, copy** → Task 15. ✓
- **Library** → Task 16. ✓
- **Global hotkey** → Task 17. ✓
- **Windows installer w/ bundled ffmpeg** → Task 18. ✓
- **Security (contextIsolation/no nodeIntegration/typed preload)** → Global Constraints + every window factory. ✓
- **Coordinates use scaleFactor; streamed-to-disk; raw webm preserved** → Tasks 2, 8, 15. ✓
- **Unit tests on pure logic only** → Tasks 2–4. ✓

**Known follow-ups (not v1):** single-window capture; copying the actual file object (vs path) to the clipboard; per-recording duration persisted into library metadata.
