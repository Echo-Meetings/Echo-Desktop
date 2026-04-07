import { useAppStore } from '@/stores/appStore'
import type { HistoryFilter, Tag } from '@/types/models'
import { useT } from '@/i18n'
import { SortMenu } from './SortMenu'

export function FilterBar() {
  const t = useT()
  const {
    historyFilter,
    setHistoryFilter,
    tags,
    activeTagFilter,
    setActiveTagFilter
  } = useAppStore()

  const filterLabels: Record<HistoryFilter, string> = {
    all: t.filterAll,
    today: t.filterToday,
    yesterday: t.filterYesterday,
    last7Days: t.filter7d,
    last30Days: t.filter30d,
    custom: ''
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.filterRow}>
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
        <SortMenu />
      </div>

      {/* Tag filter chips */}
      {tags.length > 0 && (
        <div style={styles.tagFilterBar}>
          {tags.map((tag: Tag) => (
            <button
              key={tag.id}
              onClick={() => setActiveTagFilter(activeTagFilter === tag.id ? null : tag.id)}
              style={{
                ...styles.tagChip,
                ...(activeTagFilter === tag.id
                  ? { backgroundColor: tag.color + '30', color: tag.color, borderColor: tag.color + '60', fontWeight: 600 }
                  : {})
              }}
            >
              <span style={{ ...styles.tagDot, backgroundColor: tag.color }} />
              {tag.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    flexShrink: 0
  },
  filterRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px 4px 12px',
    gap: 2
  },
  filterBar: {
    display: 'flex',
    gap: 2,
    flex: 1,
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
  tagFilterBar: {
    display: 'flex',
    gap: 4,
    padding: '2px 12px 6px',
    overflowX: 'auto',
    scrollbarWidth: 'none' as any,
    msOverflowStyle: 'none' as any
  },
  tagChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    padding: '2px 8px',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'transparent',
    color: 'var(--color-secondary)',
    fontSize: 10,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'var(--transition-fast)'
  },
  tagDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0
  }
}
