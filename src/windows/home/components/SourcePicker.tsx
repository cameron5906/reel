import type { CaptureTarget, DisplayInfo, Rect } from '@shared/types'

interface Props {
  displays: DisplayInfo[]
  target: CaptureTarget
  onChange: (t: CaptureTarget) => void
}

export function SourcePicker({ displays, target, onChange }: Props) {
  async function pickRegion() {
    const rect: Rect | null = await window.reel.selectRegion()
    if (!rect) return
    const display = displays.find(
      (d) =>
        rect.x >= d.bounds.x &&
        rect.y >= d.bounds.y &&
        rect.x < d.bounds.x + d.bounds.width &&
        rect.y < d.bounds.y + d.bounds.height
    ) ?? displays[0]
    onChange({ kind: 'region', displayId: display.id, rect })
  }

  return (
    <div className="source-picker">
      <div className="seg">
        <button
          className={target.kind === 'display' ? 'active' : ''}
          onClick={() => { if (target.kind !== 'display') onChange({ kind: 'display', displayId: displays[0]?.id ?? 0 }) }}
        >
          Full monitor
        </button>
        <button
          className={target.kind === 'region' ? 'active' : ''}
          onClick={pickRegion}
        >
          {target.kind === 'region'
            ? `Region ${target.rect.width}×${target.rect.height}`
            : 'Select region…'}
        </button>
      </div>

      {target.kind === 'display' && displays.length > 1 && (
        <select
          value={target.displayId}
          onChange={(e) => onChange({ kind: 'display', displayId: Number(e.target.value) })}
        >
          {displays.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
      )}
    </div>
  )
}
