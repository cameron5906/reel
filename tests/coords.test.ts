import { describe, it, expect } from 'vitest'
import { physicalCrop, fitCanvas, mapBubbleToCanvas } from '@/lib/coords'

const display = { bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1 }

describe('physicalCrop', () => {
  it('full display at scale 1 maps to physical pixels at origin', () => {
    expect(physicalCrop({ x: 0, y: 0, width: 1920, height: 1080 }, display))
      .toEqual({ x: 0, y: 0, width: 1920, height: 1080 })
  })

  it('region offsets by display origin and multiplies by scaleFactor', () => {
    const d = { bounds: { x: -1920, y: 0, width: 1920, height: 1080 }, scaleFactor: 1.5 }
    expect(physicalCrop({ x: -1920 + 100, y: 200, width: 640, height: 360 }, d))
      .toEqual({ x: 150, y: 300, width: 960, height: 540 })
  })
})

describe('fitCanvas', () => {
  it('does not upscale when below the cap', () => {
    expect(fitCanvas({ x: 0, y: 0, width: 1280, height: 720 }, 1920))
      .toEqual({ width: 1280, height: 720, scale: 1 })
  })

  it('scales down to the cap on the long edge, preserving aspect', () => {
    expect(fitCanvas({ x: 0, y: 0, width: 3840, height: 2160 }, 1920))
      .toEqual({ width: 1920, height: 1080, scale: 0.5 })
  })
})

describe('mapBubbleToCanvas', () => {
  it('places a bubble relative to capture origin and scales it', () => {
    // capture region starts at screen (100,200); bubble at (300,400) DIP, scale 2, canvasScale 0.5
    const r = mapBubbleToCanvas(
      { x: 300, y: 400, width: 160, height: 160 },
      { x: 100, y: 200, width: 640, height: 360 },
      2,
      0.5
    )
    expect(r).toEqual({ x: 200, y: 200, width: 160, height: 160 })
  })
})
