export function mixAudio(sources: MediaStream[]): { track: MediaStreamTrack; close: () => void } {
  const ctx = new AudioContext()
  const dest = ctx.createMediaStreamDestination()
  for (const s of sources) {
    if (s.getAudioTracks().length === 0) continue
    ctx.createMediaStreamSource(s).connect(dest)
  }
  return {
    track: dest.stream.getAudioTracks()[0],
    close: () => { ctx.close().catch(() => {}) }
  }
}
