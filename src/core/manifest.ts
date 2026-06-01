import type {
  HandlerEntry,
  HandlerManifest,
  ParsedExport,
  ParsedFile,
  ResolvedOptions,
} from '../types'
import { isIdentifier, stripExtension, toIdentifier, toPosix } from './utils'

export interface ManifestResult {
  manifest: HandlerManifest
  warnings: string[]
}

/**
 * Build the handler manifest from parsed files: assign namespaces and channels,
 * sanitize identifiers, and detect collisions.
 */
export function buildManifest(
  files: ParsedFile[],
  options: ResolvedOptions,
): ManifestResult {
  const warnings: string[] = []
  const entries: HandlerEntry[] = []

  // Track collisions by runtime channel and by bridge key path.
  const byChannel = new Map<string, HandlerEntry>()
  const byBridgeKey = new Map<string, HandlerEntry>()

  for (const file of files) {
    const namespace = sanitizeNamespace(
      resolveNamespace(file, options),
      file,
      warnings,
    )

    for (const exp of file.exports) {
      const exportKey = sanitizeExportName(exp, file, warnings)
      const channel = options.channelName({
        namespace,
        exportName: exportKey,
        file: file.filePath,
      })

      const entry: HandlerEntry = {
        channel,
        namespace,
        exportName: exp.exportName,
        importPath: stripExtension(file.filePath),
        isAsync: exp.isAsync,
        jsDoc: exp.jsDoc,
      }

      const bridgeKey = namespace ? `${namespace}.${exportKey}` : exportKey

      const channelClash = byChannel.get(channel)
      if (channelClash) {
        const message =
          `Duplicate IPC channel "${channel}":\n` +
          `  - ${channelClash.importPath} (${channelClash.exportName})\n` +
          `  - ${entry.importPath} (${entry.exportName})`
        if (options.failOnCollision) throw new Error(message)
        warnings.push(message)
        continue
      }

      const bridgeClash = byBridgeKey.get(bridgeKey)
      if (bridgeClash) {
        const message =
          `Duplicate bridge member "window.${options.bridgeName}.${bridgeKey}":\n` +
          `  - ${bridgeClash.importPath} (${bridgeClash.exportName})\n` +
          `  - ${entry.importPath} (${entry.exportName})`
        if (options.failOnCollision) throw new Error(message)
        warnings.push(message)
        continue
      }

      byChannel.set(channel, entry)
      byBridgeKey.set(bridgeKey, entry)
      entries.push(entry)
    }
  }

  // Stable ordering for deterministic codegen output.
  entries.sort((a, b) => a.channel.localeCompare(b.channel))

  return { manifest: entries, warnings }
}

function resolveNamespace(file: ParsedFile, options: ResolvedOptions): string {
  const strategy = options.namespace
  if (typeof strategy === 'function') return strategy(file)
  if (strategy === 'flat') return ''

  const segments = relativeSegments(file.filePath, options.dirs)

  if (strategy === 'file') {
    const last = segments[segments.length - 1]
    if (last && last !== 'index') return last
    // index.ts collapses to its containing folder.
    return segments[segments.length - 2] ?? ''
  }

  // 'folder': dotted path, dropping a trailing 'index'.
  const withoutIndex =
    segments[segments.length - 1] === 'index' ? segments.slice(0, -1) : segments
  return withoutIndex.join('.')
}

/** Path segments of a file relative to its owning scan dir, sans extension. */
function relativeSegments(filePath: string, dirs: string[]): string[] {
  const posix = toPosix(filePath)
  // Longest matching scan dir wins.
  const dir = [...dirs]
    .map(toPosix)
    .filter((d) => posix === d || posix.startsWith(`${d}/`))
    .sort((a, b) => b.length - a.length)[0]

  const relative = dir ? posix.slice(dir.length + 1) : posix
  return stripExtension(relative).split('/').filter(Boolean)
}

function sanitizeNamespace(
  namespace: string,
  file: ParsedFile,
  warnings: string[],
): string {
  if (namespace === '') return ''
  return namespace
    .split('.')
    .filter(Boolean)
    .map((segment) => {
      if (isIdentifier(segment)) return segment
      const { id } = toIdentifier(segment)
      warnings.push(
        `Namespace segment "${segment}" from ${file.relativePath} is not a valid identifier; using "${id}".`,
      )
      return id
    })
    .join('.')
}

function sanitizeExportName(
  exp: ParsedExport,
  file: ParsedFile,
  warnings: string[],
): string {
  // `default` is a reserved word but valid as an object/member key.
  if (exp.exportName === 'default' || isIdentifier(exp.exportName)) {
    return exp.exportName
  }
  const { id } = toIdentifier(exp.exportName)
  warnings.push(
    `Export "${exp.exportName}" from ${file.relativePath} is not a valid identifier; using "${id}".`,
  )
  return id
}
