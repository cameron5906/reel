import type { RecordingSettings } from '@shared/types'

export const defaultSettings: RecordingSettings = {
  target: { kind: 'display', displayId: 0 },
  micDeviceId: null,
  webcamDeviceId: null,
  systemAudio: true,
  bubble: { enabled: false, sizePx: 180 },
  maxLongEdge: 1920
}
