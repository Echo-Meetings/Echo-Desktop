import type { ElectronAPI } from '../../preload/index'

declare global {
  interface Window {
    electronAPI: ElectronAPI
    setProgress?: (pct: number) => void
    finishLoading?: () => void
  }
}
