import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'

const isDev = !!process.env['ELECTRON_RENDERER_URL']

function createHome() {
  const win = new BrowserWindow({
    width: 980,
    height: 680,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  if (isDev) win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/windows/home/index.html`)
  else win.loadFile(join(__dirname, '../renderer/windows/home/index.html'))
}

app.whenReady().then(() => {
  createHome()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createHome()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
