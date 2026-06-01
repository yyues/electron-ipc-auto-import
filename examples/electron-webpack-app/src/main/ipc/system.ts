/** Return basic runtime info. */
export function info(): { platform: NodeJS.Platform; electron: string; node: string } {
  return {
    platform: process.platform,
    electron: process.versions.electron ?? 'unknown',
    node: process.versions.node,
  }
}

/** Echo a message back (handy for smoke-testing the bridge). */
export function echo(msg: string): string {
  return msg
}
