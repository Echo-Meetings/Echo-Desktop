import { useState, useCallback, useEffect, useRef, memo } from 'react'
import { useAppStore } from '@/stores/appStore'
import type { HistoryEntry, HistoryFilter, QueueSession } from '@/types/models'
import { formatDuration, VIDEO_EXTENSIONS } from '@/types/models'
import { Settings } from './Settings'
import { EchoLogo } from './EchoLogo'
import { useT, fmt } from '@/i18n'

export function Sidebar() {
  const {
    historyEntries,
    selectedEntryId,
    historyFilter,
    historySearch,
    queueSessions,
    focusedSessionId,
    setSelectedEntryId,
    setViewingEntry,
    setHistoryFilter,
    setHistorySearch,
    setFocusedSessionId,
    resetToDropZone
  } = useAppStore()

  const t = useT()

  const filterLabels: Record<HistoryFilter, string> = {
    all: t.filterAll,
    today: t.filterToday,
    yesterday: t.filterYesterday,
    last7Days: t.filter7d,
    last30Days: t.filter30d,
    custom: ''
  }

  const activeSessions = queueSessions.filter(
    (s) => s.status === 'processing' || s.status === 'queued' || s.status === 'error'
  )

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const isMultiSelect = selectedIds.size > 0

  // UI state
  const [deleteTarget, setDeleteTarget] = useState<HistoryEntry | null>(null)
  const [batchDeleteCount, setBatchDeleteCount] = useState(0)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: HistoryEntry } | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Thumbnail cache for video entries
  const [thumbnails, setThumbnails] = useState<Record<string, string | null>>({})

  useEffect(() => {
    const fetchThumbnails = async () => {
      const results: Record<string, string | null> = {}
      for (const entry of historyEntries) {
        const ext = entry.fileExtension?.toLowerCase() || ''
        if (VIDEO_EXTENSIONS.has(ext) && !thumbnails[entry.id]) {
          try {
            results[entry.id] = await window.electronAPI.history.getThumbnail(entry.id)
          } catch {
            results[entry.id] = null
          }
        }
      }
      if (Object.keys(results).length > 0) {
        setThumbnails((prev) => ({ ...prev, ...results }))
      }
    }
    fetchThumbnails()
  }, [historyEntries])

  // Filter entries
  const filteredEntries = historyEntries.filter((e) => {
    if (historyFilter !== 'all') {
      const now = new Date()
      const created = new Date(e.createdAt)
      const dayMs = 86400000
      if (historyFilter === 'today') {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
        if (created.getTime() < startOfToday) return false
      } else if (historyFilter === 'yesterday') {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
        const startOfYesterday = startOfToday - dayMs
        if (created.getTime() < startOfYesterday || created.getTime() >= startOfToday) return false
      } else if (historyFilter === 'last7Days') {
        if (now.getTime() - created.getTime() > 7 * dayMs) return false
      } else if (historyFilter === 'last30Days') {
        if (now.getTime() - created.getTime() > 30 * dayMs) return false
      }
    }
    if (historySearch) {
      return e.fileName.toLowerCase().includes(historySearch.toLowerCase())
    }
    return true
  })

  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clickCountRef = useRef(0)

  const handleSelectEntry = useCallback((entry: HistoryEntry, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(entry.id)) next.delete(entry.id)
        else next.add(entry.id)
        return next
      })
      return
    }

    clickCountRef.current++

    if (clickCountRef.current === 1) {
      // First click — wait to see if a second follows
      clickTimer.current = setTimeout(() => {
        clickCountRef.current = 0
        // Single click — select and view
        if (isMultiSelect) setSelectedIds(new Set())
        setSelectedEntryId(entry.id)
        setViewingEntry(entry)
      }, 250)
    } else if (clickCountRef.current === 2) {
      // Double click — rename
      if (clickTimer.current) clearTimeout(clickTimer.current)
      clickCountRef.current = 0
      // Make sure entry is selected first
      setSelectedEntryId(entry.id)
      setViewingEntry(entry)
      // Start rename
      setRenamingId(entry.id)
      setRenameValue(entry.fileName)
      setTimeout(() => renameInputRef.current?.select(), 50)
    }
  }, [isMultiSelect, setSelectedEntryId, setViewingEntry])

  const handleNewTranscription = async () => {
    setSelectedIds(new Set())
    const filePaths = await window.electronAPI.file.openPicker()
    if (filePaths.length > 0) {
      const store = useAppStore.getState()
      const language = store.languageOverride === 'auto' ? null : store.languageOverride
      const validFiles: Array<{ sessionId: string; fileName: string; filePath: string }> = []

      for (const filePath of filePaths) {
        const result = await window.electronAPI.file.validate(filePath)
        if (result.status === 'valid' || result.status === 'needsConversion') {
          const fileName = filePath.split(/[/\\]/).pop() || filePath
          validFiles.push({ sessionId: crypto.randomUUID(), fileName, filePath })
        }
      }

      if (validFiles.length > 0) {
        store.enqueueFiles(validFiles)
        store.setFocusedSessionId(validFiles[0].sessionId)
        await window.electronAPI.queue.enqueue(
          validFiles.map((f) => ({ sessionId: f.sessionId, filePath: f.filePath, language }))
        )
      }
    }
  }

  const handleSessionClick = (session: QueueSession) => {
    setFocusedSessionId(session.sessionId)
  }

  const [cancelTarget, setCancelTarget] = useState<QueueSession | null>(null)

  const handleCancelSession = (e: React.MouseEvent, session: QueueSession) => {
    e.stopPropagation()
    setCancelTarget(session)
  }

  const confirmCancelSession = async () => {
    if (cancelTarget) {
      await window.electronAPI.queue.cancel(cancelTarget.sessionId)
      useAppStore.getState().removeSession(cancelTarget.sessionId)
      setCancelTarget(null)
    }
  }

  // Delete via context menu
  const requestDelete = (entry: HistoryEntry) => {
    setContextMenu(null)
    setDeleteTarget(entry)
    setBatchDeleteCount(0)
  }

  const requestBatchDelete = () => {
    setBatchDeleteCount(selectedIds.size)
    setDeleteTarget(null)
  }

  const confirmDelete = async () => {
    if (batchDeleteCount > 0) {
      const ids = Array.from(selectedIds)
      await window.electronAPI.history.deleteMultiple(ids)
      setSelectedIds(new Set())
      if (selectedEntryId && ids.includes(selectedEntryId)) resetToDropZone()
    } else if (deleteTarget) {
      await window.electronAPI.history.delete(deleteTarget.id)
      if (selectedEntryId === deleteTarget.id) resetToDropZone()
    }
    const entries = await window.electronAPI.history.getAll()
    useAppStore.getState().setHistoryEntries(entries as never[])
    setDeleteTarget(null)
    setBatchDeleteCount(0)
  }

  const cancelDelete = () => {
    setDeleteTarget(null)
    setBatchDeleteCount(0)
  }

  const startRename = (entry: HistoryEntry) => {
    setContextMenu(null)
    setRenamingId(entry.id)
    setRenameValue(entry.fileName)
    setTimeout(() => renameInputRef.current?.select(), 50)
  }

  const renameSaving = useRef(false)
  const renamingIdRef = useRef<string | null>(null)
  const renameValueRef = useRef('')

  // Keep refs in sync with state
  renamingIdRef.current = renamingId
  renameValueRef.current = renameValue

  const doRename = useCallback(async () => {
    const id = renamingIdRef.current
    const name = renameValueRef.current
    if (!id || renameSaving.current) return
    if (!name.trim()) {
      setRenamingId(null)
      return
    }
    renameSaving.current = true
    setRenamingId(null)
    try {
      await window.electronAPI.history.rename(id, name.trim())
      const entries = await window.electronAPI.history.getAll()
      useAppStore.getState().setHistoryEntries(entries as never[])
      const store = useAppStore.getState()
      if (store.viewingEntry?.id === id) {
        const updated = (entries as any[]).find((e: any) => e.id === id)
        if (updated) store.setViewingEntry(updated)
      }
    } finally {
      renameSaving.current = false
    }
  }, [])

  const cancelRename = useCallback(() => {
    setRenamingId(null)
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent, entry: HistoryEntry) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, entry })
  }, [])

  const handleLogoClick = () => {
    setSelectedIds(new Set())
    resetToDropZone()
  }

  return (
    <aside style={styles.sidebar}>
      <style>{sidebarKeyframes}</style>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logoRow} onClick={handleLogoClick}>
          <div style={styles.logoIcon}><EchoLogo size={18} /></div>
          <span style={styles.logoText}>{t.appName}</span>
        </div>
      </div>

      {/* New Transcription Button */}
      <div style={styles.buttonWrapper}>
        <button onClick={handleNewTranscription} style={styles.newButton}>
          <span style={{ fontSize: 16 }}>+</span>
          <span>{t.newTranscription}</span>
        </button>
      </div>

      {/* Active Sessions Panel — always visible above search/filters */}
      {activeSessions.length > 0 && (
        <div style={styles.activePanel}>
          <div style={styles.activePanelHeader}>
            {t.active} ({activeSessions.length})
          </div>
          {activeSessions.map((session) => (
            <button
              key={session.sessionId}
              onClick={() => handleSessionClick(session)}
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
                  <span style={{ fontSize: 10, color: 'var(--color-secondary)' }}>⏳</span>
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
                onClick={(e) => handleCancelSession(e, session)}
                style={styles.sessionCancelBtn}
                title="Cancel"
              >
                ✕
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div style={styles.searchWrapper}>
        <div style={styles.searchField}>
          <span style={styles.searchIcon}>Q</span>
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            style={styles.searchInput}
          />
          {historySearch && (
            <button onClick={() => setHistorySearch('')} style={styles.clearButton}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filterBar}>
        {(['all', 'today', 'yesterday', 'last7Days', 'last30Days'] as HistoryFilter[]).map((key) => (
          <button
            key={key}
            onClick={() => setHistoryFilter(key)}
            style={{
              ...styles.filterChip,
              ...(historyFilter === key ? styles.filterChipActive : {})
            }}
          >
            {filterLabels[key]}
          </button>
        ))}
      </div>

      <div style={styles.divider} />

      {/* Batch actions bar */}
      {isMultiSelect && (
        <div style={styles.batchBar}>
          <span style={styles.batchText}>{selectedIds.size} {t.selected}</span>
          <button onClick={requestBatchDelete} style={styles.batchDeleteBtn}>
            {t.delete}
          </button>
          <button onClick={() => setSelectedIds(new Set())} style={styles.batchCancelBtn}>
            {t.cancel}
          </button>
        </div>
      )}

      {/* History List */}
      <div style={styles.historyList}>
        {historyEntries.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>〰</div>
            <div style={styles.emptyText}>{t.noTranscriptions}</div>
            <div style={styles.emptyHint}>{t.dropOrClick}</div>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyText}>{t.noResults}</div>
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <HistoryRow
              key={entry.id}
              entry={entry}
              isViewing={selectedEntryId === entry.id && !isMultiSelect}
              isSelected={selectedIds.has(entry.id)}
              isMultiSelect={isMultiSelect}
              thumbnail={thumbnails[entry.id] || null}
              renamingId={renamingId}
              renameValue={renameValue}
              renameInputRef={renameInputRef}
              onRenameChange={setRenameValue}
              onRenameBlur={doRename}
              onRenameKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); doRename() }
                if (e.key === 'Escape') cancelRename()
              }}
              onSelect={handleSelectEntry}
              onContextMenu={handleContextMenu}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <div style={styles.footerUser}>
          <div style={styles.userAvatar}>SE</div>
          <span style={styles.userName}>Sergey</span>
        </div>
        <button onClick={() => setShowSettings(true)} style={styles.settingsBtn} title="Settings">
          ⚙
        </button>
      </div>

      {/* Context menu (macOS-style) */}
      {contextMenu && (
        <div
          style={styles.contextOverlay}
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu(null) }}
        >
          <div style={{ ...styles.contextMenu, left: contextMenu.x, top: contextMenu.y }}>
            <button
              style={styles.contextMenuItem}
              onClick={() => startRename(contextMenu.entry)}
            >
              {t.rename}
            </button>
            <div style={{ height: 1, backgroundColor: 'var(--color-border)', margin: '2px 8px' }} />
            <button
              style={styles.contextMenuItem}
              onClick={() => requestDelete(contextMenu.entry)}
            >
              <span style={{ color: 'var(--color-destructive)' }}>{t.delete}</span>
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal (macOS-style) */}
      {(deleteTarget || batchDeleteCount > 0) && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalTitle}>
              {batchDeleteCount > 0
                ? fmt(t.deleteNTranscriptions, { n: batchDeleteCount })
                : t.deleteTranscription}
            </div>
            <div style={styles.modalText}>
              {batchDeleteCount > 0
                ? fmt(t.deleteConfirmBatch, { n: batchDeleteCount })
                : fmt(t.deleteConfirmSingle, { name: deleteTarget?.fileName || '' })}
            </div>
            <div style={styles.modalActions}>
              <button onClick={cancelDelete} style={styles.modalCancel}>
                {t.cancel}
              </button>
              <button onClick={confirmDelete} style={styles.modalDelete}>
                {t.delete}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel transcription confirmation */}
      {cancelTarget && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalTitle}>{t.cancelTranscription}</div>
            <div style={styles.modalText}>
              {fmt(t.cancelTranscriptionConfirm, { name: cancelTarget.fileName })}
            </div>
            <div style={styles.modalActions}>
              <button onClick={() => setCancelTarget(null)} style={styles.modalCancel}>
                {t.keepGoing}
              </button>
              <button onClick={confirmCancelSession} style={styles.modalDelete}>
                {t.cancelTranscription}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </aside>
  )
}

