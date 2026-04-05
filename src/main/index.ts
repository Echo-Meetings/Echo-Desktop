import { app, BrowserWindow, shell, nativeTheme, protocol, net, dialog, ipcMain, nativeImage } from 'electron'
import { join, extname } from 'path'
import { pathToFileURL } from 'url'
import { registerFileIpc } from './ipc/file'
import { registerHistoryIpc } from './ipc/history'
import { registerSettingsIpc } from './ipc/settings'
import { registerExportIpc } from './ipc/export'
import { registerTranscriptionIpc } from './ipc/transcription'
import { registerPlaybackIpc } from './ipc/playback'
import { registerModelIpc } from './ipc/model'

let mainWindow: BrowserWindow | null = null
let hasActiveSessions = false

function createWindow(): void {
  const iconPath = join(__dirname, '../../resources/icon.png')

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 900,
    minHeight: 520,
    show: false,
    title: 'Echo',
    icon: iconPath,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#111111' : '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false  // Allow file:// access for local media playback
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    if (process.env['ELECTRON_RENDERER_URL']) {
      mainWindow?.webContents.openDevTools({ mode: 'detach' })
    }
  })

  // Warn before closing if transcriptions are active
  mainWindow.on('close', (e) => {
    if (hasActiveSessions) {
      const choice = dialog.showMessageBoxSync(mainWindow!, {
        type: 'warning',
        buttons: ['Cancel', 'Quit Anyway'],
        defaultId: 0,
        cancelId: 0,
        title: 'Transcription in progress',
        message: 'One or more files are still being transcribed.',
        detail: 'If you quit now, progress will be lost. Are you sure?'
      })
      if (choice === 0) {
        e.preventDefault()
        return
      }
    }
  })

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Dev server in dev mode, file:// in production
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Register custom protocol for serving local media files
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-media', privileges: { stream: true, bypassCSP: true } }
])

app.whenReady().then(() => {
  // Register protocol handler for local media files
  // Use query param ?path= to avoid URL authority/path parsing issues across platforms
  // Return net.fetch directly — wrapping in new Response() breaks video streaming
  protocol.handle('local-media', (request) => {
    console.log('[local-media] Raw request.url:', request.url)

    let filePath: string | null = null
    try {
      const url = new URL(request.url)
      filePath = url.searchParams.get('path')
      console.log('[local-media] Parsed via URL searchParams:', filePath)
    } catch (e) {
      console.error('[local-media] URL parse failed:', e)
    }

    // Fallback: strip scheme prefix
    if (!filePath) {
      const stripped = request.url.replace(/^local-media:\/\/[^?]*\?path=/, '')
      if (stripped !== request.url) {
        filePath = decodeURIComponent(stripped)
        console.log('[local-media] Parsed via regex fallback:', filePath)
      } else {
        filePath = decodeURIComponent(request.url.replace('local-media://', ''))
        console.log('[local-media] Parsed via legacy fallback:', filePath)
      }
    }

    if (!filePath) {
      console.error('[local-media] No path resolved from:', request.url)
      return new Response('File path missing', { status: 400 })
    }

    const fileUrl = pathToFileURL(filePath).toString()
    console.log('[local-media] Serving:', filePath, '->', fileUrl)
    return net.fetch(fileUrl, { headers: request.headers })
  })

  // Track active transcription sessions for close warning
  ipcMain.handle('app:setActiveSessions', (_event, active: boolean) => {
    hasActiveSessions = active
  })

  // Register all IPC handlers
  registerFileIpc()
  registerHistoryIpc()
  registerSettingsIpc()
  registerExportIpc()
  registerTranscriptionIpc()
  registerPlaybackIpc()
  registerModelIpc()

  // Set dock icon on macOS (ensures custom icon in dev mode too)
  if (process.platform === 'darwin') {
    const dockIcon = nativeImage.createFromPath(join(__dirname, '../../resources/icon.png'))
    if (!dockIcon.isEmpty()) {
      app.dock.setIcon(dockIcon)
    }
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}
