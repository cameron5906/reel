import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { registry } from './registry'

export function createToolbarWindow(): BrowserWindow {
  const primary = screen.getPrimaryDisplay()
  const width = 280, height = 56
  const win = new BrowserWindow({
    width, height,
    x: primary.bounds.x + Math.round((primary.bounds.width - width) / 2),
    y: primary.bounds.y + primary.bounds.height - height - 24,
    frame: false, transparent: true, resizable: false,
    alwaysOnTop: true, skipTaskbar: true, hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true, nodeIntegration: false
    }
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  const isDev = !!process.env['ELECTRON_RENDERER_URL']
  if (isDev) win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/windows/toolbar/index.html`)
  else win.loadFile(join(__dirname, '../renderer/windows/toolbar/index.html'))
  registry.set('toolbar', win)
  return win
}
