import { useEffect, useState, useCallback, useRef } from 'react'
import { useAppStore } from '@/stores/appStore'
import { Sidebar } from '@/components/Sidebar'
import { DropZone } from '@/components/DropZone'
import { ProcessingView } from '@/components/ProcessingView'
import { TranscriptView } from '@/components/TranscriptView'
import { ErrorView } from '@/components/ErrorView'
import { Onboarding } from '@/components/Onboarding'
import { ModelSetup } from '@/components/ModelSetup'

export default function App() {
  const {
    phase,
    isModelReady,
    hasCompletedOnboarding,
    viewingEntry,
    focusedSessionId,
    queueSessions,
    theme,
    setTheme
  } = useAppStore()

  // Initialize theme from system preference
  useEffect(() => {
    window.electronAPI.platform.getTheme().then((t) => {
      setTheme(t as 'dark' | 'light')
    })
    const unsubscribe = window.electronAPI.on('theme:changed', (t) => {
      setTheme(t as 'dark' | 'light')
    })
    return unsubscribe
  }, [setTheme])

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Load settings and history on mount — all IPC calls in parallel
  useEffect(() => {
    async function loadSettings() {
      const [onboarded, lang, savedUiLang, modelStatus, depsStatus, entries, { detectSystemLocale }] =
        await Promise.all([
          window.electronAPI.settings.get('hasCompletedOnboarding'),
          window.electronAPI.settings.get('languageOverride'),
          window.electronAPI.settings.get('uiLanguage'),
          window.electronAPI.model.getStatus(),
          window.electronAPI.deps.getStatus(),
          window.electronAPI.history.getAll(),
          import('@/i18n')
        ])

      if (onboarded) useAppStore.getState().setHasCompletedOnboarding(true)
      if (typeof lang === 'string') useAppStore.getState().setLanguageOverride(lang)

      if (savedUiLang && typeof savedUiLang === 'string') {
        useAppStore.getState().setUiLanguage(savedUiLang as 'en' | 'ru' | 'de' | 'fr')
      } else {
        useAppStore.getState().setUiLanguage(detectSystemLocale())
      }

      if (modelStatus.loaded && depsStatus.whisperAvailable && depsStatus.ffmpegAvailable) {
        useAppStore.getState().setModelReady(true)
      }

      useAppStore.getState().setHistoryEntries(entries as never[])

      // Dismiss preloader
      if (typeof window.finishLoading === 'function') window.finishLoading()
    }
    loadSettings()
  }, [])

  // Resizable sidebar (hooks must be before conditional returns)
  const [sidebarWidth, setSidebarWidth] = useState(260)
  const isResizing = useRef(false)

  const handleSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isResizing.current = true
    const startX = e.clientX
    const startWidth = sidebarWidth

    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return
      const newWidth = Math.max(200, Math.min(450, startWidth + (ev.clientX - startX)))
      setSidebarWidth(newWidth)
    }
    const onUp = () => {
      isResizing.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [sidebarWidth])

  // Subscribe to queue events
  useEffect(() => {
    const unsubs = [
      window.electronAPI.on('queue:sessionStarted', (sessionId) => {
        useAppStore.getState().updateSessionStatus(sessionId as string, 'processing')
      }),
      window.electronAPI.on('queue:sessionProgress', (sessionId, progress, lang) => {
        useAppStore.getState().updateSessionProgress(
          sessionId as string,
          progress as number,
          lang as string | null
        )
      }),
      window.electronAPI.on('queue:sessionSegment', (sessionId, segments) => {
        useAppStore.getState().appendSessionSegments(
          sessionId as string,
          segments as never[]
        )
      }),
      window.electronAPI.on('queue:sessionCompleted', async (sessionId, data) => {
        const d = data as { transcript: never; mediaPath: string | null; entryId: string | null }
        useAppStore.getState().completeSession(
          sessionId as string,
          d.transcript,
          d.mediaPath,
          d.entryId
        )
        // Reload history
        const entries = await window.electronAPI.history.getAll()
        useAppStore.getState().setHistoryEntries(entries as never[])

        // Auto-remove completed session from queue after 3 seconds
        setTimeout(() => {
          const state = useAppStore.getState()
          const session = state.queueSessions.find((s) => s.sessionId === sessionId)
          if (session?.status === 'completed') {
            // If user is focused on this session, switch to viewing the history entry
            if (state.focusedSessionId === sessionId && d.entryId) {
              const entry = state.historyEntries.find((e) => e.id === d.entryId)
              if (entry) {
                state.setViewingEntry(entry)
                state.setSelectedEntryId(entry.id)
              }
            }
            state.removeSession(sessionId as string)
          }
        }, 3000)
      }),
      window.electronAPI.on('queue:sessionError', (sessionId, message) => {
        useAppStore.getState().failSession(sessionId as string, message as string)
      }),
      window.electronAPI.on('queue:sessionRemoved', (sessionId) => {
        useAppStore.getState().removeSession(sessionId as string)
      }),
      // Model events
      window.electronAPI.on('model:downloadProgress', (progress) => {
        useAppStore.getState().setModelDownloadProgress(progress as number)
      }),
      window.electronAPI.on('model:loaded', () => {
        useAppStore.getState().setModelReady(true)
      })
    ]
    return () => unsubs.forEach((u) => u())
  }, [])

  // Notify main process about active sessions (for close warning)
  useEffect(() => {
    const hasActive = queueSessions.some(
      (s) => s.status === 'processing' || s.status === 'queued'
    )
    window.electronAPI.app.setActiveSessions(hasActive)
  }, [queueSessions])

  // Routing: onboarding -> model setup -> main layout
  if (!hasCompletedOnboarding) {
    return <Onboarding />
  }

  if (!isModelReady) {
    return <ModelSetup />
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <div style={{ width: sidebarWidth, flexShrink: 0, display: 'flex' }}>
        <Sidebar />
      </div>
      {/* Sidebar resize handle */}
      <div
        onMouseDown={handleSidebarResizeStart}
        style={{
          width: 5,
          cursor: 'col-resize',
          backgroundColor: 'transparent',
          flexShrink: 0,
          position: 'relative',
          zIndex: 10
        }}
      >
        <div style={{
          position: 'absolute',
          left: 2,
          top: 0,
          bottom: 0,
          width: 1,
          backgroundColor: 'var(--color-border)'
        }} />
      </div>
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        <ContentRouter
          phase={phase}
          viewingEntry={viewingEntry}
          focusedSessionId={focusedSessionId}
          queueSessions={queueSessions}
        />
      </main>
    </div>
  )
}

