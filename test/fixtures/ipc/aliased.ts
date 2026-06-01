import { defineIpcHandler } from '../../../src/runtime/main'

// Marker-wrapped handler (for `mode: 'marker'` tests).
export const ping = defineIpcHandler((): string => 'pong')

// Re-export resolves to user.getUser's origin declaration.
export { getUser as fetchUser } from './user'

// Plain export, only picked up in all-exports mode.
export function plain(): number {
  return 1
}
