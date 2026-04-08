import type { QueueSession } from '@/types/models'
import { useT } from '@/i18n'

interface Props {
  sessions: QueueSession[]
  focusedSessionId: string | null
  onSessionClick: (session: QueueSession) => void
  onCancelSession: (e: React.MouseEvent, session: QueueSession) => void
}

export function ActiveSessions({ sessions, focusedSessionId, onSessionClick, onCancelSession }: Props) {
  const t = useT()
  if (sessions.length === 0) return null

  return (
    <div style={styles.activePanel}>
      <div style={styles.activePanelHeader}>
        {t.active} ({sessions.length})
      </div>
      {sessions.map((session) => (
        <button
          key={session.sessionId}
          onClick={() => onSessionClick(session)}
          style={{
            ...styles.activeRow,
            ...(focusedSessionId === session.sessionId ? styles.activeRowFocused : {})
          }}
        >
          <div style={styles.activeIndicator}>
            {session.status === 'processing' ? (
              <div style={styles.spinnerIcon}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                  <circle cx="8" cy="8" r="6" stroke="var(--color-border)" strokeWidth="2" />
                  <path d="M8 2a6 6 0 0 1 6 6" stroke="var(--color-foreground)" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
            ) : session.status === 'error' ? (
              <span style={{ color: 'var(--color-destructive)', fontSize: 12, fontWeight: 700 }}>!</span>
            ) : (
              <span style={{ fontSize: 10, color: 'var(--color-secondary)' }}>&#x23F3;</span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.activeFileName}>{session.fileName}</div>
            {session.status === 'processing' && (
              <div style={styles.progressBarTrack}>
                <div
                  style={{
                    ...styles.progressBarFill,
                    width: session.progress > 0 ? `${session.progress * 100}%` : '30%',
                    animation: session.progress <= 0 ? 'indeterminate 1.5s ease-in-out infinite' : 'none'
                  }}
                />
              </div>
            )}
            {session.status === 'queued' && (
              <div style={styles.queuedText}>{t.queued}</div>
            )}
            {session.status === 'error' && (
              <div style={styles.errorText}>{t.failed}</div>
            )}
          </div>
          <div
            onClick={(e) => onCancelSession(e, session)}
            style={styles.sessionCancelBtn}
            title="Cancel"
          >
            &#x2715;
          </div>
        </button>
      ))}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  activePanel: {
    flexShrink: 0,
    maxHeight: 200,
    overflowY: 'auto',
    borderBottom: '1px solid var(--color-border)',
    marginBottom: 4
  },
  activePanelHeader: {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--color-secondary)',
    padding: '6px 12px 2px',
    letterSpacing: 0.5
  },
  activeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    transition: 'var(--transition-fast)'
  },
  activeRowFocused: {
    backgroundColor: 'var(--color-highlight)'
  },
  activeIndicator: {
    width: 24,
    height: 24,
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--color-surface)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  spinnerIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  activeFileName: {
    fontSize: 12,
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--color-foreground)'
  },
  progressBarTrack: {
    height: 2,
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--color-border)',
    marginTop: 3,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--color-foreground)',
    transition: 'width 300ms ease-in-out'
  },
  queuedText: {
    fontSize: 10,
    color: 'var(--color-secondary)',
    marginTop: 2
  },
  errorText: {
    fontSize: 10,
    color: 'var(--color-destructive)',
    marginTop: 2
  },
  sessionCancelBtn: {
    fontSize: 9,
    color: 'var(--color-secondary)',
    cursor: 'pointer',
    padding: '2px 4px',
    borderRadius: 'var(--radius-sm)',
    opacity: 0.5,
    flexShrink: 0
  }
}
