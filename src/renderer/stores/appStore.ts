import { create } from 'zustand'
import type {
  AppPhase,
  HistoryEntry,
  HistoryFilter,
  TranscriptSegment,
  TranscriptResult
} from '@/types/models'

interface AppStore {
  // Phase state machine
  phase: AppPhase
  setPhase: (phase: AppPhase) => void

  // Model state
  isModelReady: boolean
  modelDownloadProgress: number
  setModelReady: (ready: boolean) => void
  setModelDownloadProgress: (progress: number) => void

  // Transcription streaming state
  transcriptionProgress: number
  detectedLanguage: string | null
  liveSegments: TranscriptSegment[]
  setTranscriptionProgress: (progress: number) => void
  setDetectedLanguage: (lang: string | null) => void
  appendLiveSegments: (segments: TranscriptSegment[]) => void
  clearLiveSegments: () => void

  // History
  historyEntries: HistoryEntry[]
  selectedEntryId: string | null
  viewingEntry: HistoryEntry | null
  historyFilter: HistoryFilter
  historySearch: string
  setHistoryEntries: (entries: HistoryEntry[]) => void
  setSelectedEntryId: (id: string | null) => void
  setViewingEntry: (entry: HistoryEntry | null) => void
  setHistoryFilter: (filter: HistoryFilter) => void
  setHistorySearch: (search: string) => void

  // Settings
  languageOverride: string
  hasCompletedOnboarding: boolean
  setLanguageOverride: (lang: string) => void
  setHasCompletedOnboarding: (done: boolean) => void

  // Theme
  theme: 'dark' | 'light'
  setTheme: (theme: 'dark' | 'light') => void

  // Actions
  resetToDropZone: () => void
  startProcessing: (fileName: string, filePath: string | null) => void
  completeTranscription: (transcript: TranscriptResult, mediaPath: string | null) => void
  setError: (message: string, retryFilePath: string | null) => void
}

export const useAppStore = create<AppStore>((set) => ({
  // Phase
  phase: { type: 'empty' },
  setPhase: (phase) => set({ phase }),

  // Model
  isModelReady: false,
  modelDownloadProgress: 0,
  setModelReady: (ready) => set({ isModelReady: ready }),
  setModelDownloadProgress: (progress) => set({ modelDownloadProgress: progress }),

  // Transcription streaming
  transcriptionProgress: 0,
  detectedLanguage: null,
  liveSegments: [],
  setTranscriptionProgress: (progress) => set({ transcriptionProgress: progress }),
  setDetectedLanguage: (lang) => set({ detectedLanguage: lang }),
  appendLiveSegments: (segments) =>
    set((state) => ({ liveSegments: [...state.liveSegments, ...segments] })),
  clearLiveSegments: () => set({ liveSegments: [] }),

  // History
  historyEntries: [],
  selectedEntryId: null,
  viewingEntry: null,
  historyFilter: 'all',
  historySearch: '',
  setHistoryEntries: (entries) => set({ historyEntries: entries }),
  setSelectedEntryId: (id) => set({ selectedEntryId: id }),
  setViewingEntry: (entry) => set({ viewingEntry: entry }),
  setHistoryFilter: (filter) => set({ historyFilter: filter }),
  setHistorySearch: (search) => set({ historySearch: search }),

  // Settings
  languageOverride: 'auto',
  hasCompletedOnboarding: false,
  setLanguageOverride: (lang) => set({ languageOverride: lang }),
  setHasCompletedOnboarding: (done) => set({ hasCompletedOnboarding: done }),

  // Theme
  theme: 'dark',
  setTheme: (theme) => set({ theme }),

  // Actions
  resetToDropZone: () =>
    set({
      phase: { type: 'empty' },
      viewingEntry: null,
      selectedEntryId: null,
      detectedLanguage: null,
      liveSegments: [],
      transcriptionProgress: 0
    }),

  startProcessing: (fileName, filePath) =>
    set({
      phase: { type: 'processing', fileName, filePath },
      viewingEntry: null,
      selectedEntryId: null,
      detectedLanguage: null,
      liveSegments: [],
      transcriptionProgress: 0
    }),

  completeTranscription: (transcript, mediaPath) =>
    set({
      phase: { type: 'result', transcript, mediaPath },
      liveSegments: []
    }),

  setError: (message, retryFilePath) =>
    set({ phase: { type: 'error', message, retryFilePath } })
}))
