import { useEffect, useRef } from 'react'
import type { CameraFrame, BackgroundSettings } from '@shared/types'
import { CameraRenderer } from '@/recorder/camera-renderer'

const DEFAULT_BG: BackgroundSettings = { enabled: false, mode: 'color', color: '#ffffff', imageDataUrl: null, segThreshold: 0.5 }

export function Bubble({ deviceId, frame }: { deviceId?: string; frame: CameraFrame }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const frameRef = useRef(frame)
  const bgRef = useRef<BackgroundSettings>(DEFAULT_BG)
  const flipRef = useRef(true)
  const rendererRef = useRef<CameraRenderer | null>(null)
  frameRef.current = frame
  if (!rendererRef.current) rendererRef.current = new CameraRenderer()

  useEffect(() => {
    window.reel.getSettings().then((s) => {
      if (s) {
        flipRef.current = s.cameraFlip
        if (s.background) {
          bgRef.current = s.background
          if (s.background.enabled) rendererRef.current?.init()
        }
      }
    })
    const offFlip = window.reel.onFlipChanged((v) => { flipRef.current = v })
    return () => { offFlip(); rendererRef.current?.dispose() }
  }, [])

  useEffect(() => {
    let active = true
    let stream: MediaStream | null = null
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    videoRef.current = video
    navigator.mediaDevices
      .getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId } } : true })
      .then((s) => {
        if (!active) { s.getTracks().forEach((t) => t.stop()); return }
        stream = s
        video.srcObject = s
        video.play().catch(() => {})
      })
      .catch((e) => console.error('bubble cam failed', e))
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
        const s = canvas.width
        ctx.clearRect(0, 0, s, s)
        rendererRef.current!.draw(ctx, video, {
          frame: frameRef.current,
          dest: { x: 0, y: 0, w: s, h: s },
          radius: s / 2,
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

  return (
    <div className="bubble">
      <canvas ref={canvasRef} width={360} height={360} className="cam" />
    </div>
  )
}
