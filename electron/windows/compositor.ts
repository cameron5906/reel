import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { registry } from './registry'

export function createCompositorWindow(): BrowserWindow {
  const existing = registry.get('compositor')
  if (existing) return existing
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  })
  const isDev = !!process.env['ELECTRON_RENDERER_URL']
  if (isDev) win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/windows/compositor/index.html`)
  else win.loadFile(join(__dirname, '../renderer/windows/compositor/index.html'))
  registry.set('compositor', win)
  return win
}
