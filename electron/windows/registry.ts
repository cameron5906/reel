import type { BrowserWindow } from 'electron'

const windows = new Map<string, BrowserWindow>()

export const registry = {
  set(name: string, win: BrowserWindow) {
    windows.set(name, win)
    win.on('closed', () => windows.delete(name))
  },
  get(name: string): BrowserWindow | undefined {
    return windows.get(name)
  },
  close(name: string) {
    windows.get(name)?.close()
  },
  broadcast(channel: string, payload: unknown) {
    for (const win of windows.values()) {
      if (!win.isDestroyed()) win.webContents.send(channel, payload)
    }
  }
}
