import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { registry } from './registry'

export function createBubbleWindow(sizePx: number, camId: string): BrowserWindow {
  const primary = screen.getPrimaryDisplay()
  const win = new BrowserWindow({
    width: sizePx,
    height: sizePx,
    x: primary.bounds.x + 60,
    y: primary.bounds.y + primary.bounds.height - sizePx - 80,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  win.setAlwaysOnTop(true, 'screen-saver')

  const report = () => {
    const b = win.getBounds()
    registry.broadcast('bubble:bounds', { x: b.x, y: b.y, width: b.width, height: b.height })
  }
  win.on('move', report)
  win.on('resize', report)
  win.webContents.on('did-finish-load', report)

  const isDev = !!process.env['ELECTRON_RENDERER_URL']
  if (isDev) win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/windows/bubble/index.html?cam=${encodeURIComponent(camId)}`)
  else win.loadFile(join(__dirname, '../renderer/windows/bubble/index.html'), { search: `cam=${encodeURIComponent(camId)}` })

  registry.set('bubble', win)
  return win
}
