import { BrowserWindow } from 'electron'
import type { Rect } from '@shared/types'
import { registry } from './registry'

const MARGIN = 2 // px; the outline sits in this margin just outside the captured region

export function createRegionOutlineWindow(rect: Rect): BrowserWindow {
  const win = new BrowserWindow({
    x: rect.x - MARGIN,
    y: rect.y - MARGIN,
    width: rect.width + MARGIN * 2,
    height: rect.height + MARGIN * 2,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setIgnoreMouseEvents(true)

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    html, body { margin: 0; height: 100%; background: transparent; overflow: hidden; }
    .frame {
      box-sizing: border-box;
      width: 100vw; height: 100vh;
      border: ${MARGIN}px solid rgba(120, 170, 255, .7);
      border-radius: 3px;
    }
  </style></head><body><div class="frame"></div></body></html>`
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))

  registry.set('region-outline', win)
  return win
}
