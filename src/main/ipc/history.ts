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

  ipcMain.handle('history:rename', async (_event, id: string, newName: string) => {
    return historyService.rename(id, newName)
  })

  ipcMain.handle('history:getMediaUrl', async (_event, id: string) => {
    const entry = historyService.loadById(id)
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

  ipcMain.handle('history:moveToFolder', async (_event, id: string, folderId: string | null) => {
    historyService.moveToFolder(id, folderId)
  })

  ipcMain.handle('history:moveMultipleToFolder', async (_event, ids: string[], folderId: string | null) => {
    historyService.moveMultipleToFolder(ids, folderId)
  })

  ipcMain.handle('history:setTags', async (_event, id: string, tagIds: string[]) => {
    historyService.setTags(id, tagIds)
  })
}
