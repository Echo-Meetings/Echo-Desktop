import { ipcMain, dialog } from 'electron'
import * as FileImportService from '../services/FileImportService'

const SUPPORTED_EXTENSIONS = ['webm', 'mp4', 'm4v', 'mp3', 'm4a', 'wav', 'mov', 'ogg']

export function registerFileIpc(): void {
  ipcMain.handle('file:openPicker', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        {
          name: 'Audio & Video',
          extensions: SUPPORTED_EXTENSIONS
        }
      ],
      message: 'Choose an audio or video file to transcribe'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('file:validate', async (_event, filePath: string) => {
    return FileImportService.validate(filePath)
  })
}
