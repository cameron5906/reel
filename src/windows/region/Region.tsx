import React, { useRef, useState } from 'react'

export function Region() {
  const [start, setStart] = useState<{ x: number; y: number } | null>(null)
  const [cur, setCur] = useState<{ x: number; y: number } | null>(null)
  const dragging = useRef(false)

  function rect() {
    if (!start || !cur) return null
    return {
      x: Math.min(start.x, cur.x),
      y: Math.min(start.y, cur.y),
      width: Math.abs(cur.x - start.x),
      height: Math.abs(cur.y - start.y)
    }
  }

  function onDown(e: React.MouseEvent) { dragging.current = true; setStart({ x: e.clientX, y: e.clientY }); setCur({ x: e.clientX, y: e.clientY }) }
  function onMove(e: React.MouseEvent) { if (dragging.current) setCur({ x: e.clientX, y: e.clientY }) }
  function onUp() {
    dragging.current = false
    const r = rect()
    if (r && r.width > 10 && r.height > 10) window.reel.regionDone(r)
    else window.reel.regionDone(null)
  }

  React.useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') window.reel.regionDone(null) }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [])

  const r = rect()
  return (
    <div className="overlay" onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp}>
      <div className="hint">Drag to select a region · Esc to cancel</div>
      {r && <div className="sel" style={{ left: r.x, top: r.y, width: r.width, height: r.height }}>
        <span className="size">{r.width}×{r.height}</span>
      </div>}
    </div>
  )
}
