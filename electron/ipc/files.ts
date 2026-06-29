import { app, ipcMain, dialog, shell, clipboard, BrowserWindow } from 'electron'
import { writeFile, readdir, stat, unlink, mkdir } from 'node:fs/promises'
import { join, basename } from 'node:path'
import type { SaveRequest, SaveResult, RecordingMeta } from '@shared/types'
import { buildTranscodeArgs, buildThumbnailArgs } from '../../src/lib/ffmpeg-args'
import { sanitizeFilename } from '../../src/lib/paths'
import { runFfmpeg } from '../ffmpeg/run'

function libraryDir(): string {
  return join(app.getPath('videos'), 'Reel')
}

export function registerFileHandlers() {
  ipcMain.handle('files:writeTemp', async (_e, bytes: Uint8Array, ext: 'mp4' | 'webm' = 'webm') => {
    const tempPath = join(app.getPath('temp'), `reel-${process.hrtime.bigint()}.${ext}`)
    await writeFile(tempPath, Buffer.from(bytes))
    return tempPath
  })

  ipcMain.handle('files:save', async (e, req: SaveRequest): Promise<SaveResult> => {
    await mkdir(libraryDir(), { recursive: true })
    const ext = req.format
    const defaultPath = join(libraryDir(), `${sanitizeFilename(req.suggestedName)}.${ext}`)
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
    })
    if (canceled || !filePath) return { saved: false }

    const win = BrowserWindow.fromWebContents(e.sender)
    const sourceIsMp4 = req.tempPath.toLowerCase().endsWith('.mp4')
    const base = {
      input: req.tempPath, output: filePath, format: req.format,
      trimStart: req.trimStart, trimEnd: req.trimEnd,
      height: req.height, sourceIsMp4
    }
    const total = req.durationSec ?? ((req.trimEnd ?? 0) - (req.trimStart ?? 0))
    const onProgress = (sec: number) => {
      if (total > 0) win?.webContents.send('export:progress', Math.min(99, Math.round((sec / total) * 100)))
    }
    // Try GPU (NVENC) first for any re-encode; fall back to libx264 if it's unavailable.
    // (The copy fast-path ignores the encoder, so this is a no-op there.)
    try {
      await runFfmpeg(buildTranscodeArgs({ ...base, videoEncoder: 'nvenc' }), onProgress)
    } catch {
      await runFfmpeg(buildTranscodeArgs({ ...base, videoEncoder: 'x264' }), onProgress)
    }

    // best-effort thumbnail (a little way in, so it isn't a black first frame)
    try {
      const thumb = filePath.replace(/\.[^.]+$/, '.jpg')
      const at = Math.max(0.5, Math.min(3, (req.durationSec ?? 4) * 0.2))
      await runFfmpeg(buildThumbnailArgs(filePath, thumb, at))
    } catch { /* ignore */ }

    win?.webContents.send('export:progress', 100)
    return { saved: true, path: filePath }
  })

  ipcMain.handle('files:list', async (): Promise<RecordingMeta[]> => {
    await mkdir(libraryDir(), { recursive: true })
    const entries = await readdir(libraryDir())
    const vids = entries.filter((f) => f.endsWith('.mp4') || f.endsWith('.webm'))
    const metas = await Promise.all(vids.map(async (f) => {
      const path = join(libraryDir(), f)
      const s = await stat(path)
      const thumb = join(libraryDir(), f.replace(/\.[^.]+$/, '.jpg'))
      let thumbnailPath: string | null = null
      try {
        await stat(thumb)
        thumbnailPath = thumb
      } catch {
        // No thumbnail yet (save-time failure, or a file added outside the app) — make one.
        try {
          await runFfmpeg(buildThumbnailArgs(path, thumb, 1))
          await stat(thumb)
          thumbnailPath = thumb
        } catch { /* leave null; UI shows a placeholder */ }
      }
      return { path, name: basename(f), thumbnailPath, durationSec: null, createdMs: s.birthtimeMs, sizeBytes: s.size }
    }))
    return metas.sort((a, b) => b.createdMs - a.createdMs)
  })

  ipcMain.handle('files:delete', async (_e, path: string) => { await unlink(path).catch(() => {}) })
  ipcMain.on('files:reveal', (_e, path: string) => { shell.showItemInFolder(path) })
  ipcMain.handle('files:copy', async (_e, path: string) => {
    // Copies the file path to the clipboard; Reveal-in-Explorer covers drag-to-share
    clipboard.writeText(path)
  })
}
