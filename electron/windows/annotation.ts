import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import type { Rect } from '@shared/types'
import { registry } from './registry'

export function createAnnotationWindow(bounds: Rect): BrowserWindow {
  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  // Above app windows so annotations draw over them, but below the toolbar/bubble
  // (screen-saver level) so those stay clickable while drawing.
  win.setAlwaysOnTop(true, 'pop-up-menu')
  win.setIgnoreMouseEvents(true, { forward: true }) // start click-through (draw off)

  const isDev = !!process.env['ELECTRON_RENDERER_URL']
  if (isDev) win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/windows/annotation/index.html`)
  else win.loadFile(join(__dirname, '../renderer/windows/annotation/index.html'))

  registry.set('annotation', win)
  return win
}
