import { useState, useRef, useCallback } from 'react'
import { useAppStore } from '@/stores/appStore'
import type { Folder } from '@/types/models'
import { useT } from '@/i18n'

export function FolderTree() {
  const t = useT()
  const {
    folders,
    activeFolderId,
    expandedFolderIds,
    setActiveFolderId,
    toggleFolderExpanded,
    setFolders
  } = useAppStore()

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; folder: Folder | null } | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [creatingIn, setCreatingIn] = useState<string | null | false>(false) // false = not creating, null = root, string = parentId
  const [newFolderName, setNewFolderName] = useState('')
  const renameRef = useRef<HTMLInputElement>(null)
  const createRef = useRef<HTMLInputElement>(null)

  const rootFolders = folders.filter((f) => f.parentId === null).sort((a, b) => a.order - b.order)

  const getChildren = useCallback(
    (parentId: string) => folders.filter((f) => f.parentId === parentId).sort((a, b) => a.order - b.order),
    [folders]
  )

  const hasChildren = useCallback(
    (folderId: string) => folders.some((f) => f.parentId === folderId),
    [folders]
  )

  const handleContextMenu = (e: React.MouseEvent, folder: Folder | null) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, folder })
  }

  const handleCreateFolder = async (parentId: string | null) => {
    setContextMenu(null)
    setCreatingIn(parentId)
    setNewFolderName('')
    setTimeout(() => createRef.current?.focus(), 50)
  }

  const confirmCreate = async () => {
    if (creatingIn === false) return
    const name = newFolderName.trim()
    if (!name) {
      setCreatingIn(false)
      return
    }
    const folder = await window.electronAPI.folders.createFolder(name, creatingIn) as Folder
    if (folder) {
      const meta = await window.electronAPI.folders.getMetadata()
      useAppStore.getState().setFolders(meta.folders as Folder[])
    }
    setCreatingIn(false)
  }

  const handleRename = (folder: Folder) => {
    setContextMenu(null)
    setRenamingId(folder.id)
    setRenameValue(folder.name)
    setTimeout(() => renameRef.current?.select(), 50)
  }

  const confirmRename = async () => {
    if (!renamingId) return
    const name = renameValue.trim()
    if (name) {
      await window.electronAPI.folders.renameFolder(renamingId, name)
      const meta = await window.electronAPI.folders.getMetadata()
      useAppStore.getState().setFolders(meta.folders as Folder[])
    }
    setRenamingId(null)
  }

  const handleDelete = async (folder: Folder) => {
    setContextMenu(null)
    await window.electronAPI.folders.deleteFolder(folder.id)
    const meta = await window.electronAPI.folders.getMetadata()
    const store = useAppStore.getState()
    store.setFolders(meta.folders as Folder[])
    if (activeFolderId === folder.id) store.setActiveFolderId(null)
    // Reload history to reflect unfolded entries
    const entries = await window.electronAPI.history.getAll()
    store.setHistoryEntries(entries as never[])
  }

  const renderFolder = (folder: Folder, depth: number) => {
    const isActive = activeFolderId === folder.id
    const isExpanded = expandedFolderIds.has(folder.id)
    const children = getChildren(folder.id)
    const hasKids = children.length > 0

    return (
      <div key={folder.id}>
        <div
          style={{
            ...styles.folderRow,
            paddingLeft: 12 + depth * 16,
            ...(isActive ? styles.folderRowActive : {})
          }}
          onClick={() => setActiveFolderId(folder.id)}
          onContextMenu={(e) => handleContextMenu(e, folder)}
        >
          {hasKids ? (
            <span
              style={styles.expandBtn}
              onClick={(e) => { e.stopPropagation(); toggleFolderExpanded(folder.id) }}
            >
              {isExpanded ? '\u25BE' : '\u25B8'}
            </span>
          ) : (
            <span style={styles.expandPlaceholder} />
          )}
          <span style={styles.folderIcon}>{folder.color ? '\uD83D\uDCC1' : '\uD83D\uDCC1'}</span>
          {renamingId === folder.id ? (
            <input
              ref={renameRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={confirmRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); confirmRename() }
                if (e.key === 'Escape') setRenamingId(null)
              }}
              onClick={(e) => e.stopPropagation()}
              style={styles.renameInput}
              autoFocus
            />
          ) : (
            <span style={styles.folderName}>{folder.name}</span>
          )}
        </div>
        {isExpanded && children.map((child) => renderFolder(child, depth + 1))}
        {isExpanded && creatingIn === folder.id && (
          <div style={{ ...styles.folderRow, paddingLeft: 12 + (depth + 1) * 16 }}>
            <span style={styles.expandPlaceholder} />
            <span style={styles.folderIcon}>{'\uD83D\uDCC1'}</span>
            <input
              ref={createRef}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onBlur={confirmCreate}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); confirmCreate() }
                if (e.key === 'Escape') setCreatingIn(false)
              }}
              placeholder={t.newFolder}
              style={styles.renameInput}
              autoFocus
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* All Records (root) */}
      <div
        style={{
          ...styles.folderRow,
          paddingLeft: 12,
          ...(activeFolderId === null ? styles.folderRowActive : {})
        }}
        onClick={() => setActiveFolderId(null)}
        onContextMenu={(e) => handleContextMenu(e, null)}
      >
        <span style={styles.expandPlaceholder} />
        <span style={styles.folderIcon}>{'\uD83D\uDCDA'}</span>
        <span style={styles.folderName}>{t.allRecords}</span>
      </div>

      {rootFolders.map((f) => renderFolder(f, 0))}

      {creatingIn === null && (
        <div style={{ ...styles.folderRow, paddingLeft: 12 }}>
          <span style={styles.expandPlaceholder} />
          <span style={styles.folderIcon}>{'\uD83D\uDCC1'}</span>
          <input
            ref={createRef}
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onBlur={confirmCreate}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); confirmCreate() }
              if (e.key === 'Escape') setCreatingIn(false)
            }}
            placeholder={t.newFolder}
            style={styles.renameInput}
            autoFocus
          />
        </div>
      )}

      {/* + New Folder button */}
      <button
        style={styles.addFolderBtn}
        onClick={() => handleCreateFolder(null)}
      >
        + {t.newFolder}
      </button>

      {/* Context menu */}
      {contextMenu && (
        <div
          style={styles.contextOverlay}
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu(null) }}
        >
          <div style={{ ...styles.contextMenu, left: contextMenu.x, top: contextMenu.y }}>
            {contextMenu.folder && (
              <>
                <button style={styles.contextMenuItem} onClick={() => handleRename(contextMenu.folder!)}>
                  {t.rename}
                </button>
                <button style={styles.contextMenuItem} onClick={() => handleCreateFolder(contextMenu.folder!.id)}>
                  {t.createSubfolder}
                </button>
                <div style={{ height: 1, backgroundColor: 'var(--color-border)', margin: '2px 8px' }} />
                <button style={styles.contextMenuItem} onClick={() => handleDelete(contextMenu.folder!)}>
                  <span style={{ color: 'var(--color-destructive)' }}>{t.delete}</span>
                </button>
              </>
            )}
            {!contextMenu.folder && (
              <button style={styles.contextMenuItem} onClick={() => handleCreateFolder(null)}>
                {t.newFolder}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flexShrink: 0,
    borderBottom: '1px solid var(--color-border)',
    paddingBottom: 4,
    maxHeight: 240,
    overflowY: 'auto'
  },
  folderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '5px 12px',
    cursor: 'pointer',
    fontSize: 13,
    transition: 'var(--transition-fast)',
    borderRadius: 0
  },
  folderRowActive: {
    backgroundColor: 'var(--color-highlight)',
    fontWeight: 600
  },
  expandBtn: {
    width: 14,
    textAlign: 'center',
    fontSize: 10,
    color: 'var(--color-secondary)',
    cursor: 'pointer',
    flexShrink: 0
  },
  expandPlaceholder: {
    width: 14,
    flexShrink: 0
  },
  folderIcon: {
    fontSize: 13,
    flexShrink: 0
  },
  folderName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    minWidth: 0
  },
  renameInput: {
    fontSize: 13,
    flex: 1,
    minWidth: 0,
    border: '1px solid var(--color-border-strong)',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-foreground)',
    padding: '1px 4px',
    outline: 'none'
  },
  addFolderBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 12px',
    background: 'none',
    border: 'none',
    color: 'var(--color-secondary)',
    fontSize: 11,
    cursor: 'pointer',
    opacity: 0.7
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
  }
}
