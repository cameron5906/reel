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
