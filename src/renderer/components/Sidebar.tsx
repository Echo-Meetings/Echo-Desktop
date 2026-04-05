import { useState, useCallback } from 'react'
import { useAppStore } from '@/stores/appStore'
import type { HistoryEntry, HistoryFilter } from '@/types/models'
import { formatDuration } from '@/types/models'
import { Settings } from './Settings'

const FILTER_OPTIONS: { key: HistoryFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'last7Days', label: 'Week' },
  { key: 'last30Days', label: 'Month' }
]

export function Sidebar() {
  const {
    historyEntries,
    selectedEntryId,
    historyFilter,
    historySearch,
    phase,
    transcriptionProgress,
    setSelectedEntryId,
    setViewingEntry,
    setHistoryFilter,
    setHistorySearch,
    resetToDropZone
  } = useAppStore()

  const isProcessing = phase.type === 'processing'
  const processingFileName = phase.type === 'processing' ? phase.fileName : null

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const isMultiSelect = selectedIds.size > 0

  // UI state
  const [deleteTarget, setDeleteTarget] = useState<HistoryEntry | null>(null)
  const [batchDeleteCount, setBatchDeleteCount] = useState(0)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: HistoryEntry } | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  // Filter entries by date filter and search query
  const filteredEntries = historyEntries.filter((e) => {
    if (historyFilter !== 'all') {
      const now = Date.now()
      const created = new Date(e.createdAt).getTime()
      const dayMs = 86400000
      if (historyFilter === 'today' && now - created > dayMs) return false
      if (historyFilter === 'last7Days' && now - created > 7 * dayMs) return false
      if (historyFilter === 'last30Days' && now - created > 30 * dayMs) return false
    }
    if (historySearch) {
      return e.fileName.toLowerCase().includes(historySearch.toLowerCase())
    }
    return true
  })

  const handleSelectEntry = useCallback((entry: HistoryEntry, e: React.MouseEvent) => {
    // Multi-select with Cmd/Ctrl or Shift
    if (e.metaKey || e.ctrlKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(entry.id)) {
          next.delete(entry.id)
        } else {
          next.add(entry.id)
        }
        return next
      })
      return
    }

    // Normal click — clear multi-select and view
    if (isMultiSelect) {
      setSelectedIds(new Set())
    }
    setSelectedEntryId(entry.id)
    setViewingEntry(entry)
  }, [isMultiSelect, setSelectedEntryId, setViewingEntry])

  const handleNewTranscription = async () => {
    if (isProcessing) return // Block during active transcription
    setSelectedIds(new Set())
    const isViewingFile = selectedEntryId || phase.type === 'result'
    if (isViewingFile) {
      // If viewing a file, open picker directly
      const filePath = await window.electronAPI.file.openPicker()
      if (filePath) {
        const result = await window.electronAPI.file.validate(filePath)
        if (result.status === 'valid' || result.status === 'needsConversion') {
          const fileName = filePath.split(/[/\\]/).pop() || filePath
          useAppStore.getState().startProcessing(fileName, filePath)
          await window.electronAPI.transcription.start(
            filePath,
            useAppStore.getState().languageOverride === 'auto'
              ? null
              : useAppStore.getState().languageOverride
          )
        }
      }
    } else {
      resetToDropZone()
    }
  }

  const handleReturnToProcessing = () => {
    setViewingEntry(null)
    setSelectedEntryId(null)
  }

  // Delete single
  const requestDelete = (e: React.MouseEvent, entry: HistoryEntry) => {
    e.stopPropagation()
    setContextMenu(null)
    setDeleteTarget(entry)
    setBatchDeleteCount(0)
  }

  // Delete batch
  const requestBatchDelete = () => {
    setBatchDeleteCount(selectedIds.size)
    setDeleteTarget(null)
  }

  const confirmDelete = async () => {
    if (batchDeleteCount > 0) {
      // Batch delete
      const ids = Array.from(selectedIds)
      await window.electronAPI.history.deleteMultiple(ids)
      setSelectedIds(new Set())
      if (selectedEntryId && ids.includes(selectedEntryId)) {
        resetToDropZone()
      }
    } else if (deleteTarget) {
      // Single delete
      await window.electronAPI.history.delete(deleteTarget.id)
      if (selectedEntryId === deleteTarget.id) {
        resetToDropZone()
      }
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

  const handleContextMenu = (e: React.MouseEvent, entry: HistoryEntry) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, entry })
  }

  const handleLogoClick = () => {
    setSelectedIds(new Set())
    resetToDropZone()
  }

  return (
    <aside style={styles.sidebar}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logoRow} onClick={handleLogoClick}>
          <div style={styles.logoIcon}>〰</div>
          <span style={styles.logoText}>Echo</span>
        </div>
      </div>

      {/* New Transcription Button */}
      <div style={styles.buttonWrapper}>
        <button
          onClick={handleNewTranscription}
          disabled={isProcessing}
          style={{
            ...styles.newButton,
            ...(isProcessing ? { opacity: 0.4, cursor: 'not-allowed' } : {})
          }}
        >
          <span style={{ fontSize: 16 }}>+</span>
          <span>New Transcription</span>
        </button>
      </div>

      {/* Search */}
      <div style={styles.searchWrapper}>
        <div style={styles.searchField}>
          <span style={styles.searchIcon}>Q</span>
          <input
            type="text"
            placeholder="Search..."
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
        {FILTER_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setHistoryFilter(key)}
            style={{
              ...styles.filterChip,
              ...(historyFilter === key ? styles.filterChipActive : {})
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={styles.divider} />

      {/* Batch actions bar */}
      {isMultiSelect && (
        <div style={styles.batchBar}>
          <span style={styles.batchText}>{selectedIds.size} selected</span>
          <button onClick={requestBatchDelete} style={styles.batchDeleteBtn}>
            Delete
          </button>
          <button onClick={() => setSelectedIds(new Set())} style={styles.batchCancelBtn}>
            Cancel
          </button>
        </div>
      )}

      {/* Active Transcription Row */}
      {isProcessing && (
        <button onClick={handleReturnToProcessing} style={styles.activeRow}>
          <div style={styles.activeIndicator}>
            <div style={styles.pulseIcon}>〰</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.activeFileName}>{processingFileName}</div>
            <div style={styles.progressBarTrack}>
              <div
                style={{
                  ...styles.progressBarFill,
                  width:
                    transcriptionProgress > 0 ? `${transcriptionProgress * 100}%` : '30%'
                }}
              />
            </div>
          </div>
        </button>
      )}

      {/* History List */}
      <div style={styles.historyList}>
        {historyEntries.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>〰</div>
            <div style={styles.emptyText}>No transcriptions yet</div>
            <div style={styles.emptyHint}>Drop a file or click "New Transcription"</div>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyText}>No results found</div>
            <div style={styles.emptyHint}>No files matching "{historySearch}"</div>
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const isSelected = selectedIds.has(entry.id)
            const isViewing = selectedEntryId === entry.id && !isMultiSelect
            return (
              <button
                key={entry.id}
                onClick={(e) => handleSelectEntry(entry, e)}
                onContextMenu={(e) => handleContextMenu(e, entry)}
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
                <div style={styles.thumbnail}>🎵</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.entryFileRow}>
                    <div style={styles.entryFileName}>{entry.fileName}</div>
                    {!isMultiSelect && (
                      <div
                        onClick={(e) => requestDelete(e, entry)}
                        style={styles.deleteButton}
                        title="Delete"
                      >
                        ✕
                      </div>
                    )}
                  </div>
                  <div style={styles.entryMeta}>
                    {entry.audioDuration ? formatDuration(entry.audioDuration) : ''}
                    {entry.audioDuration ? ' · ' : ''}
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>

      {/* Footer with settings */}
      <div style={styles.footer}>
        <div style={styles.footerUser}>
          <div style={styles.userAvatar}>SE</div>
          <span style={styles.userName}>Sergey</span>
        </div>
        <button onClick={() => setShowSettings(true)} style={styles.settingsBtn} title="Settings">
          ⚙
        </button>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          style={styles.contextOverlay}
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu(null) }}
        >
          <div style={{ ...styles.contextMenu, left: contextMenu.x, top: contextMenu.y }}>
            <button
              style={styles.contextMenuItem}
              onClick={(e) => requestDelete(e, contextMenu.entry)}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {(deleteTarget || batchDeleteCount > 0) && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalTitle}>
              {batchDeleteCount > 0
                ? `Delete ${batchDeleteCount} transcriptions?`
                : 'Delete transcription?'}
            </div>
            <div style={styles.modalText}>
              {batchDeleteCount > 0
                ? `${batchDeleteCount} items will be permanently deleted.`
                : `"${deleteTarget?.fileName}" will be permanently deleted.`}
            </div>
            <div style={styles.modalActions}>
              <button onClick={cancelDelete} style={styles.modalCancel}>
                Cancel
              </button>
              <button onClick={confirmDelete} style={styles.modalDelete}>
                Delete
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

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 260,
    minWidth: 240,
    maxWidth: 300,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--color-background)',
    overflow: 'hidden'
  },
  header: {
    padding: '14px 14px 8px'
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
    fontWeight: 600
  },
  buttonWrapper: {
    padding: '0 10px 8px'
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
  searchWrapper: {
    padding: '0 10px 6px'
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
    padding: '0 10px 8px',
    overflowX: 'auto'
  },
  filterChip: {
    padding: '4px 10px',
    border: 'none',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'transparent',
    color: 'var(--color-secondary)',
    fontSize: 'var(--font-caption)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'var(--transition-fast)'
  },
  filterChipActive: {
    backgroundColor: 'var(--color-foreground)',
    color: 'var(--color-background)',
    fontWeight: 600
  },
  divider: {
    height: 1,
    backgroundColor: 'var(--color-border)',
    margin: '0 10px'
  },
  batchBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
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
  activeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    backgroundColor: 'var(--color-highlight)',
    border: 'none',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left'
  },
  activeIndicator: {
    width: 28,
    height: 28,
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--color-surface)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  pulseIcon: {
    fontSize: 12,
    animation: 'pulse 1.5s ease-in-out infinite'
  },
  activeFileName: {
    fontSize: 'var(--font-caption)',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--color-foreground)'
  },
  progressBarTrack: {
    height: 3,
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--color-border)',
    marginTop: 4,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--color-foreground)',
    transition: 'width 300ms ease-in-out'
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
    padding: '8px 14px',
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
    width: 28,
    height: 28,
    borderRadius: 5,
    backgroundColor: 'var(--color-surface)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    flexShrink: 0
  },
  entryFileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4
  },
  entryFileName: {
    flex: 1,
    fontSize: 'var(--font-caption)',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  deleteButton: {
    fontSize: 10,
    color: 'var(--color-secondary)',
    cursor: 'pointer',
    padding: '2px 4px',
    borderRadius: 'var(--radius-sm)',
    opacity: 0.5,
    flexShrink: 0,
    transition: 'var(--transition-fast)'
  },
  entryMeta: {
    fontSize: 11,
    color: 'var(--color-secondary)',
    marginTop: 2
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
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
  contextOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 100
  },
  contextMenu: {
    position: 'fixed',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: 4,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    zIndex: 101,
    minWidth: 120
  },
  contextMenuItem: {
    display: 'block',
    width: '100%',
    padding: '6px 12px',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--color-destructive)',
    fontSize: 'var(--font-caption)',
    cursor: 'pointer',
    textAlign: 'left',
    borderRadius: 'var(--radius-sm)'
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200
  },
  modal: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--spacing-md)',
    width: 320,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
  },
  modalTitle: {
    fontSize: 'var(--font-heading)',
    fontWeight: 600,
    marginBottom: 8
  },
  modalText: {
    fontSize: 'var(--font-body)',
    color: 'var(--color-secondary)',
    marginBottom: 'var(--spacing-sm)',
    lineHeight: 1.4
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8
  },
  modalCancel: {
    padding: '6px 14px',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'transparent',
    color: 'var(--color-foreground)',
    fontSize: 'var(--font-button)',
    cursor: 'pointer'
  },
  modalDelete: {
    padding: '6px 14px',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--color-destructive)',
    color: '#fff',
    fontSize: 'var(--font-button)',
    fontWeight: 600,
    cursor: 'pointer'
  }
}
