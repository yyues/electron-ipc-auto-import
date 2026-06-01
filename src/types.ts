/**
 * Public type definitions for electron-ipc-auto-import.
 *
 * This module is dependency-free so it can be imported as a lightweight
 * `electron-ipc-auto-import/types` subpath without pulling in build tooling.
 */

/**
 * A picomatch-compatible filter pattern, matching the semantics of
 * `@rollup/pluginutils` `createFilter`.
 */
export type FilterPattern =
  | ReadonlyArray<string | RegExp>
  | string
  | RegExp
  | null

/**
 * How channel namespaces are derived from a scanned file.
 *
 * - `file`   — basename without extension (`ipc/user.ts` -> `user`)
 * - `folder` — containing folder name; `index.ts` resolves to the folder
 * - `flat`   — no namespace; all handlers live directly on the bridge root
 * - function — fully custom, receives the parsed file
 */
export type NamespaceStrategy =
  | 'file'
  | 'folder'
  | 'flat'
  | ((file: ParsedFile) => string)

/** How module specifiers are emitted into the generated `.d.ts`. */
export type PathStyle = 'relative' | 'absolute' | 'alias'

/** Detection mode for which exports become IPC handlers. */
export type DetectionMode = 'all-exports' | 'marker'

/** Context passed to a custom {@link Options.channelName} resolver. */
export interface ChannelNameContext {
  namespace: string
  exportName: string
  /** Absolute, POSIX-normalized path of the source file. */
  file: string
}

/** A single exported function discovered during scanning. */
export interface ParsedExport {
  /** The exported identifier (`getUser`). `default` for default exports. */
  exportName: string
  /** Whether the export's declaration is a function/method. */
  isFunction: boolean
  /** Whether the function is declared `async`. */
  isAsync: boolean
  /** Whether this is a type-only export (`export type`/`interface`). */
  isTypeOnly: boolean
  /** Whether this is the module's default export. */
  isDefault: boolean
  /** Whether wrapped in the marker call (`defineIpcHandler(...)`). */
  isMarked: boolean
  /** Leading JSDoc comment text, if any (for editor hover passthrough). */
  jsDoc?: string
}

/** A scanned source file and its qualifying exports. */
export interface ParsedFile {
  /** Absolute, POSIX-normalized path. */
  filePath: string
  /** Path relative to the project root, POSIX-normalized. */
  relativePath: string
  exports: ParsedExport[]
}

/** A fully resolved handler entry — the unit consumed by all generators. */
export interface HandlerEntry {
  /** Runtime IPC channel string, e.g. `user:getUser`. */
  channel: string
  /** Bridge namespace, e.g. `user`. Empty string for `flat` strategy. */
  namespace: string
  /** Exported identifier. */
  exportName: string
  /** Absolute, POSIX-normalized path of the source module (no extension). */
  importPath: string
  /** Whether the handler is declared async. */
  isAsync: boolean
  jsDoc?: string
}

/** The complete set of discovered handlers. */
export type HandlerManifest = HandlerEntry[]

/** User-facing plugin options. */
export interface Options {
  /**
   * Directories to scan for handler modules, relative to the project root.
   * @default ['src/ipc', 'src/main/ipc']
   */
  dirs?: string[]

  /**
   * Files to include. Applied to absolute paths.
   * @default [/\.[cm]?[tj]sx?$/]
   */
  include?: FilterPattern

  /**
   * Files to exclude. The generated dts path is always excluded automatically.
   * @default [/node_modules/, /\.d\.ts$/, /\.(test|spec)\./]
   */
  exclude?: FilterPattern

  /**
   * Which exports qualify as IPC handlers.
   * @default 'all-exports'
   */
  mode?: DetectionMode

  /**
   * Marker function name used when `mode: 'marker'`.
   * @default 'defineIpcHandler'
   */
  markerName?: string

  /**
   * How namespaces are derived from files.
   * @default 'file'
   */
  namespace?: NamespaceStrategy

  /**
   * Resolve the runtime channel string for a handler.
   * @default ({ namespace, exportName }) => namespace ? `${namespace}:${exportName}` : exportName
   */
  channelName?: (ctx: ChannelNameContext) => string

  /**
   * Pass the `IpcMainInvokeEvent` as the first argument to handlers.
   * When `true`, the renderer-facing signature drops that first parameter.
   * @default false
   */
  eventArg?: boolean

  /**
   * Global name exposed on `window` via contextBridge.
   * @default 'ipc'
   */
  bridgeName?: string

  /**
   * Path of the generated declaration file, relative to project root.
   * Set to `false` to disable dts generation.
   * @default 'src/ipc-auto-import.d.ts'
   */
  dts?: string | false

  /**
   * How module specifiers are written into the generated dts.
   * `relative` keeps the file portable across machines (recommended).
   * @default 'relative'
   */
  pathStyle?: PathStyle

  /**
   * Project root. Defaults to the bundler's resolved root or `process.cwd()`.
   */
  root?: string

  /**
   * Treat channel/namespace collisions as a hard error.
   * @default true
   */
  failOnCollision?: boolean

  /**
   * Include `export default` handlers (mapped to `<namespace>.default`).
   * @default false
   */
  allowDefault?: boolean
}

/** Options with all defaults applied. */
export interface ResolvedOptions {
  dirs: string[]
  include: FilterPattern
  exclude: FilterPattern
  mode: DetectionMode
  markerName: string
  namespace: NamespaceStrategy
  channelName: (ctx: ChannelNameContext) => string
  eventArg: boolean
  bridgeName: string
  dts: string | false
  pathStyle: PathStyle
  root: string
  failOnCollision: boolean
  allowDefault: boolean
}

/** Identifiers of the generated virtual modules. */
export const VIRTUAL_MAIN = 'virtual:electron-ipc/main'
export const VIRTUAL_PRELOAD = 'virtual:electron-ipc/preload'
