import type { CameraFrame } from '@shared/types'

export function clampPan(value: number, zoom: number): number {
  const half = 1 / Math.max(1, zoom) / 2
  return Math.min(1 - half, Math.max(half, value))
}

/**
 * Given a webcam source (vw×vh) and a viewframe (zoom + normalized pan center),
 * return the source sub-rectangle to draw, cover-fit to the destination aspect.
 */
export function framedSource(vw: number, vh: number, frame: CameraFrame, destW: number, destH: number) {
  const z = Math.max(1, frame.zoom || 1)
  const fwN = 1 / z
  const half = fwN / 2
  const cx = Math.min(1 - half, Math.max(half, frame.panX))
  const cy = Math.min(1 - half, Math.max(half, frame.panY))
  const fx = (cx - half) * vw
  const fy = (cy - half) * vh
  const fw = fwN * vw
  const fh = fwN * vh

  const destAR = destW / destH
  const srcAR = fw / fh
  let sw: number
  let sh: number
  if (srcAR > destAR) { sh = fh; sw = fh * destAR } else { sw = fw; sh = fw / destAR }
  return { sx: fx + (fw - sw) / 2, sy: fy + (fh - sh) / 2, sw, sh }
}
