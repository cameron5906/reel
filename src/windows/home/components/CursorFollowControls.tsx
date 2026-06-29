import type { CursorFollow } from '@shared/types'

interface Props {
  value: CursorFollow
  onChange: (c: CursorFollow) => void
}

export function CursorFollowControls({ value, onChange }: Props) {
  return (
    <div className="follow-controls">
      <div className="follow-head">
        <span className="field-label">Cursor follow</span>
        <span className="kbd">Ctrl+Shift+Q while recording</span>
      </div>

      <label className="slider-row">
        <span className="slider-label">Trail</span>
        <input
          type="range"
          min={0.05}
          max={0.5}
          step={0.01}
          value={value.smoothing}
          onChange={(e) => onChange({ ...value, smoothing: Number(e.target.value) })}
        />
      </label>

      <label className="slider-row">
        <span className="slider-label">Offset</span>
        <input
          type="range"
          min={0}
          max={160}
          step={4}
          value={value.offset}
          onChange={(e) => onChange({ ...value, offset: Number(e.target.value) })}
        />
      </label>

      <label className="toggle">
        <input
          type="checkbox"
          checked={value.autoFlip}
          onChange={(e) => onChange({ ...value, autoFlip: e.target.checked })}
        />
        <span className="toggle-track"><span className="toggle-thumb" /></span>
        <span className="toggle-label">Flip to face cursor</span>
      </label>
    </div>
  )
}
