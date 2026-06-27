import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { registry } from './registry'

export function createEditorWindow(tempPath: string, durationSec: number): BrowserWindow {
  const win = new BrowserWindow({
    width: 960, height: 720,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true, nodeIntegration: false,
      webSecurity: false   // allow file:// playback of the temp recording
    }
  })
  const q = `tempPath=${encodeURIComponent(tempPath)}&duration=${durationSec}`
  const isDev = !!process.env['ELECTRON_RENDERER_URL']
  if (isDev) win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/windows/editor/index.html?${q}`)
  else win.loadFile(join(__dirname, '../renderer/windows/editor/index.html'), { search: q })
  registry.set('editor', win)
  return win
}
