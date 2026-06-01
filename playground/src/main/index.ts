import { resolve } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { registerIpcHandlers } from 'virtual:electron-ipc/main'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 900,
    height: 640,
    webPreferences: {
      preload: resolve(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  })

  // Always open devtools in the playground for fast iteration.
  win.webContents.openDevTools({ mode: 'detach' })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(resolve(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpcHandlers({
    // Validate every payload — flip a breakpoint here to inspect dispatches.
    validate: (channel, args) => {
      console.log('[ipc]', channel, args)
      return args
    },
  })
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
