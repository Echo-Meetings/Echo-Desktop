import { ipcMain } from 'electron'
import { FolderService } from '../services/FolderService'
import { historyService } from './history'

const folderService = new FolderService()

export { folderService }

export function registerFoldersIpc(): void {
  ipcMain.handle('folders:getMetadata', async () => {
    return folderService.loadMetadata()
  })

  ipcMain.handle('folders:createFolder', async (_event, name: string, parentId: string | null) => {
    return folderService.createFolder(name, parentId)
  })

  ipcMain.handle('folders:renameFolder', async (_event, id: string, name: string) => {
    return folderService.renameFolder(id, name)
  })

  ipcMain.handle('folders:deleteFolder', async (_event, id: string) => {
    const deletedIds = folderService.deleteFolder(id)
    // Move entries from deleted folders to root
    await historyService.unfoldEntries(deletedIds)
  })

  ipcMain.handle('folders:moveFolder', async (_event, id: string, newParentId: string | null) => {
    return folderService.moveFolder(id, newParentId)
  })

  ipcMain.handle('folders:createTag', async (_event, name: string, color: string) => {
    return folderService.createTag(name, color)
  })

  ipcMain.handle('folders:updateTag', async (_event, id: string, name: string, color: string) => {
    return folderService.updateTag(id, name, color)
  })

  ipcMain.handle('folders:deleteTag', async (_event, id: string) => {
    folderService.deleteTag(id)
    // Remove tag from all entries
    await historyService.removeTagFromAll(id)
  })
}
