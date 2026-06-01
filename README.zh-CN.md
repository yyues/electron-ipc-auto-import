# electron-ipc-auto-import

> 自动发现项目里的导出函数，并把它们注册为**类型安全的 Electron IPC** —— 不再
> 手写 `ipcMain.handle`、不再维护 preload 桥接、不再担心 shared types 漂移。灵感
> 来自 [`unplugin-auto-import`](https://github.com/unplugin/unplugin-auto-import)，
> 基于 [`unplugin`](https://github.com/unjs/unplugin) 实现，可以无缝接入
> Vite / electron-vite、Webpack、Rspack、esbuild、Rollup。

English: [README.md](./README.md)

主进程里写一个普通函数：

```ts
// src/main/ipc/user.ts
export interface User { id: number; name: string }

/** 根据 id 取用户。 */
export function getUser(id: number): User {
  return db.get(id)
}
```

渲染进程直接调用，自动补全 + 推导返回类型：

```ts
// renderer
const user = await window.ipc.user.getUser(1) // user: User
```

完事了。插件会扫描你的 handler 目录，把主进程的注册逻辑和 preload 的
`contextBridge` 桥接以**虚拟模块**形式生成出来，并同时产出一份物理
`.d.ts`，直接给 `window.ipc` 加上来自源码签名的类型。

## 工作原理

| 构建目标 | 生成内容 | 你怎么用 |
| --- | --- | --- |
| **main** | `virtual:electron-ipc/main` —— 把每个 handler 绑到 `ipcMain.handle` | 在 `app.whenReady()` 之后调用一次 `registerIpcHandlers()` |
| **preload** | `virtual:electron-ipc/preload` —— `contextBridge.exposeInMainWorld('ipc', …)` | `import 'virtual:electron-ipc/preload'`（side effect） |
| **renderer** | 物理 `.d.ts`，扩展 `Window` | 什么都不用做，`window.ipc.*` 直接有类型 |

生成的 `.d.ts` 通过 `typeof import('…')` 引用你的源码，类型自动跟随且**在编译期
被擦除**，主进程代码不会泄漏到渲染端 bundle。preload 桥闭包里只持有字面量
channel 字符串，渲染端无法 invoke 任意未声明的 channel。

## 安装

```bash
npm i -D electron-ipc-auto-import
```

## electron-vite 接入

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
  main:     { plugins: [externalizeDepsPlugin(), ipc()] },
  preload:  { plugins: [externalizeDepsPlugin(), ipc()] },
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

在某个 `env.d.ts` 里引用一次虚拟模块声明 + 生成的物理类型：

```ts
/// <reference types="electron-ipc-auto-import/client" />
/// <reference path="./preload/ipc-auto-import.d.ts" />
```

## Webpack 接入

```js
// webpack.config.cjs
const electronIpc = require('electron-ipc-auto-import/webpack').default

module.exports = {
  // ……
  plugins: [
    electronIpc({
      root: __dirname,
      dirs: ['src/main/ipc'],
      dts: 'src/preload/ipc-auto-import.d.ts',
    }),
  ],
}
```

> 完整 webpack 示例（main + preload + renderer 三套 config）见
> [`examples/electron-webpack-app`](examples/electron-webpack-app)。

其他打包器：从 `electron-ipc-auto-import/rspack`、`/esbuild`、`/rollup` 引入。

## 配置项

| 选项 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `dirs` | `string[]` | `['src/ipc', 'src/main/ipc']` | 扫描的 handler 目录 |
| `include` | `FilterPattern` | `[/\.[cm]?[tj]sx?$/]` | 命中文件正则 |
| `exclude` | `FilterPattern` | node_modules / `.d.ts` / 测试 | 生成的 dts 路径会自动排除 |
| `mode` | `'all-exports' \| 'marker'` | `'all-exports'` | `marker` 模式下只注册被 `defineIpcHandler(...)` 包裹的导出 |
| `markerName` | `string` | `'defineIpcHandler'` | `marker` 模式的标记函数名 |
| `namespace` | `'file' \| 'folder' \| 'flat' \| (file) => string` | `'file'` | `window.ipc.<ns>` 的派生策略 |
| `channelName` | `(ctx) => string` | `` `${ns}:${name}` `` | 运行时的 channel 字符串 |
| `eventArg` | `boolean` | `false` | 把 `IpcMainInvokeEvent` 作为 handler 第一个参数（渲染端签名会自动去掉它） |
| `bridgeName` | `string` | `'ipc'` | 暴露到 `window` 上的全局名 |
| `dts` | `string \| false` | `'src/ipc-auto-import.d.ts'` | 生成 dts 的输出路径，`false` 关闭 |
| `pathStyle` | `'relative' \| 'absolute' \| 'alias'` | `'relative'` | dts 内 import 路径写法（`relative` 跨机器可移植，推荐） |
| `failOnCollision` | `boolean` | `true` | 冲突的 channel / bridge key 直接报错 |
| `allowDefault` | `boolean` | `false` | 是否把 `export default` 也作为 handler |
| `validate` | `(channel, args) => args \| void` | — | 主进程派发前校验/改写参数 |
| `serializeError` | `(err) => unknown` | `{name,message,stack,code}` | 错误回传到渲染端的载荷 |

## 检测规则

默认情况下，扫描目录里**每一个导出的函数**都会被注册。会被跳过的有：
type-only 导出（`export type`/`interface`）、非函数值导出，以及
`export default`（除非 `allowDefault: true`）。需要更显式的控制就用
`mode: 'marker'`：

```ts
import { defineIpcHandler } from 'electron-ipc-auto-import/runtime/main'
export const ping = defineIpcHandler(() => 'pong')
```

## 命名空间与冲突

`user.ts` → `window.ipc.user.*`；用 `namespace: 'folder'` 时，
`user/profile.ts` → `window.ipc.user.profile.*`。重复的 channel / bridge 成员
默认是**硬错误**（`failOnCollision: false` 可降级为告警）—— 静默 last-wins 会让
渲染端调用到错误的 handler。

## 错误传递

handler 抛错会在渲染端落地为真实的 `Error` 实例，`name`、`message`、`stack` 与
自定义字段（例如 `code`）都会保留：

```ts
try {
  await window.ipc.user.getUser(999)
} catch (e) {
  e.name    // 'NotFoundError'
  e.code    // 'E_NOT_FOUND'
}
```

## 安全

为 `contextIsolation: true` + `sandbox: true` 的现代 Electron 配置而设计。桥
仅暴露一份被 freeze 的 invoker 对象——既不暴露 `ipcRenderer`，也不暴露 Node。
建议用 `validate` 在主进程里拒绝不可信参数（搭配 zod / valibot 都很合适）。

## 示例

- [`examples/electron-vite-app`](examples/electron-vite-app) —— electron-vite 集成
- [`examples/electron-webpack-app`](examples/electron-webpack-app) —— webpack 集成
- [`playground`](playground) —— 用于断点调试插件本身的最小 Electron 应用

## License

MIT
