import React from 'react'

interface Props {
  duration: number
  inSec: number
  outSec: number
  playhead: number
  onChange: (next: { inSec: number; outSec: number }) => void
  onScrub: (sec: number) => void
}

export function TrimBar({ duration, inSec, outSec, playhead, onChange, onScrub }: Props) {
  const ref = React.useRef<HTMLDivElement>(null)
  const pct = (s: number) => (duration ? (s / duration) * 100 : 0)

  function posToSec(clientX: number) {
    const el = ref.current!
    const r = el.getBoundingClientRect()
    return Math.max(0, Math.min(duration, ((clientX - r.left) / r.width) * duration))
  }

  function dragHandle(which: 'in' | 'out') {
    return (e: React.MouseEvent) => {
      e.stopPropagation()
      const move = (ev: MouseEvent) => {
        const sec = posToSec(ev.clientX)
        if (which === 'in') onChange({ inSec: Math.min(sec, outSec - 0.1), outSec })
        else onChange({ inSec, outSec: Math.max(sec, inSec + 0.1) })
      }
      const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    }
  }

  return (
    <div className="trim" ref={ref} onMouseDown={(e) => onScrub(posToSec(e.clientX))}>
      <div className="trim-dim" style={{ left: 0, width: `${pct(inSec)}%` }} />
      <div className="trim-dim" style={{ right: 0, width: `${100 - pct(outSec)}%` }} />
      <div className="trim-range" style={{ left: `${pct(inSec)}%`, width: `${pct(outSec) - pct(inSec)}%` }} />
      <div className="playhead" style={{ left: `${pct(playhead)}%` }} />
      <div className="handle" style={{ left: `${pct(inSec)}%` }} onMouseDown={dragHandle('in')} />
      <div className="handle" style={{ left: `${pct(outSec)}%` }} onMouseDown={dragHandle('out')} />
    </div>
  )
}
