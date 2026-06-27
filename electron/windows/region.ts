import { BrowserWindow, screen, ipcMain } from 'electron'
import { join } from 'node:path'
import type { Rect } from '@shared/types'

export function selectRegion(): Promise<Rect | null> {
  return new Promise((resolve) => {
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    const win = new BrowserWindow({
      x: display.bounds.x, y: display.bounds.y,
      width: display.bounds.width, height: display.bounds.height,
      frame: false, transparent: true, alwaysOnTop: true,
      skipTaskbar: true, hasShadow: false, enableLargerThanScreen: true,
      webPreferences: {
        preload: join(__dirname, '../preload/preload.js'),
        contextIsolation: true, nodeIntegration: false
      }
    })
    win.setAlwaysOnTop(true, 'screen-saver')

    const done = (_e: unknown, rect: Rect | null) => {
      ipcMain.removeListener('region:done', done)
      if (rect) {
        // Renderer reports rect relative to overlay (0,0). Convert to screen coords.
        resolve({ x: rect.x + display.bounds.x, y: rect.y + display.bounds.y, width: rect.width, height: rect.height })
      } else resolve(null)
      if (!win.isDestroyed()) win.close()
    }
    ipcMain.on('region:done', done)

    const isDev = !!process.env['ELECTRON_RENDERER_URL']
    if (isDev) win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/windows/region/index.html`)
    else win.loadFile(join(__dirname, '../renderer/windows/region/index.html'))
  })
}
