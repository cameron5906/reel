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
  // Prefer H.264/MP4 so "Export to MP4" can stream-copy (instant). Then VP8
  // (fast to decode) over VP9 (slow software decode) for the webm fallback.
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm'
  ]
  return candidates.find((c) => MediaRecorder.isTypeSupported(c)) ?? 'video/webm'
}

export function extForMime(mime: string): 'mp4' | 'webm' {
  return mime.startsWith('video/mp4') ? 'mp4' : 'webm'
}
