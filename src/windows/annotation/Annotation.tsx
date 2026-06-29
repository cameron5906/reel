import { useEffect, useRef, useState } from 'react'

interface Point { x: number; y: number }
interface Stroke { color: string; width: number; points: Point[] }

const COLORS = ['#f2555a', '#f5b945', '#3ddc97', '#5b8cff', '#ffffff', '#111418']
const WIDTHS = [3, 6, 12]

export function Annotation() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strokes = useRef<Stroke[]>([])
  const drawing = useRef(false)
  const [drawMode, setDrawMode] = useState(false)
  const [color, setColor] = useState(COLORS[0])
  const [width, setWidth] = useState(WIDTHS[1])
  const colorRef = useRef(color)
  const widthRef = useRef(width)
  colorRef.current = color
  widthRef.current = width

  function fit() {
    const c = canvasRef.current
    if (!c) return
    c.width = window.innerWidth
    c.height = window.innerHeight
    redraw()
  }

  function redraw() {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const s of strokes.current) {
      ctx.strokeStyle = s.color
      ctx.lineWidth = s.width
      ctx.beginPath()
      s.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
      ctx.stroke()
    }
  }

  useEffect(() => {
    fit()
    window.addEventListener('resize', fit)
    const off = window.reel.onDrawChanged(setDrawMode)
    return () => { window.removeEventListener('resize', fit); off() }
  }, [])

  function onDown(e: React.PointerEvent) {
    if (!drawMode) return
    drawing.current = true
    strokes.current.push({ color: colorRef.current, width: widthRef.current, points: [{ x: e.clientX, y: e.clientY }] })
  }
  function onMove(e: React.PointerEvent) {
    if (!drawing.current) return
    const s = strokes.current[strokes.current.length - 1]
    s.points.push({ x: e.clientX, y: e.clientY })
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.strokeStyle = s.color
    ctx.lineWidth = s.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const n = s.points.length
    ctx.beginPath()
    ctx.moveTo(s.points[n - 2].x, s.points[n - 2].y)
    ctx.lineTo(s.points[n - 1].x, s.points[n - 1].y)
    ctx.stroke()
  }
  function onUp() { drawing.current = false }

  function undo() { strokes.current.pop(); redraw() }
  function clear() { strokes.current = []; redraw() }

  return (
    <div className={drawMode ? 'anno draw-on' : 'anno'}>
      <canvas
        ref={canvasRef}
        className="anno-canvas"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      />
      <div className={drawMode ? 'palette-bar' : 'palette-bar hidden'}>
        {COLORS.map((c) => (
          <button
            key={c}
            className={color === c ? 'pen sel' : 'pen'}
            style={{ background: c }}
            onClick={() => setColor(c)}
          />
        ))}
        <span className="divider" />
        {WIDTHS.map((w) => (
          <button key={w} className={width === w ? 'wbtn sel' : 'wbtn'} onClick={() => setWidth(w)}>
            <span className="wdot" style={{ width: w + 2, height: w + 2 }} />
          </button>
        ))}
        <span className="divider" />
        <button className="tool-btn" onClick={undo}>Undo</button>
        <button className="tool-btn" onClick={clear}>Clear</button>
      </div>
    </div>
  )
}
