import { useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import type { Tag } from '@/types/models'
import { useT } from '@/i18n'

const PRESET_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'
]

interface Props {
  entryId: string
  currentTagIds: string[]
  position: { x: number; y: number }
  onClose: () => void
}

export function TagSelector({ entryId, currentTagIds, position, onClose }: Props) {
  const t = useT()
  const { tags, setTags } = useAppStore()
  const [newTagName, setNewTagName] = useState('')
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0])

  const toggleTag = async (tagId: string) => {
    const next = currentTagIds.includes(tagId)
      ? currentTagIds.filter((id) => id !== tagId)
      : [...currentTagIds, tagId]
    await window.electronAPI.history.setTags(entryId, next)
    // Reload history to update UI
    const entries = await window.electronAPI.history.getAll()
    useAppStore.getState().setHistoryEntries(entries as never[])
  }

  const createTag = async () => {
    const name = newTagName.trim()
    if (!name) return
    const tag = await window.electronAPI.folders.createTag(name, selectedColor) as Tag
    if (tag) {
      const meta = await window.electronAPI.folders.getMetadata()
      setTags(meta.tags as Tag[])
      // Auto-assign new tag to entry
      const next = [...currentTagIds, tag.id]
      await window.electronAPI.history.setTags(entryId, next)
      const entries = await window.electronAPI.history.getAll()
      useAppStore.getState().setHistoryEntries(entries as never[])
    }
    setNewTagName('')
  }

  const deleteTag = async (tagId: string) => {
    await window.electronAPI.folders.deleteTag(tagId)
    const meta = await window.electronAPI.folders.getMetadata()
    setTags(meta.tags as Tag[])
    const entries = await window.electronAPI.history.getAll()
    useAppStore.getState().setHistoryEntries(entries as never[])
  }

  return (
    <div style={styles.overlay} onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }}>
      <div
        style={{ ...styles.popup, left: Math.min(position.x, window.innerWidth - 240), top: Math.min(position.y, window.innerHeight - 300) }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={styles.title}>{t.tags}</div>

        {/* Existing tags */}
        <div style={styles.tagList}>
          {tags.map((tag) => (
            <div key={tag.id} style={styles.tagRow}>
              <label style={styles.tagLabel}>
                <input
                  type="checkbox"
                  checked={currentTagIds.includes(tag.id)}
                  onChange={() => toggleTag(tag.id)}
                  style={styles.checkbox}
                />
                <span style={{ ...styles.tagDot, backgroundColor: tag.color }} />
                <span style={styles.tagName}>{tag.name}</span>
              </label>
              <button
                style={styles.deleteTagBtn}
                onClick={() => deleteTag(tag.id)}
                title={t.removeTag}
              >
                &#x2715;
              </button>
            </div>
          ))}
        </div>

        {/* Create new tag */}
        <div style={styles.createSection}>
          <div style={styles.colorRow}>
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                style={{
                  ...styles.colorBtn,
                  backgroundColor: color,
                  ...(selectedColor === color ? styles.colorBtnActive : {})
                }}
                onClick={() => setSelectedColor(color)}
              />
            ))}
          </div>
          <div style={styles.createRow}>
            <input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createTag() } }}
              placeholder={t.newTag}
              style={styles.input}
            />
            <button
              onClick={createTag}
              disabled={!newTagName.trim()}
              style={styles.createBtn}
            >
              +
            </button>
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
    zIndex: 200
  },
  popup: {
    position: 'fixed',
    width: 220,
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 10,
    padding: 10,
    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
    backdropFilter: 'blur(20px)',
    zIndex: 201
  },
  title: {
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 8,
    color: 'var(--color-foreground)'
  },
  tagList: {
    maxHeight: 160,
    overflowY: 'auto',
    marginBottom: 8
  },
  tagRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '3px 0'
  },
  tagLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
    flex: 1,
    minWidth: 0
  },
  checkbox: {
    width: 14,
    height: 14,
    cursor: 'pointer',
    accentColor: 'var(--color-foreground)'
  },
  tagDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0
  },
  tagName: {
    fontSize: 12,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  deleteTagBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-secondary)',
    fontSize: 8,
    cursor: 'pointer',
    padding: '2px 4px',
    opacity: 0.5
  },
  createSection: {
    borderTop: '1px solid var(--color-border)',
    paddingTop: 8
  },
  colorRow: {
    display: 'flex',
    gap: 4,
    marginBottom: 6
  },
  colorBtn: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    border: '2px solid transparent',
    cursor: 'pointer',
    padding: 0
  },
  colorBtnActive: {
    borderColor: 'var(--color-foreground)',
    boxShadow: '0 0 0 1px var(--color-background)'
  },
  createRow: {
    display: 'flex',
    gap: 4
  },
  input: {
    flex: 1,
    fontSize: 12,
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--color-background)',
    color: 'var(--color-foreground)',
    padding: '4px 6px',
    outline: 'none'
  },
  createBtn: {
    width: 28,
    height: 28,
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'transparent',
    color: 'var(--color-foreground)',
    fontSize: 14,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }
}
