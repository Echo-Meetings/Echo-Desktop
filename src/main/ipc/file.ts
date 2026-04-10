import { ipcMain, dialog } from 'electron'
import * as FileImportService from '../services/FileImportService'

const SUPPORTED_EXTENSIONS = ['mkv', 'webm', 'mp4', 'm4v', 'mp3', 'm4a', 'wav', 'mov', 'ogg']

export function registerFileIpc(): void {
  ipcMain.handle('file:openPicker', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Audio & Video',
          extensions: SUPPORTED_EXTENSIONS
        }
      ],
      message: 'Choose audio or video files to transcribe'
    })
    if (result.canceled || result.filePaths.length === 0) return []
    return result.filePaths
  })

  ipcMain.handle('file:validate', async (_event, filePath: string) => {
    return FileImportService.validate(filePath)
  })
}
