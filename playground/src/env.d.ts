/// <reference types="vite/client" />
/// <reference types="electron-ipc-auto-import/client" />
/// <reference path="./preload/ipc-auto-import.d.ts" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
