import { useState, useCallback } from 'react'
import { useAppStore } from '@/stores/appStore'
import { SUPPORTED_EXTENSIONS } from '@/types/models'

export function DropZone() {
  const { startProcessing, phase } = useAppStore()
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isProcessing = phase.type === 'processing'

  const handleFile = useCallback(
    async (filePath: string) => {
      if (isProcessing) return // Block during active transcription
      setError(null)
      const result = await window.electronAPI.file.validate(filePath)
      if (result.status === 'valid' || result.status === 'needsConversion') {
        const fileName = filePath.split(/[/\\]/).pop() || filePath
        startProcessing(fileName, filePath)
        await window.electronAPI.transcription.start(
          filePath,
          useAppStore.getState().languageOverride === 'auto'
            ? null
            : useAppStore.getState().languageOverride
        )
      } else if (result.status === 'unsupportedFormat') {
        setError(
          `Unsupported format. Supported: ${[...SUPPORTED_EXTENSIONS].join(', ')}`
        )
      } else {
        setError("This file doesn't seem to contain audio.")
      }
    },
    [startProcessing, isProcessing]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) {
        // In Electron, file.path gives the absolute path
        handleFile((file as File & { path: string }).path)
      }
    },
    [handleFile]
  )

  const handleClick = useCallback(async () => {
    const filePath = await window.electronAPI.file.openPicker()
    if (filePath) handleFile(filePath)
  }, [handleFile])

  return (
    <div
      style={styles.container}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragOver(true)
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <div
        style={{
          ...styles.dropArea,
          borderColor: isDragOver ? 'var(--color-foreground)' : 'var(--color-border)',
          backgroundColor: isDragOver ? 'var(--color-surface)' : 'transparent'
        }}
      >
        <div style={styles.icon}>↓</div>
        <div style={styles.title}>Drop a file or click to browse</div>
        <div style={styles.subtitle}>
          Supports MP3, WAV, M4A, MP4, MOV, WebM, OGG
        </div>
        {error && <div style={styles.error}>{error}</div>}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    padding: 'var(--spacing-sm)',
    cursor: 'pointer',
    height: '100%'
  },
  dropArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    height: '100%',
    border: '2px dashed var(--color-border)',
    borderRadius: 'var(--radius-xl)',
    transition: 'var(--transition-normal)'
  },
  icon: {
    fontSize: 40,
    color: 'var(--color-secondary)',
    fontWeight: 300
  },
  title: {
    fontSize: 'var(--font-heading)',
    fontWeight: 600,
    color: 'var(--color-foreground)'
  },
  subtitle: {
    fontSize: 'var(--font-caption)',
    color: 'var(--color-secondary)',
    textAlign: 'center'
  },
  error: {
    fontSize: 'var(--font-caption)',
    color: 'var(--color-destructive)',
    textAlign: 'center',
    marginTop: 8
  }
}
