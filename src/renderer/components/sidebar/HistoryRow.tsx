import { memo } from 'react'
import type { HistoryEntry, Tag } from '@/types/models'
import { formatDuration, VIDEO_EXTENSIONS } from '@/types/models'

interface Props {
  entry: HistoryEntry
  isViewing: boolean
  isSelected: boolean
  isMultiSelect: boolean
  thumbnail: string | null
  tags: Tag[]
  renamingId: string | null
  renameValue: string
  renameInputRef: React.RefObject<HTMLInputElement | null>
  onRenameChange: (value: string) => void
  onRenameBlur: () => void
  onRenameKeyDown: (e: React.KeyboardEvent) => void
  onSelect: (entry: HistoryEntry, e: React.MouseEvent) => void
  onContextMenu: (e: React.MouseEvent, entry: HistoryEntry) => void
}

export const HistoryRow = memo(function HistoryRow({
  entry, isViewing, isSelected, isMultiSelect, thumbnail, tags,
  renamingId, renameValue, renameInputRef,
  onRenameChange, onRenameBlur, onRenameKeyDown,
  onSelect, onContextMenu
}: Props) {
  const ext = entry.fileExtension?.toLowerCase() || ''
  const isVideo = VIDEO_EXTENSIONS.has(ext)
  const entryTags = tags.filter((t) => entry.tagIds?.includes(t.id))

  return (
    <button
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
          {isSelected && '\u2713'}
        </div>
      )}
      <div style={styles.thumbnail}>
        {thumbnail ? (
          <img src={thumbnail} style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} />
        ) : isVideo ? '\u25B6' : '\u266A'}
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
          {entry.audioDuration ? ' \u00B7 ' : ''}
          {new Date(entry.createdAt).toLocaleDateString()}
        </div>
        {entryTags.length > 0 && (
          <div style={styles.tagRow}>
            {entryTags.map((tag) => (
              <span
                key={tag.id}
                style={{
                  ...styles.tagDot,
                  backgroundColor: tag.color
                }}
                title={tag.name}
              />
            ))}
          </div>
        )}
      </div>
    </button>
  )
})

const styles: Record<string, React.CSSProperties> = {
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
  tagRow: {
    display: 'flex',
    gap: 3,
    marginTop: 3
  },
  tagDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    flexShrink: 0
  }
}
