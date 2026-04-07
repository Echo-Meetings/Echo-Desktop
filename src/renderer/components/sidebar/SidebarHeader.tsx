import { EchoLogo } from '../EchoLogo'
import { useT } from '@/i18n'

interface Props {
  onLogoClick: () => void
  onNewTranscription: () => void
}

export function SidebarHeader({ onLogoClick, onNewTranscription }: Props) {
  const t = useT()

  return (
    <>
      <div style={styles.header}>
        <div style={styles.logoRow} onClick={onLogoClick}>
          <div style={styles.logoIcon}><EchoLogo size={18} /></div>
          <span style={styles.logoText}>{t.appName}</span>
        </div>
      </div>
      <div style={styles.buttonWrapper}>
        <button onClick={onNewTranscription} style={styles.newButton}>
          <span style={{ fontSize: 16 }}>+</span>
          <span>{t.newTranscription}</span>
        </button>
      </div>
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    padding: '14px 12px 8px'
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer'
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: 'var(--color-foreground)',
    color: 'var(--color-background)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 700
  },
  logoText: {
    fontSize: 'var(--font-heading)',
    fontWeight: 700
  },
  buttonWrapper: {
    padding: '0 12px 8px'
  },
  newButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '8px 12px',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'transparent',
    color: 'var(--color-foreground)',
    fontSize: 'var(--font-button)',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'var(--transition-fast)'
  }
}
