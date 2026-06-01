import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveOptions } from '../src/core/options'
import { absPosix } from '../src/core/utils'

// Use a real absolute path so drive-letter handling matches across platforms.
const ROOT = absPosix(path.resolve('proj-root-fixture'))

describe('resolveOptions', () => {
  it('applies sensible defaults', () => {
    const o = resolveOptions({ root: ROOT })
    expect(o.mode).toBe('all-exports')
    expect(o.bridgeName).toBe('ipc')
    expect(o.eventArg).toBe(false)
    expect(o.pathStyle).toBe('relative')
    expect(o.failOnCollision).toBe(true)
    expect(o.allowDefault).toBe(false)
    expect(o.dirs).toEqual([`${ROOT}/src/ipc`, `${ROOT}/src/main/ipc`])
    expect(o.dts).toBe(`${ROOT}/src/ipc-auto-import.d.ts`)
  })

  it('resolves dirs relative to root and honors absolute dirs', () => {
    const abs = absPosix(path.resolve('abs-ipc-fixture'))
    const o = resolveOptions({ root: ROOT, dirs: ['handlers', abs] })
    expect(o.dirs).toEqual([`${ROOT}/handlers`, abs])
  })

  it('supports disabling dts', () => {
    expect(resolveOptions({ dts: false }).dts).toBe(false)
  })

  it('default channelName namespaces with a colon', () => {
    const o = resolveOptions({})
    expect(o.channelName({ namespace: 'user', exportName: 'getUser', file: 'x' })).toBe(
      'user:getUser',
    )
    expect(o.channelName({ namespace: '', exportName: 'ping', file: 'x' })).toBe('ping')
  })
})
