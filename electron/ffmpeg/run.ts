import { spawn } from 'node:child_process'
import ffmpegPath from 'ffmpeg-static'

export function runFfmpeg(args: string[], onProgress?: (sec: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const bin = (ffmpegPath as unknown as string).replace('app.asar', 'app.asar.unpacked')
    const proc = spawn(bin, args)
    let stderr = ''
    proc.stderr.on('data', (d) => {
      const s = d.toString()
      stderr += s
      const m = s.match(/time=(\d+):(\d+):(\d+\.\d+)/)
      if (m && onProgress) onProgress(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]))
    })
    proc.on('error', reject)
    proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`)))
  })
}
