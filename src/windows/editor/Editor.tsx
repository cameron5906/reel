import { useEffect, useRef, useState } from 'react'
import { TrimBar } from './TrimBar'

export function Editor({ tempPath, duration }: { tempPath: string; duration: number }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [dur, setDur] = useState(duration)
  const [trim, setTrim] = useState({ inSec: 0, outSec: duration })
  const [playhead, setPlayhead] = useState(0)
  const [format, setFormat] = useState<'mp4' | 'webm'>('mp4')
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const v = videoRef.current!
    const onMeta = () => {
      if (isFinite(v.duration)) { setDur(v.duration); setTrim((_t) => ({ inSec: 0, outSec: v.duration })) }
    }
    const onTime = () => {
      setPlayhead(v.currentTime)
      if (v.currentTime >= trim.outSec) v.pause()
    }
    v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('timeupdate', onTime)
    return () => { v.removeEventListener('loadedmetadata', onMeta); v.removeEventListener('timeupdate', onTime) }
  }, [trim.outSec])

  useEffect(() => {
    const unsub = window.reel.onExportProgress(setProgress)
    return () => { unsub() }
  }, [])

  async function save() {
    setError(null)
    setProgress(0)
    try {
      const res = await window.reel.saveRecording({
        tempPath, format, trimStart: trim.inSec, trimEnd: trim.outSec,
        suggestedName: 'Reel-recording'
      })
      if (res.saved && res.path) {
        window.reel.revealInExplorer(res.path)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setProgress(null)
    }
  }

  function play() {
    const v = videoRef.current!
    if (v.currentTime < trim.inSec || v.currentTime >= trim.outSec) v.currentTime = trim.inSec
    v.play()
  }

  return (
    <div className="editor">
      <video ref={videoRef} src={`file://${tempPath}`} controls={false} className="preview" />
      <div className="controls">
        <button onClick={play}>▶ Play</button>
        <span className="meta">Trim: {trim.inSec.toFixed(1)}s – {trim.outSec.toFixed(1)}s</span>
        <select value={format} onChange={(e) => setFormat(e.target.value as 'mp4' | 'webm')}>
          <option value="mp4">MP4</option>
          <option value="webm">WebM</option>
        </select>
        <button onClick={save} disabled={progress !== null}>
          {progress === null ? 'Save' : `Exporting ${progress}%`}
        </button>
        {error && <span className="error">{error}</span>}
      </div>
      <TrimBar
        duration={dur}
        inSec={trim.inSec}
        outSec={trim.outSec}
        playhead={playhead}
        onChange={setTrim}
        onScrub={(s) => { videoRef.current!.currentTime = s }}
      />
    </div>
  )
}
