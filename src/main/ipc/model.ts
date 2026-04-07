import { ipcMain, BrowserWindow } from 'electron'
import { statSync } from 'fs'
import { locateWhisperCli, locateFFmpeg, locateFFprobe } from '../services/BinaryPaths'
import { modelManager, whisperBinaryManager } from './transcription'
import { getHardwareInfo, getOptimalThreadCount, getRecommendedBackend } from '../services/HardwareDetection'
import { getRecommendedModelId } from '../services/ModelManager'

function safeSend(channel: string, ...args: unknown[]): void {
  const win = BrowserWindow.getAllWindows()[0]
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, ...args)
  }
}

export function registerModelIpc(): void {
  ipcMain.handle('model:getStatus', async () => {
    return {
      loaded: modelManager.isModelDownloaded(),
      path: modelManager.isModelDownloaded() ? modelManager.getModelPath() : null
    }
  })

  ipcMain.handle('model:load', async () => {
    if (modelManager.isModelDownloaded()) {
      safeSend('model:loaded')
      return
    }

    try {
      modelManager.deleteModel()
      await modelManager.downloadModel((fraction) => {
        safeSend('model:downloadProgress', fraction)
      })
      safeSend('model:loaded')
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
    try {
      await modelManager.downloadModel((fraction) => {
        safeSend('model:downloadProgress', fraction)
      }, modelId, (info) => {
        safeSend('model:downloadDetailedProgress', info)
      })
      safeSend('model:loaded')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === 'Download cancelled') {
        safeSend('model:downloadCancelled')
      } else {
        console.error('Model download failed:', err)
      }
    }
  })

  ipcMain.handle('model:cancelDownload', async () => {
    modelManager.cancelDownload()
  })

  ipcMain.handle('model:getModelsDiskUsage', async () => {
    return modelManager.getModelsDiskUsage()
  })

  // --- Hardware info ---

  ipcMain.handle('hardware:getInfo', async () => {
    const info = getHardwareInfo()
    const gpuBinarySupport = whisperBinaryManager.detectGpuSupport()
    const gpuEffective = info.gpu.available && gpuBinarySupport !== 'none'
    const recommendedBackend = getRecommendedBackend(info.gpu)
    return {
      ...info,
      optimalThreads: getOptimalThreadCount(gpuEffective, gpuBinarySupport),
      gpuBinarySupport,
      gpuEffective,
      recommendedBackend
    }
  })

  ipcMain.handle('hardware:getRecommendedModel', async () => {
    return getRecommendedModelId(getHardwareInfo())
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
    try {
      await whisperBinaryManager.download((fraction) => {
        safeSend('deps:whisperDownloadProgress', fraction)
      })
      safeSend('deps:whisperReady')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Download failed'
      safeSend('deps:whisperError', message)
    }
  })

  ipcMain.handle('deps:downloadFFmpeg', async () => {
    try {
      await whisperBinaryManager.downloadFFmpeg((fraction) => {
        safeSend('deps:ffmpegDownloadProgress', fraction)
      })
      safeSend('deps:ffmpegReady')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'FFmpeg download failed'
      safeSend('deps:ffmpegError', message)
    }
  })

  ipcMain.handle('deps:ensureAll', async () => {
    try {
      if (!locateFFmpeg() && whisperBinaryManager.canAutoDownloadFFmpeg()) {
        safeSend('deps:status', 'Downloading ffmpeg...')
        await whisperBinaryManager.downloadFFmpeg((fraction) => {
          safeSend('deps:ffmpegDownloadProgress', fraction)
        })
        safeSend('deps:ffmpegReady')
      }

      if (!locateWhisperCli() && whisperBinaryManager.canAutoDownload()) {
        safeSend('deps:status', 'Downloading whisper-cli...')
        await whisperBinaryManager.download((fraction) => {
          safeSend('deps:whisperDownloadProgress', fraction)
        })
        safeSend('deps:whisperReady')
      }

      if (!modelManager.isModelDownloaded()) {
        modelManager.deleteModel()
        const activeModel = modelManager.getActiveModel()
        safeSend('deps:status', `Downloading AI model (~${Math.round(activeModel.sizeBytes / 1e9 * 10) / 10} GB)...`)
        await modelManager.downloadModel((fraction) => {
          safeSend('model:downloadProgress', fraction)
        })
        safeSend('model:loaded')
      }

      safeSend('deps:status', null)
      safeSend('deps:allReady')
    } catch (err) {
      console.error('[deps:ensureAll] Failed:', err)
      const message = err instanceof Error ? err.message : 'Download failed'
      safeSend('deps:error', message)
    }
  })
}
