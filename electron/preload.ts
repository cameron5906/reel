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

  writeTemp: (bytes: Uint8Array): Promise<string> => ipcRenderer.invoke('files:writeTemp', bytes),

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
