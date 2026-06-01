import { describe, expect, it } from 'vitest'
import { generateMainModule } from '../src/core/generate/main'
import { generatePreloadModule } from '../src/core/generate/preload'
import { generateDts } from '../src/core/generate/dts'
import { resolveOptions } from '../src/core/options'
import type { HandlerManifest, ResolvedOptions } from '../src/types'

const manifest: HandlerManifest = [
  {
    channel: 'user:getUser',
    namespace: 'user',
    exportName: 'getUser',
    importPath: '/proj/src/ipc/user',
    isAsync: false,
    jsDoc: 'Fetch a user by id.',
  },
  {
    channel: 'user:updateUser',
    namespace: 'user',
    exportName: 'updateUser',
    importPath: '/proj/src/ipc/user',
    isAsync: true,
  },
  {
    channel: 'files:read',
    namespace: 'files',
    exportName: 'read',
    importPath: '/proj/src/ipc/files',
    isAsync: true,
  },
]

function options(overrides?: Partial<ResolvedOptions>): ResolvedOptions {
  return resolveOptions({ root: '/proj', ...overrides })
}

describe('generateMainModule', () => {
  it('imports each module once and lists channel→handler pairs', () => {
    const code = generateMainModule(manifest, options())
    expect(code).toContain("import { registerHandlers } from 'electron-ipc-auto-import/runtime/main'")
    expect(code).toContain("import * as _m0 from '/proj/src/ipc/user'")
    expect(code).toContain("import * as _m1 from '/proj/src/ipc/files'")
    expect(code).toContain("{ channel: 'user:getUser', handler: _m0['getUser'] }")
    expect(code).toContain('eventArg: false')
    expect(code).toContain('export function registerIpcHandlers')
    // Only two unique imports for three handlers.
    expect(code.match(/import \* as/g)).toHaveLength(2)
  })
})

describe('generatePreloadModule', () => {
  it('builds a nested, frozen contextBridge api of invokers', () => {
    const code = generatePreloadModule(manifest, options())
    expect(code).toContain("import { contextBridge } from 'electron'")
    expect(code).toContain('getUser: createInvoker(\'user:getUser\')')
    expect(code).toContain('read: createInvoker(\'files:read\')')
    expect(code).toContain("contextBridge.exposeInMainWorld('ipc', api)")
    expect(code).toContain('freezeDeep(')
    expect(code).toContain("'user:getUser',")
  })

  it('honors a custom bridge name', () => {
    const code = generatePreloadModule(manifest, options({ bridgeName: 'api' }))
    expect(code).toContain("contextBridge.exposeInMainWorld('api', api)")
  })
})

describe('generateDts', () => {
  it('references source signatures via type-only typeof import (relative)', () => {
    const code = generateDts(manifest, options())
    // dts default lives at /proj/src/ipc-auto-import.d.ts -> ./ipc/user
    expect(code).toContain("typeof import('./ipc/user')['getUser']")
    expect(code).toContain("typeof import('./ipc/files')['read']")
    expect(code).toContain('interface Window')
    expect(code).toContain('ipc: IpcApi')
    expect(code).toContain('Fetch a user by id.')
  })

  it('drops the event arg from the renderer signature when eventArg is true', () => {
    const code = generateDts(manifest, options({ eventArg: true }))
    expect(code).toContain('_Tail<Parameters<F>>')
  })

  it('emits absolute specifiers when pathStyle is absolute', () => {
    const code = generateDts(manifest, options({ pathStyle: 'absolute' }))
    expect(code).toContain("typeof import('/proj/src/ipc/user')['getUser']")
  })

  it('returns empty string when dts disabled', () => {
    expect(generateDts(manifest, options({ dts: false }))).toBe('')
  })
})
