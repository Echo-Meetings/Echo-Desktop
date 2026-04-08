import { useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import type { SortField } from '@/types/models'
import { useT } from '@/i18n'

export function SortMenu() {
  const t = useT()
  const { sortField, sortDirection, setSortField, setSortDirection } = useAppStore()
  const [open, setOpen] = useState(false)

  const options: { field: SortField; label: string }[] = [
    { field: 'createdAt', label: t.sortByDate },
    { field: 'fileName', label: t.sortByName },
    { field: 'audioDuration', label: t.sortByDuration },
    { field: 'detectedLanguage', label: t.sortByLanguage }
  ]

  const handleSelect = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection(field === 'createdAt' ? 'desc' : 'asc')
    }
    setOpen(false)
  }

  return (
    <div style={styles.container}>
      <button
        style={styles.sortBtn}
        onClick={() => setOpen(!open)}
        title={t.sortBy}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5h10" />
          <path d="M11 9h7" />
          <path d="M11 13h4" />
          <path d="M3 17l3 3 3-3" />
          <path d="M6 18V4" />
        </svg>
      </button>

      {open && (
        <>
          <div style={styles.overlay} onClick={() => setOpen(false)} />
          <div style={styles.dropdown}>
            <div style={styles.dropdownTitle}>{t.sortBy}</div>
            {options.map(({ field, label }) => (
              <button
                key={field}
                style={{
                  ...styles.dropdownItem,
                  ...(sortField === field ? styles.dropdownItemActive : {})
                }}
                onClick={() => handleSelect(field)}
              >
                <span>{label}</span>
                {sortField === field && (
                  <span style={styles.arrow}>
                    {sortDirection === 'asc' ? '\u2191' : '\u2193'}
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative'
  },
  sortBtn: {
    padding: '4px 8px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'transparent',
    color: 'var(--color-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 99
  },
  dropdown: {
    position: 'absolute',
    right: 0,
    top: '100%',
    marginTop: 4,
    width: 180,
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    padding: 4,
    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
    backdropFilter: 'blur(20px)',
    zIndex: 100
  },
  dropdownTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--color-secondary)',
    padding: '4px 10px 2px',
    letterSpacing: 0.5
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '6px 10px',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--color-foreground)',
    fontSize: 13,
    cursor: 'pointer',
    borderRadius: 4,
    textAlign: 'left'
  },
  dropdownItemActive: {
    backgroundColor: 'var(--color-highlight)',
    fontWeight: 600
  },
  arrow: {
    fontSize: 12,
    fontWeight: 700
  }
}
