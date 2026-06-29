import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import type { Rect, CameraFrame } from '@shared/types'
import { registry } from './registry'

export function createBubbleWindow(sizePx: number, camId: string, anchor: Rect, frame: CameraFrame): BrowserWindow {
  const margin = 24
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi))
  const x = clamp(anchor.x + margin, anchor.x, anchor.x + anchor.width - sizePx)
  const y = clamp(
    anchor.y + anchor.height - sizePx - margin,
    anchor.y,
    anchor.y + anchor.height - sizePx
  )
  const win = new BrowserWindow({
    width: sizePx,
    height: sizePx,
    x,
    y,
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
  win.setContentProtection(true) // the engine composites the bubble; keep the on-screen preview out of capture

  const report = () => {
    const b = win.getBounds()
    registry.broadcast('bubble:bounds', { x: b.x, y: b.y, width: b.width, height: b.height })
  }
  win.on('move', report)
  win.on('resize', report)
  win.webContents.on('did-finish-load', report)

  const q = `cam=${encodeURIComponent(camId)}&zoom=${frame.zoom}&panX=${frame.panX}&panY=${frame.panY}`
  const isDev = !!process.env['ELECTRON_RENDERER_URL']
  if (isDev) win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/windows/bubble/index.html?${q}`)
  else win.loadFile(join(__dirname, '../renderer/windows/bubble/index.html'), { search: q })

  registry.set('bubble', win)
  return win
}
