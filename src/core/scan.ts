import { glob } from 'tinyglobby'
import { createFilter } from '@rollup/pluginutils'
import type { ResolvedOptions } from '../types'
import { toPosix } from './utils'

/**
 * Discover candidate handler files across the configured dirs, honoring
 * include/exclude filters. Returns absolute, POSIX-normalized paths.
 *
 * The generated dts path (when enabled) is always excluded so writing it can
 * never re-trigger a scan (feedback-loop guard).
 */
export async function scanFiles(options: ResolvedOptions): Promise<string[]> {
  const exclude = normalizeExclude(options)
  const filter = createFilter(options.include, exclude)

  const patterns = options.dirs.map((dir) => `${toPosix(dir)}/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}`)

  const matches = await glob(patterns, {
    absolute: true,
    onlyFiles: true,
    dot: false,
  })

  return matches
    .map(toPosix)
    .filter((file) => filter(file))
    .sort()
}

function normalizeExclude(options: ResolvedOptions): Array<string | RegExp> {
  const base = toExcludeArray(options.exclude)
  if (options.dts) {
    // Exact-match the generated dts so it is never scanned.
    base.push(options.dts)
  }
  return base
}

function toExcludeArray(
  pattern: ResolvedOptions['exclude'],
): Array<string | RegExp> {
  if (pattern == null) return []
  if (Array.isArray(pattern)) return [...pattern]
  return [pattern as string | RegExp]
}