function ContentRouter({
  phase,
  viewingEntry,
  focusedSessionId,
  queueSessions
}: {
  phase: ReturnType<typeof useAppStore.getState>['phase']
  viewingEntry: ReturnType<typeof useAppStore.getState>['viewingEntry']
  focusedSessionId: string | null
  queueSessions: ReturnType<typeof useAppStore.getState>['queueSessions']
}) {
  const [historyMediaPath, setHistoryMediaPath] = useState<string | null>(null)

  // Resolve media path when viewing a history entry
  useEffect(() => {
    setHistoryMediaPath(null)
    if (viewingEntry) {
      const entryId = viewingEntry.id
      window.electronAPI.history.getMediaUrl(entryId).then((path) => {
        if (useAppStore.getState().viewingEntry?.id === entryId) {
          setHistoryMediaPath(path as string | null)
        }
      })
    }
  }, [viewingEntry])

  // If viewing a history entry, show its transcript
  if (viewingEntry) {
    return (
      <TranscriptView
        transcript={{
          fileName: viewingEntry.fileName,
          segments: viewingEntry.segments,
          detectedLanguage: viewingEntry.detectedLanguage,
          stats: viewingEntry.audioDuration
            ? {
                audioDuration: viewingEntry.audioDuration,
                transcriptionDuration: viewingEntry.transcriptionDuration || 0,
                wordCount: viewingEntry.wordCount || 0,
                characterCount: viewingEntry.characterCount || 0,
                speedRatio:
                  viewingEntry.audioDuration && viewingEntry.transcriptionDuration
                    ? viewingEntry.audioDuration / viewingEntry.transcriptionDuration
                    : 0
              }
            : null
        }}
        mediaPath={historyMediaPath}
      />
    )
  }

  // If focused on a queue session
  if (focusedSessionId) {
    const session = queueSessions.find((s) => s.sessionId === focusedSessionId)
    if (session) {
      if (session.status === 'processing' || session.status === 'queued') {
        return <ProcessingView session={session} />
      }
      if (session.status === 'completed' && session.result) {
        return (
          <TranscriptView
            key={session.sessionId}
            transcript={session.result}
            mediaPath={session.mediaPath}
          />
        )
      }
      if (session.status === 'error') {
        return (
          <ErrorView
            message={session.error || 'Transcription failed'}
            retryFilePath={session.filePath}
          />
        )
      }
    }
  }

  // Default: DropZone
  return <DropZone />
}
