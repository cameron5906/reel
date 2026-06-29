import { useAudioLevel } from '../hooks/useAudioLevel'

export function AudioMeter({ deviceId }: { deviceId: string | null }) {
  const level = useAudioLevel(deviceId)
  const pct = Math.round(level * 100)
  const color = level > 0.85 ? '#f2555a' : level > 0.6 ? '#f5b945' : '#3ddc97'
  return (
    <div className="meter" title="Microphone input level">
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}
