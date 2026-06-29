import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { registry } from './registry'

export function createToolbarWindow(hasCam: boolean, flip: boolean): BrowserWindow {
  const primary = screen.getPrimaryDisplay()
  const width = hasCam ? 524 : 328, height = 56
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
  win.setContentProtection(true) // keep the control bar out of the recording
  const isDev = !!process.env['ELECTRON_RENDERER_URL']
  const search = `cam=${hasCam ? '1' : '0'}&flip=${flip ? '1' : '0'}`
  if (isDev) win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/windows/toolbar/index.html?${search}`)
  else win.loadFile(join(__dirname, '../renderer/windows/toolbar/index.html'), { search })
  registry.set('toolbar', win)
  return win
}
