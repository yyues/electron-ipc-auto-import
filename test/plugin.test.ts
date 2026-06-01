import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { unpluginFactory } from '../src/unplugin'
import { VIRTUAL_MAIN, VIRTUAL_PRELOAD } from '../src/types'
import { toPosix } from '../src/core/utils'

const FIXTURES = toPosix(path.resolve(__dirname, 'fixtures'))

// The factory returns a plain options object whose hooks we can call directly,
// emulating what a bundler does (resolveId -> load).
function createPlugin() {
  return unpluginFactory(
    { root: FIXTURES, dirs: ['ipc'], dts: false },
    { framework: 'vite' } as never,
  ) as {
    buildStart: () => Promise<void>
    resolveId: (id: string) => string | null
    load: (id: string) => Promise<string | null>
  }
}

describe('unplugin wiring', () => {
  it('resolves the virtual module ids to internal ids', () => {
    const plugin = createPlugin()
    expect(plugin.resolveId(VIRTUAL_MAIN)).toBe(`\0${VIRTUAL_MAIN}`)
    expect(plugin.resolveId(VIRTUAL_PRELOAD)).toBe(`\0${VIRTUAL_PRELOAD}`)
    expect(plugin.resolveId('some-other-id')).toBeNull()
  })

  it('loads generated source for the resolved virtual ids', async () => {
    const plugin = createPlugin()
    await plugin.buildStart()

    const main = await plugin.load(`\0${VIRTUAL_MAIN}`)
    const preload = await plugin.load(`\0${VIRTUAL_PRELOAD}`)

    expect(main).toContain('export function registerIpcHandlers')
    expect(main).toContain("from 'electron-ipc-auto-import/runtime/main'")
    expect(preload).toContain("contextBridge.exposeInMainWorld('ipc', api)")
    expect(preload).toContain('createInvoker(')
  })

  it('returns null when loading a non-virtual id', async () => {
    const plugin = createPlugin()
    expect(await plugin.load('/some/real/file.ts')).toBeNull()
  })
})
