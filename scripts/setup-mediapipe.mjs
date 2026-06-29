// Copies the MediaPipe vision WASM runtime out of node_modules into the
// renderer's public folder so it's served locally at runtime. Runs on
// postinstall. The segmentation model itself is committed (it's small and
// not shipped in the npm package), so no network access is needed here.
import { mkdirSync, copyFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
const dest = join(root, 'src', 'public', 'mediapipe', 'wasm')

if (!existsSync(src)) {
  console.warn('[reel] @mediapipe/tasks-vision not installed yet; skipping wasm copy.')
  process.exit(0)
}

mkdirSync(dest, { recursive: true })
for (const file of readdirSync(src)) {
  copyFileSync(join(src, file), join(dest, file))
}
console.log('[reel] MediaPipe wasm runtime ready.')
