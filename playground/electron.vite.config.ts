import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import electronIpc from 'electron-ipc-auto-import/vite'

const projectRoot = import.meta.dirname

// Playground is meant for breakpoint debugging the plugin itself, so we
// disable minification and emit sourcemaps for every target.
const ipcPlugin = () =>
  electronIpc({
    root: projectRoot,
    dirs: ['src/main/ipc'],
    dts: resolve(projectRoot, 'src/preload/ipc-auto-import.d.ts'),
    bridgeName: 'ipc',
    namespace: 'folder',
  })

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), ipcPlugin()],
    build: { sourcemap: true, minify: false },
  },
  preload: {
    // Sandboxed preloads must be CommonJS and self-contained: bundle the
    // runtime (don't externalize it) and emit a `.cjs` so Electron can load it.
    plugins: [
      externalizeDepsPlugin({ exclude: ['electron-ipc-auto-import'] }),
      ipcPlugin(),
    ],
    build: {
      sourcemap: 'inline',
      minify: false,
      rollupOptions: {
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    plugins: [vue(), ipcPlugin()],
    build: { sourcemap: true, minify: false },
  },
})
