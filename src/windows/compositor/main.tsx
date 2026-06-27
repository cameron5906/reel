import { RecorderEngine } from '@/recorder/engine'

const engine = new RecorderEngine()

const off = window.reel.onRecorderCommand(async (cmd) => {
  if (cmd.type === 'start') {
    try { await engine.start(cmd) } catch (err) { console.error('start failed', err) }
  } else if (cmd.type === 'stop') {
    const { blob, durationSec } = await engine.stop()
    const buf = new Uint8Array(await blob.arrayBuffer())
    const tempPath = await window.reel.writeTemp(buf)
    window.reel.recordingFinished(tempPath, durationSec)
  }
})
window.addEventListener('beforeunload', off)
