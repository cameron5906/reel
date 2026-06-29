import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision'
import type { CameraFrame, BackgroundSettings } from '@shared/types'
import { framedSource } from '@/lib/frame'

const WASM_BASE = import.meta.env.DEV ? '/mediapipe/wasm' : '../../mediapipe/wasm'
const MODEL_URL = import.meta.env.DEV ? '/mediapipe/selfie_segmenter.tflite' : '../../mediapipe/selfie_segmenter.tflite'

export interface CameraDraw {
  frame: CameraFrame
  dest: { x: number; y: number; w: number; h: number }
  radius: number // corner radius in px (0 = rectangle, min(w,h)/2 = circle)
  alpha: number
  mirror: boolean
  background: BackgroundSettings
  border?: { width: number; color: string }
}

export class CameraRenderer {
  private segmenter?: ImageSegmenter
  private initing?: Promise<void>
  private maskCanvas = document.createElement('canvas')
  private personCanvas = document.createElement('canvas')
  private blurCanvas = document.createElement('canvas')
  private bgImage: HTMLImageElement | null = null
  private bgImageSrc: string | null = null
  private lastTs = -1
  private prevConf: Float32Array | null = null

  init(): Promise<void> {
    if (this.segmenter) return Promise.resolve()
    if (!this.initing) {
      this.initing = (async () => {
        const files = await FilesetResolver.forVisionTasks(WASM_BASE)
        this.segmenter = await ImageSegmenter.createFromOptions(files, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          outputCategoryMask: false,
          outputConfidenceMasks: true
        })
      })().catch((e) => { console.error('segmenter init failed', e) })
    }
    return this.initing
  }

  dispose() {
    this.segmenter?.close()
    this.segmenter = undefined
    this.initing = undefined
    this.prevConf = null
  }

  private ensureBgImage(src: string | null) {
    if (src === this.bgImageSrc) return
    this.bgImageSrc = src
    if (!src) { this.bgImage = null; return }
    const img = new Image()
    img.onload = () => { this.bgImage = img }
    img.src = src
  }

  draw(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, o: CameraDraw) {
    const vw = video.videoWidth || 1
    const vh = video.videoHeight || 1
    const { x, y, w, h } = o.dest
    const radius = Math.max(0, Math.min(o.radius, Math.min(w, h) / 2))
    const { sx, sy, sw, sh } = framedSource(vw, vh, o.frame, w, h)
    const bg = o.background

    if (bg.enabled && !this.segmenter) this.init()

    ctx.save()
    ctx.globalAlpha = o.alpha
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, radius)
    ctx.clip()
    if (o.mirror) { ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.translate(-x, -y) }

    if (bg.enabled && this.segmenter) {
      this.compositeSegmented(ctx, video, o, { vw, vh, x, y, w, h, sx, sy, sw, sh })
    } else {
      ctx.drawImage(video, sx, sy, sw, sh, x, y, w, h)
    }
    ctx.restore()

    if (o.border && radius > 0.5) {
      const ringAlpha = o.alpha * Math.min(1, radius / (Math.min(w, h) / 2))
      const r = radius - o.border.width / 2
      ctx.save()
      ctx.globalAlpha = ringAlpha
      ctx.beginPath()
      ctx.roundRect(x + o.border.width / 2, y + o.border.width / 2, w - o.border.width, h - o.border.width, Math.max(0, r))
      ctx.lineWidth = o.border.width
      ctx.strokeStyle = o.border.color
      ctx.stroke()
      ctx.restore()
    }
  }

  private compositeSegmented(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    o: CameraDraw,
    g: { vw: number; vh: number; x: number; y: number; w: number; h: number; sx: number; sy: number; sw: number; sh: number }
  ) {
    const { vw, vh, x, y, w, h, sx, sy, sw, sh } = g
    const bg = o.background

    const ts = Math.max(this.lastTs + 1, Math.round(performance.now()))
    this.lastTs = ts
    let mask: import('@mediapipe/tasks-vision').MPMask | undefined
    try {
      const result = this.segmenter!.segmentForVideo(video, ts)
      mask = result.confidenceMasks?.[0]
    } catch {
      ctx.drawImage(video, sx, sy, sw, sh, x, y, w, h)
      return
    }

    // Background layer
    if (bg.mode === 'image') {
      this.ensureBgImage(bg.imageDataUrl)
      if (this.bgImage) drawCover(ctx, this.bgImage, x, y, w, h)
      else { ctx.fillStyle = bg.color; ctx.fillRect(x, y, w, h) }
    } else if (bg.mode === 'blur') {
      const bc = this.blurCanvas
      bc.width = w; bc.height = h
      const bctx = bc.getContext('2d')!
      bctx.filter = 'blur(14px)'
      bctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h)
      bctx.filter = 'none'
      ctx.drawImage(bc, x, y)
    } else {
      ctx.fillStyle = bg.color
      ctx.fillRect(x, y, w, h)
    }

    // Person layer (framed video kept only where the mask says "person")
    if (mask) {
      const pc = this.personCanvas
      pc.width = w; pc.height = h
      const pctx = pc.getContext('2d')!
      pctx.clearRect(0, 0, w, h)
      pctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h)

      const mw = mask.width
      const mh = mask.height
      const conf = mask.getAsFloat32Array()
      // Temporal smoothing: gently blend with the previous frame to reduce flicker without ghosting.
      if (!this.prevConf || this.prevConf.length !== conf.length) this.prevConf = new Float32Array(conf.length)
      const prev = this.prevConf
      const smooth = 0.85
      const mc = this.maskCanvas
      mc.width = mw; mc.height = mh
      const mctx = mc.getContext('2d')!
      const id = mctx.createImageData(mw, mh)
      // Tight matte: a narrow ramp biased slightly INWARD so the soft edge never reaches into
      // the real background (which would reveal it as a halo). Higher threshold cuts more.
      const t = Math.min(0.97, Math.max(0.05, bg.segThreshold ?? 0.5))
      const lo = t
      const span = 0.08
      for (let i = 0; i < conf.length; i++) {
        const c = prev[i] + (conf[i] - prev[i]) * smooth
        prev[i] = c
        let a = (c - lo) / span
        a = a < 0 ? 0 : a > 1 ? 1 : a
        id.data[i * 4 + 3] = a * 255
      }
      mctx.putImageData(id, 0, 0)

      const rx = mw / vw
      const ry = mh / vh
      pctx.globalCompositeOperation = 'destination-in'
      pctx.drawImage(mc, sx * rx, sy * ry, sw * rx, sh * ry, 0, 0, w, h)
      pctx.globalCompositeOperation = 'source-over'

      ctx.drawImage(pc, x, y)
      mask.close()
    } else {
      ctx.drawImage(video, sx, sy, sw, sh, x, y, w, h)
    }
  }
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  const destAR = w / h
  const srcAR = iw / ih
  let sw: number
  let sh: number
  if (srcAR > destAR) { sh = ih; sw = ih * destAR } else { sw = iw; sh = iw / destAR }
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h)
}
