import { contextBridge, ipcRenderer } from 'electron'
import type {
  DisplayInfo, Rect, RecordingSettings, RecorderCommand, SceneMode,
  SaveRequest, SaveResult, RecordingMeta
} from '@shared/types'

const api = {
  getDisplays: (): Promise<DisplayInfo[]> => ipcRenderer.invoke('sources:displays'),
  selectRegion: (): Promise<Rect | null> => ipcRenderer.invoke('region:select'),
  regionDone: (rect: Rect | null): void => { ipcRenderer.send('region:done', rect) },

  startRecording: (settings: RecordingSettings): Promise<void> =>
    ipcRenderer.invoke('recording:start', settings),
  stopRecording: (): Promise<void> => ipcRenderer.invoke('recording:stop'),

  reportBubbleBounds: (rect: Rect): void => { ipcRenderer.send('bubble:bounds', rect) },
  onBubbleBounds: (cb: (rect: Rect) => void) => {
    const h = (_: unknown, r: Rect) => cb(r)
    ipcRenderer.on('bubble:bounds', h)
    return () => ipcRenderer.removeListener('bubble:bounds', h)
  },

  pauseRecording: (): void => { ipcRenderer.send('recorder:cmd', { type: 'pause' }) },
  resumeRecording: (): void => { ipcRenderer.send('recorder:cmd', { type: 'resume' }) },

  setScene: (mode: SceneMode): void => { ipcRenderer.send('recording:scene', mode) },
  onSceneChanged: (cb: (mode: SceneMode) => void) => {
    const h = (_: unknown, m: SceneMode) => cb(m)
    ipcRenderer.on('scene:changed', h)
    return () => { ipcRenderer.removeListener('scene:changed', h) }
  },

  setFlip: (value: boolean): void => { ipcRenderer.send('recording:flip', value) },
  onFlipChanged: (cb: (value: boolean) => void) => {
    const h = (_: unknown, v: boolean) => cb(v)
    ipcRenderer.on('flip:changed', h)
    return () => { ipcRenderer.removeListener('flip:changed', h) }
  },

  setDrawMode: (on: boolean): void => { ipcRenderer.send('recording:draw', on) },
  onDrawChanged: (cb: (on: boolean) => void) => {
    const h = (_: unknown, v: boolean) => cb(v)
    ipcRenderer.on('draw:changed', h)
    return () => { ipcRenderer.removeListener('draw:changed', h) }
  },

  setFollow: (on: boolean): void => { ipcRenderer.send('recording:follow', on) },
  onFollowChanged: (cb: (on: boolean) => void) => {
    const h = (_: unknown, v: boolean) => cb(v)
    ipcRenderer.on('follow:changed', h)
    return () => { ipcRenderer.removeListener('follow:changed', h) }
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

  writeTemp: (bytes: Uint8Array, ext: 'mp4' | 'webm' = 'webm'): Promise<string> =>
    ipcRenderer.invoke('files:writeTemp', bytes, ext),

  saveRecording: (req: SaveRequest): Promise<SaveResult> => ipcRenderer.invoke('files:save', req),
  listRecordings: (): Promise<RecordingMeta[]> => ipcRenderer.invoke('files:list'),
  deleteRecording: (path: string): Promise<void> => ipcRenderer.invoke('files:delete', path),
  revealInExplorer: (path: string): void => { ipcRenderer.send('files:reveal', path) },
  copyFile: (path: string): Promise<void> => ipcRenderer.invoke('files:copy', path),

  onExportProgress: (cb: (pct: number) => void) => {
    const h = (_: unknown, pct: number) => cb(pct)
    ipcRenderer.on('export:progress', h)
    return () => ipcRenderer.removeListener('export:progress', h)
  },

  abortRecording: (message: string): void => { ipcRenderer.send('recording:abort', message) },

  countdownDone: (): void => { ipcRenderer.send('countdown:done') },

  getSettings: (): Promise<RecordingSettings | null> => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: RecordingSettings): void => { ipcRenderer.send('settings:set', settings) },

  minimizeWindow: (): void => { ipcRenderer.send('window:minimize') },
  toggleMaximizeWindow: (): void => { ipcRenderer.send('window:maximizeToggle') },
  closeWindow: (): void => { ipcRenderer.send('window:close') },
  onMaximizeChange: (cb: (maximized: boolean) => void) => {
    const h = (_: unknown, m: boolean) => cb(m)
    ipcRenderer.on('window:maximized', h)
    return () => { ipcRenderer.removeListener('window:maximized', h) }
  }
}

export type ReelApi = typeof api
contextBridge.exposeInMainWorld('reel', api)
