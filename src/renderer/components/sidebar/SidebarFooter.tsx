interface Props {
  username: string | null
  onSettingsClick: () => void
}

export function SidebarFooter({ username, onSettingsClick }: Props) {
  const handleRevealStorage = () => {
    // Open storage location using Electron IPC (mirror Settings.tsx behavior)
    window.electronAPI.settings.revealStorage()
  };
  return (
    <div style={styles.footer}>
      <div style={styles.footerUser}>
        <div style={styles.userAvatar}>{username ? username.slice(0, 2).toUpperCase() : '?'}</div>
        <span style={styles.userName}>{username || 'User'}</span>
      </div>
      <div style={{flex: 1}} />
      <button onClick={handleRevealStorage} style={styles.showTranscriptsBtn} title="Reveal storage">
        &#128194;
      </button>
      <button onClick={onSettingsClick} style={styles.settingsBtn} title="Settings">
        &#x2699;
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    borderTop: '1px solid var(--color-border)',
    flexShrink: 0
  },
  footerUser: {
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  userAvatar: {
    width: 26,
    height: 26,
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--color-surface)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--color-secondary)'
  },
  userName: {
    fontSize: 'var(--font-caption)',
    fontWeight: 500
  },
  showTranscriptsBtn: {
    width: 28,
    height: 28,
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'transparent',
    color: 'var(--color-secondary)',
    cursor: 'pointer',
    fontSize: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  settingsBtn: {
    width: 28,
    height: 28,
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'transparent',
    color: 'var(--color-secondary)',
    cursor: 'pointer',
    fontSize: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }
}
