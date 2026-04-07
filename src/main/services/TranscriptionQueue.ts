import { BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { pathToFileURL } from 'url'
import { TranscriptionService, PerformanceConfig } from './TranscriptionService'
import { ModelManager } from './ModelManager'
import { WhisperBinaryManager } from './WhisperBinaryManager'
import * as FileImportService from './FileImportService'
import { HistoryService } from './HistoryService'
import { locateWhisperCli, locateFFmpeg } from './BinaryPaths'
import { getFreeMemoryMB, getHardwareInfo } from './HardwareDetection'

interface QueueItem {
  sessionId: string
  filePath: string
  language: string | null
}

export class TranscriptionQueue {
  private queue: QueueItem[] = []
  private isProcessing = false
  private transcriptionService = new TranscriptionService()
  private modelManager: ModelManager
  private whisperBinaryManager: WhisperBinaryManager
  private historyService: HistoryService
  private getPerformanceConfig: () => PerformanceConfig

  constructor(
    modelManager: ModelManager,
    whisperBinaryManager: WhisperBinaryManager,
    historyService: HistoryService,
    getPerformanceConfig?: () => PerformanceConfig
  ) {
    this.modelManager = modelManager
    this.whisperBinaryManager = whisperBinaryManager
    this.historyService = historyService
    this.getPerformanceConfig = getPerformanceConfig || (() => ({
      accelerationMode: 'gpu' as const,
      flashAttention: true,
      threadCount: 'auto' as const
    }))
  }

  private getWindow(): BrowserWindow | null {
    const windows = BrowserWindow.getAllWindows()
    return windows.length > 0 ? windows[0] : null
  }

  private send(channel: string, ...args: unknown[]): void {
    const win = this.getWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, ...args)
    }
  }

  enqueue(items: Array<{ sessionId: string; filePath: string; language: string | null }>): void {
    for (const item of items) {
      this.queue.push(item)
    }
    if (!this.isProcessing) {
      this.processNext()
    }
  }

  cancel(sessionId: string): void {
    // If currently processing this session, kill the process
    const current = this.queue[0]
    if (current && current.sessionId === sessionId && this.isProcessing) {
      this.transcriptionService.cancel()
      // processNext will be called after the process exits
      return
    }
    // Otherwise remove from queue
    this.queue = this.queue.filter((item) => item.sessionId !== sessionId)
    this.send('queue:sessionRemoved', sessionId)
  }

  cancelAll(): void {
    const sessionIds = this.queue.map((item) => item.sessionId)
    this.queue = []
    if (this.isProcessing) {
      this.transcriptionService.cancel()
    }
    for (const id of sessionIds) {
      this.send('queue:sessionRemoved', id)
    }
  }

  private async processNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.isProcessing = false
      return
    }

    this.isProcessing = true
    const item = this.queue[0]
    const { sessionId, filePath, language } = item

    this.send('queue:sessionStarted', sessionId)

    try {
      // Pre-check: does the source file still exist?
      if (!existsSync(filePath)) {
        const name = filePath.split(/[/\\]/).pop() || filePath
        throw new Error(`The file "${name}" could not be found. It may have been moved or deleted.`)
      }

      // Ensure ffmpeg
      if (!locateFFmpeg()) {
        if (this.whisperBinaryManager.canAutoDownloadFFmpeg()) {
          this.send('queue:sessionProgress', sessionId, -1, null)
          await this.whisperBinaryManager.downloadFFmpeg((fraction) => {
            this.send('deps:ffmpegDownloadProgress', fraction)
          })
        } else {
          throw new Error('ffmpeg not found. Install via your package manager:\n  macOS: brew install ffmpeg\n  Linux: sudo apt install ffmpeg')
        }
      }

      // Ensure whisper-cli (correct architecture and GPU support)
      const needsArchFix = this.whisperBinaryManager.needsArchFix()
      const needsGpuUpgrade = this.whisperBinaryManager.needsGpuUpgrade()
      if (needsArchFix) {
        console.log('[queue] Wrong whisper-cli architecture detected, downloading native build')
      }
      if (needsGpuUpgrade) {
        console.log('[queue] CPU-only whisper-cli detected, upgrading to GPU-enabled build')
      }
      if (!locateWhisperCli() || needsArchFix || needsGpuUpgrade) {
        if (this.whisperBinaryManager.canAutoDownload()) {
          this.send('queue:sessionProgress', sessionId, -1, null)
          await this.whisperBinaryManager.download((fraction) => {
            this.send('deps:whisperDownloadProgress', fraction)
          }, needsArchFix || needsGpuUpgrade)
        } else {
          throw new Error(this.whisperBinaryManager.getInstallInstructions())
        }
      }

      // Ensure model
      if (!this.modelManager.isModelDownloaded()) {
        this.modelManager.deleteModel()
        this.send('queue:sessionProgress', sessionId, -1, null)
        await this.modelManager.downloadModel((fraction) => {
          this.send('model:downloadProgress', fraction)
        })
        this.send('model:loaded')
      }

      // Memory pre-check: warn if free RAM is too low for the active model
      const activeModel = this.modelManager.getActiveModel()
      const freeMB = getFreeMemoryMB()
      if (freeMB < activeModel.ramRequiredMB) {
        this.send('queue:memoryWarning', sessionId, {
          freeMemoryMB: freeMB,
          requiredMB: activeModel.ramRequiredMB,
          modelId: activeModel.id
        })
      }

      // Convert to WAV
      this.send('queue:sessionProgress', sessionId, -1, null)
      let wavPath: string
      try {
        wavPath = await FileImportService.convertToWav(filePath)
      } catch (err) {
        const code = err instanceof Error ? err.message : ''
        throw new Error(code === 'NO_AUDIO_STREAM'
          ? `The file doesn't contain an audio track.`
          : code === 'CORRUPT_FILE'
            ? `The file appears to be damaged or in an unsupported format.`
            : code === 'PERMISSION_DENIED'
              ? `Cannot access the file. Check permissions.`
              : `Could not process the file.`)
      }

      // Apply performance config before transcription
      this.transcriptionService.setPerformanceConfig(this.getPerformanceConfig())
      this.transcriptionService.setGpuBinarySupport(this.whisperBinaryManager.detectGpuSupport())

      // Transcribe
      const result = await this.transcriptionService.transcribe(
        wavPath,
        FileImportService.getFileName(filePath),
        this.modelManager.getModelPath(),
        language,
        (fraction, lang, eta) => {
          this.send('queue:sessionProgress', sessionId, fraction, lang, eta)
        },
        (segments) => {
          this.send('queue:sessionSegment', sessionId, segments)
        }
      )

      // Save to history
      const entry = this.historyService.save(result, filePath)

      // Generate thumbnail from original source file (non-blocking)
      if (filePath && FileImportService.isVideoFile(filePath)) {
        const thumbPath = this.historyService.getThumbnailSavePath(entry.id)
        FileImportService.generateThumbnail(filePath, thumbPath).catch(() => {})
      }

      // Notify completion
      const resolvedMedia = this.historyService.resolveMediaPath(entry)
      this.send('queue:sessionCompleted', sessionId, {
        transcript: result,
        mediaPath: resolvedMedia ? pathToFileURL(resolvedMedia).toString() : null,
        entryId: entry.id
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Transcription failed'
      console.error(`[queue] Error for session ${sessionId}:`, message, err)

      // Detect model corruption
      if (message.includes('not all tensors') || message.includes('failed to initialize whisper') || message.includes('GGML_ASSERT')) {
        console.warn('[queue] Model appears corrupt, marking for re-download')
        this.modelManager.deleteModel()
      }

      // Detect ACCESS_VIOLATION on Windows — run diagnostics to provide actionable advice
      if (message.includes('ACCESS_VIOLATION') || message.includes('3221225501')) {
        const diag = this.whisperBinaryManager.diagnose()
        console.warn('[queue] ACCESS_VIOLATION diagnostics:', JSON.stringify(diag))

        let userMessage: string
        if (!diag.vcRuntimeInstalled) {
          const arch = process.arch === 'arm64' ? 'ARM64' : 'x64'
          const url = process.arch === 'arm64'
            ? 'https://aka.ms/vs/17/release/vc_redist.arm64.exe'
            : 'https://aka.ms/vs/17/release/vc_redist.x64.exe'
          userMessage = `whisper-cli crashed: Visual C++ Redistributable (${arch}) is not installed. ` +
            `Download "Microsoft Visual C++ 2015-2022 Redistributable (${arch})" from microsoft.com and restart the app. ` +
            url
        } else if (diag.missingDlls.length > 0) {
          userMessage = `whisper-cli crashed: missing DLL files (${diag.missingDlls.join(', ')}). ` +
            'Please reinstall whisper-cli from Settings → System Diagnostics.'
        } else {
          userMessage = 'whisper-cli crashed unexpectedly (ACCESS_VIOLATION). ' +
            'Try reinstalling whisper-cli from Settings → System Diagnostics. ' +
            'If the issue persists, check Settings → System Diagnostics for details.'
        }
        this.send('queue:sessionError', sessionId, userMessage)
      } else if (!message.includes('cancelled')) {
        this.send('queue:sessionError', sessionId, message)
      } else {
        this.send('queue:sessionRemoved', sessionId)
      }
    }

    // Move to next item
    this.queue.shift()
    this.processNext()
  }
}
