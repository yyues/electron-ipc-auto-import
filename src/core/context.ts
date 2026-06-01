import fs from 'node:fs'
import path from 'node:path'
import { createFilter } from '@rollup/pluginutils'
import type { Project } from 'ts-morph'
import type {
  HandlerManifest,
  Options,
  ParsedFile,
  ResolvedOptions,
} from '../types'
import { resolveOptions } from './options'
import { scanFiles } from './scan'
import { createProject, parseFile } from './parse'
import { buildManifest } from './manifest'
import { generateMainModule } from './generate/main'
import { generatePreloadModule } from './generate/preload'
import { generateDts } from './generate/dts'
import { hash, toPosix } from './utils'

export interface GeneratedShape {
  manifest: HandlerManifest
  main: string
  preload: string
  dts: string
  /** Hash of the runtime-relevant shape (channels + namespaces). */
  shapeHash: string
}

/**
 * Coordinates scanning, manifest building, codegen, and dts writing. A single
 * instance is shared across the separate main/preload/renderer builds so they
 * all observe one source of truth.
 */
export class IpcContext {
  readonly options: ResolvedOptions
  private project: Project
  private files = new Map<string, ParsedFile>()
  private generated: GeneratedShape | undefined
  private scanned = false
  private readonly fileFilter: (id: string) => boolean
  private lastWrittenDtsHash: string | undefined

  constructor(rawOptions: Options) {
    this.options = resolveOptions(rawOptions)
    this.project = createProject()
    this.fileFilter = createFilter(this.options.include, this.options.exclude)
  }

  /** Whether a given absolute path is within scan scope. */
  isScanned(id: string): boolean {
    const posix = toPosix(id)
    const inDir = this.options.dirs.some(
      (dir) => posix === dir || posix.startsWith(`${dir}/`),
    )
    return inDir && this.fileFilter(posix)
  }

  /** Run a full scan + parse from disk, replacing all cached files. */
  async scan(): Promise<void> {
    const paths = await scanFiles(this.options)
    this.files.clear()
    for (const filePath of paths) {
      this.files.set(filePath, this.parseOne(filePath))
    }
    this.scanned = true
    this.generated = undefined
  }

  /** Re-parse a single changed/added file. Returns true if its exports changed. */
  updateFile(filePath: string): boolean {
    const posix = toPosix(filePath)
    if (!this.isScanned(posix)) return false
    const next = this.parseOne(posix)
    const prev = this.files.get(posix)
    this.files.set(posix, next)
    this.generated = undefined
    return !prev || !sameExports(prev, next)
  }

  /** Drop a deleted file. Returns true if it had been tracked. */
  removeFile(filePath: string): boolean {
    const posix = toPosix(filePath)
    const existed = this.files.delete(posix)
    if (existed) {
      this.project.getSourceFile(posix)?.forget()
      this.generated = undefined
    }
    return existed
  }

  private parseOne(filePath: string): ParsedFile {
    const relativePath = toPosix(path.relative(this.options.root, filePath))
    return parseFile(this.project, filePath, relativePath, this.options)
  }

  /** Build (and cache) all generated outputs. Scans first if needed. */
  async getGenerated(): Promise<GeneratedShape> {
    if (!this.scanned) await this.scan()
    if (this.generated) return this.generated

    const { manifest, warnings } = buildManifest(
      [...this.files.values()].sort((a, b) =>
        a.filePath.localeCompare(b.filePath),
      ),
      this.options,
    )
    for (const w of warnings) console.warn(`[electron-ipc-auto-import] ${w}`)

    const main = generateMainModule(manifest, this.options)
    const preload = generatePreloadModule(manifest, this.options)
    const dts = generateDts(manifest, this.options)
    const shapeHash = hash(
      manifest.map((e) => `${e.channel}|${e.namespace}.${e.exportName}`).join(';'),
    )

    this.generated = { manifest, main, preload, dts, shapeHash }
    return this.generated
  }

  /** Write the dts to disk if its content changed. Returns true if written. */
  async writeDts(): Promise<boolean> {
    if (this.options.dts === false) return false
    const { dts } = await this.getGenerated()
    const contentHash = hash(dts)
    if (contentHash === this.lastWrittenDtsHash) return false

    const dtsPath = this.options.dts
    const existing = readIfExists(dtsPath)
    if (existing !== null && hash(existing) === contentHash) {
      this.lastWrittenDtsHash = contentHash
      return false
    }

    fs.mkdirSync(path.dirname(dtsPath), { recursive: true })
    fs.writeFileSync(dtsPath, dts, 'utf8')
    this.lastWrittenDtsHash = contentHash
    return true
  }
}

function sameExports(a: ParsedFile, b: ParsedFile): boolean {
  if (a.exports.length !== b.exports.length) return false
  const key = (f: ParsedFile) =>
    f.exports
      .map((e) => `${e.exportName}:${e.isAsync}:${e.isFunction}:${e.isMarked}`)
      .sort()
      .join(',')
  return key(a) === key(b)
}

function readIfExists(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

// --- Shared singleton registry -------------------------------------------------

const contexts = new Map<string, IpcContext>()

/** A stable key from the primitive option fields that affect output. */
function contextKey(options: ResolvedOptions): string {
  return JSON.stringify({
    root: options.root,
    dirs: options.dirs,
    dts: options.dts,
    bridgeName: options.bridgeName,
    mode: options.mode,
    markerName: options.markerName,
    eventArg: options.eventArg,
    pathStyle: options.pathStyle,
  })
}

/**
 * Get or create the shared context for these options. The separate
 * main/preload/renderer plugin instances resolve to the same context.
 */
export function getContext(rawOptions: Options): IpcContext {
  const resolved = resolveOptions(rawOptions)
  const key = contextKey(resolved)
  let ctx = contexts.get(key)
  if (!ctx) {
    ctx = new IpcContext(rawOptions)
    contexts.set(key, ctx)
  }
  return ctx
}
