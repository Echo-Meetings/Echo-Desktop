import { ipcMain, dialog, nativeTheme, app, shell } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// Simple JSON settings store (replaces electron-store which requires ESM)
class SettingsStore {
  private filePath: string
  private data: Record<string, unknown>
  private defaults: Record<string, unknown>

  constructor(defaults: Record<string, unknown>) {
    this.defaults = defaults
    const userDataPath = app.getPath('userData')
    if (!existsSync(userDataPath)) mkdirSync(userDataPath, { recursive: true })
    this.filePath = join(userDataPath, 'settings.json')

    if (existsSync(this.filePath)) {
      try {
        this.data = JSON.parse(readFileSync(this.filePath, 'utf-8'))
      } catch {
        this.data = { ...defaults }
      }
    } else {
      this.data = { ...defaults }
    }
  }

  get(key: string): unknown {
    return key in this.data ? this.data[key] : this.defaults[key]
  }

  set(key: string, value: unknown): void {
    this.data[key] = value
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8')
  }
}

const store = new SettingsStore({
  languageOverride: 'auto',
  hasCompletedOnboarding: false,
  privacyConsent: false,
  storageDirectory: ''
})

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', (_event, key: string) => {
    return store.get(key)
  })

  ipcMain.handle('settings:set', (_event, key: string, value: unknown) => {
    store.set(key, value)
  })

  ipcMain.handle('settings:getStorageDirectory', () => {
    const dir = store.get('storageDirectory') as string
    if (dir) return dir
    const home = process.env.HOME || process.env.USERPROFILE || ''
    return join(home, 'Documents', 'EchoTranscripts')
  })

  ipcMain.handle('settings:setStorageDirectory', async (_event, _path: string) => {
    // TODO: Implement storage migration
    return {}
  })

  ipcMain.handle('settings:openDirectoryPicker', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      message: 'Choose where to save your transcripts'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('settings:getStorageSize', () => {
    const dir = store.get('storageDirectory') as string
    const home = process.env.HOME || process.env.USERPROFILE || ''
    const storageDir = dir || join(home, 'Documents', 'EchoTranscripts')
    return getDirSize(storageDir)
  })

  ipcMain.handle('settings:revealStorage', () => {
    const dir = store.get('storageDirectory') as string
    const home = process.env.HOME || process.env.USERPROFILE || ''
    const storageDir = dir || join(home, 'Documents', 'EchoTranscripts')
    shell.openPath(storageDir)
  })

  ipcMain.handle('platform:getTheme', () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  })

  nativeTheme.on('updated', () => {
    const { BrowserWindow } = require('electron')
    const windows = BrowserWindow.getAllWindows()
    const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    windows.forEach((w: Electron.BrowserWindow) => w.webContents.send('theme:changed', theme))
  })
}

function getDirSize(dirPath: string): number {
  if (!existsSync(dirPath)) return 0
  let total = 0
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name)
      if (entry.isDirectory()) {
        total += getDirSize(fullPath)
      } else {
        total += statSync(fullPath).size
      }
    }
  } catch { /* ignore permission errors */ }
  return total
}
