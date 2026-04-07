import { useState, useCallback, useEffect, useRef } from 'react'
import { useAppStore } from '@/stores/appStore'
import type { HistoryEntry, Folder, Tag, QueueSession } from '@/types/models'
import { VIDEO_EXTENSIONS } from '@/types/models'
import { useT, fmt } from '@/i18n'

import { Settings } from './Settings'
import { SidebarHeader } from './sidebar/SidebarHeader'
import { ActiveSessions } from './sidebar/ActiveSessions'
import { SearchBar } from './sidebar/SearchBar'
import { FilterBar } from './sidebar/FilterBar'
import { FolderTree } from './sidebar/FolderTree'
import { HistoryRow } from './sidebar/HistoryRow'
import { TagSelector } from './sidebar/TagSelector'
import { SidebarFooter } from './sidebar/SidebarFooter'

export function Sidebar() {
  const {
    historyEntries,
    selectedEntryId,
    historyFilter,
    historySearch,
    queueSessions,
    focusedSessionId,
    activeFolderId,
    activeTagFilter,
    sortField,
    sortDirection,
    tags,
    setSelectedEntryId,
    setViewingEntry,
    setHistorySearch,
    setFocusedSessionId,
    setFolders,
    setTags,
    resetToDropZone
  } = useAppStore()

  const t = useT()

  // Load folders and tags on mount
  useEffect(() => {
    window.electronAPI.folders.getMetadata().then((meta) => {
      setFolders(meta.folders as Folder[])
      setTags(meta.tags as Tag[])
    })
  }, [setFolders, setTags])

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
  const [username, setUsername] = useState<string | null>(null)
  const [tagSelectorState, setTagSelectorState] = useState<{ entryId: string; tagIds: string[]; x: number; y: number } | null>(null)
  const [moveMenuState, setMoveMenuState] = useState<{ entry: HistoryEntry; x: number; y: number } | null>(null)

  useEffect(() => {
    window.electronAPI.platform.getUsername().then(setUsername)
  }, [])

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Thumbnail cache
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
    // Folder filter
    if (activeFolderId !== null && e.folderId !== activeFolderId) return false

    // Date filter
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

    // Tag filter
    if (activeTagFilter && !e.tagIds?.includes(activeTagFilter)) return false

    // Search filter
    if (historySearch) {
      return e.fileName.toLowerCase().includes(historySearch.toLowerCase())
    }
    return true
  })

  // Sort entries
  const sortedEntries = [...filteredEntries].sort((a, b) => {
    const dir = sortDirection === 'asc' ? 1 : -1
    switch (sortField) {
      case 'fileName':
        return dir * a.fileName.localeCompare(b.fileName)
      case 'audioDuration':
        return dir * ((a.audioDuration || 0) - (b.audioDuration || 0))
      case 'detectedLanguage':
        return dir * (a.detectedLanguage || '').localeCompare(b.detectedLanguage || '')
      default:
        return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    }
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
      clickTimer.current = setTimeout(() => {
        clickCountRef.current = 0
        if (isMultiSelect) setSelectedIds(new Set())
        setSelectedEntryId(entry.id)
        setViewingEntry(entry)
      }, 250)
    } else if (clickCountRef.current === 2) {
      if (clickTimer.current) clearTimeout(clickTimer.current)
      clickCountRef.current = 0
      setSelectedEntryId(entry.id)
      setViewingEntry(entry)
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

  // Delete
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

  // Rename
  const startRename = (entry: HistoryEntry) => {
    setContextMenu(null)
    setRenamingId(entry.id)
    setRenameValue(entry.fileName)
    setTimeout(() => renameInputRef.current?.select(), 50)
  }

  const renameSaving = useRef(false)
  const renamingIdRef = useRef<string | null>(null)
  const renameValueRef = useRef('')
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

  // Move to folder
  const handleMoveToFolder = async (entryId: string, folderId: string | null) => {
    await window.electronAPI.history.moveToFolder(entryId, folderId)
    const entries = await window.electronAPI.history.getAll()
    useAppStore.getState().setHistoryEntries(entries as never[])
    setMoveMenuState(null)
    setContextMenu(null)
  }

  const { folders } = useAppStore()

  return (
    <aside style={styles.sidebar}>
      <style>{sidebarKeyframes}</style>

      <SidebarHeader
        onLogoClick={handleLogoClick}
        onNewTranscription={handleNewTranscription}
      />

      <ActiveSessions
        sessions={activeSessions}
        focusedSessionId={focusedSessionId}
        onSessionClick={(session) => setFocusedSessionId(session.sessionId)}
        onCancelSession={handleCancelSession}
      />

      <SearchBar value={historySearch} onChange={setHistorySearch} />

      <FilterBar />

      <FolderTree />

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
            <div style={styles.emptyIcon}>{'\u3030'}</div>
            <div style={styles.emptyText}>{t.noTranscriptions}</div>
            <div style={styles.emptyHint}>{t.dropOrClick}</div>
          </div>
        ) : sortedEntries.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyText}>{t.noResults}</div>
          </div>
        ) : (
          sortedEntries.map((entry) => (
            <HistoryRow
              key={entry.id}
              entry={entry}
              isViewing={selectedEntryId === entry.id && !isMultiSelect}
              isSelected={selectedIds.has(entry.id)}
              isMultiSelect={isMultiSelect}
              thumbnail={thumbnails[entry.id] || null}
              tags={tags}
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

      <SidebarFooter username={username} onSettingsClick={() => setShowSettings(true)} />

      {/* Context menu */}
      {contextMenu && (
        <div
          style={styles.contextOverlay}
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu(null) }}
        >
          <div style={{ ...styles.contextMenu, left: contextMenu.x, top: contextMenu.y }}>
            <button style={styles.contextMenuItem} onClick={() => startRename(contextMenu.entry)}>
              {t.rename}
            </button>
            <button
              style={styles.contextMenuItem}
              onClick={() => {
                setTagSelectorState({
                  entryId: contextMenu.entry.id,
                  tagIds: contextMenu.entry.tagIds || [],
                  x: contextMenu.x,
                  y: contextMenu.y
                })
                setContextMenu(null)
              }}
            >
              {t.tags}
            </button>
            <button
              style={styles.contextMenuItem}
              onClick={() => {
                setMoveMenuState({ entry: contextMenu.entry, x: contextMenu.x, y: contextMenu.y })
                setContextMenu(null)
              }}
            >
              {t.moveToFolder}
            </button>
            <div style={{ height: 1, backgroundColor: 'var(--color-border)', margin: '2px 8px' }} />
            <button style={styles.contextMenuItem} onClick={() => requestDelete(contextMenu.entry)}>
              <span style={{ color: 'var(--color-destructive)' }}>{t.delete}</span>
            </button>
          </div>
        </div>
      )}

      {/* Tag selector popup */}
      {tagSelectorState && (
        <TagSelector
          entryId={tagSelectorState.entryId}
          currentTagIds={tagSelectorState.tagIds}
          position={{ x: tagSelectorState.x, y: tagSelectorState.y }}
          onClose={() => setTagSelectorState(null)}
        />
      )}

      {/* Move to folder popup */}
      {moveMenuState && (
        <div
          style={styles.contextOverlay}
          onClick={() => setMoveMenuState(null)}
          onContextMenu={(e) => { e.preventDefault(); setMoveMenuState(null) }}
        >
          <div style={{ ...styles.contextMenu, left: moveMenuState.x, top: moveMenuState.y }}>
            <div style={styles.moveMenuTitle}>{t.moveToFolder}</div>
            <button
              style={{
                ...styles.contextMenuItem,
                ...(moveMenuState.entry.folderId === null ? { fontWeight: 600 } : {})
              }}
              onClick={() => handleMoveToFolder(moveMenuState.entry.id, null)}
            >
              {'\uD83D\uDCDA'} {t.allRecords}
            </button>
            {folders.map((f) => (
              <button
                key={f.id}
                style={{
                  ...styles.contextMenuItem,
                  paddingLeft: 12 + (f.parentId ? 16 : 0),
                  ...(moveMenuState.entry.folderId === f.id ? { fontWeight: 600 } : {})
                }}
                onClick={() => handleMoveToFolder(moveMenuState.entry.id, f.id)}
              >
                {'\uD83D\uDCC1'} {f.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
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
              <button onClick={cancelDelete} style={styles.modalCancel}>{t.cancel}</button>
              <button onClick={confirmDelete} style={styles.modalDelete}>{t.delete}</button>
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
              <button onClick={() => setCancelTarget(null)} style={styles.modalCancel}>{t.keepGoing}</button>
              <button onClick={confirmCancelSession} style={styles.modalDelete}>{t.cancelTranscription}</button>
            </div>
          </div>
        </div>
      )}

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

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--color-background)',
    overflow: 'hidden'
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
    borderRadius: 4,
    color: 'var(--color-foreground)'
  },
  moveMenuTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--color-secondary)',
    padding: '4px 12px 2px',
    letterSpacing: 0.5
  },
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
