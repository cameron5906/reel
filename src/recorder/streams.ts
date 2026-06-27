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
