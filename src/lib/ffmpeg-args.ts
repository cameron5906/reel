export interface TranscodeOptions {
  input: string
  output: string
  format: 'mp4' | 'webm'
  trimStart?: number
  trimEnd?: number
  height?: number | null            // target output height in px; null/undefined = keep source
  sourceIsMp4?: boolean             // source is already H.264/MP4 (enables a stream-copy fast path)
  videoEncoder?: 'nvenc' | 'x264'   // encoder for the mp4 re-encode path (defaults to x264)
}

function trimFlags(o: TranscodeOptions): string[] {
  const flags: string[] = []
  if (o.trimStart != null) flags.push('-ss', String(o.trimStart))
  return flags
}

function durationFlags(o: TranscodeOptions): string[] {
  if (o.trimStart != null && o.trimEnd != null) {
    return ['-t', String(o.trimEnd - o.trimStart)]
  }
  if (o.trimEnd != null) return ['-t', String(o.trimEnd)]
  return []
}

export function buildTranscodeArgs(o: TranscodeOptions): string[] {
  const hasTrim = o.trimStart != null || o.trimEnd != null
  const hasScale = o.height != null

  // Fast path: container remux with no re-encode when nothing needs changing.
  if (!hasTrim && !hasScale) {
    if (o.format === 'mp4' && o.sourceIsMp4) {
      return ['-y', '-i', o.input, '-c', 'copy', o.output]
    }
    if (o.format === 'webm' && !o.sourceIsMp4) {
      return ['-y', '-i', o.input, '-c', 'copy', o.output]
    }
  }

  const args = ['-y', ...trimFlags(o), '-i', o.input, ...durationFlags(o)]
  if (hasScale) args.push('-vf', `scale=-2:${o.height}`)
  // Normalize to a constant 30fps — recordings carry a 1000fps timebase that
  // otherwise makes the encoder process far too many frames.
  args.push('-r', '30')

  if (o.format === 'mp4') {
    if (o.videoEncoder === 'nvenc') {
      args.push('-c:v', 'h264_nvenc', '-preset', 'p4', '-rc', 'vbr', '-cq', '26', '-b:v', '0', '-pix_fmt', 'yuv420p')
    } else {
      args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p')
    }
    args.push('-c:a', 'aac', '-b:a', '160k')
  } else {
    args.push('-c:v', 'libvpx', '-b:v', '4M', '-c:a', 'libopus')
  }
  args.push(o.output)
  return args
}

export function buildThumbnailArgs(input: string, output: string, atSeconds: number): string[] {
  return ['-y', '-ss', String(atSeconds), '-i', input, '-frames:v', '1', '-q:v', '3', output]
}
