import { contextBridge, ipcRenderer } from 'electron'

export type ElectronAPI = typeof electronAPI

const electronAPI = {
  // File operations
  file: {
    openPicker: (): Promise<string[]> => ipcRenderer.invoke('file:openPicker'),
    validate: (filePath: string): Promise<{ status: string; filePath?: string }> =>
      ipcRenderer.invoke('file:validate', filePath)
  },

  // Queue-based transcription
  queue: {
    enqueue: (items: Array<{ sessionId: string; filePath: string; language: string | null }>): Promise<void> =>
      ipcRenderer.invoke('queue:enqueue', items),
    cancel: (sessionId: string): Promise<void> =>
      ipcRenderer.invoke('queue:cancel', sessionId),
    cancelAll: (): Promise<void> =>
      ipcRenderer.invoke('queue:cancelAll')
  },

  // Legacy transcription API (backward compat)
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
    rename: (id: string, newName: string): Promise<unknown> =>
      ipcRenderer.invoke('history:rename', id, newName),
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
    load: (): Promise<void> => ipcRenderer.invoke('model:load'),
    delete: (modelId?: string): Promise<{ deleted: boolean }> => ipcRenderer.invoke('model:delete', modelId),
    getSize: (): Promise<{ size: number; path: string }> => ipcRenderer.invoke('model:getSize'),
    getAvailableModels: (): Promise<Array<{
      id: string; filename: string; sizeBytes: number; ramRequiredMB: number
      labelKey: string; accuracy: string; speedMultiplier: number; multilingual: boolean
      category: string
    }>> => ipcRenderer.invoke('model:getAvailableModels'),
    cancelDownload: (): Promise<void> => ipcRenderer.invoke('model:cancelDownload'),
    getDownloadedModels: (): Promise<Record<string, boolean>> =>
      ipcRenderer.invoke('model:getDownloadedModels'),
    getActiveModelId: (): Promise<string> => ipcRenderer.invoke('model:getActiveModelId'),
    setActiveModelId: (modelId: string): Promise<void> =>
      ipcRenderer.invoke('model:setActiveModelId', modelId),
    downloadById: (modelId: string): Promise<void> =>
      ipcRenderer.invoke('model:downloadById', modelId),
    getModelsDiskUsage: (): Promise<number> => ipcRenderer.invoke('model:getModelsDiskUsage')
  },

  // Hardware info
  hardware: {
    getInfo: (): Promise<{
      cpuCores: number; totalMemoryMB: number; freeMemoryMB: number
      platform: string; arch: string; optimalThreads: number
      gpu: {
        available: boolean; backend: 'cuda' | 'metal' | 'vulkan' | 'none'
        vendor: 'nvidia' | 'amd' | 'intel' | 'apple' | 'unknown'
        name: string | null; vramMB: number | null
        cudaAvailable: boolean; vulkanAvailable: boolean; driverVersion: string | null
      }
      gpuBinarySupport: 'cuda' | 'vulkan' | 'metal' | 'none'
      gpuEffective: boolean
      recommendedBackend: 'cuda' | 'vulkan' | 'metal' | 'none'
    }> => ipcRenderer.invoke('hardware:getInfo'),
    getRecommendedModel: (): Promise<string> => ipcRenderer.invoke('hardware:getRecommendedModel')
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
      arch: string
      vcRuntimeInstalled: boolean
      vcRuntimeDownloadUrl: string
    }> => ipcRenderer.invoke('deps:getStatus'),
    diagnose: (): Promise<{
      ok: boolean
      whisperInstalled: boolean
      whisperBinaryValid: boolean
      ffmpegInstalled: boolean
      vcRuntimeInstalled: boolean
      missingDlls: string[]
      arch: string
      platform: string
      whisperPath: string | null
      ffmpegPath: string | null
      whisperVersion: string
      gpuBackend: 'cuda' | 'vulkan' | 'metal' | 'none'
    }> => ipcRenderer.invoke('deps:diagnose'),
    deleteWhisper: (): Promise<{ deleted: boolean }> => ipcRenderer.invoke('deps:deleteWhisper'),
    downloadWhisper: (): Promise<void> => ipcRenderer.invoke('deps:downloadWhisper'),
    downloadFFmpeg: (): Promise<void> => ipcRenderer.invoke('deps:downloadFFmpeg'),
    ensureAll: (): Promise<void> => ipcRenderer.invoke('deps:ensureAll')
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
    revealStorage: (): Promise<void> => ipcRenderer.invoke('settings:revealStorage'),
    showPrivacyPolicy: (locale?: string): Promise<boolean> => ipcRenderer.invoke('settings:showPrivacyPolicy', locale)
  },

  // Update check
  update: {
    check: (): Promise<{
      hasUpdate?: boolean
      currentVersion?: string
      latestVersion?: string
      releaseUrl?: string
      error?: string
    }> => ipcRenderer.invoke('update:check'),
    openRelease: (url: string): Promise<void> => ipcRenderer.invoke('update:openRelease', url),
    getVersion: (): Promise<string> => ipcRenderer.invoke('update:getVersion')
  },

  // App lifecycle
  app: {
    setActiveSessions: (active: boolean): Promise<void> =>
      ipcRenderer.invoke('app:setActiveSessions', active)
  },

  // Logs
  logs: {
    getRecent: (): Promise<Array<{ timestamp: string; level: string; tag: string; message: string }>> =>
      ipcRenderer.invoke('logs:getRecent'),
    readFile: (): Promise<string> => ipcRenderer.invoke('logs:readFile'),
    reveal: (): Promise<void> => ipcRenderer.invoke('logs:reveal')
  },

  // Platform info
  platform: {
    get: (): string => process.platform,
    getTheme: (): Promise<string> => ipcRenderer.invoke('platform:getTheme'),
    getUsername: (): Promise<string | null> => ipcRenderer.invoke('platform:getUsername')
  },

  // Event listeners (for streaming data from main process)
  on: (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    const allowedChannels = [
      // Queue events
      'queue:sessionStarted',
      'queue:sessionProgress',
      'queue:sessionSegment',
      'queue:sessionCompleted',
      'queue:sessionError',
      'queue:sessionRemoved',
      'queue:memoryWarning',
      'queue:gpuError',
      // Legacy transcription events
      'transcription:progress',
      'transcription:segment',
      'transcription:complete',
      'transcription:error',
      // Model/deps events
      'model:downloadProgress',
      'model:downloadDetailedProgress',
      'model:downloadCancelled',
      'model:loaded',
      'deps:whisperDownloadProgress',
      'deps:whisperReady',
      'deps:whisperError',
      'deps:ffmpegDownloadProgress',
      'deps:ffmpegReady',
      'deps:ffmpegError',
      'deps:status',
      'deps:allReady',
      'deps:error',
      // Theme
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
