import type { RecorderCommand, Rect, DisplayInfo, RecordingSettings, SceneMode } from '@shared/types'
import { physicalCrop, fitCanvas, mapBubbleToCanvas } from '@/lib/coords'
import { getScreenStream, getWebcamStream, getMicStream, pickMimeType, extForMime } from './streams'
import { mixAudio } from './audio-mix'
import { CameraRenderer } from './camera-renderer'

interface CamLayout { x: number; y: number; w: number; h: number; radius: number; alpha: number }

const TWEEN_MS = 400

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
  private mic?: MediaStream
  private audioMix?: { track: MediaStreamTrack; close: () => void }
  private bubbleBounds?: Rect
  private offBubble?: () => void
  private settings?: RecordingSettings
  private display?: DisplayInfo
  private canvasScale = 1
  private scene: SceneMode = 'both'
  private camLayout?: CamLayout
  private animFrom?: CamLayout
  private animStart = 0
  private flip = true
  private mimeType = 'video/webm'
  private camRenderer = new CameraRenderer()

  private reset() {
    this.offBubble?.()
    this.offBubble = undefined
    this.bubbleBounds = undefined
    this.settings = undefined
    this.display = undefined
    this.screen?.getTracks().forEach((t) => t.stop())
    this.webcam?.getTracks().forEach((t) => t.stop())
    this.mic?.getTracks().forEach((t) => t.stop())
    this.audioMix?.close()
    this.audioMix = undefined
    this.screenVideo.srcObject = null
    this.webcamVideo.srcObject = null
    this.screen = undefined
    this.webcam = undefined
    this.mic = undefined
    this.recorder = undefined
    this.chunks = []
    this.scene = 'both'
    this.camLayout = undefined
    this.animFrom = undefined
  }

  async start(cmd: Extract<RecorderCommand, { type: 'start' }>) {
    this.reset()
    const { settings, sourceId, display } = cmd
    this.screen = await getScreenStream(sourceId, settings.systemAudio)

    this.crop = physicalCrop(captureRect(settings, display), display)
    const canvasSize = fitCanvas(this.crop, settings.maxLongEdge)
    this.canvas.width = canvasSize.width
    this.canvas.height = canvasSize.height

    this.settings = settings
    this.display = display
    this.canvasScale = canvasSize.scale
    this.flip = settings.cameraFlip

    if (settings.bubble.enabled && settings.webcamDeviceId) {
      this.webcam = await getWebcamStream(settings.webcamDeviceId)
      await playStream(this.webcamVideo, this.webcam)
      this.offBubble = window.reel.onBubbleBounds((r) => { this.bubbleBounds = r })
      if (settings.background.enabled) this.camRenderer.init()
    }

    await playStream(this.screenVideo, new MediaStream(this.screen.getVideoTracks()))

    const audioSources: MediaStream[] = []
    if (settings.systemAudio && this.screen.getAudioTracks().length) {
      audioSources.push(new MediaStream(this.screen.getAudioTracks()))
    }
    if (settings.micDeviceId) {
      this.mic = await getMicStream(settings.micDeviceId)
      audioSources.push(this.mic)
    }

    const out = this.canvas.captureStream(30)
    if (audioSources.length) {
      this.audioMix = mixAudio(audioSources)
      out.addTrack(this.audioMix.track)
    }
    this.mimeType = pickMimeType()
    this.recorder = new MediaRecorder(out, { mimeType: this.mimeType, videoBitsPerSecond: 8_000_000 })
    this.recorder.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data) }
    this.chunks = []
    this.recorder.start(1000)
    this.startMs = performance.now()
    this.loop()
  }

  setScene(mode: SceneMode) {
    if (mode === this.scene) return
    this.animFrom = this.camLayout ?? this.targetLayout(this.scene)
    this.animStart = performance.now()
    this.scene = mode
  }

  setFlip(value: boolean) {
    this.flip = value
  }

  private loop = () => {
    const { x, y, width, height } = this.crop
    this.ctx.drawImage(this.screenVideo, x, y, width, height, 0, 0, this.canvas.width, this.canvas.height)
    this.drawCamera()
    this.raf = requestAnimationFrame(this.loop)
  }

  private drawCamera() {
    if (!this.webcam) return
    const target = this.targetLayout(this.scene)
    const t = this.animFrom
      ? easeInOutCubic(Math.min(1, (performance.now() - this.animStart) / TWEEN_MS))
      : 1
    const layout = this.animFrom ? lerpLayout(this.animFrom, target, t) : target
    this.camLayout = layout
    if (t >= 1) this.animFrom = undefined
    if (layout.alpha <= 0.01) return

    const r = (layout.radius * Math.min(layout.w, layout.h)) / 2
    const borderW = Math.max(2, Math.round(Math.min(layout.w, layout.h) * 0.03))
    this.camRenderer.draw(this.ctx, this.webcamVideo, {
      frame: this.settings?.cameraFrame ?? { zoom: 1, panX: 0.5, panY: 0.5 },
      dest: { x: layout.x, y: layout.y, w: layout.w, h: layout.h },
      radius: r,
      alpha: layout.alpha,
      mirror: this.flip,
      background: this.settings?.background ?? { enabled: false, mode: 'color', color: '#ffffff', imageDataUrl: null, segThreshold: 0.5 },
      border: { width: borderW, color: 'rgba(255,255,255,0.92)' }
    })
  }

  private targetLayout(scene: SceneMode): CamLayout {
    if (scene === 'camera') {
      return { x: 0, y: 0, w: this.canvas.width, h: this.canvas.height, radius: 0, alpha: 1 }
    }
    const b = this.bubbleRectOnCanvas()
    return { ...b, radius: 1, alpha: scene === 'both' ? 1 : 0 }
  }

  private bubbleRectOnCanvas(): { x: number; y: number; w: number; h: number } {
    if (this.bubbleBounds && this.settings && this.display) {
      const b = mapBubbleToCanvas(
        this.bubbleBounds,
        captureRect(this.settings, this.display),
        this.display.scaleFactor,
        this.canvasScale
      )
      return { x: b.x, y: b.y, w: b.width, h: b.height }
    }
    const d = Math.round(Math.min(this.canvas.width, this.canvas.height) * 0.18)
    const m = Math.round(d * 0.3)
    return { x: m, y: this.canvas.height - d - m, w: d, h: d }
  }

  pause() { this.recorder?.state === 'recording' && this.recorder.pause() }
  resume() { this.recorder?.state === 'paused' && this.recorder.resume() }

  async stop(): Promise<{ blob: Blob; durationSec: number; ext: 'mp4' | 'webm' }> {
    cancelAnimationFrame(this.raf)
    const durationSec = (performance.now() - this.startMs) / 1000
    const blob = await this.finalize()
    this.offBubble?.()
    this.webcam?.getTracks().forEach((t) => t.stop())
    this.mic?.getTracks().forEach((t) => t.stop())
    this.audioMix?.close()
    this.screen?.getTracks().forEach((t) => t.stop())
    return { blob, durationSec, ext: extForMime(this.mimeType) }
  }

  private finalize(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.recorder) return resolve(new Blob())
      this.recorder.onstop = () => resolve(new Blob(this.chunks, { type: this.mimeType }))
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
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for stream metadata')), 10000)
    video.onloadedmetadata = () => {
      clearTimeout(timer)
      video.play().then(() => resolve()).catch(reject)
    }
    video.onerror = () => { clearTimeout(timer); reject(new Error('Stream failed to load')) }
  })
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpLayout(a: CamLayout, b: CamLayout, t: number): CamLayout {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    w: lerp(a.w, b.w, t),
    h: lerp(a.h, b.h, t),
    radius: lerp(a.radius, b.radius, t),
    alpha: lerp(a.alpha, b.alpha, t)
  }
}

