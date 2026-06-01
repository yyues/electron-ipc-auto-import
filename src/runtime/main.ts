import { ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { encodeErrorMessage } from './shared'

export { ERROR_TAG } from './shared'

type AnyHandler = (...args: any[]) => any

export interface HandlerRegistration {
  channel: string
  handler: AnyHandler
}

export interface RegisterHandlersOptions {
  /** Pass the IpcMainInvokeEvent as the first arg to handlers. */
  eventArg?: boolean
  /**
   * Validate/transform renderer args before dispatch. Return a new args array
   * to replace them, or throw to reject. Runs in the main process.
   */
  validate?: (channel: string, args: unknown[]) => unknown[] | void
  /** Customize the error payload sent to the renderer. */
  serializeError?: (err: unknown) => unknown
}

/** Channels already bound, so re-registration is a safe no-op. */
const registered = new Set<string>()

/**
 * Bind each handler to `ipcMain.handle`. Idempotent per channel. Errors thrown
 * by handlers are normalized into a structured payload that the preload runtime
 * rehydrates into a real Error.
 */
export function registerHandlers(
  handlers: HandlerRegistration[],
  options: RegisterHandlersOptions = {},
): void {
  for (const { channel, handler } of handlers) {
    if (registered.has(channel)) continue
    registered.add(channel)

    ipcMain.handle(channel, async (event: IpcMainInvokeEvent, ...args: unknown[]) => {
      try {
        let finalArgs = args
        if (options.validate) {
          const replaced = options.validate(channel, args)
          if (Array.isArray(replaced)) finalArgs = replaced
        }
        const callArgs = options.eventArg ? [event, ...finalArgs] : finalArgs
        return await handler(...callArgs)
      } catch (err) {
        throw encodeError(err, options.serializeError)
      }
    })
  }
}

/** Remove all bindings (mainly for tests / hot reload). */
export function unregisterAllHandlers(): void {
  for (const channel of registered) {
    ipcMain.removeHandler(channel)
  }
  registered.clear()
}

function encodeError(
  err: unknown,
  serializeError?: (err: unknown) => unknown,
): Error {
  // Electron preserves an Error's `message`; embed the payload there so custom
  // fields survive structured cloning across the contextBridge.
  return new Error(encodeErrorMessage(err, serializeError))
}

/**
 * Marker used in `mode: 'marker'`. Identity at runtime, but lets the scanner
 * detect explicit IPC handlers. Preserves the function type so the renderer's
 * generated types stay accurate.
 */
export function defineIpcHandler<T extends AnyHandler>(handler: T): T {
  return handler
}
