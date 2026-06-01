import { createUnplugin, type UnpluginFactory } from 'unplugin'
import type { Options } from './types'
import { VIRTUAL_MAIN, VIRTUAL_PRELOAD } from './types'
import { getContext, type IpcContext } from './core/context'

const RESOLVED_MAIN = `\0${VIRTUAL_MAIN}`
const RESOLVED_PRELOAD = `\0${VIRTUAL_PRELOAD}`

function isVirtual(id: string): boolean {
  return id === VIRTUAL_MAIN || id === VIRTUAL_PRELOAD
}

export const unpluginFactory: UnpluginFactory<Options | undefined> = (
  rawOptions = {},
) => {
  // Mutable copy so Vite can inject the resolved root before the context is created.
  const options: Options = { ...rawOptions }
  let ctx: IpcContext | undefined

  const ensureContext = (): IpcContext => {
    if (!ctx) ctx = getContext(options)
    return ctx
  }

  return {
    name: 'electron-ipc-auto-import',
    enforce: 'pre',

    async buildStart() {
      const context = ensureContext()
      await context.scan()
      await context.writeDts()
    },

    resolveId(id) {
      if (id === VIRTUAL_MAIN) return RESOLVED_MAIN
      if (id === VIRTUAL_PRELOAD) return RESOLVED_PRELOAD
      return null
    },

    loadInclude(id) {
      return id === RESOLVED_MAIN || id === RESOLVED_PRELOAD
    },

    async load(id) {
      if (id !== RESOLVED_MAIN && id !== RESOLVED_PRELOAD) return null
      const generated = await ensureContext().getGenerated()
      return id === RESOLVED_MAIN ? generated.main : generated.preload
    },

    async watchChange(id, change) {
      const context = ensureContext()
      const changed =
        change.event === 'delete'
          ? context.removeFile(id)
          : context.updateFile(id)
      if (changed) await context.writeDts()
    },

    vite: {
      // NOTE: we intentionally do NOT adopt `config.root` here. Under
      // electron-vite each target (main/preload/renderer) has a *different*
      // root (e.g. `src/renderer`), which would resolve `dirs` inconsistently
      // and let one target overwrite the dts with an empty manifest. The
      // project root is `options.root` (if set) or `process.cwd()`.
      configureServer(server) {
        const context = ensureContext()
        // Watch scan dirs so handler changes regenerate the dts and invalidate
        // the virtual modules even when they aren't in the renderer graph.
        server.watcher.add(context.options.dirs)

        const onChange = async (file: string, event: 'update' | 'delete') => {
          const changed =
            event === 'delete'
              ? context.removeFile(file)
              : context.isScanned(file) && context.updateFile(file)
          if (!changed) return
          await context.writeDts()
          for (const id of [RESOLVED_MAIN, RESOLVED_PRELOAD]) {
            const mod = server.moduleGraph.getModuleById(id)
            if (mod) server.reloadModule(mod).catch(() => {})
          }
        }

        server.watcher.on('add', (f) => void onChange(f, 'update'))
        server.watcher.on('change', (f) => void onChange(f, 'update'))
        server.watcher.on('unlink', (f) => void onChange(f, 'delete'))
      },
    },
  }
}

export const unplugin = /* #__PURE__ */ createUnplugin(unpluginFactory)

export default unplugin
