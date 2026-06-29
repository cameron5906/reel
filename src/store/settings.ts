import type { RecordingSettings } from '@shared/types'

export const defaultSettings: RecordingSettings = {
  target: { kind: 'display', displayId: 0 },
  micDeviceId: null,
  webcamDeviceId: null,
  systemAudio: true,
  bubble: { enabled: false, sizePx: 180 },
  cameraFrame: { zoom: 1, panX: 0.5, panY: 0.5 },
  cameraFlip: true,
  cursorFollow: { smoothing: 0.2, offset: 48, autoFlip: true },
  background: { enabled: false, mode: 'color', color: '#ffffff', imageDataUrl: null, segThreshold: 0.5 },
  savedColors: [],
  maxLongEdge: 1920
}
