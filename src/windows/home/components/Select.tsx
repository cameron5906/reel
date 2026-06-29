interface Option { value: string; label: string }

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
}

export function Select({ label, value, onChange, options, placeholder }: Props) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <div className="select-wrap">
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <svg className="chev" width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </label>
  )
}
