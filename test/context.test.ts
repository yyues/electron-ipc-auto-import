import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { IpcContext } from '../src/core/context'
import { toPosix } from '../src/core/utils'

const FIXTURES = toPosix(path.resolve(__dirname, 'fixtures'))
const tmpDir = toPosix(fs.mkdtempSync(path.join(os.tmpdir(), 'eipc-')))
const dtsPath = `${tmpDir}/ipc-auto-import.d.ts`

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function makeContext() {
  return new IpcContext({
    root: FIXTURES,
    dirs: ['ipc'],
    dts: dtsPath,
  })
}

describe('IpcContext integration', () => {
  it('scans fixtures and builds a manifest with expected channels', async () => {
    const ctx = makeContext()
    const { manifest } = await ctx.getGenerated()
    const channels = manifest.map((e) => e.channel).sort()

    expect(channels).toContain('user:getUser')
    expect(channels).toContain('user:updateUser')
    expect(channels).toContain('files:read')
    expect(channels).toContain('files:write')
    expect(channels).toContain('aliased:fetchUser')
    expect(channels).toContain('aliased:plain')
  })

  it('generates main, preload, and dts referencing fixture modules', async () => {
    const ctx = makeContext()
    const { main, preload, dts } = await ctx.getGenerated()
    expect(main).toContain('registerIpcHandlers')
    expect(main).toContain('/ipc/user')
    expect(preload).toContain("contextBridge.exposeInMainWorld('ipc'")
    expect(dts).toContain("typeof import")
    expect(dts).toContain("['getUser']")
  })

  it('writes the dts once, then skips when unchanged (hash gate)', async () => {
    const ctx = makeContext()
    expect(await ctx.writeDts()).toBe(true)
    expect(fs.existsSync(dtsPath)).toBe(true)
    expect(await ctx.writeDts()).toBe(false)
  })

  it('respects scan scope via isScanned', () => {
    const ctx = makeContext()
    expect(ctx.isScanned(`${FIXTURES}/ipc/user.ts`)).toBe(true)
    expect(ctx.isScanned(`${FIXTURES}/other/thing.ts`)).toBe(false)
    expect(ctx.isScanned(dtsPath)).toBe(false)
  })
})
