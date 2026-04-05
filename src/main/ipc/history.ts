import { ipcMain } from 'electron'
import { HistoryService } from '../services/HistoryService'
import { readFileSync } from 'fs'
import { pathToFileURL } from 'url'

const historyService = new HistoryService()

export { historyService }

export function registerHistoryIpc(): void {
  ipcMain.handle('history:getAll', async () => {
    return historyService.loadAll()
  })

  ipcMain.handle('history:delete', async (_event, id: string) => {
    historyService.delete(id)
  })

  ipcMain.handle('history:deleteMultiple', async (_event, ids: string[]) => {
    for (const id of ids) {
      historyService.delete(id)
    }
  })

  ipcMain.handle('history:getMediaUrl', async (_event, id: string) => {
    const entries = historyService.loadAll()
    const entry = entries.find((e) => e.id === id)
    if (!entry) return null
    const filePath = historyService.resolveMediaPath(entry)
    return filePath ? pathToFileURL(filePath).toString() : null
  })

  ipcMain.handle('history:getThumbnail', async (_event, id: string) => {
    const thumbPath = historyService.getThumbnailPath(id)
    if (!thumbPath) return null
    try {
      const data = readFileSync(thumbPath)
      return `data:image/jpeg;base64,${data.toString('base64')}`
    } catch {
      return null
    }
  })
}
