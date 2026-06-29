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

export interface CameraFrame {
  zoom: number   // >= 1
  panX: number   // source-center fraction 0..1 (0.5 = centered)
  panY: number
}

export interface CursorFollow {
  smoothing: number   // 0..1 lerp per frame (low = laggy trail, high = snappy)
  offset: number      // px radius the bubble keeps from the cursor
  autoFlip: boolean   // flip the face toward the cursor side
}

export interface BackgroundSettings {
  enabled: boolean
  mode: 'color' | 'blur' | 'image'
  color: string
  imageDataUrl: string | null
  segThreshold: number   // 0..1 — higher cuts the background more aggressively
}

export interface RecordingSettings {
  target: CaptureTarget
  micDeviceId: string | null
  webcamDeviceId: string | null
  systemAudio: boolean
  bubble: { enabled: boolean; sizePx: number }   // sizePx = diameter in DIPs
  cameraFrame: CameraFrame
  cameraFlip: boolean                             // horizontally mirror the camera (preview + recording)
  cursorFollow: CursorFollow
  background: BackgroundSettings
  savedColors: string[]                           // user's saved custom background colors
  maxLongEdge: number                             // canvas cap, default 1920
}

export type SceneMode = 'both' | 'screen' | 'camera'

export type RecorderCommand =
  | { type: 'start'; settings: RecordingSettings; sourceId: string; display: DisplayInfo }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'stop' }
  | { type: 'scene'; mode: SceneMode }
  | { type: 'flip'; value: boolean }

export interface SaveRequest {
  tempPath: string                 // raw recording temp file (mp4 or webm)
  format: 'mp4' | 'webm'
  trimStart?: number
  trimEnd?: number
  suggestedName: string
  height?: number | null           // target output height; null/undefined = original
  durationSec?: number             // expected output length, for progress %
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
