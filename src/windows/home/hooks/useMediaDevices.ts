import { useEffect, useState } from 'react'

export interface DeviceList { mics: MediaDeviceInfo[]; cams: MediaDeviceInfo[] }

export function useMediaDevices(): DeviceList {
  const [devices, setDevices] = useState<DeviceList>({ mics: [], cams: [] })
  useEffect(() => {
    async function load() {
      // Prompt once so device labels are populated.
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        s.getTracks().forEach((t) => t.stop())
      } catch { /* user can still pick "none" */ }
      const all = await navigator.mediaDevices.enumerateDevices()
      setDevices({
        mics: all.filter((d) => d.kind === 'audioinput'),
        cams: all.filter((d) => d.kind === 'videoinput')
      })
    }
    load()
    navigator.mediaDevices.addEventListener('devicechange', load)
    return () => navigator.mediaDevices.removeEventListener('devicechange', load)
  }, [])
  return devices
}
