export interface TranscodeOptions {
  input: string
  output: string
  format: 'mp4' | 'webm'
  trimStart?: number
  trimEnd?: number
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
  if (o.format === 'webm' && !hasTrim) {
    return ['-y', '-i', o.input, '-c', 'copy', o.output]
  }
  return [
    '-y',
    ...trimFlags(o),
    '-i', o.input,
    ...durationFlags(o),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k',
    o.output
  ]
}

export function buildThumbnailArgs(input: string, output: string, atSeconds: number): string[] {
  return ['-y', '-ss', String(atSeconds), '-i', input, '-frames:v', '1', '-q:v', '3', output]
}
