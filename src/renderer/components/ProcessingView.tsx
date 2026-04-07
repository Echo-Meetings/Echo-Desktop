import { useRef, useEffect, useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import { formatTimestamp } from '@/types/models'
import type { QueueSession } from '@/types/models'
import { useT, fmt } from '@/i18n'

interface ProcessingViewProps {
  session: QueueSession
}

export function ProcessingView({ session }: ProcessingViewProps) {
  const t = useT()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(0)

  const { fileName, progress, detectedLanguage, etaSeconds, liveSegments, status } = session

  // Smooth scroll to latest segment
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [liveSegments])

  // Stagger new segment animations
  useEffect(() => {
    if (liveSegments.length > visibleCount) {
      const timer = setTimeout(() => {
        setVisibleCount(liveSegments.length)
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [liveSegments.length, visibleCount])

  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const handleCancel = () => {
    setShowCancelConfirm(true)
  }

  const confirmCancel = async () => {
    await window.electronAPI.queue.cancel(session.sessionId)
    useAppStore.getState().removeSession(session.sessionId)
    useAppStore.getState().setFocusedSessionId(null)
    setShowCancelConfirm(false)
  }

  const percent = progress > 0 ? Math.min(Math.round(progress * 100), 100) : null
  const isQueued = status === 'queued'

  return (
    <div style={styles.container}>
      <style>{keyframes}</style>

      {/* Left panel -- progress info */}
      <div style={styles.leftPanel}>
        <div style={styles.thumbnailPlaceholder}>
          <div style={styles.thumbnailIcon}>
            {isQueued ? '⏳' : '〰'}
          </div>
        </div>

        <div style={styles.fileName}>{fileName}</div>

        {isQueued ? (
          <div style={styles.queuedLabel}>{t.waitingInQueue}</div>
        ) : (
          <div style={styles.progressSection}>
            <div style={styles.progressTrack}>
              <div
                style={{
                  ...styles.progressFill,
                  width: percent !== null ? `${percent}%` : '30%',
                  animation: percent === null ? 'indeterminate 1.5s ease-in-out infinite' : 'none'
                }}
              />
            </div>
            <div style={styles.progressLabel}>
              {percent !== null
                ? etaSeconds !== null && etaSeconds > 0
                  ? `${percent}% — ~${formatEta(etaSeconds)} ${t.remaining}`
                  : `${percent}%`
                : t.preparing}
            </div>
          </div>
        )}

        {detectedLanguage && (
          <div style={styles.languageBadge}>{detectedLanguage}</div>
        )}

        <button onClick={handleCancel} style={styles.cancelButton}>
          {t.cancel}
        </button>
      </div>

      {/* Cancel confirmation */}
      {showCancelConfirm && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalTitle}>{t.cancelTranscription}?</div>
            <div style={styles.modalText}>
              {fmt(t.cancelTranscriptionConfirm, { name: fileName })}
            </div>
            <div style={styles.modalActions}>
              <button onClick={() => setShowCancelConfirm(false)} style={styles.modalKeep}>
                {t.keepGoing}
              </button>
              <button onClick={confirmCancel} style={styles.modalCancel}>
                {t.cancelTranscription}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Right panel -- live transcript */}
      <div style={styles.rightPanel}>
        {liveSegments.length === 0 ? (
          <div style={styles.emptyTranscript}>
            <div style={styles.pulsingDot} />
            <div style={styles.emptyText}>
              {isQueued ? t.queuedStatus : t.transcribing}
            </div>
            <div style={styles.emptyHint}>
              {isQueued
                ? t.queuedHint
                : t.transcribingHint}
            </div>
          </div>
        ) : (
          <div ref={scrollRef} style={styles.segmentList}>
            {liveSegments.map((segment, index) => (
              <div
                key={segment.id}
                style={{
                  ...styles.segmentRow,
                  animation: index >= visibleCount - 3 ? 'segmentFadeIn 0.4s ease-out forwards' : 'none',
                  opacity: index >= visibleCount - 3 ? undefined : 1
                }}
              >
                <span style={styles.segmentTime}>
                  {formatTimestamp(segment.startTime)}
                </span>
                <span style={styles.segmentText}>{segment.text}</span>
              </div>
            ))}
            {percent !== null && percent < 100 && (
              <div style={styles.typingIndicator}>
                <span style={styles.typingDot} />
                <span style={{ ...styles.typingDot, animationDelay: '0.15s' }} />
                <span style={{ ...styles.typingDot, animationDelay: '0.3s' }} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}

const keyframes = `
@keyframes segmentFadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

@keyframes dotBounce {
  0%, 100% { opacity: 0.3; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-3px); }
}

@keyframes indeterminate {
  0% { margin-left: 0; width: 30%; }
  50% { margin-left: 35%; width: 30%; }
  100% { margin-left: 70%; width: 30%; }
}
`

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    height: '100%',
    overflow: 'hidden'
  },
  leftPanel: {
    width: 280,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--spacing-lg)',
    gap: 16,
    background: 'linear-gradient(180deg, var(--color-surface) 0%, var(--color-background) 100%)'
  },
  thumbnailPlaceholder: {
    width: 200,
    height: 140,
    borderRadius: 'var(--radius-xl)',
    backgroundColor: 'var(--color-highlight)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  thumbnailIcon: {
    fontSize: 40,
    opacity: 0.5
  },
  fileName: {
    fontSize: 'var(--font-heading)',
    fontWeight: 600,
    textAlign: 'center',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical'
  },
  queuedLabel: {
    fontSize: 'var(--font-body)',
    color: 'var(--color-secondary)',
    fontStyle: 'italic'
  },
  progressSection: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 6
  },
  progressTrack: {
    height: 4,
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--color-border)',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--color-foreground)',
    transition: 'width 400ms ease-in-out'
  },
  progressLabel: {
    fontSize: 'var(--font-caption)',
    color: 'var(--color-secondary)',
    textAlign: 'center'
  },
  languageBadge: {
    fontSize: 'var(--font-caption)',
    color: 'var(--color-secondary)',
    backgroundColor: 'var(--color-surface)',
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)'
  },
  cancelButton: {
    padding: '6px 16px',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'transparent',
    color: 'var(--color-secondary)',
    fontSize: 'var(--font-button)',
    cursor: 'pointer',
    marginTop: 8,
    transition: 'var(--transition-fast)'
  },
  rightPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  emptyTranscript: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    opacity: 0.6
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: 'var(--color-secondary)',
    animation: 'pulse 1.5s ease-in-out infinite',
    marginBottom: 4
  },
  emptyText: {
    fontSize: 'var(--font-heading)',
    fontWeight: 600
  },
  emptyHint: {
    fontSize: 'var(--font-body)',
    color: 'var(--color-secondary)',
    textAlign: 'center',
    maxWidth: 300
  },
  segmentList: {
    flex: 1,
    overflowY: 'auto',
    padding: 'var(--spacing-md)',
    scrollBehavior: 'smooth'
  },
  segmentRow: {
    display: 'flex',
    gap: 12,
    padding: '8px 0',
    lineHeight: 1.5,
    opacity: 0
  },
  segmentTime: {
    fontSize: 'var(--font-caption)',
    color: 'var(--color-secondary)',
    fontFamily: 'monospace',
    flexShrink: 0,
    width: 48,
    paddingTop: 2
  },
  segmentText: {
    fontSize: 'var(--font-body)',
    lineHeight: 1.6,
    userSelect: 'text'
  },
  typingIndicator: {
    display: 'flex',
    gap: 4,
    padding: '12px 0 12px 60px',
    alignItems: 'center'
  },
  typingDot: {
    width: 5,
    height: 5,
    borderRadius: '50%',
    backgroundColor: 'var(--color-secondary)',
    animation: 'dotBounce 0.8s ease-in-out infinite',
    display: 'inline-block'
  },
  modalOverlay: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200
  },
  modal: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: 12,
    padding: 20,
    width: 340,
    boxShadow: '0 12px 40px rgba(0,0,0,0.3)'
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: 600,
    marginBottom: 8
  },
  modalText: {
    fontSize: 13,
    color: 'var(--color-secondary)',
    marginBottom: 20,
    lineHeight: 1.5
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8
  },
  modalKeep: {
    padding: '7px 16px',
    border: '1px solid var(--color-border)',
    borderRadius: 6,
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-foreground)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer'
  },
  modalCancel: {
    padding: '7px 16px',
    border: 'none',
    borderRadius: 6,
    backgroundColor: 'var(--color-destructive)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer'
  }
}
