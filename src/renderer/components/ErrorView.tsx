import { useAppStore } from '@/stores/appStore'

interface ErrorViewProps {
  message: string
  retryFilePath: string | null
}

export function ErrorView({ message, retryFilePath }: ErrorViewProps) {
  const { resetToDropZone, startProcessing } = useAppStore()

  const handleRetry = async () => {
    if (!retryFilePath) return
    const fileName = retryFilePath.split(/[/\\]/).pop() || retryFilePath
    startProcessing(fileName, retryFilePath)
    await window.electronAPI.transcription.start(
      retryFilePath,
      useAppStore.getState().languageOverride === 'auto'
        ? null
        : useAppStore.getState().languageOverride
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconCircle}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div style={styles.message}>{message}</div>
        <div style={styles.actions}>
          {retryFilePath && (
            <button onClick={handleRetry} style={styles.button}>
              Try again
            </button>
          )}
          <button onClick={resetToDropZone} style={styles.buttonSecondary}>
            Choose another file
          </button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--spacing-xl)'
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    padding: '32px 40px',
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'var(--color-surface)',
    maxWidth: 420,
    textAlign: 'center'
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    backgroundColor: 'var(--color-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  message: {
    fontSize: 'var(--font-body)',
    color: 'var(--color-secondary)',
    lineHeight: 1.6
  },
  actions: {
    display: 'flex',
    gap: 10,
    marginTop: 8
  },
  button: {
    padding: '8px 20px',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--color-foreground)',
    color: 'var(--color-background)',
    fontSize: 'var(--font-button)',
    fontWeight: 500,
    cursor: 'pointer'
  },
  buttonSecondary: {
    padding: '8px 20px',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'transparent',
    color: 'var(--color-foreground)',
    fontSize: 'var(--font-button)',
    fontWeight: 500,
    cursor: 'pointer'
  }
}
