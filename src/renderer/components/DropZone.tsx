import { useState, useCallback } from 'react'
import { useAppStore } from '@/stores/appStore'
import { SUPPORTED_EXTENSIONS } from '@/types/models'
import { useT, fmt } from '@/i18n'

export function DropZone() {
  const t = useT()
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const enqueueFiles = useCallback(async (filePaths: string[]) => {
    setError(null)

    const validFiles: Array<{ sessionId: string; fileName: string; filePath: string }> = []
    const errors: string[] = []

    for (const filePath of filePaths) {
      const result = await window.electronAPI.file.validate(filePath)
      if (result.status === 'valid' || result.status === 'needsConversion') {
        const fileName = filePath.split(/[/\\]/).pop() || filePath
        const sessionId = crypto.randomUUID()
        validFiles.push({ sessionId, fileName, filePath })
      } else if (result.status === 'unsupportedFormat') {
        const name = filePath.split(/[/\\]/).pop() || filePath
        errors.push(fmt(t.unsupportedFormat, { name }))
      } else {
        const name = filePath.split(/[/\\]/).pop() || filePath
        errors.push(fmt(t.unreadable, { name }))
      }
    }

    if (errors.length > 0 && validFiles.length === 0) {
      setError(
        errors.length === 1
          ? errors[0]
          : fmt(t.filesNotSupported, { n: errors.length, formats: [...SUPPORTED_EXTENSIONS].join(', ') })
      )
      return
    }

    if (validFiles.length > 0) {
      const store = useAppStore.getState()
      const language = store.languageOverride === 'auto' ? null : store.languageOverride

      // Add to store
      store.enqueueFiles(validFiles)

      // Focus on first new file
      store.setFocusedSessionId(validFiles[0].sessionId)

      // Send to main process
      await window.electronAPI.queue.enqueue(
        validFiles.map((f) => ({
          sessionId: f.sessionId,
          filePath: f.filePath,
          language
        }))
      )

      if (errors.length > 0) {
        setError(fmt(t.filesSkipped, { n: errors.length }))
      }
    }
  }, [t])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        const paths = files.map((f) => (f as File & { path: string }).path)
        enqueueFiles(paths)
      }
    },
    [enqueueFiles]
  )

  const handleClick = useCallback(async () => {
    const filePaths = await window.electronAPI.file.openPicker()
    if (filePaths.length > 0) enqueueFiles(filePaths)
  }, [enqueueFiles])

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
        <div style={styles.title}>{t.dropTitle}</div>
        <div style={styles.subtitle}>
          {t.dropSubtitle}
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
