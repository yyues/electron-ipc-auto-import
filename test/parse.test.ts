import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createProject, parseFile } from '../src/core/parse'
import { resolveOptions } from '../src/core/options'
import { toPosix } from '../src/core/utils'
import type { ResolvedOptions } from '../src/types'

const FIXTURES = toPosix(path.resolve(__dirname, 'fixtures'))

function parse(file: string, options?: Partial<ResolvedOptions>) {
  const resolved = resolveOptions({ root: FIXTURES, ...options })
  const project = createProject()
  const abs = toPosix(path.join(FIXTURES, file))
  return parseFile(project, abs, file, resolved)
}

function names(file: string, options?: Partial<ResolvedOptions>): string[] {
  return parse(file, options)
    .exports.map((e) => e.exportName)
    .sort()
}

describe('parseFile (all-exports)', () => {
  it('keeps function exports, skips types/consts/defaults/non-exported', () => {
    expect(names('ipc/user.ts')).toEqual(['getUser', 'updateUser'])
  })

  it('detects arrow-function const exports', () => {
    expect(names('ipc/files.ts')).toEqual(['read', 'write'])
  })

  it('records async-ness and JSDoc', () => {
    const parsed = parse('ipc/user.ts')
    const getUser = parsed.exports.find((e) => e.exportName === 'getUser')!
    const updateUser = parsed.exports.find((e) => e.exportName === 'updateUser')!
    expect(getUser.isAsync).toBe(false)
    expect(getUser.jsDoc).toBe('Fetch a user by id.')
    expect(updateUser.isAsync).toBe(true)
  })

  it('resolves re-exports to the origin declaration', () => {
    // aliased.ts re-exports user.getUser as fetchUser; it is a function.
    expect(names('ipc/aliased.ts')).toContain('fetchUser')
  })

  it('includes default exports when allowDefault is set', () => {
    expect(names('ipc/user.ts', { allowDefault: true })).toContain('default')
  })
})

describe('parseFile (marker mode)', () => {
  it('keeps only defineIpcHandler-wrapped exports', () => {
    expect(names('ipc/aliased.ts', { mode: 'marker' })).toEqual(['ping'])
  })
})
