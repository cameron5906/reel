import { describe, it, expect } from 'vitest'
import { buildTranscodeArgs, buildThumbnailArgs } from '@/lib/ffmpeg-args'

describe('buildTranscodeArgs', () => {
  it('stream-copies an H.264 source to mp4 when no trim/scale (instant export)', () => {
    expect(buildTranscodeArgs({ input: 'in.mp4', output: 'out.mp4', format: 'mp4', sourceIsMp4: true })).toEqual([
      '-y', '-i', 'in.mp4', '-c', 'copy', 'out.mp4'
    ])
  })

  it('re-encodes a webm source to mp4 (H.264/AAC) at a normalized 30fps', () => {
    expect(buildTranscodeArgs({ input: 'in.webm', output: 'out.mp4', format: 'mp4' })).toEqual([
      '-y', '-i', 'in.webm', '-r', '30',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '160k',
      'out.mp4'
    ])
  })

  it('uses NVENC when requested', () => {
    const args = buildTranscodeArgs({ input: 'in.mp4', output: 'out.mp4', format: 'mp4', sourceIsMp4: true, height: 720, videoEncoder: 'nvenc' })
    expect(args).toContain('h264_nvenc')
    expect(args).not.toContain('libx264')
  })

  it('applies a scale filter for a target height (forces re-encode even from mp4)', () => {
    const args = buildTranscodeArgs({ input: 'in.mp4', output: 'out.mp4', format: 'mp4', sourceIsMp4: true, height: 720 })
    expect(args[args.indexOf('-vf') + 1]).toBe('scale=-2:720')
    expect(args).toContain('libx264')
  })

  it('applies trim with -ss before -i and -t duration, re-encoding for accuracy', () => {
    const args = buildTranscodeArgs({ input: 'in.mp4', output: 'out.mp4', format: 'mp4', sourceIsMp4: true, trimStart: 2, trimEnd: 5 })
    expect(args.slice(0, 6)).toEqual(['-y', '-ss', '2', '-i', 'in.mp4', '-t'])
    expect(args[6]).toBe('3')
    expect(args).toContain('libx264')
  })

  it('webm output stream-copies a webm source when no trim/scale', () => {
    expect(buildTranscodeArgs({ input: 'in.webm', output: 'out.webm', format: 'webm' })).toEqual([
      '-y', '-i', 'in.webm', '-c', 'copy', 'out.webm'
    ])
  })
})

describe('buildThumbnailArgs', () => {
  it('grabs a single frame at the given time', () => {
    expect(buildThumbnailArgs('in.webm', 'thumb.jpg', 1.5)).toEqual([
      '-y', '-ss', '1.5', '-i', 'in.webm', '-frames:v', '1', '-q:v', '3', 'thumb.jpg'
    ])
  })
})
