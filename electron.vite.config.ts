import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const alias = { '@shared': resolve('shared'), '@': resolve('src') }

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()], build: { lib: { entry: 'electron/main.ts' } }, resolve: { alias } },
  preload: { plugins: [externalizeDepsPlugin()], build: { lib: { entry: 'electron/preload.ts' } }, resolve: { alias } },
  renderer: {
    root: 'src',
    resolve: { alias },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          home: resolve('src/windows/home/index.html'),
          compositor: resolve('src/windows/compositor/index.html'),
          bubble: resolve('src/windows/bubble/index.html'),
          toolbar: resolve('src/windows/toolbar/index.html'),
          region: resolve('src/windows/region/index.html'),
          editor: resolve('src/windows/editor/index.html'),
          annotation: resolve('src/windows/annotation/index.html')
        }
      }
    }
  }
})
