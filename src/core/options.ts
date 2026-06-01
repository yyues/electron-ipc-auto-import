import path from 'node:path'
import type { ChannelNameContext, Options, ResolvedOptions } from '../types'
import { absPosix } from './utils'

const DEFAULT_INCLUDE: RegExp[] = [/\.[cm]?[tj]sx?$/]
const DEFAULT_EXCLUDE: RegExp[] = [
  /node_modules/,
  /\.d\.ts$/,
  /\.(test|spec)\.[cm]?[tj]sx?$/,
]

function defaultChannelName({ namespace, exportName }: ChannelNameContext): string {
  return namespace ? `${namespace}:${exportName}` : exportName
}

/** Apply defaults and normalize user options into a {@link ResolvedOptions}. */
export function resolveOptions(options: Options = {}): ResolvedOptions {
  const root = absPosix(options.root ?? process.cwd())

  const dts =
    options.dts === false
      ? false
      : absPosix(root, options.dts ?? 'src/ipc-auto-import.d.ts')

  return {
    dirs: (options.dirs ?? ['src/ipc', 'src/main/ipc']).map((d) =>
      path.isAbsolute(d) ? absPosix(d) : absPosix(root, d),
    ),
    include: options.include ?? DEFAULT_INCLUDE,
    exclude: options.exclude ?? DEFAULT_EXCLUDE,
    mode: options.mode ?? 'all-exports',
    markerName: options.markerName ?? 'defineIpcHandler',
    namespace: options.namespace ?? 'file',
    channelName: options.channelName ?? defaultChannelName,
    eventArg: options.eventArg ?? false,
    bridgeName: options.bridgeName ?? 'ipc',
    dts,
    pathStyle: options.pathStyle ?? 'relative',
    root,
    failOnCollision: options.failOnCollision ?? true,
    allowDefault: options.allowDefault ?? false,
  }
}
