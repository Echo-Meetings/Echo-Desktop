import { useEffect, useState } from 'react'
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

  // Load settings and history on mount
  useEffect(() => {
    async function loadSettings() {
      const onboarded = await window.electronAPI.settings.get('hasCompletedOnboarding')
      if (onboarded) useAppStore.getState().setHasCompletedOnboarding(true)

      const lang = await window.electronAPI.settings.get('languageOverride')
      if (typeof lang === 'string') useAppStore.getState().setLanguageOverride(lang)

      // Check if model AND dependencies are ready
      const [modelStatus, depsStatus] = await Promise.all([
        window.electronAPI.model.getStatus(),
        window.electronAPI.deps.getStatus()
      ])
      // Only mark model ready if all deps are also available
      if (modelStatus.loaded && depsStatus.whisperAvailable && depsStatus.ffmpegAvailable) {
        useAppStore.getState().setModelReady(true)
      }

      // Load history
      const entries = await window.electronAPI.history.getAll()
      useAppStore.getState().setHistoryEntries(entries as never[])
    }
    loadSettings()
  }, [])

  // Subscribe to transcription streaming events
  useEffect(() => {
    const unsubs = [
      window.electronAPI.on('transcription:progress', (progress, lang) => {
        useAppStore.getState().setTranscriptionProgress(progress as number)
        if (lang) useAppStore.getState().setDetectedLanguage(lang as string)
      }),
      window.electronAPI.on('transcription:segment', (segments) => {
        useAppStore.getState().appendLiveSegments(segments as never[])
      }),
      window.electronAPI.on('transcription:complete', async (result) => {
        const r = result as { transcript: never; mediaPath: string | null }
        useAppStore.getState().completeTranscription(r.transcript, r.mediaPath)
        // Reload history to include the new entry
        const entries = await window.electronAPI.history.getAll()
        useAppStore.getState().setHistoryEntries(entries as never[])
      }),
      window.electronAPI.on('transcription:error', (error) => {
        const e = error as { message: string; retryFilePath: string | null }
        useAppStore.getState().setError(e.message, e.retryFilePath)
      }),
      window.electronAPI.on('model:downloadProgress', (progress) => {
        useAppStore.getState().setModelDownloadProgress(progress as number)
      }),
      window.electronAPI.on('model:loaded', () => {
        useAppStore.getState().setModelReady(true)
      })
    ]
    return () => unsubs.forEach((u) => u())
  }, [])

  // Routing: onboarding → model setup → main layout
  if (!hasCompletedOnboarding) {
    return <Onboarding />
  }

  if (!isModelReady) {
    return <ModelSetup />
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <Sidebar />
      <div
        style={{
          width: 1,
          backgroundColor: 'var(--color-border)',
          flexShrink: 0
        }}
      />
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        <ContentRouter phase={phase} viewingEntry={viewingEntry} />
      </main>
    </div>
  )
}

function ContentRouter({
  phase,
  viewingEntry
}: {
  phase: ReturnType<typeof useAppStore.getState>['phase']
  viewingEntry: ReturnType<typeof useAppStore.getState>['viewingEntry']
}) {
  const [historyMediaPath, setHistoryMediaPath] = useState<string | null>(null)

  // Resolve media path when viewing a history entry
  useEffect(() => {
    setHistoryMediaPath(null) // Reset immediately to prevent stale video
    if (viewingEntry) {
      const entryId = viewingEntry.id
      window.electronAPI.history.getMediaUrl(entryId).then((path) => {
        // Only update if we're still viewing the same entry
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
        key={viewingEntry.id}
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

  // Phase-based routing (mirrors ContentView.swift)
  switch (phase.type) {
    case 'empty':
      return <DropZone />
    case 'processing':
      return <ProcessingView fileName={phase.fileName} />
    case 'result':
      return <TranscriptView transcript={phase.transcript} mediaPath={phase.mediaPath} />
    case 'error':
      return <ErrorView message={phase.message} retryFilePath={phase.retryFilePath} />
  }
}
