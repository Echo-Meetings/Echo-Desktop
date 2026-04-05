import { ipcMain, dialog, clipboard } from 'electron'
import { writeFile } from 'fs/promises'

export function registerExportIpc(): void {
  ipcMain.handle('export:clipboard', (_event, text: string) => {
    clipboard.writeText(text)
  })

  ipcMain.handle('export:saveTxt', async (_event, fileName: string, content: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath: `${fileName}_transcript.txt`,
      filters: [{ name: 'Text Files', extensions: ['txt'] }]
    })
    if (result.canceled || !result.filePath) {
      return { status: 'cancelled' }
    }
    await writeFile(result.filePath, content, 'utf-8')
    return { status: 'saved', path: result.filePath }
  })
}
