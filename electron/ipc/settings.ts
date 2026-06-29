import { ipcMain } from 'electron'
import type { RecordingSettings } from '@shared/types'
import { store } from '../store'

export function registerSettingsHandlers() {
  ipcMain.handle('settings:get', () => store.get<RecordingSettings>('recordingSettings') ?? null)
  ipcMain.on('settings:set', (_e, settings: RecordingSettings) => {
    store.set('recordingSettings', settings)
  })
}
