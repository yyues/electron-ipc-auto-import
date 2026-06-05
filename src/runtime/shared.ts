/**
 * Shared, electron-free runtime helpers. Safe to pull into both the main and
 * preload bundles (no side effects, no `electron` import).
 */

/** Tag prefix used to smuggle a serializable error payload through Electron's
 * error channel, so custom fields survive the round-trip to the renderer. */
export const ERROR_TAG = '__EIPC_ERR__:'

/** Turn an arbitrary thrown value into a structured-clone-safe payload. */
export function defaultSerialize(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    const out: Record<string, unknown> = {
      name: err.name,
      message: err.message,
      stack: err.stack,
    }
    const record = err as unknown as Record<string, unknown>
    for (const key of Object.keys(err)) {
      if (!(key in out)) out[key] = record[key]
    }
    return out
  }
  return { name: 'Error', message: String(err) }
}

/** Encode an error into a tagged message string for transit through Electron. */
export function encodeErrorMessage(
  err: unknown,
  serializeError?: (err: unknown) => unknown,
): string {
  const payload = serializeError ? serializeError(err) : defaultSerialize(err)
  return `${ERROR_TAG}${safeStringify(payload)}`
}

/**
 * Reconstruct a real Error from a (possibly Electron-wrapped) message that
 * contains a tagged payload. Returns `undefined` when no payload is present.
 */
export function decodeErrorMessage(message: string): Error | undefined {
  const tagIndex = message.indexOf(ERROR_TAG)
  if (tagIndex < 0) return undefined

  try {
    const payload = JSON.parse(message.slice(tagIndex + ERROR_TAG.length)) as
      | Record<string, unknown>
      | undefined
    if (!payload || typeof payload !== 'object') return undefined

    const restored = new Error(String(payload.message ?? ''))
    if (typeof payload.name === 'string') restored.name = payload.name
    if (typeof payload.stack === 'string') restored.stack = payload.stack
    const record = restored as unknown as Record<string, unknown>
    for (const [key, value] of Object.entries(payload)) {
      if (key === 'name' || key === 'message' || key === 'stack') continue
      record[key] = value
    }
    return restored
  } catch {
    return undefined
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    // A field (circular ref, BigInt, …) broke serialization. Degrade to the
    // core error fields so name/message/stack still survive the round-trip,
    // rather than collapsing the whole payload into a generic message.
    if (value && typeof value === 'object') {
      const v = value as Record<string, unknown>
      try {
        return JSON.stringify({
          name: typeof v.name === 'string' ? v.name : 'Error',
          message: typeof v.message === 'string' ? v.message : String(v.message ?? ''),
          ...(typeof v.stack === 'string' ? { stack: v.stack } : {}),
        })
      } catch {
        // fall through to the generic payload below
      }
    }
    return JSON.stringify({ name: 'Error', message: 'Unserializable error' })
  }
}
