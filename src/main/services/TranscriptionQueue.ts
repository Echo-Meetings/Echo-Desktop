import { BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { pathToFileURL } from 'url'
import { TranscriptionService } from './TranscriptionService'
import { ModelManager } from './ModelManager'
import { WhisperBinaryManager } from './WhisperBinaryManager'
import * as FileImportService from './FileImportService'
import { HistoryService } from './HistoryService'
import { locateWhisperCli, locateFFmpeg } from './BinaryPaths'

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

  constructor(modelManager: ModelManager, whisperBinaryManager: WhisperBinaryManager, historyService: HistoryService) {
    this.modelManager = modelManager
    this.whisperBinaryManager = whisperBinaryManager
    this.historyService = historyService
  }

  private getWindow(): BrowserWindow | null {
    const windows = BrowserWindow.getAllWindows()
    return windows.length > 0 ? windows[0] : null
  }

  private send(channel: string, ...args: unknown[]): void {
    this.getWindow()?.webContents.send(channel, ...args)
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

      // Ensure whisper-cli
      if (!locateWhisperCli()) {
        if (this.whisperBinaryManager.canAutoDownload()) {
          this.send('queue:sessionProgress', sessionId, -1, null)
          await this.whisperBinaryManager.download((fraction) => {
            this.send('deps:whisperDownloadProgress', fraction)
          })
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

      // Transcribe
      const result = await this.transcriptionService.transcribe(
        wavPath,
        FileImportService.getFileName(filePath),
        this.modelManager.getModelPath(),
        language,
        (fraction, lang) => {
          this.send('queue:sessionProgress', sessionId, fraction, lang)
        },
        (segments) => {
          this.send('queue:sessionSegment', sessionId, segments)
        }
      )

      // Save to history
      const entry = this.historyService.save(result, filePath)

      // Generate thumbnail (non-blocking)
      const mediaPath = this.historyService.resolveMediaPath(entry)
      if (mediaPath) {
        const thumbPath = this.historyService.getThumbnailSavePath(entry.id)
        FileImportService.generateThumbnail(mediaPath, thumbPath).catch(() => {})
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

      if (!message.includes('cancelled')) {
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