const sidebarKeyframes = `
@keyframes spin {
  to { transform: rotate(360deg); }
}
@keyframes pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}
@keyframes indeterminate {
  0% { margin-left: 0; width: 30%; }
  50% { margin-left: 35%; width: 30%; }
  100% { margin-left: 70%; width: 30%; }
}
`

interface HistoryRowProps {
  entry: HistoryEntry
  isViewing: boolean
  isSelected: boolean
  isMultiSelect: boolean
  thumbnail: string | null
  renamingId: string | null
  renameValue: string
  renameInputRef: React.RefObject<HTMLInputElement | null>
  onRenameChange: (value: string) => void
  onRenameBlur: () => void
  onRenameKeyDown: (e: React.KeyboardEvent) => void
  onSelect: (entry: HistoryEntry, e: React.MouseEvent) => void
  onContextMenu: (e: React.MouseEvent, entry: HistoryEntry) => void
}

const HistoryRow = memo(function HistoryRow({
  entry, isViewing, isSelected, isMultiSelect, thumbnail,
  renamingId, renameValue, renameInputRef,
  onRenameChange, onRenameBlur, onRenameKeyDown,
  onSelect, onContextMenu
}: HistoryRowProps) {
  const ext = entry.fileExtension?.toLowerCase() || ''
  const isVideo = VIDEO_EXTENSIONS.has(ext)

  return (
    <button
      key={entry.id}
      onClick={(e) => onSelect(entry, e)}
      onContextMenu={(e) => onContextMenu(e, entry)}
      style={{
        ...styles.historyRow,
        ...(isViewing ? styles.historyRowSelected : {}),
        ...(isSelected ? styles.historyRowMultiSelected : {})
      }}
    >
      {isMultiSelect && (
        <div style={{
          ...styles.checkbox,
          ...(isSelected ? styles.checkboxChecked : {})
        }}>
          {isSelected && '✓'}
        </div>
      )}
      <div style={styles.thumbnail}>
        {thumbnail ? (
          <img src={thumbnail} style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} />
        ) : isVideo ? '▶' : '♪'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {renamingId === entry.id ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onBlur={onRenameBlur}
            onKeyDown={onRenameKeyDown}
            onClick={(e) => e.stopPropagation()}
            style={styles.renameInput}
            autoFocus
          />
        ) : (
          <div style={styles.entryFileName}>{entry.fileName}</div>
        )}
        <div style={styles.entryMeta}>
          {entry.audioDuration ? formatDuration(entry.audioDuration) : ''}
          {entry.audioDuration ? ' · ' : ''}
          {new Date(entry.createdAt).toLocaleDateString()}
        </div>
      </div>
    </button>
  )
})

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--color-background)',
    overflow: 'hidden'
  },
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
  },
  // Active sessions panel
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
  },
  searchWrapper: {
    padding: '0 12px 6px'
  },
  searchField: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 8px',
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid transparent'
  },
  searchIcon: {
    fontSize: 11,
    opacity: 0.4,
    fontWeight: 600
  },
  searchInput: {
    flex: 1,
    border: 'none',
    background: 'none',
    outline: 'none',
    color: 'var(--color-foreground)',
    fontSize: 'var(--font-caption)'
  },
  clearButton: {
    background: 'none',
    border: 'none',
    color: 'var(--color-secondary)',
    cursor: 'pointer',
    fontSize: 10,
    padding: 2
  },
  filterBar: {
    display: 'flex',
    gap: 2,
    padding: '0 12px 8px',
    overflowX: 'auto',
    scrollbarWidth: 'none' as any,
    msOverflowStyle: 'none' as any
  },
  filterChip: {
    padding: '4px 10px',
    border: 'none',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'transparent',
    color: 'var(--color-foreground)',
    opacity: 0.65,
    fontSize: 'var(--font-caption)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'var(--transition-fast)'
  },
  filterChipActive: {
    backgroundColor: 'var(--color-foreground)',
    color: 'var(--color-background)',
    fontWeight: 600,
    opacity: 1
  },
  divider: {
    height: 1,
    backgroundColor: 'var(--color-border)',
    margin: '0 12px'
  },
  batchBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    backgroundColor: 'var(--color-highlight)',
    flexShrink: 0
  },
  batchText: {
    fontSize: 'var(--font-caption)',
    fontWeight: 600,
    flex: 1
  },
  batchDeleteBtn: {
    padding: '4px 10px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--color-destructive)',
    color: '#fff',
    fontSize: 'var(--font-caption)',
    fontWeight: 600,
    cursor: 'pointer'
  },
  batchCancelBtn: {
    padding: '4px 10px',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'transparent',
    color: 'var(--color-foreground)',
    fontSize: 'var(--font-caption)',
    cursor: 'pointer'
  },
  historyList: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 0'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--spacing-xl) var(--spacing-sm)',
    gap: 8,
    opacity: 0.6
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 4
  },
  emptyText: {
    fontSize: 'var(--font-body)',
    fontWeight: 500,
    color: 'var(--color-secondary)'
  },
  emptyHint: {
    fontSize: 'var(--font-caption)',
    color: 'var(--color-secondary)',
    textAlign: 'center'
  },
  historyRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    width: '100%',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--color-foreground)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'var(--transition-fast)'
  },
  historyRowSelected: {
    backgroundColor: 'var(--color-highlight)'
  },
  historyRowMultiSelected: {
    backgroundColor: 'var(--color-highlight)'
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 'var(--radius-sm)',
    border: '2px solid var(--color-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
    color: 'transparent'
  },
  checkboxChecked: {
    backgroundColor: 'var(--color-foreground)',
    borderColor: 'var(--color-foreground)',
    color: 'var(--color-background)'
  },
  thumbnail: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: 'var(--color-surface)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    flexShrink: 0,
    overflow: 'hidden'
  },
  entryFileName: {
    fontSize: 14,
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  renameInput: {
    fontSize: 14,
    fontWeight: 600,
    width: '100%',
    border: '1px solid var(--color-border-strong)',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-foreground)',
    padding: '2px 4px',
    outline: 'none'
  },
  entryMeta: {
    fontSize: 12,
    color: 'var(--color-secondary)',
    marginTop: 2
  },
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
  },
  // Context menu (macOS-style)
  contextOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 100
  },
  contextMenu: {
    position: 'fixed',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    padding: 4,
    boxShadow: '0 8px 24px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.1)',
    zIndex: 101,
    minWidth: 160,
    backdropFilter: 'blur(20px)'
  },
  contextMenuItem: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '6px 12px',
    border: 'none',
    backgroundColor: 'transparent',
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'left',
    borderRadius: 4
  },
  // Delete confirmation modal (macOS-style)
  modalOverlay: {
    position: 'fixed',
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
    boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
    backdropFilter: 'blur(20px)'
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
  modalCancel: {
    padding: '7px 16px',
    border: '1px solid var(--color-border)',
    borderRadius: 6,
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-foreground)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer'
  },
  modalDelete: {
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
