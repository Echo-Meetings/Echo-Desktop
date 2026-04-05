import { ipcMain } from 'electron'
import { extractWaveform } from '../services/WaveformService'

export function registerPlaybackIpc(): void {
  ipcMain.handle('playback:getWaveform', async (_event, filePath: string, sampleCount: number) => {
    return extractWaveform(filePath, sampleCount)
  })
}
