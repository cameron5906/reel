import { useEffect, useState } from 'react'

export function useAudioLevel(deviceId: string | null): number {
  const [level, setLevel] = useState(0)
  useEffect(() => {
    if (!deviceId) { setLevel(0); return }
    let active = true
    let raf = 0
    let ctx: AudioContext | null = null
    let stream: MediaStream | null = null

    navigator.mediaDevices
      .getUserMedia({ audio: { deviceId: { exact: deviceId } } })
      .then((s) => {
        if (!active) { s.getTracks().forEach((t) => t.stop()); return }
        stream = s
        ctx = new AudioContext()
        const source = ctx.createMediaStreamSource(s)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 512
        source.connect(analyser)
        const data = new Uint8Array(analyser.frequencyBinCount)
        const tick = () => {
          analyser.getByteTimeDomainData(data)
          let sum = 0
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128
            sum += v * v
          }
          const rms = Math.sqrt(sum / data.length)
          setLevel(Math.min(1, rms * 2.4))
          raf = requestAnimationFrame(tick)
        }
        tick()
      })
      .catch(() => {})

    return () => {
      active = false
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
      ctx?.close().catch(() => {})
    }
  }, [deviceId])
  return level
}
