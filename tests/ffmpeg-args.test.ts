import { describe, it, expect } from 'vitest'
import { buildTranscodeArgs, buildThumbnailArgs } from '@/lib/ffmpeg-args'

describe('buildTranscodeArgs', () => {
  it('transcodes webm to mp4 with H.264/AAC, no trim', () => {
    expect(buildTranscodeArgs({ input: 'in.webm', output: 'out.mp4', format: 'mp4' })).toEqual([
      '-y', '-i', 'in.webm',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k',
      'out.mp4'
    ])
  })

  it('applies trim with -ss before -i and -to as duration after', () => {
    const args = buildTranscodeArgs({ input: 'in.webm', output: 'out.mp4', format: 'mp4', trimStart: 2, trimEnd: 5 })
    expect(args.slice(0, 6)).toEqual(['-y', '-ss', '2', '-i', 'in.webm', '-t'])
    expect(args[6]).toBe('3') // duration = trimEnd - trimStart
    expect(args).toContain('out.mp4')
  })

  it('webm output stream-copies when no trim', () => {
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
