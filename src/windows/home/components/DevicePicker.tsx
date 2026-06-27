interface Props {
  label: string
  devices: MediaDeviceInfo[]
  value: string | null
  onChange: (id: string | null) => void
  allowNone?: boolean
}

export function DevicePicker({ label, devices, value, onChange, allowNone }: Props) {
  return (
    <label className="field">
      <span>{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      >
        {allowNone && <option value="">None</option>}
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || 'Unnamed device'}
          </option>
        ))}
      </select>
    </label>
  )
}
