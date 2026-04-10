import { ipcMain, dialog } from 'electron'
import * as FileImportService from '../services/FileImportService'

const SUPPORTED_EXTENSIONS = ['mp4', 'mp3', 'webm', 'm4a', 'wav', 'mov', 'ogg', 'mkv', 'm4v', 'opus', 'flac']

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
