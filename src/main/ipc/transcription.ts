import { ipcMain, BrowserWindow } from 'electron'
import { TranscriptionService } from '../services/TranscriptionService'
import { ModelManager } from '../services/ModelManager'
import { WhisperBinaryManager } from '../services/WhisperBinaryManager'
import * as FileImportService from '../services/FileImportService'
import { HistoryService } from '../services/HistoryService'
import { locateWhisperCli, locateFFmpeg } from '../services/BinaryPaths'
import { pathToFileURL } from 'url'

const transcriptionService = new TranscriptionService()
const modelManager = new ModelManager()
const whisperBinaryManager = new WhisperBinaryManager()
const historyService = new HistoryService()

export { historyService }

function getWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows()
  return windows.length > 0 ? windows[0] : null
}

export function registerTranscriptionIpc(): void {
  ipcMain.handle(
    'transcription:start',
    async (_event, filePath: string, language: string | null) => {
      const win = getWindow()
      if (!win) return

      try {
        // Cancel any running transcription first
        transcriptionService.cancel()

        // Step 0a: Ensure ffmpeg is available (needed for WAV conversion)
        if (!locateFFmpeg()) {
          if (whisperBinaryManager.canAutoDownloadFFmpeg()) {
            win.webContents.send('transcription:progress', -1, null)
            await whisperBinaryManager.downloadFFmpeg((fraction) => {
              win.webContents.send('deps:ffmpegDownloadProgress', fraction)
            })
          } else {
            win.webContents.send('transcription:error', {
              message: 'ffmpeg not found. Install via your package manager:\n  macOS: brew install ffmpeg\n  Linux: sudo apt install ffmpeg',
              retryFilePath: filePath
            })
            return
          }
        }

        // Step 0b: Ensure whisper-cli is available
        if (!locateWhisperCli()) {
          if (whisperBinaryManager.canAutoDownload()) {
            win.webContents.send('transcription:progress', -1, null)
            await whisperBinaryManager.download((fraction) => {
              win.webContents.send('deps:whisperDownloadProgress', fraction)
            })
          } else {
            win.webContents.send('transcription:error', {
              message: whisperBinaryManager.getInstallInstructions(),
              retryFilePath: filePath
            })
            return
          }
        }

        // Step 1: Ensure model is downloaded
        if (!modelManager.isModelDownloaded()) {
          win.webContents.send('transcription:progress', -1, null)
          await modelManager.downloadModel((fraction) => {
            win.webContents.send('model:downloadProgress', fraction)
          })
          win.webContents.send('model:loaded')
        }

        // Step 2: Convert to WAV
        win.webContents.send('transcription:progress', -1, null)
        let wavPath: string
        try {
          wavPath = await FileImportService.convertToWav(filePath)
        } catch (err) {
          const code = err instanceof Error ? err.message : ''
          const friendly = friendlyError(code, filePath)
          win.webContents.send('transcription:error', {
            message: friendly,
            retryFilePath: code === 'NO_AUDIO_STREAM' ? null : filePath
          })
          return
        }

        // Step 3: Transcribe
        const result = await transcriptionService.transcribe(
          wavPath,
          FileImportService.getFileName(filePath),
          modelManager.getModelPath(),
          language,
          (fraction, lang) => {
            win.webContents.send('transcription:progress', fraction, lang)
          },
          (segments) => {
            win.webContents.send('transcription:segment', segments)
          }
        )

        // Step 4: Save to history (HEVC conversion happens in background)
        const entry = historyService.save(result, filePath)

        // Step 5: Generate thumbnail (non-blocking)
        const mediaPath = historyService.resolveMediaPath(entry)
        if (mediaPath) {
          const thumbPath = historyService.getThumbnailSavePath(entry.id)
          FileImportService.generateThumbnail(mediaPath, thumbPath).catch(() => {})
        }

        // Step 6: Notify renderer
        const resolvedMedia = historyService.resolveMediaPath(entry)
        win.webContents.send('transcription:complete', {
          transcript: result,
          mediaPath: resolvedMedia ? pathToFileURL(resolvedMedia).toString() : null,
          entryId: entry.id
        })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Transcription failed'
        if (!message.includes('cancelled')) {
          win?.webContents.send('transcription:error', {
            message: friendlyError(message, filePath),
            retryFilePath: filePath
          })
        }
      }
    }
  )

  ipcMain.handle('transcription:cancel', async () => {
    transcriptionService.cancel()
  })
}

const FILE_NAME = (p: string) => p.split(/[/\\]/).pop() || p

function friendlyError(code: string, filePath: string): string {
  const name = FILE_NAME(filePath)
  switch (code) {
    case 'NO_AUDIO_STREAM':
      return `The file "${name}" doesn't contain an audio track. Only files with audio can be transcribed.`
    case 'CORRUPT_FILE':
      return `The file "${name}" appears to be damaged or in an unsupported format. Try re-exporting it from the original source.`
    case 'PERMISSION_DENIED':
      return `Cannot access "${name}". Check that you have permission to read this file.`
    case 'CONVERSION_FAILED':
      return `Could not process "${name}". The file might be in an unsupported format. Supported: MP4, MOV, MP3, M4A, WAV, WebM, OGG.`
    case 'FFMPEG_NOT_WORKING':
      return 'Audio processing tool (ffmpeg) is not responding. Try restarting the app.'
    default:
      if (code.includes('whisper-cli not found')) {
        return 'Speech recognition engine not found. Restart the app to download it automatically.'
      }
      if (code.includes('Whisper JSON output not found')) {
        return `Transcription of "${name}" failed. The file might be too short or contain only silence.`
      }
      return `Something went wrong while processing "${name}". Please try again.`
  }
}
