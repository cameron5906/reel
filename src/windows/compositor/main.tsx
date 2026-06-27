import { RecorderEngine } from '@/recorder/engine'

const engine = new RecorderEngine()

const off = window.reel.onRecorderCommand(async (cmd) => {
  if (cmd.type === 'start') {
    try { await engine.start(cmd) } catch (err) {
      await engine.stop().catch(() => {})
      window.reel.abortRecording(err instanceof Error ? err.message : String(err))
    }
  } else if (cmd.type === 'pause') {
    engine.pause()
  } else if (cmd.type === 'resume') {
    engine.resume()
  } else if (cmd.type === 'stop') {
    const { blob, durationSec } = await engine.stop()
    const buf = new Uint8Array(await blob.arrayBuffer())
    const tempPath = await window.reel.writeTemp(buf)
    window.reel.recordingFinished(tempPath, durationSec)
  }
})
window.addEventListener('beforeunload', off)
