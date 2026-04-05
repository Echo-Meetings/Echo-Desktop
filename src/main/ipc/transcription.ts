import { ipcMain } from 'electron'
import { ModelManager } from '../services/ModelManager'
import { WhisperBinaryManager } from '../services/WhisperBinaryManager'
import { HistoryService } from '../services/HistoryService'
import { TranscriptionQueue } from '../services/TranscriptionQueue'

const modelManager = new ModelManager()
const whisperBinaryManager = new WhisperBinaryManager()
const historyService = new HistoryService()
const queue = new TranscriptionQueue(modelManager, whisperBinaryManager, historyService)

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
