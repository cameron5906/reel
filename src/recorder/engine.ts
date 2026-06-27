import type { RecorderCommand, Rect, DisplayInfo, RecordingSettings } from '@shared/types'
import { physicalCrop, fitCanvas, mapBubbleToCanvas } from '@/lib/coords'
import { getScreenStream, getWebcamStream, getMicStream, pickMimeType } from './streams'
import { mixAudio } from './audio-mix'

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

    if (settings.bubble.enabled && settings.webcamDeviceId) {
      this.webcam = await getWebcamStream(settings.webcamDeviceId)
      await playStream(this.webcamVideo, this.webcam)
      this.offBubble = window.reel.onBubbleBounds((r) => { this.bubbleBounds = r })
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

  pause() { this.recorder?.state === 'recording' && this.recorder.pause() }
  resume() { this.recorder?.state === 'paused' && this.recorder.resume() }

  async stop(): Promise<{ blob: Blob; durationSec: number }> {
    cancelAnimationFrame(this.raf)
    const durationSec = (performance.now() - this.startMs) / 1000
    const blob = await this.finalize()
    this.offBubble?.()
    this.webcam?.getTracks().forEach((t) => t.stop())
    this.mic?.getTracks().forEach((t) => t.stop())
    this.audioMix?.close()
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
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for stream metadata')), 10000)
    video.onloadedmetadata = () => {
      clearTimeout(timer)
      video.play().then(() => resolve()).catch(reject)
    }
    video.onerror = () => { clearTimeout(timer); reject(new Error('Stream failed to load')) }
  })
}
