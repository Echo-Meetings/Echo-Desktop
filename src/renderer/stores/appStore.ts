import { create } from 'zustand'
import type {
  AppPhase,
  HistoryEntry,
  HistoryFilter,
  TranscriptSegment,
  TranscriptResult,
  QueueSession,
  QueueSessionStatus
} from '@/types/models'

interface AppStore {
  // Phase state machine (for non-queue views)
  phase: AppPhase
  setPhase: (phase: AppPhase) => void

  // Model state
  isModelReady: boolean
  modelDownloadProgress: number
  setModelReady: (ready: boolean) => void
  setModelDownloadProgress: (progress: number) => void

  // Queue sessions
  queueSessions: QueueSession[]
  focusedSessionId: string | null
  enqueueFiles: (files: Array<{ sessionId: string; fileName: string; filePath: string }>) => void
  updateSessionStatus: (sessionId: string, status: QueueSessionStatus) => void
  updateSessionProgress: (sessionId: string, progress: number, language: string | null, etaSeconds?: number | null) => void
  appendSessionSegments: (sessionId: string, segments: TranscriptSegment[]) => void
  completeSession: (sessionId: string, result: TranscriptResult, mediaPath: string | null, entryId: string | null) => void
  failSession: (sessionId: string, error: string) => void
  removeSession: (sessionId: string) => void
  setFocusedSessionId: (id: string | null) => void

  // Legacy transcription streaming state (kept for ProcessingView compat)
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
  uiLanguage: 'en' | 'ru' | 'de' | 'fr'
  languageOverride: string
  hasCompletedOnboarding: boolean
  setUiLanguage: (lang: 'en' | 'ru' | 'de' | 'fr') => void
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

  // Queue sessions
  queueSessions: [],
  focusedSessionId: null,

  enqueueFiles: (files) =>
    set((state) => ({
      queueSessions: [
        ...state.queueSessions,
        ...files.map((f) => ({
          sessionId: f.sessionId,
          fileName: f.fileName,
          filePath: f.filePath,
          status: 'queued' as const,
          progress: 0,
          detectedLanguage: null,
          etaSeconds: null,
          liveSegments: [],
          error: null,
          result: null,
          mediaPath: null,
          entryId: null,
          addedAt: Date.now()
        }))
      ]
    })),

  updateSessionStatus: (sessionId, status) =>
    set((state) => ({
      queueSessions: state.queueSessions.map((s) =>
        s.sessionId === sessionId ? { ...s, status } : s
      )
    })),

  updateSessionProgress: (sessionId, progress, language, etaSeconds) =>
    set((state) => ({
      queueSessions: state.queueSessions.map((s) =>
        s.sessionId === sessionId
          ? { ...s, progress, detectedLanguage: language || s.detectedLanguage, etaSeconds: etaSeconds ?? s.etaSeconds }
          : s
      )
    })),

  appendSessionSegments: (sessionId, segments) =>
    set((state) => ({
      queueSessions: state.queueSessions.map((s) =>
        s.sessionId === sessionId
          ? { ...s, liveSegments: [...s.liveSegments, ...segments] }
          : s
      )
    })),

  completeSession: (sessionId, result, mediaPath, entryId) =>
    set((state) => ({
      queueSessions: state.queueSessions.map((s) =>
        s.sessionId === sessionId
          ? { ...s, status: 'completed' as const, result, mediaPath, entryId, liveSegments: [] }
          : s
      )
    })),

  failSession: (sessionId, error) =>
    set((state) => ({
      queueSessions: state.queueSessions.map((s) =>
        s.sessionId === sessionId
          ? { ...s, status: 'error' as const, error }
          : s
      )
    })),

  removeSession: (sessionId) =>
    set((state) => ({
      queueSessions: state.queueSessions.filter((s) => s.sessionId !== sessionId),
      focusedSessionId: state.focusedSessionId === sessionId ? null : state.focusedSessionId
    })),

  setFocusedSessionId: (id) => set({ focusedSessionId: id, viewingEntry: null, selectedEntryId: null }),

  // Legacy transcription streaming
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
  setViewingEntry: (entry) => set({ viewingEntry: entry, focusedSessionId: null }),
  setHistoryFilter: (filter) => set({ historyFilter: filter }),
  setHistorySearch: (search) => set({ historySearch: search }),

  // Settings
  uiLanguage: 'en',
  languageOverride: 'auto',
  hasCompletedOnboarding: false,
  setUiLanguage: (lang) => set({ uiLanguage: lang }),
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
      focusedSessionId: null,
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
