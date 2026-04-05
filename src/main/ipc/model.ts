import { ipcMain, BrowserWindow } from 'electron'
import { ModelManager } from '../services/ModelManager'
import { WhisperBinaryManager } from '../services/WhisperBinaryManager'
import { locateWhisperCli, locateFFmpeg, locateFFprobe } from '../services/BinaryPaths'

const modelManager = new ModelManager()
const whisperBinaryManager = new WhisperBinaryManager()

export function registerModelIpc(): void {
  ipcMain.handle('model:getStatus', async () => {
    return {
      loaded: modelManager.isModelDownloaded(),
      path: modelManager.isModelDownloaded() ? modelManager.getModelPath() : null
    }
  })

  ipcMain.handle('model:load', async () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return

    if (modelManager.isModelDownloaded()) {
      win.webContents.send('model:loaded')
      return
    }

    try {
      await modelManager.downloadModel((fraction) => {
        win.webContents.send('model:downloadProgress', fraction)
      })
      win.webContents.send('model:loaded')
    } catch (err) {
      console.error('Model download failed:', err)
    }
  })

  // --- Dependency status: whisper-cli + ffmpeg ---

  ipcMain.handle('deps:getStatus', async () => {
    return {
      whisperAvailable: locateWhisperCli() !== null,
      whisperPath: locateWhisperCli(),
      ffmpegAvailable: locateFFmpeg() !== null,
      ffmpegPath: locateFFmpeg(),
      ffprobeAvailable: locateFFprobe() !== null,
      canAutoDownloadWhisper: whisperBinaryManager.canAutoDownload(),
      canAutoDownloadFFmpeg: whisperBinaryManager.canAutoDownloadFFmpeg(),
      whisperInstallInstructions: whisperBinaryManager.getInstallInstructions(),
      platform: process.platform
    }
  })

  ipcMain.handle('deps:downloadWhisper', async () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return

    try {
      await whisperBinaryManager.download((fraction) => {
        win.webContents.send('deps:whisperDownloadProgress', fraction)
      })
      win.webContents.send('deps:whisperReady')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Download failed'
      win.webContents.send('deps:whisperError', message)
    }
  })

  ipcMain.handle('deps:downloadFFmpeg', async () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return

    try {
      await whisperBinaryManager.downloadFFmpeg((fraction) => {
        win.webContents.send('deps:ffmpegDownloadProgress', fraction)
      })
      win.webContents.send('deps:ffmpegReady')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'FFmpeg download failed'
      win.webContents.send('deps:ffmpegError', message)
    }
  })
}
