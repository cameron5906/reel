import { ipcMain, dialog } from 'electron'
import type { RecordingSettings, DisplayInfo } from '@shared/types'
import { registry } from '../windows/registry'
import { createCompositorWindow } from '../windows/compositor'
import { createBubbleWindow } from '../windows/bubble'
import { createToolbarWindow } from '../windows/toolbar'
import { createRegionOutlineWindow } from '../windows/region-outline'
import { createCountdownWindow } from '../windows/countdown'
import { createAnnotationWindow } from '../windows/annotation'
import { createEditorWindow } from '../windows/editor'
import {
  registerStopHotkey, unregisterStopHotkey,
  registerSceneHotkeys, unregisterSceneHotkeys, applyScene,
  applyFlip, setInitialFlip, getCurrentFlip,
  applyDraw, setInitialDraw, registerDrawHotkey, unregisterDrawHotkey,
  registerFollowHotkey, unregisterFollowHotkey
} from './hotkeys'
import { setFollowConfig, setFollow, stopFollow } from './cursor-follow'

let pending: { settings: RecordingSettings; info: DisplayInfo } | null = null

function beginCapture(settings: RecordingSettings, info: DisplayInfo) {
  if (settings.bubble.enabled && settings.webcamDeviceId) {
    const anchor = settings.target.kind === 'region' ? settings.target.rect : info.bounds
    createBubbleWindow(settings.bubble.sizePx, settings.webcamDeviceId, anchor, settings.cameraFrame)
  }

  if (settings.target.kind === 'region') {
    createRegionOutlineWindow(settings.target.rect)
  }

  createAnnotationWindow(info.bounds)

  const comp = createCompositorWindow()
  const send = () => comp.webContents.send('recorder:cmd',
    { type: 'start', settings, sourceId: info.sourceId, display: info })
  if (comp.webContents.isLoading()) comp.webContents.once('did-finish-load', send)
  else send()

  const hasCam = !!(settings.bubble.enabled && settings.webcamDeviceId)
  setInitialFlip(settings.cameraFlip)
  setInitialDraw(false)
  setFollowConfig(settings.cursorFollow)
  createToolbarWindow(hasCam, settings.cameraFlip)
  registerStopHotkey()
  registerDrawHotkey()
  if (hasCam) {
    registerSceneHotkeys()
    registerFollowHotkey()
  }
}

function endSession() {
  stopFollow()
  unregisterStopHotkey()
  unregisterSceneHotkeys()
  unregisterDrawHotkey()
  unregisterFollowHotkey()
  registry.close('countdown')
  registry.closeRecordingOverlays()
  registry.get('home')?.show()
}

export function registerRecordingHandlers() {
  ipcMain.handle('recording:start', async (_e, settings: RecordingSettings) => {
    const { screen, desktopCapturer } = await import('electron')
    const displays = screen.getAllDisplays()
    const display = displays.find((d) => d.id === settings.target.displayId) ?? displays[0]
    const sources = await desktopCapturer.getSources({ types: ['screen'] })
    const source = sources.find((s) => s.display_id === String(display.id)) ?? sources[0]

    const info: DisplayInfo = {
      id: display.id,
      label: display.label,
      bounds: display.bounds,
      scaleFactor: display.scaleFactor,
      sourceId: source.id
    }

    registry.get('home')?.hide()
    pending = { settings, info }
    createCountdownWindow(display.bounds)
  })

  ipcMain.on('countdown:done', () => {
    registry.close('countdown')
    if (!pending) return
    const { settings, info } = pending
    pending = null
    beginCapture(settings, info)
  })

  ipcMain.handle('recording:stop', async () => {
    registry.get('compositor')?.webContents.send('recorder:cmd', { type: 'stop' })
    registry.closeRecordingOverlays()
  })

  ipcMain.on('recorder:cmd', (_e, cmd) => {
    registry.get('compositor')?.webContents.send('recorder:cmd', cmd)
  })

  ipcMain.on('recording:scene', (_e, mode) => applyScene(mode))
  ipcMain.on('recording:flip', (_e, value: boolean) => applyFlip(value))
  ipcMain.on('recording:draw', (_e, on: boolean) => applyDraw(on))
  ipcMain.on('recording:follow', (_e, on: boolean) => setFollow(on, getCurrentFlip(), applyFlip))

  ipcMain.on('recording:finished', (_e, payload: { tempPath: string; durationSec: number }) => {
    endSession()
    createEditorWindow(payload.tempPath, payload.durationSec)
  })

  ipcMain.on('recording:abort', (_e, message: string) => {
    pending = null
    endSession()
    dialog.showErrorBox('Recording failed', message)
  })
}
