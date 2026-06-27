import { useEffect, useRef } from 'react'

export function Bubble({ deviceId }: { deviceId?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    let stream: MediaStream
    navigator.mediaDevices
      .getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId } } : true })
      .then((s) => { stream = s; if (videoRef.current) videoRef.current.srcObject = s })
      .catch((e) => console.error('bubble cam failed', e))
    return () => stream?.getTracks().forEach((t) => t.stop())
  }, [deviceId])

  return <video ref={videoRef} autoPlay muted playsInline className="cam" />
}
