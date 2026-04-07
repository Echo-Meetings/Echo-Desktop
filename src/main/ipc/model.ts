import { ipcMain, BrowserWindow } from 'electron'
import { statSync } from 'fs'
import { locateWhisperCli, locateFFmpeg, locateFFprobe } from '../services/BinaryPaths'
import { modelManager, whisperBinaryManager } from './transcription'
import { getHardwareInfo, getOptimalThreadCount } from '../services/HardwareDetection'

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
      modelManager.deleteModel()
      await modelManager.downloadModel((fraction) => {
        win.webContents.send('model:downloadProgress', fraction)
      })
      win.webContents.send('model:loaded')
    } catch (err) {
      console.error('Model download failed:', err)
    }
  })

  ipcMain.handle('model:delete', async (_event, modelId?: string) => {
    modelManager.deleteModel(modelId)
    return { deleted: true }
  })

  ipcMain.handle('model:getSize', async () => {
    const modelPath = modelManager.getModelPath()
    try {
      const stat = statSync(modelPath)
      return { size: stat.size, path: modelPath }
    } catch {
      return { size: 0, path: modelPath }
    }
  })

  // --- Multi-model management ---

  ipcMain.handle('model:getAvailableModels', async () => {
    return modelManager.getAvailableModels()
  })

  ipcMain.handle('model:getDownloadedModels', async () => {
    return modelManager.getDownloadedModels()
  })

  ipcMain.handle('model:getActiveModelId', async () => {
    return modelManager.getActiveModelId()
  })

  ipcMain.handle('model:setActiveModelId', async (_event, modelId: string) => {
    modelManager.setActiveModelId(modelId)
  })

  ipcMain.handle('model:downloadById', async (_event, modelId: string) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return

    try {
      await modelManager.downloadModel((fraction) => {
        win.webContents.send('model:downloadProgress', fraction)
      }, modelId)
      win.webContents.send('model:loaded')
    } catch (err) {
      console.error('Model download failed:', err)
    }
  })

  ipcMain.handle('model:getModelsDiskUsage', async () => {
    return modelManager.getModelsDiskUsage()
  })

  // --- Hardware info ---

  ipcMain.handle('hardware:getInfo', async () => {
    return {
      ...getHardwareInfo(),
      optimalThreads: getOptimalThreadCount()
    }
  })

  // --- Dependency status ---

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
      platform: process.platform,
      arch: process.arch,
      ...whisperBinaryManager.checkVcRuntime()
    }
  })

  ipcMain.handle('deps:diagnose', async () => {
    return whisperBinaryManager.diagnose()
  })

  ipcMain.handle('deps:deleteWhisper', async () => {
    whisperBinaryManager.deleteWhisperBinary()
    return { deleted: true }
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

  ipcMain.handle('deps:ensureAll', async () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return

    try {
      if (!locateFFmpeg() && whisperBinaryManager.canAutoDownloadFFmpeg()) {
        win.webContents.send('deps:status', 'Downloading ffmpeg...')
        await whisperBinaryManager.downloadFFmpeg((fraction) => {
          win.webContents.send('deps:ffmpegDownloadProgress', fraction)
        })
        win.webContents.send('deps:ffmpegReady')
      }

      if (!locateWhisperCli() && whisperBinaryManager.canAutoDownload()) {
        win.webContents.send('deps:status', 'Downloading whisper-cli...')
        await whisperBinaryManager.download((fraction) => {
          win.webContents.send('deps:whisperDownloadProgress', fraction)
        })
        win.webContents.send('deps:whisperReady')
      }

      if (!modelManager.isModelDownloaded()) {
        modelManager.deleteModel()
        const activeModel = modelManager.getActiveModel()
        win.webContents.send('deps:status', `Downloading AI model (~${Math.round(activeModel.sizeBytes / 1e9 * 10) / 10} GB)...`)
        await modelManager.downloadModel((fraction) => {
          win.webContents.send('model:downloadProgress', fraction)
        })
        win.webContents.send('model:loaded')
      }

      win.webContents.send('deps:status', null)
      win.webContents.send('deps:allReady')
    } catch (err) {
      console.error('[deps:ensureAll] Failed:', err)
      const message = err instanceof Error ? err.message : 'Download failed'
      win.webContents.send('deps:error', message)
    }
  })
}
