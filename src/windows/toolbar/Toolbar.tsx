import { useEffect, useState } from 'react'
import type { SceneMode } from '@shared/types'

const SCENES: { mode: SceneMode; label: string; title: string }[] = [
  { mode: 'both', label: 'Both', title: 'Screen + camera bubble (Ctrl+Shift+1)' },
  { mode: 'screen', label: 'Screen', title: 'Screen only (Ctrl+Shift+2)' },
  { mode: 'camera', label: 'Cam', title: 'Camera fullscreen (Ctrl+Shift+3)' }
]

export function Toolbar({ hasCam, initialFlip }: { hasCam: boolean; initialFlip: boolean }) {
  const [elapsed, setElapsed] = useState(0)
  const [paused, setPaused] = useState(false)
  const [scene, setScene] = useState<SceneMode>('both')
  const [flip, setFlip] = useState(initialFlip)
  const [draw, setDraw] = useState(false)
  const [follow, setFollow] = useState(false)

  useEffect(() => {
    const id = setInterval(() => { if (!paused) setElapsed((e) => e + 1) }, 1000)
    return () => clearInterval(id)
  }, [paused])

  useEffect(() => window.reel.onSceneChanged(setScene), [])
  useEffect(() => window.reel.onFlipChanged(setFlip), [])
  useEffect(() => window.reel.onDrawChanged(setDraw), [])
  useEffect(() => window.reel.onFollowChanged(setFollow), [])

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

      {hasCam && (
        <div className="scenes">
          {SCENES.map((s) => (
            <button
              key={s.mode}
              title={s.title}
              className={scene === s.mode ? 'scene active' : 'scene'}
              onClick={() => window.reel.setScene(s.mode)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {hasCam && (
        <button
          className={flip ? 'icon-btn active' : 'icon-btn'}
          title="Flip camera (Ctrl+Shift+F)"
          onClick={() => window.reel.setFlip(!flip)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v18" strokeDasharray="2 2" />
            <path d="M16 7l4 5-4 5z" />
            <path d="M8 7l-4 5 4 5z" />
          </svg>
        </button>
      )}

      {hasCam && (
        <button
          className={follow ? 'icon-btn active' : 'icon-btn'}
          title="Follow cursor (Ctrl+Shift+Q)"
          onClick={() => window.reel.setFollow(!follow)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3l7 17 2-7 7-2z" />
          </svg>
        </button>
      )}

      <button
        className={draw ? 'icon-btn active' : 'icon-btn'}
        title="Draw on screen (Ctrl+Shift+D)"
        onClick={() => window.reel.setDrawMode(!draw)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" />
        </svg>
      </button>
      <button onClick={togglePause}>{paused ? '▶' : '❚❚'}</button>
      <button className="stop" onClick={() => window.reel.stopRecording()}>■</button>
    </div>
  )
}
