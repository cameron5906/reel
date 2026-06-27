import { describe, it, expect } from 'vitest'
import { sanitizeFilename, defaultRecordingName } from '@/lib/paths'

describe('sanitizeFilename', () => {
  it('replaces Windows-illegal characters with underscores', () => {
    expect(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j')
  })
  it('trims trailing dots and spaces', () => {
    expect(sanitizeFilename('demo.  ')).toBe('demo')
  })
})

describe('defaultRecordingName', () => {
  it('formats a stable, sortable name', () => {
    const d = new Date('2026-06-27T14:09:03')
    expect(defaultRecordingName(d)).toBe('Reel-2026-06-27_14-09-03')
  })
})
