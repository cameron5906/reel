import { ipcMain, screen, desktopCapturer } from 'electron'
import type { DisplayInfo } from '@shared/types'
import { selectRegion } from '../windows/region'

export function registerSourceHandlers() {
  ipcMain.handle('region:select', () => selectRegion())

  ipcMain.handle('sources:displays', async (): Promise<DisplayInfo[]> => {
    const displays = screen.getAllDisplays()
    const sources = await desktopCapturer.getSources({ types: ['screen'] })
    return displays.map((d, i) => {
      // desktopCapturer screen source ids look like "screen:<display_id>:0"
      const match = sources.find((s) => s.display_id === String(d.id)) ?? sources[i]
      return {
        id: d.id,
        label: d.label || `Display ${i + 1}`,
        bounds: { x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height },
        scaleFactor: d.scaleFactor,
        sourceId: match?.id ?? ''
      }
    })
  })
}
