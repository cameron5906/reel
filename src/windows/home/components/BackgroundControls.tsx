import type { BackgroundSettings } from '@shared/types'
import { ColorPalette } from './ColorPalette'

interface Props {
  value: BackgroundSettings
  savedColors: string[]
  onChange: (b: BackgroundSettings) => void
  onSavedColorsChange: (colors: string[]) => void
}

const MODES: { mode: BackgroundSettings['mode']; label: string }[] = [
  { mode: 'color', label: 'Color' },
  { mode: 'blur', label: 'Blur' },
  { mode: 'image', label: 'Image' }
]

export function BackgroundControls({ value, savedColors, onChange, onSavedColorsChange }: Props) {
  function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onChange({ ...value, mode: 'image', imageDataUrl: reader.result as string })
    reader.readAsDataURL(file)
  }

  return (
    <div className="bg-controls">
      <label className="toggle">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
        />
        <span className="toggle-track"><span className="toggle-thumb" /></span>
        <span className="toggle-label">Remove background</span>
      </label>

      {value.enabled && (
        <div className="bg-options">
          <div className="segmented small">
            {MODES.map((m) => (
              <button
                key={m.mode}
                className={value.mode === m.mode ? 'seg on' : 'seg'}
                onClick={() => onChange({ ...value, mode: m.mode })}
              >
                {m.label}
              </button>
            ))}
          </div>

          <label className="slider-row">
            <span className="slider-label">Cutout</span>
            <input
              type="range"
              min={0}
              max={0.9}
              step={0.02}
              value={value.segThreshold}
              onChange={(e) => onChange({ ...value, segThreshold: Number(e.target.value) })}
            />
          </label>

          {value.mode === 'color' && (
            <ColorPalette
              value={value.color}
              saved={savedColors}
              onPick={(c) => onChange({ ...value, color: c })}
              onSave={(c) => onSavedColorsChange([...savedColors, c])}
              onDelete={(c) => onSavedColorsChange(savedColors.filter((x) => x.toLowerCase() !== c.toLowerCase()))}
            />
          )}

          {value.mode === 'image' && (
            <div className="img-row">
              <span className="img-name">{value.imageDataUrl ? 'Image selected' : 'No image chosen'}</span>
              <label className="btn-file">
                Choose…
                <input type="file" accept="image/*" onChange={pickImage} hidden />
              </label>
              {value.imageDataUrl && (
                <button className="btn-clear" onClick={() => onChange({ ...value, imageDataUrl: null })}>Clear</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
