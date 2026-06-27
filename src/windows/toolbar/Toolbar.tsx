import { useEffect, useState } from 'react'

export function Toolbar() {
  const [elapsed, setElapsed] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    const id = setInterval(() => { if (!paused) setElapsed((e) => e + 1) }, 1000)
    return () => clearInterval(id)
  }, [paused])

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')

  function togglePause() {
    if (paused) window.reel.resumeRecording()
    else window.reel.pauseRecording()
    setPaused((p) => !p)
  }

  return (
    <div className="bar">
      <span className="dot" />
      <span className="time">{mm}:{ss}</span>
      <button onClick={togglePause}>{paused ? '▶' : '❚❚'}</button>
      <button className="stop" onClick={() => window.reel.stopRecording()}>■</button>
    </div>
  )
}
