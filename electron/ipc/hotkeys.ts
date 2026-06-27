import { globalShortcut } from 'electron'
import { registry } from '../windows/registry'

const STOP_ACCELERATOR = 'CommandOrControl+Shift+S'

export function registerStopHotkey() {
  globalShortcut.register(STOP_ACCELERATOR, () => {
    registry.get('compositor')?.webContents.send('recorder:cmd', { type: 'stop' })
    registry.close('bubble')
    registry.close('toolbar')
  })
}

export function unregisterStopHotkey() {
  globalShortcut.unregister(STOP_ACCELERATOR)
}
