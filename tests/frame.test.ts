import { describe, it, expect } from 'vitest'
import { framedSource, clampPan } from '@/lib/frame'

describe('framedSource', () => {
  it('zoom 1 centered = full-frame cover-fit (16:9 into 4:3 source)', () => {
    // 640x480 source, 1280x720 (16:9) destination -> letterbox-crop top/bottom
    expect(framedSource(640, 480, { zoom: 1, panX: 0.5, panY: 0.5 }, 1280, 720))
      .toEqual({ sx: 0, sy: 60, sw: 640, sh: 360 })
  })

  it('zoom 2 centered into a square destination picks a centered square', () => {
    expect(framedSource(640, 480, { zoom: 2, panX: 0.5, panY: 0.5 }, 100, 100))
      .toEqual({ sx: 200, sy: 120, sw: 240, sh: 240 })
  })

  it('clamps pan so the framed region stays inside the source', () => {
    // zoom 2 -> half window = 0.25; panX 0 must clamp to 0.25 -> fx 0
    const r = framedSource(640, 480, { zoom: 2, panX: 0, panY: 1 }, 320, 240)
    expect(r.sx).toBe(0)
    expect(r.sy).toBe(240) // panY 1 clamps to 0.75 -> fy = 0.5*480 = 240
  })
})

describe('clampPan', () => {
  it('keeps the center within [half, 1-half] for the zoom level', () => {
    expect(clampPan(0, 2)).toBe(0.25)
    expect(clampPan(1, 2)).toBe(0.75)
    expect(clampPan(0.5, 4)).toBe(0.5)
  })
})
