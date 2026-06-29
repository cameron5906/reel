import { useEffect, useRef } from 'react'
import type { CameraFrame, BackgroundSettings } from '@shared/types'
import { clampPan } from '@/lib/frame'
import { CameraRenderer } from '@/recorder/camera-renderer'

interface Props {
  deviceId: string | null
  frame: CameraFrame
  background: BackgroundSettings
  flipped: boolean
  onFrameChange: (f: CameraFrame) => void
}

export function WebcamPreview({ deviceId, frame, background, flipped, onFrameChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const frameRef = useRef(frame)
  const bgRef = useRef(background)
  const flipRef = useRef(flipped)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const rendererRef = useRef<CameraRenderer | null>(null)
  frameRef.current = frame
  bgRef.current = background
  flipRef.current = flipped

  if (!rendererRef.current) rendererRef.current = new CameraRenderer()

  useEffect(() => {
    if (background.enabled) rendererRef.current?.init()
  }, [background.enabled])

  useEffect(() => () => rendererRef.current?.dispose(), [])

  useEffect(() => {
    if (!deviceId) return
    let active = true
    let stream: MediaStream | null = null
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    videoRef.current = video
    navigator.mediaDevices
      .getUserMedia({ video: { deviceId: { exact: deviceId } } })
      .then((s) => {
        if (!active) { s.getTracks().forEach((t) => t.stop()); return }
        stream = s
        video.srcObject = s
        video.play().catch(() => {})
      })
      .catch(() => {})
    return () => {
      active = false
      stream?.getTracks().forEach((t) => t.stop())
      videoRef.current = null
    }
  }, [deviceId])

  useEffect(() => {
    let raf = 0
    const draw = () => {
      const canvas = canvasRef.current
      const video = videoRef.current
      if (canvas && video && video.videoWidth) {
        const ctx = canvas.getContext('2d')!
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        rendererRef.current!.draw(ctx, video, {
          frame: frameRef.current,
          dest: { x: 0, y: 0, w: canvas.width, h: canvas.height },
          radius: 0,
          alpha: 1,
          mirror: flipRef.current,
          background: bgRef.current
        })
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  function onWheel(e: React.WheelEvent) {
    const f = frameRef.current
    const zoom = Math.min(4, Math.max(1, f.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)))
    onFrameChange({ zoom, panX: clampPan(f.panX, zoom), panY: clampPan(f.panY, zoom) })
  }

  function onMouseDown(e: React.MouseEvent) {
    if (frameRef.current.zoom <= 1.001) return
    drag.current = { x: e.clientX, y: e.clientY }
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!drag.current) return
    const rect = canvasRef.current!.getBoundingClientRect()
    const dx = e.clientX - drag.current.x
    const dy = e.clientY - drag.current.y
    drag.current = { x: e.clientX, y: e.clientY }
    const f = frameRef.current
    const span = 1 / f.zoom
    onFrameChange({
      zoom: f.zoom,
      panX: clampPan(f.panX + (dx / rect.width) * span, f.zoom),
      panY: clampPan(f.panY - (dy / rect.height) * span, f.zoom)
    })
  }

  function endDrag() { drag.current = null }

  if (!deviceId) {
    return (
      <div className="preview">
        <div className="preview-empty">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M2 6.5A1.5 1.5 0 0 1 3.5 5h9A1.5 1.5 0 0 1 14 6.5v11A1.5 1.5 0 0 1 12.5 19h-9A1.5 1.5 0 0 1 2 17.5z" />
            <path d="m14 9 6-3.5v13L14 15" />
          </svg>
          <span>Camera off</span>
        </div>
      </div>
    )
  }

  const zoomed = frame.zoom > 1.001
  return (
    <div className="preview">
      <canvas
        ref={canvasRef}
        width={640}
        height={360}
        className={`preview-canvas${zoomed ? ' pannable' : ''}`}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
      />
      <div className="preview-tools">
        <span className="zoom-badge">{frame.zoom.toFixed(1)}×</span>
        {zoomed && (
          <button className="reset-frame" onClick={() => onFrameChange({ zoom: 1, panX: 0.5, panY: 0.5 })}>
            Reset
          </button>
        )}
      </div>
      <div className="preview-hint">Scroll to zoom · drag to pan</div>
    </div>
  )
}
