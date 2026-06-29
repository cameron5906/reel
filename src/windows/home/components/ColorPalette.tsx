interface Props {
  value: string
  saved: string[]
  onPick: (c: string) => void
  onSave: (c: string) => void
  onDelete: (c: string) => void
}

const PRESETS = [
  '#ffffff', '#e7e7ea', '#8a8f98', '#1e1e24', '#0e0e12',
  '#3ddc97', '#00b140', '#5b8cff', '#0047ab', '#b06ab3',
  '#f2555a', '#f5b945'
]

const norm = (c: string) => c.toLowerCase()

export function ColorPalette({ value, saved, onPick, onSave, onDelete }: Props) {
  const known = new Set([...PRESETS, ...saved].map(norm))
  const isSel = (c: string) => norm(c) === norm(value)

  function onCustom(e: React.ChangeEvent<HTMLInputElement>) {
    const c = e.target.value
    onPick(c)
    if (!known.has(norm(c))) onSave(c)
  }

  return (
    <div className="palette">
      {PRESETS.map((c) => (
        <button
          key={c}
          className={`swatch${isSel(c) ? ' sel' : ''}`}
          style={{ background: c }}
          title={c.toUpperCase()}
          onClick={() => onPick(c)}
        />
      ))}
      {saved.map((c) => (
        <div
          key={c}
          className={`swatch saved${isSel(c) ? ' sel' : ''}`}
          style={{ background: c }}
          title={c.toUpperCase()}
          onClick={() => onPick(c)}
        >
          <button className="swatch-del" title="Remove" onClick={(e) => { e.stopPropagation(); onDelete(c) }}>×</button>
        </div>
      ))}
      <label className="swatch custom" title="Custom color">
        <span className="custom-plus">+</span>
        <input type="color" value={value} onChange={onCustom} />
      </label>
    </div>
  )
}
