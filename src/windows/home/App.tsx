import { useEffect, useRef, useState } from 'react'
import type { DisplayInfo, RecordingSettings } from '@shared/types'
import { defaultSettings } from '@/store/settings'
import { useMediaDevices } from './hooks/useMediaDevices'
import { SourcePicker } from './components/SourcePicker'
import { Select } from './components/Select'
import { WebcamPreview } from './components/WebcamPreview'
import { AudioMeter } from './components/AudioMeter'
import { BackgroundControls } from './components/BackgroundControls'
import { CursorFollowControls } from './components/CursorFollowControls'
import { Library } from './components/Library'
import { TitleBar } from './components/TitleBar'
import './home.css'

export function App() {
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [settings, setSettings] = useState<RecordingSettings | null>(null)
  const [maximized, setMaximized] = useState(false)
  const { mics, cams } = useMediaDevices()
  const validated = useRef(false)

  useEffect(() => { window.reel.getDisplays().then(setDisplays) }, [])
  useEffect(() => window.reel.onMaximizeChange(setMaximized), [])

  useEffect(() => {
    window.reel.getSettings().then((saved) => {
      setSettings(saved ? {
        ...defaultSettings,
        ...saved,
        bubble: { ...defaultSettings.bubble, ...saved.bubble },
        cameraFrame: { ...defaultSettings.cameraFrame, ...saved.cameraFrame },
        cursorFollow: { ...defaultSettings.cursorFollow, ...saved.cursorFollow },
        background: { ...defaultSettings.background, ...saved.background },
        savedColors: saved.savedColors ?? defaultSettings.savedColors
      } : defaultSettings)
    })
  }, [])

  // Drop saved device ids that no longer exist, once devices have loaded.
  useEffect(() => {
    if (validated.current || !settings) return
    if (cams.length === 0 && mics.length === 0) return
    validated.current = true
    setSettings((s) => {
      if (!s) return s
      let next = s
      if (s.webcamDeviceId && !cams.some((c) => c.deviceId === s.webcamDeviceId)) {
        next = { ...next, webcamDeviceId: null, bubble: { ...next.bubble, enabled: false } }
      }
      if (s.micDeviceId && !mics.some((m) => m.deviceId === s.micDeviceId)) {
        next = { ...next, micDeviceId: null }
      }
      return next
    })
  }, [cams, mics, settings])

  function update(patch: Partial<RecordingSettings>) {
    setSettings((s) => {
      const next = { ...(s as RecordingSettings), ...patch }
      window.reel.saveSettings(next)
      return next
    })
  }

  if (!settings) {
    return (
      <div className="root">
        <div className="card"><div className="loading">Loading…</div></div>
      </div>
    )
  }

  const camOptions = cams.map((c) => ({ value: c.deviceId, label: c.label || 'Camera' }))
  const micOptions = mics.map((m) => ({ value: m.deviceId, label: m.label || 'Microphone' }))

  return (
    <div className={maximized ? 'root maximized' : 'root'}>
      <div className="card">
        <TitleBar maximized={maximized} />
        <main className="home">
          <div className="stage">
        <div className="pane preview-pane">
          <WebcamPreview
            deviceId={settings.webcamDeviceId}
            frame={settings.cameraFrame}
            background={settings.background}
            flipped={settings.cameraFlip}
            onFrameChange={(cameraFrame) => update({ cameraFrame })}
          />
          <button
            className="record"
            disabled={displays.length === 0}
            onClick={() => window.reel.startRecording(settings)}
          >
            <span className="rec-dot" />
            Record
          </button>
        </div>

        <div className="pane setup-pane">
          <SourcePicker
            displays={displays}
            target={settings.target}
            onChange={(target) => update({ target })}
          />

          <Select
            label="Camera"
            value={settings.webcamDeviceId ?? ''}
            placeholder="None"
            options={camOptions}
            onChange={(id) =>
              update({ webcamDeviceId: id || null, bubble: { ...settings.bubble, enabled: !!id } })
            }
          />

          <div className="mic-group">
            <Select
              label="Microphone"
              value={settings.micDeviceId ?? ''}
              placeholder="None"
              options={micOptions}
              onChange={(id) => update({ micDeviceId: id || null })}
            />
            <AudioMeter deviceId={settings.micDeviceId} />
          </div>

          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.systemAudio}
              onChange={(e) => update({ systemAudio: e.target.checked })}
            />
            <span className="toggle-track"><span className="toggle-thumb" /></span>
            <span className="toggle-label">System audio</span>
          </label>

          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.cameraFlip}
              onChange={(e) => update({ cameraFlip: e.target.checked })}
            />
            <span className="toggle-track"><span className="toggle-thumb" /></span>
            <span className="toggle-label">Flip camera (mirror)</span>
          </label>

          <BackgroundControls
            value={settings.background}
            savedColors={settings.savedColors}
            onChange={(background) => update({ background })}
            onSavedColorsChange={(savedColors) => update({ savedColors })}
          />

          <CursorFollowControls
            value={settings.cursorFollow}
            onChange={(cursorFollow) => update({ cursorFollow })}
          />
        </div>
      </div>

          <Library />
        </main>
      </div>
    </div>
  )
}
