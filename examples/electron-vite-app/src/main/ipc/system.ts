import { app } from 'electron'

/** Return basic runtime info. */
export function info(): { electron: string; platform: NodeJS.Platform } {
  return { electron: process.versions.electron ?? 'unknown', platform: process.platform }
}

/** Echo a message back (handy for smoke-testing the bridge). */
export function echo(message: string): string {
  return `${app.getName()}: ${message}`
}
