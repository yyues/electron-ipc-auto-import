/** Echo input back unchanged (sync). */
export function echo(payload: unknown): unknown {
  return payload
}

/** Resolve after `ms` milliseconds — useful for testing await behavior. */
export async function slow(ms: number): Promise<{ waitedMs: number }> {
  await new Promise((r) => setTimeout(r, ms))
  return { waitedMs: ms }
}

/** Always throws — verifies error round-tripping into the renderer. */
export function throwError(message: string): never {
  const err = Object.assign(new Error(message), { code: 'E_PLAYGROUND' })
  throw err
}

/** Dump some runtime info (handy for breakpoint inspection in main). */
export function dump(): {
  platform: NodeJS.Platform
  node: string
  electron: string
} {
  return {
    platform: process.platform,
    node: process.versions.node,
    electron: process.versions.electron ?? 'unknown',
  }
}
