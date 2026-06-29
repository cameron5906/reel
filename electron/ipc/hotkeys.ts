import { globalShortcut } from 'electron'
import type { SceneMode } from '@shared/types'
import { registry } from '../windows/registry'
import { toggleFollow } from './cursor-follow'

const STOP_ACCELERATOR = 'CommandOrControl+Shift+S'
const FLIP_ACCELERATOR = 'CommandOrControl+Shift+F'
const DRAW_ACCELERATOR = 'CommandOrControl+Shift+D'
const FOLLOW_ACCELERATOR = 'CommandOrControl+Shift+Q'

const SCENE_ACCELERATORS: Record<string, SceneMode> = {
  'CommandOrControl+Shift+1': 'both',
  'CommandOrControl+Shift+2': 'screen',
  'CommandOrControl+Shift+3': 'camera'
}

export function applyScene(mode: SceneMode) {
  registry.get('compositor')?.webContents.send('recorder:cmd', { type: 'scene', mode })
  const bubble = registry.get('bubble')
  if (bubble) {
    if (mode === 'both') bubble.showInactive()
    else bubble.hide()
  }
  registry.broadcast('scene:changed', mode)
}

let currentFlip = true

export function setInitialFlip(value: boolean) {
  currentFlip = value
}

export function getCurrentFlip() {
  return currentFlip
}

export function applyFlip(value: boolean) {
  currentFlip = value
  registry.get('compositor')?.webContents.send('recorder:cmd', { type: 'flip', value })
  registry.broadcast('flip:changed', value)
}

let currentDraw = false

export function setInitialDraw(value: boolean) {
  currentDraw = value
}

export function applyDraw(on: boolean) {
  currentDraw = on
  const ann = registry.get('annotation')
  if (ann) {
    if (on) ann.setIgnoreMouseEvents(false)
    else ann.setIgnoreMouseEvents(true, { forward: true })
  }
  registry.broadcast('draw:changed', on)
}

export function registerDrawHotkey() {
  globalShortcut.register(DRAW_ACCELERATOR, () => applyDraw(!currentDraw))
}

export function unregisterDrawHotkey() {
  globalShortcut.unregister(DRAW_ACCELERATOR)
}

export function registerFollowHotkey() {
  globalShortcut.register(FOLLOW_ACCELERATOR, () => toggleFollow(currentFlip, applyFlip))
}

export function unregisterFollowHotkey() {
  globalShortcut.unregister(FOLLOW_ACCELERATOR)
}

export function registerStopHotkey() {
  globalShortcut.register(STOP_ACCELERATOR, () => {
    registry.get('compositor')?.webContents.send('recorder:cmd', { type: 'stop' })
    registry.closeRecordingOverlays()
  })
}

export function unregisterStopHotkey() {
  globalShortcut.unregister(STOP_ACCELERATOR)
}

export function registerSceneHotkeys() {
  for (const [accelerator, mode] of Object.entries(SCENE_ACCELERATORS)) {
    globalShortcut.register(accelerator, () => applyScene(mode))
  }
  globalShortcut.register(FLIP_ACCELERATOR, () => applyFlip(!currentFlip))
}

export function unregisterSceneHotkeys() {
  for (const accelerator of Object.keys(SCENE_ACCELERATORS)) {
    globalShortcut.unregister(accelerator)
  }
  globalShortcut.unregister(FLIP_ACCELERATOR)
}
