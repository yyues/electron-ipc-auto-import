import { unplugin } from './unplugin'

export { unplugin, unpluginFactory } from './unplugin'
export * from './types'

// Low-level building blocks, handy for debugging and programmatic use
// (e.g. the playground): scan + generate without a bundler.
export { IpcContext, getContext } from './core/context'
export type { GeneratedShape } from './core/context'
export { resolveOptions } from './core/options'

/**
 * The universal unplugin instance. Prefer a framework subpath import
 * (`electron-ipc-auto-import/vite`) in app code; this export is handy for
 * programmatic use: `import ipc from 'electron-ipc-auto-import'; ipc.vite()`.
 */
export default unplugin
