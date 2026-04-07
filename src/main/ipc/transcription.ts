import { ipcMain, app } from 'electron'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { ModelManager } from '../services/ModelManager'
import { WhisperBinaryManager } from '../services/WhisperBinaryManager'
import { HistoryService } from '../services/HistoryService'
import { TranscriptionQueue } from '../services/TranscriptionQueue'
import type { PerformanceConfig } from '../services/TranscriptionService'

const modelManager = new ModelManager()
const whisperBinaryManager = new WhisperBinaryManager()
const historyService = new HistoryService()

function getPerformanceConfig(): PerformanceConfig {
  try {
    const settingsPath = join(app.getPath('userData'), 'settings.json')
    if (existsSync(settingsPath)) {
      const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'))
      return {
        accelerationMode: settings.accelerationMode || 'gpu',
        flashAttention: settings.flashAttention !== false,
        threadCount: settings.threadCount || 'auto'
      }
    }
  } catch { /* ok */ }
  return { accelerationMode: 'gpu', flashAttention: true, threadCount: 'auto' }
}

const queue = new TranscriptionQueue(modelManager, whisperBinaryManager, historyService, getPerformanceConfig)

// Restore saved active model from settings
try {
  const settingsPath = join(app.getPath('userData'), 'settings.json')
  if (existsSync(settingsPath)) {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'))
    if (settings.activeModel) {
      modelManager.setActiveModelId(settings.activeModel)
    }
  }
} catch { /* ok */ }

export { historyService, modelManager, whisperBinaryManager }

export function registerTranscriptionIpc(): void {
  // Queue-based transcription
  ipcMain.handle(
    'queue:enqueue',
    async (_event, items: Array<{ sessionId: string; filePath: string; language: string | null }>) => {
      queue.enqueue(items)
    }
  )

  ipcMain.handle('queue:cancel', async (_event, sessionId: string) => {
    queue.cancel(sessionId)
  })

  ipcMain.handle('queue:cancelAll', async () => {
    queue.cancelAll()
  })

  // Legacy single-file API (kept for backward compat during transition)
  ipcMain.handle(
    'transcription:start',
    async (_event, filePath: string, language: string | null) => {
      const sessionId = `legacy-${Date.now()}`
      queue.enqueue([{ sessionId, filePath, language }])
    }
  )

  ipcMain.handle('transcription:cancel', async () => {
    queue.cancelAll()
  })
}
