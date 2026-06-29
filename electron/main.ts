import { app, BrowserWindow, Menu, globalShortcut } from 'electron'
import { join } from 'node:path'
import { registerSourceHandlers } from './ipc/sources'
import { registerRecordingHandlers } from './ipc/recording'
import { registerFileHandlers } from './ipc/files'
import { registerSettingsHandlers } from './ipc/settings'
import { registerWindowControls } from './ipc/window-controls'
import { registry } from './windows/registry'
import { store } from './store'

const isDev = !!process.env['ELECTRON_RENDERER_URL']

interface Bounds { x: number; y: number; width: number; height: number }

function createHome() {
  const saved = store.get<Bounds>('homeBounds')
  const win = new BrowserWindow({
    width: saved?.width ?? 1040,
    height: saved?.height ?? 720,
    x: saved?.x,
    y: saved?.y,
    minWidth: 920,
    minHeight: 640,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  registry.set('home', win)

  const sendMax = () => win.webContents.send('window:maximized', win.isMaximized())
  win.on('maximize', sendMax)
  win.on('unmaximize', sendMax)
  win.on('close', () => {
    if (!win.isDestroyed() && !win.isMaximized()) store.set('homeBounds', win.getBounds())
  })

  if (isDev) win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/windows/home/index.html`)
  else win.loadFile(join(__dirname, '../renderer/windows/home/index.html'))
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const home = registry.get('home')
    if (home) {
      if (home.isMinimized()) home.restore()
      home.focus()
    }
  })

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null)
    registerSourceHandlers()
    registerRecordingHandlers()
    registerFileHandlers()
    registerSettingsHandlers()
    registerWindowControls()
    createHome()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createHome()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => globalShortcut.unregisterAll())
