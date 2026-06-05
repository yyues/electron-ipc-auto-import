# electron-ipc-auto-import

> 中文文档：[README.zh-CN.md](./README.zh-CN.md)

Auto-discover exported functions and wire them up as **type-safe Electron IPC**
— no manual `ipcMain.handle`, no hand-written preload bridge, no drifting shared
types. Inspired by [`unplugin-auto-import`](https://github.com/unplugin/unplugin-auto-import),
built on [`unplugin`](https://github.com/unjs/unplugin) so it works with
Vite/electron-vite, Webpack, Rspack, esbuild, and Rollup.

Write a plain function in the main process:

```ts
// src/main/ipc/user.ts
export interface User { id: number; name: string }

/** Fetch a user by id. */
export function getUser(id: number): User {
  return db.get(id)
}
```

…and call it from the renderer, fully typed, with autocomplete and inferred
return types:

```ts
// renderer
const user = await window.ipc.user.getUser(1) // user: User
```

That's it. The plugin scans your handler dirs, generates the main-process
registration and the preload `contextBridge` bridge as **virtual modules**, and
emits a physical **`.d.ts`** that types `window.ipc` directly from your handler
signatures.

## How it works

| Build context | What's generated | How you use it |
| --- | --- | --- |
| **main** | `virtual:electron-ipc/main` — binds every handler to `ipcMain.handle` | `registerIpcHandlers()` once after `app.whenReady()` |
| **preload** | `virtual:electron-ipc/preload` — `contextBridge.exposeInMainWorld('ipc', …)` | `import 'virtual:electron-ipc/preload'` (side effect) |
| **renderer** | physical `.d.ts` augmenting `Window` | nothing — `window.ipc.*` is just typed |

The `.d.ts` types are derived from your source via type-only
`typeof import('…')`, so they stay in sync automatically and are **erased at
compile time** — main-process code never leaks into the renderer bundle. The
preload bridge closes over literal channel strings, so the renderer can never
invoke an arbitrary channel.

## Install

```bash
npm i -D electron-ipc-auto-import
```

## Setup (electron-vite)

```ts
// electron.vite.config.ts
import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import electronIpc from 'electron-ipc-auto-import/vite'

const projectRoot = import.meta.dirname

const ipc = () =>
  electronIpc({
    root: projectRoot,
    dirs: ['src/main/ipc'],
    dts: resolve(projectRoot, 'src/preload/ipc-auto-import.d.ts'),
  })

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin(), ipc()] },
  preload: { plugins: [externalizeDepsPlugin(), ipc()] },
  renderer: { plugins: [ipc()] },
})
```

```ts
// src/main/index.ts
import { registerIpcHandlers } from 'virtual:electron-ipc/main'
app.whenReady().then(() => {
  registerIpcHandlers()
  // …createWindow()
})
```

```ts
// src/preload/index.ts
import 'virtual:electron-ipc/preload'
```

Reference the virtual-module + generated types once (e.g. `src/env.d.ts`):

```ts
/// <reference types="electron-ipc-auto-import/client" />
/// <reference path="./preload/ipc-auto-import.d.ts" />
```

Other bundlers: import from `electron-ipc-auto-import/webpack`, `/rspack`,
`/esbuild`, or `/rollup`.

## Options

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `dirs` | `string[]` | `['src/ipc', 'src/main/ipc']` | Dirs to scan for handler modules |
| `include` | `FilterPattern` | `[/\.[cm]?[tj]sx?$/]` | Files to include |
| `exclude` | `FilterPattern` | node_modules / `.d.ts` / tests | The generated dts is always excluded |
| `mode` | `'all-exports' \| 'marker'` | `'all-exports'` | `marker` registers only `defineIpcHandler(...)`-wrapped exports |
| `markerName` | `string` | `'defineIpcHandler'` | Marker identifier for `marker` mode |
| `namespace` | `'file' \| 'folder' \| 'flat' \| (file) => string` | `'file'` | How `window.ipc.<ns>` is derived |
| `channelName` | `(ctx) => string` | `` `${ns}:${name}` `` | Runtime channel string |
| `eventArg` | `boolean` | `false` | Pass `IpcMainInvokeEvent` as the first handler arg (dropped from the renderer signature) |
| `bridgeName` | `string` | `'ipc'` | Global name on `window` |
| `dts` | `string \| false` | `'src/ipc-auto-import.d.ts'` | Output path, or disable |
| `pathStyle` | `'relative' \| 'absolute' \| 'alias'` | `'relative'` | How specifiers are written into the dts (keep `relative` for portable diffs) |
| `failOnCollision` | `boolean` | `true` | Error on duplicate channels / bridge keys |
| `allowDefault` | `boolean` | `false` | Include `export default` handlers |

## Runtime options

`validate` and `serializeError` are **runtime** options — they hold closures
(and usually imports like zod/valibot), so they're passed when you register the
handlers in the main process, not in the bundler config:

```ts
import { registerIpcHandlers } from 'virtual:electron-ipc/main'

registerIpcHandlers({
  // Validate/transform renderer args in main before dispatch.
  // Return a new args array to replace them, or throw to reject.
  validate(channel, args) {
    if (channel === 'user:getUser') userIdSchema.parse(args[0])
  },
  // Customize the error payload sent to the renderer (default: {name,message,stack,...customFields}).
  serializeError(err) {
    return { name: 'Error', message: String(err) } // e.g. strip stack in production
  },
})
```

| Runtime option | Type | Default | Notes |
| --- | --- | --- | --- |
| `eventArg` | `boolean` | mirrors the `eventArg` plugin option | Pass `IpcMainInvokeEvent` as the first handler arg |
| `validate` | `(channel, args) => args \| void` | — | Validate/transform args in main before dispatch |
| `serializeError` | `(err) => unknown` | `{name,message,stack,...customFields}` | Error payload sent to the renderer |

## Detection rules

By default every **exported function** in a scanned dir becomes a handler.
Type-only exports (`export type`/`interface`), non-function value exports, and
`export default` (unless `allowDefault`) are skipped. For explicit control, use
`mode: 'marker'`:

```ts
import { defineIpcHandler } from 'electron-ipc-auto-import/runtime/main'
export const ping = defineIpcHandler(() => 'pong')
```

## Namespacing & collisions

`user.ts` → `window.ipc.user.*`; with `namespace: 'folder'`,
`user/profile.ts` → `window.ipc.user.profile.*`. Duplicate channels or bridge
members are a **hard error** by default (set `failOnCollision: false` to downgrade
to warnings) — silent last-wins would let the renderer call the wrong handler.

## Errors

Handler rejections round-trip into real `Error` instances on the renderer with
`name`, `message`, `stack`, and custom fields (e.g. `code`) intact:

```ts
try {
  await window.ipc.user.getUser(999)
} catch (e) {
  e.name    // 'NotFoundError'
  e.code    // 'E_NOT_FOUND'
}
```

## Security

Designed for `contextIsolation: true` + `sandbox: true`. The bridge exposes only
a frozen object of invokers — never `ipcRenderer`, never node. Use `validate` to
reject untrusted args in the main process (pairs well with zod/valibot).

## Examples

- [`examples/electron-vite-app`](examples/electron-vite-app) — electron-vite integration
- [`examples/electron-webpack-app`](examples/electron-webpack-app) — webpack integration
- [`playground`](playground) — minimal Electron app for breakpoint-debugging the plugin itself

## License

MIT
