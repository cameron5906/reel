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
