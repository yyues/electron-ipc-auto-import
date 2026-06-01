<script setup lang="ts">
// playground UI: each button invokes one IPC handler and prints the result.
// Hit a breakpoint in main/ipc/debug.ts to inspect the dispatch end-to-end.
import { ref } from 'vue'

type Invoker = (...args: unknown[]) => Promise<unknown>

interface Call {
  /** Dotted path into window.ipc, e.g. 'debug.echo' or 'nested.math.add'. */
  path: string
  /** Button label. */
  label: string
  /** Args passed to the handler. */
  args: unknown[]
}

interface Group {
  title: string
  calls: Call[]
}

// Paths match the API actually generated with `namespace: 'folder'`:
// `debug.ts` -> window.ipc.debug.*, `nested/math.ts` -> window.ipc.nested.math.*
const groups: Group[] = [
  {
    title: 'debug.*',
    calls: [
      { path: 'debug.dump', label: 'dump()', args: [] },
      { path: 'debug.echo', label: 'echo("hello")', args: ['hello'] },
      { path: 'debug.slow', label: 'slow(250)', args: [250] },
      { path: 'debug.throwError', label: 'throwError("boom")', args: ['boom'] },
    ],
  },
  {
    title: "nested.math.* (namespace: 'folder')",
    calls: [
      { path: 'nested.math.add', label: 'add(2, 3)', args: [2, 3] },
      { path: 'nested.math.mul', label: 'mul(6, 7)', args: [6, 7] },
    ],
  },
]

const out = ref('click a button to invoke an IPC handler…')

function resolveHandler(path: string): Invoker | undefined {
  let cursor: unknown = window.ipc
  for (const seg of path.split('.')) {
    if (cursor && typeof cursor === 'object' && seg in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[seg]
    } else {
      return undefined
    }
  }
  return typeof cursor === 'function' ? (cursor as Invoker) : undefined
}

async function invoke(call: Call): Promise<void> {
  const handler = resolveHandler(call.path)
  if (!handler) {
    out.value = `no handler at window.ipc.${call.path}`
    return
  }
  try {
    const result = await handler(...call.args)
    const printedArgs = call.args.map((a) => JSON.stringify(a)).join(', ')
    out.value = `window.ipc.${call.path}(${printedArgs}) ->\n${JSON.stringify(result, null, 2)}`
  } catch (err) {
    const e = err as Error & { code?: string }
    out.value = `window.ipc.${call.path} rejected -> ${e.name}: ${e.message}${e.code ? ` (code=${e.code})` : ''}`
  }
}
</script>

<template>
  <main>
    <h1>electron-ipc-auto-import · playground</h1>

    <section v-for="group in groups" :key="group.title" class="group">
      <h2>{{ group.title }}</h2>
      <button v-for="call in group.calls" :key="call.path" @click="invoke(call)">
        {{ call.label }}
      </button>
    </section>

    <pre>{{ out }}</pre>
  </main>
</template>

<style>
body {
  font: 14px ui-sans-serif, system-ui, sans-serif;
  margin: 0;
}
main {
  padding: 24px;
  max-width: 720px;
}
button {
  margin: 4px 6px 4px 0;
  padding: 6px 10px;
}
pre {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 6px;
  white-space: pre-wrap;
  min-height: 80px;
}
.group {
  margin-bottom: 16px;
}
h2 {
  margin: 12px 0 4px;
  font-size: 14px;
}
</style>
