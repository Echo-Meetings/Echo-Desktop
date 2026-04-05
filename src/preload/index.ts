import { contextBridge, ipcRenderer } from 'electron'

export type ElectronAPI = typeof electronAPI

const electronAPI = {
  // File operations
  file: {
    openPicker: (): Promise<string | null> => ipcRenderer.invoke('file:openPicker'),
    validate: (filePath: string): Promise<{ status: string; filePath?: string }> =>
      ipcRenderer.invoke('file:validate', filePath)
  },

  // Transcription
  transcription: {
    start: (filePath: string, language: string | null): Promise<void> =>
      ipcRenderer.invoke('transcription:start', filePath, language),
    cancel: (): Promise<void> => ipcRenderer.invoke('transcription:cancel')
  },

  // History
  history: {
    getAll: (): Promise<unknown[]> => ipcRenderer.invoke('history:getAll'),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('history:delete', id),
    deleteMultiple: (ids: string[]): Promise<void> =>
      ipcRenderer.invoke('history:deleteMultiple', ids),
    getMediaUrl: (id: string): Promise<string | null> =>
      ipcRenderer.invoke('history:getMediaUrl', id),
    getThumbnail: (id: string): Promise<string | null> =>
      ipcRenderer.invoke('history:getThumbnail', id)
  },

  // Export
  export: {
    copyToClipboard: (text: string): Promise<void> =>
      ipcRenderer.invoke('export:clipboard', text),
    saveTxt: (fileName: string, content: string): Promise<{ status: string; path?: string }> =>
      ipcRenderer.invoke('export:saveTxt', fileName, content)
  },

  // Playback
  playback: {
    getWaveform: (filePath: string, sampleCount: number): Promise<number[]> =>
      ipcRenderer.invoke('playback:getWaveform', filePath, sampleCount)
  },

  // Model management
  model: {
    getStatus: (): Promise<{ loaded: boolean; path: string | null }> =>
      ipcRenderer.invoke('model:getStatus'),
    load: (): Promise<void> => ipcRenderer.invoke('model:load')
  },

  // Dependencies (whisper-cli, ffmpeg)
  deps: {
    getStatus: (): Promise<{
      whisperAvailable: boolean
      whisperPath: string | null
      ffmpegAvailable: boolean
      ffmpegPath: string | null
      ffprobeAvailable: boolean
      canAutoDownloadWhisper: boolean
      canAutoDownloadFFmpeg: boolean
      whisperInstallInstructions: string
      platform: string
    }> => ipcRenderer.invoke('deps:getStatus'),
    downloadWhisper: (): Promise<void> => ipcRenderer.invoke('deps:downloadWhisper'),
    downloadFFmpeg: (): Promise<void> => ipcRenderer.invoke('deps:downloadFFmpeg')
  },

  // Settings
  settings: {
    get: (key: string): Promise<unknown> => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: unknown): Promise<void> =>
      ipcRenderer.invoke('settings:set', key, value),
    getStorageDirectory: (): Promise<string> => ipcRenderer.invoke('settings:getStorageDirectory'),
    setStorageDirectory: (path: string): Promise<{ error?: string }> =>
      ipcRenderer.invoke('settings:setStorageDirectory', path),
    openDirectoryPicker: (): Promise<string | null> =>
      ipcRenderer.invoke('settings:openDirectoryPicker'),
    getStorageSize: (): Promise<number> => ipcRenderer.invoke('settings:getStorageSize'),
    revealStorage: (): Promise<void> => ipcRenderer.invoke('settings:revealStorage')
  },

  // Platform info
  platform: {
    get: (): string => process.platform,
    getTheme: (): Promise<string> => ipcRenderer.invoke('platform:getTheme')
  },

  // Event listeners (for streaming data from main process)
  on: (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    const allowedChannels = [
      'transcription:progress',
      'transcription:segment',
      'transcription:complete',
      'transcription:error',
      'model:downloadProgress',
      'model:loaded',
      'deps:whisperDownloadProgress',
      'deps:whisperReady',
      'deps:whisperError',
      'deps:ffmpegDownloadProgress',
      'deps:ffmpegReady',
      'deps:ffmpegError',
      'theme:changed'
    ]
    if (!allowedChannels.includes(channel)) {
      throw new Error(`IPC channel "${channel}" is not allowed`)
    }
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]): void => {
      callback(...args)
    }
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
