import type { Rect } from '@shared/types'

export function physicalCrop(
  captureRect: Rect,
  display: { bounds: Rect; scaleFactor: number }
): Rect {
  const s = display.scaleFactor
  return {
    x: (captureRect.x - display.bounds.x) * s,
    y: (captureRect.y - display.bounds.y) * s,
    width: captureRect.width * s,
    height: captureRect.height * s
  }
}

export function fitCanvas(crop: Rect, maxLongEdge: number) {
  const longest = Math.max(crop.width, crop.height)
  const scale = longest > maxLongEdge ? maxLongEdge / longest : 1
  return {
    width: Math.round(crop.width * scale),
    height: Math.round(crop.height * scale),
    scale
  }
}

export function mapBubbleToCanvas(
  bubble: Rect,
  captureRect: Rect,
  scaleFactor: number,
  canvasScale: number
): Rect {
  const s = scaleFactor * canvasScale
  return {
    x: (bubble.x - captureRect.x) * s,
    y: (bubble.y - captureRect.y) * s,
    width: bubble.width * s,
    height: bubble.height * s
  }
}
