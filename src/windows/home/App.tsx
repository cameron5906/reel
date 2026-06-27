import { useEffect, useState } from 'react'
import type { DisplayInfo, RecordingSettings } from '@shared/types'
import { defaultSettings } from '@/store/settings'
import { useMediaDevices } from './hooks/useMediaDevices'
import { SourcePicker } from './components/SourcePicker'
import { DevicePicker } from './components/DevicePicker'
import { Library } from './components/Library'
import './home.css'

export function App() {
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [settings, setSettings] = useState<RecordingSettings>(defaultSettings)
  const { mics, cams } = useMediaDevices()

  useEffect(() => { window.reel.getDisplays().then(setDisplays) }, [])

  function update(patch: Partial<RecordingSettings>) {
    setSettings((s) => ({ ...s, ...patch }))
  }

  async function startRecording() {
    await window.reel.startRecording(settings)
  }

  return (
    <div className="home">
      <h1>Reel</h1>

      <section>
        <h2>Capture</h2>
        <SourcePicker displays={displays} target={settings.target} onChange={(target) => update({ target })} />
      </section>

      <section className="grid">
        <DevicePicker label="Camera" devices={cams} value={settings.webcamDeviceId}
          allowNone onChange={(id) => update({ webcamDeviceId: id, bubble: { ...settings.bubble, enabled: !!id } })} />
        <DevicePicker label="Microphone" devices={mics} value={settings.micDeviceId}
          allowNone onChange={(micDeviceId) => update({ micDeviceId })} />
        <label className="field check">
          <input type="checkbox" checked={settings.systemAudio}
            onChange={(e) => update({ systemAudio: e.target.checked })} />
          <span>System audio</span>
        </label>
      </section>

      <button className="record" disabled={displays.length === 0} onClick={startRecording}>
        ● Record
      </button>

      <section>
        <h2>Recordings</h2>
        <Library />
      </section>
    </div>
  )
}
