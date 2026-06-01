import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import electronIpc from 'electron-ipc-auto-import/vite'

const projectRoot = import.meta.dirname

// One plugin instance per build target; the library shares a single context
// across them via its internal singleton, so the scan/manifest stay in sync.
const ipcPlugin = () =>
  electronIpc({
    // Pin the project root so every build target resolves dirs/dts identically.
    root: projectRoot,
    dirs: ['src/main/ipc'],
    dts: resolve(projectRoot, 'src/preload/ipc-auto-import.d.ts'),
    bridgeName: 'ipc',
  })

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), ipcPlugin()],
  },
  preload: {
    // Sandboxed preloads must be CommonJS and self-contained: bundle the
    // runtime (don't externalize it) and emit a `.cjs` so Electron can load it.
    plugins: [
      externalizeDepsPlugin({ exclude: ['electron-ipc-auto-import'] }),
      ipcPlugin(),
    ],
    build: {
      rollupOptions: {
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    plugins: [ipcPlugin()],
  },
})
