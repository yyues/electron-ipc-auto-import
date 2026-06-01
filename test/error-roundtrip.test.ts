import { describe, expect, it } from 'vitest'
import {
  decodeErrorMessage,
  defaultSerialize,
  encodeErrorMessage,
} from '../src/runtime/shared'

describe('error round-trip', () => {
  it('preserves name, message, and custom fields', () => {
    class ValidationError extends Error {
      code = 'E_VALIDATION'
      constructor(message: string) {
        super(message)
        this.name = 'ValidationError'
      }
    }

    const encoded = encodeErrorMessage(new ValidationError('bad input'))
    // Simulate Electron wrapping the message with a prefix.
    const wrapped = `Error invoking remote method 'x:y': Error: ${encoded}`
    const restored = decodeErrorMessage(wrapped)

    expect(restored).toBeInstanceOf(Error)
    expect(restored?.name).toBe('ValidationError')
    expect(restored?.message).toBe('bad input')
    expect((restored as unknown as { code: string }).code).toBe('E_VALIDATION')
  })

  it('handles non-Error thrown values', () => {
    const restored = decodeErrorMessage(encodeErrorMessage('boom'))
    expect(restored?.message).toBe('boom')
    expect(restored?.name).toBe('Error')
  })

  it('returns undefined when no tagged payload present', () => {
    expect(decodeErrorMessage('just a normal message')).toBeUndefined()
  })

  it('supports a custom serializer', () => {
    const encoded = encodeErrorMessage(new Error('x'), () => ({
      name: 'Custom',
      message: 'redacted',
    }))
    expect(decodeErrorMessage(encoded)?.message).toBe('redacted')
  })

  it('defaultSerialize captures own enumerable props', () => {
    const err = Object.assign(new Error('m'), { detail: { a: 1 } })
    const payload = defaultSerialize(err)
    expect(payload.message).toBe('m')
    expect(payload.detail).toEqual({ a: 1 })
  })
})
