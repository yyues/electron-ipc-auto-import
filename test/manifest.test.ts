import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildManifest } from '../src/core/manifest'
import { resolveOptions } from '../src/core/options'
import { absPosix } from '../src/core/utils'
import type { ParsedFile, ResolvedOptions } from '../src/types'

const ROOT = absPosix(path.resolve('proj-manifest-fixture'))

function options(overrides?: Partial<ResolvedOptions>): ResolvedOptions {
  return resolveOptions({ root: ROOT, dirs: ['src/ipc'], ...overrides })
}

function file(relative: string, exportNames: string[]): ParsedFile {
  return {
    filePath: `${ROOT}/src/ipc/${relative}`,
    relativePath: `src/ipc/${relative}`,
    exports: exportNames.map((exportName) => ({
      exportName,
      isFunction: true,
      isAsync: false,
      isTypeOnly: false,
      isDefault: false,
      isMarked: false,
    })),
  }
}

describe('buildManifest namespacing', () => {
  it('file strategy uses the basename and collapses index', () => {
    const { manifest } = buildManifest(
      [file('user.ts', ['getUser']), file('settings/index.ts', ['load'])],
      options({ namespace: 'file' }),
    )
    expect(manifest.find((e) => e.exportName === 'getUser')?.namespace).toBe('user')
    expect(manifest.find((e) => e.exportName === 'load')?.namespace).toBe('settings')
  })

  it('folder strategy builds dotted namespaces', () => {
    const { manifest } = buildManifest(
      [file('user/profile.ts', ['get'])],
      options({ namespace: 'folder' }),
    )
    expect(manifest[0]?.namespace).toBe('user.profile')
    expect(manifest[0]?.channel).toBe('user.profile:get')
  })

  it('flat strategy drops the namespace', () => {
    const { manifest } = buildManifest(
      [file('user.ts', ['getUser'])],
      options({ namespace: 'flat' }),
    )
    expect(manifest[0]?.namespace).toBe('')
    expect(manifest[0]?.channel).toBe('getUser')
  })

  it('sanitizes non-identifier namespaces with a warning', () => {
    const { manifest, warnings } = buildManifest(
      [file('user-profile.ts', ['get'])],
      options({ namespace: 'file' }),
    )
    expect(manifest[0]?.namespace).toBe('userProfile')
    expect(warnings.some((w) => w.includes('not a valid identifier'))).toBe(true)
  })
})

describe('buildManifest collisions', () => {
  it('throws on duplicate channels by default', () => {
    expect(() =>
      buildManifest(
        [file('a.ts', ['x'])],
        options({ channelName: () => 'same:channel', namespace: 'flat' }),
      ),
    ).not.toThrow()

    expect(() =>
      buildManifest(
        [file('a.ts', ['x']), file('b.ts', ['y'])],
        options({ channelName: () => 'same:channel' }),
      ),
    ).toThrow(/Duplicate IPC channel/)
  })

  it('collects warnings instead of throwing when failOnCollision is false', () => {
    const { manifest, warnings } = buildManifest(
      [file('a.ts', ['x']), file('b.ts', ['y'])],
      options({ channelName: () => 'same:channel', failOnCollision: false }),
    )
    expect(manifest).toHaveLength(1)
    expect(warnings.some((w) => w.includes('Duplicate IPC channel'))).toBe(true)
  })
})
