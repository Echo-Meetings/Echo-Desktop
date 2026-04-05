import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { SUPPORTED_LANGUAGES } from '@/types/models'

interface SettingsProps {
  onClose: () => void
}

export function Settings({ onClose }: SettingsProps) {
  const { languageOverride, setLanguageOverride, setHasCompletedOnboarding } = useAppStore()
  const [storageDir, setStorageDir] = useState('')
  const [storageSize, setStorageSize] = useState(0)
  const [privacyConsent, setPrivacyConsent] = useState(false)

  useEffect(() => {
    window.electronAPI.settings.getStorageDirectory().then(setStorageDir)
    window.electronAPI.settings.getStorageSize().then(setStorageSize)
    window.electronAPI.settings.get('privacyConsent').then((v) => setPrivacyConsent(!!v))
  }, [])

  const handleLanguageChange = async (code: string) => {
    setLanguageOverride(code)
    await window.electronAPI.settings.set('languageOverride', code)
  }

  const handleRevealStorage = () => {
    window.electronAPI.settings.revealStorage()
  }

  const handleChangeStorage = async () => {
    const path = await window.electronAPI.settings.openDirectoryPicker()
    if (path) {
      await window.electronAPI.settings.setStorageDirectory(path)
      setStorageDir(path)
    }
  }

  const handleShowOnboarding = async () => {
    await window.electronAPI.settings.set('hasCompletedOnboarding', false)
    setHasCompletedOnboarding(false)
    onClose()
  }

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.window} onClick={(e) => e.stopPropagation()}>
        {/* Title bar */}
        <div style={styles.titleBar}>
          <button onClick={onClose} style={styles.closeButton} />
          <span style={styles.titleText}>Echo Settings</span>
        </div>

        <div style={styles.content}>
          {/* Transcription */}
          <div style={styles.sectionTitle}>Transcription</div>
          <div style={styles.card}>
            <div style={styles.row}>
              <span style={styles.rowLabel}>Language</span>
              <select
                value={languageOverride}
                onChange={(e) => handleLanguageChange(e.target.value)}
                style={styles.select}
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={styles.divider} />
            <div style={styles.hint}>
              When set to Auto-detect, Echo will automatically identify the spoken language.
            </div>
          </div>

          {/* Storage */}
          <div style={styles.sectionTitle}>Storage</div>
          <div style={styles.card}>
            <div style={styles.row}>
              <span style={styles.rowLabel}>Transcripts & media</span>
              <span style={styles.rowValue}>{storageDir}</span>
            </div>
            <div style={styles.rowButtons}>
              <button onClick={handleRevealStorage} style={styles.actionBtn}>
                Reveal in Finder
              </button>
              <button onClick={handleChangeStorage} style={styles.actionBtn}>
                Change...
              </button>
            </div>
            <div style={styles.divider} />
            <div style={styles.row}>
              <span style={styles.rowLabel}>Storage used</span>
              <span style={styles.rowValue}>{formatSize(storageSize)}</span>
            </div>
          </div>

          {/* Privacy & Legal */}
          <div style={styles.sectionTitle}>Privacy & Legal</div>
          <div style={styles.card}>
            <div style={styles.rowButtons}>
              <button onClick={() => {}} style={styles.actionBtn}>
                View Privacy Policy
              </button>
            </div>
            <div style={styles.divider} />
            <div style={styles.row}>
              <span style={styles.rowLabel}>Privacy consent</span>
              <span style={{ ...styles.rowValue, color: privacyConsent ? '#22c55e' : 'var(--color-secondary)' }}>
                {privacyConsent ? 'Accepted' : 'Not accepted'}
              </span>
            </div>
          </div>

          {/* About */}
          <div style={styles.sectionTitle}>About</div>
          <div style={styles.card}>
            <div style={styles.row}>
              <span style={styles.rowLabel}>Third-party software</span>
              <div style={styles.aboutText}>
                <div>whisper.cpp (MIT) — Speech recognition</div>
                <div>ffmpeg 8.1 (GPL) — Video conversion</div>
              </div>
            </div>
            <div style={styles.divider} />
            <div style={styles.rowButtons}>
              <button onClick={handleShowOnboarding} style={styles.actionBtn}>
                Show Onboarding Again
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: 60,
    zIndex: 300
  },
  window: {
    width: 560,
    maxHeight: 'calc(100vh - 120px)',
    backgroundColor: 'var(--color-background)',
    borderRadius: 10,
    boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  },
  titleBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    borderBottom: '1px solid var(--color-border)',
    flexShrink: 0
  },
  closeButton: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    backgroundColor: '#ff5f57',
    border: 'none',
    cursor: 'pointer',
    flexShrink: 0
  },
  titleText: {
    fontSize: 'var(--font-body)',
    fontWeight: 600,
    flex: 1,
    textAlign: 'center',
    marginRight: 22
  },
  content: {
    padding: '16px 20px 24px',
    overflowY: 'auto',
    flex: 1
  },
  sectionTitle: {
    fontSize: 'var(--font-body)',
    fontWeight: 700,
    marginTop: 16,
    marginBottom: 8
  },
  card: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-lg)',
    padding: '12px 16px',
    marginBottom: 4
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 0',
    gap: 12
  },
  rowLabel: {
    fontSize: 'var(--font-body)',
    flexShrink: 0
  },
  rowValue: {
    fontSize: 'var(--font-body)',
    color: 'var(--color-secondary)',
    textAlign: 'right',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  rowButtons: {
    display: 'flex',
    gap: 8,
    padding: '6px 0',
    justifyContent: 'flex-start'
  },
  actionBtn: {
    padding: '6px 14px',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--color-background)',
    color: 'var(--color-foreground)',
    fontSize: 'var(--font-caption)',
    cursor: 'pointer'
  },
  select: {
    padding: '4px 8px',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--color-background)',
    color: 'var(--color-foreground)',
    fontSize: 'var(--font-body)',
    cursor: 'pointer',
    outline: 'none'
  },
  divider: {
    height: 1,
    backgroundColor: 'var(--color-border)',
    margin: '4px 0'
  },
  hint: {
    fontSize: 'var(--font-caption)',
    color: 'var(--color-secondary)',
    padding: '4px 0'
  },
  aboutText: {
    fontSize: 'var(--font-caption)',
    color: 'var(--color-secondary)',
    textAlign: 'right',
    lineHeight: 1.6
  }
}
