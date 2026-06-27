import type { RecorderCommand, Rect, DisplayInfo, RecordingSettings } from '@shared/types'
import { physicalCrop, fitCanvas, mapBubbleToCanvas } from '@/lib/coords'
import { getScreenStream, getWebcamStream, pickMimeType } from './streams'

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
  private webcam?: MediaStream
  private webcamVideo = document.createElement('video')
  private bubbleBounds?: Rect
  private offBubble?: () => void
  private settings?: RecordingSettings
  private display?: DisplayInfo
  private canvasScale = 1

  async start(cmd: Extract<RecorderCommand, { type: 'start' }>) {
    const { settings, sourceId, display } = cmd
    this.screen = await getScreenStream(sourceId, settings.systemAudio)

    this.crop = physicalCrop(captureRect(settings, display), display)
    const canvasSize = fitCanvas(this.crop, settings.maxLongEdge)
    this.canvas.width = canvasSize.width
    this.canvas.height = canvasSize.height

    this.settings = settings
    this.display = display
    this.canvasScale = canvasSize.scale

    if (settings.bubble.enabled && settings.webcamDeviceId) {
      this.webcam = await getWebcamStream(settings.webcamDeviceId)
      await playStream(this.webcamVideo, this.webcam)
      this.offBubble = window.reel.onBubbleBounds((r) => { this.bubbleBounds = r })
    }

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

  async stop(): Promise<{ blob: Blob; durationSec: number }> {
    cancelAnimationFrame(this.raf)
    const durationSec = (performance.now() - this.startMs) / 1000
    const blob = await this.finalize()
    this.offBubble?.()
    this.webcam?.getTracks().forEach((t) => t.stop())
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
