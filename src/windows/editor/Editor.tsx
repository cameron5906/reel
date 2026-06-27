import { useEffect, useRef, useState } from 'react'
import { TrimBar } from './TrimBar'

export function Editor({ tempPath, duration }: { tempPath: string; duration: number }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [dur, setDur] = useState(duration)
  const [trim, setTrim] = useState({ inSec: 0, outSec: duration })
  const [playhead, setPlayhead] = useState(0)

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
        {/* Save button added in Task 15 */}
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
