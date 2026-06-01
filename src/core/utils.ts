import { createHash } from 'node:crypto'
import path from 'node:path'

/** Normalize a filesystem path to POSIX separators (forward slashes). */
export function toPosix(p: string): string {
  return p.replace(/\\/g, '/')
}

/** Absolute, POSIX-normalized path. */
export function absPosix(...segments: string[]): string {
  return toPosix(path.resolve(...segments))
}

/** Strip a recognized TS/JS extension from a module path. */
export function stripExtension(p: string): string {
  return p.replace(/\.[cm]?[tj]sx?$/, '')
}

/**
 * Convert an arbitrary string into a valid JS identifier segment, used for
 * namespace and bridge keys. Returns `{ id, changed }`.
 */
export function toIdentifier(input: string): { id: string; changed: boolean } {
  // camelCase across non-identifier separators, then strip anything illegal.
  const camel = input
    .replace(/[^A-Za-z0-9$_]+(.)?/g, (_m, c: string | undefined) =>
      c ? c.toUpperCase() : '',
    )
  let id = camel.replace(/[^A-Za-z0-9$_]/g, '')
  if (id.length > 0 && /^[0-9]/.test(id)) id = `_${id}`
  return { id: id || '_', changed: id !== input }
}

/** Whether a string is already a valid JS identifier. */
export function isIdentifier(input: string): boolean {
  return /^[A-Za-z$_][A-Za-z0-9$_]*$/.test(input)
}

/** Short, stable content hash (hex) for change detection. */
export function hash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16)
}

/** Compute a POSIX-relative module specifier from `fromFile` to `toModule`. */
export function relativeSpecifier(fromFile: string, toModule: string): string {
  const fromDir = path.dirname(fromFile)
  let rel = toPosix(path.relative(fromDir, toModule))
  if (!rel.startsWith('.')) rel = `./${rel}`
  return rel
}

/** Escape a string for safe embedding inside single quotes in generated code. */
export function singleQuote(str: string): string {
  return `'${str.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}
