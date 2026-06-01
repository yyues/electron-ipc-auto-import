import { ipcRenderer } from 'electron'
import { decodeErrorMessage } from './shared'

type Invoker = (...args: unknown[]) => Promise<unknown>

/**
 * Build an invoker bound to a literal channel. The renderer can only call
 * channels for which an invoker was generated — it can never pass an arbitrary
 * channel string.
 */
export function createInvoker(channel: string): Invoker {
  return (...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args).catch((err: unknown) => {
      throw rehydrateError(err)
    })
}

/** Recursively freeze the exposed API object so the renderer cannot mutate it. */
export function freezeDeep<T>(obj: T): T {
  if (obj && typeof obj === 'object') {
    for (const value of Object.values(obj)) freezeDeep(value)
    Object.freeze(obj)
  }
  return obj
}

/**
 * Reconstruct a real Error from the tagged payload smuggled through Electron's
 * error message, restoring name/stack/custom fields. Falls back to the original
 * error when no payload is present.
 */
function rehydrateError(err: unknown): unknown {
  const message = err instanceof Error ? err.message : String(err)
  return decodeErrorMessage(message) ?? err
}
