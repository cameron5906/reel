import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('reel', {})
