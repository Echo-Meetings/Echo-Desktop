import { useT } from '@/i18n'

interface Props {
  value: string
  onChange: (value: string) => void
}

export function SearchBar({ value, onChange }: Props) {
  const t = useT()

  return (
    <div style={styles.searchWrapper}>
      <div style={styles.searchField}>
        <svg style={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder={t.searchPlaceholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={styles.searchInput}
        />
        {value && (
          <button onClick={() => onChange('')} style={styles.clearButton}>
            &#x2715;
          </button>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
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
    opacity: 0.4,
    flexShrink: 0
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
  }
}
