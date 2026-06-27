import { app, ipcMain } from 'electron'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { RecordingSettings, DisplayInfo } from '@shared/types'
import { registry } from '../windows/registry'
import { createCompositorWindow } from '../windows/compositor'
import { createBubbleWindow } from '../windows/bubble'
import { createToolbarWindow } from '../windows/toolbar'

export function registerRecordingHandlers() {
  ipcMain.handle('recording:start', async (_e, settings: RecordingSettings) => {
    const { screen, desktopCapturer } = await import('electron')
    const displays = screen.getAllDisplays()
    const display = displays.find((d) => d.id === settings.target.displayId) ?? displays[0]
    const sources = await desktopCapturer.getSources({ types: ['screen'] })
    const source = sources.find((s) => s.display_id === String(display.id)) ?? sources[0]

    const info: DisplayInfo = {
      id: display.id,
      label: display.label,
      bounds: display.bounds,
      scaleFactor: display.scaleFactor,
      sourceId: source.id
    }

    if (settings.bubble.enabled && settings.webcamDeviceId) {
      createBubbleWindow(settings.bubble.sizePx, settings.webcamDeviceId)
    }

    const comp = createCompositorWindow()
    const send = () => comp.webContents.send('recorder:cmd',
      { type: 'start', settings, sourceId: source.id, display: info })
    if (comp.webContents.isLoading()) comp.webContents.once('did-finish-load', send)
    else send()

    createToolbarWindow()
  })

  ipcMain.handle('recording:stop', async () => {
    registry.get('compositor')?.webContents.send('recorder:cmd', { type: 'stop' })
    registry.close('bubble')
    registry.close('toolbar')
  })

  ipcMain.on('recorder:cmd', (_e, cmd) => {
    registry.get('compositor')?.webContents.send('recorder:cmd', cmd)
  })

  ipcMain.handle('files:writeTemp', async (_e, bytes: Uint8Array) => {
    const tempPath = join(app.getPath('temp'), `reel-${process.hrtime.bigint()}.webm`)
    await writeFile(tempPath, Buffer.from(bytes))
    return tempPath
  })

  ipcMain.on('recording:finished', (_e, payload: { tempPath: string; durationSec: number }) => {
    registry.broadcast('recording:finished', payload)
  })
}
