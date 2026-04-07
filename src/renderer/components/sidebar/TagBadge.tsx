import type { Tag } from '@/types/models'

interface Props {
  tag: Tag
  small?: boolean
  onClick?: () => void
  onRemove?: () => void
}

export function TagBadge({ tag, small, onClick, onRemove }: Props) {
  return (
    <span
      style={{
        ...styles.badge,
        backgroundColor: tag.color + '20',
        color: tag.color,
        borderColor: tag.color + '40',
        ...(small ? styles.small : {}),
        ...(onClick ? { cursor: 'pointer' } : {})
      }}
      onClick={onClick}
    >
      <span style={{ ...styles.dot, backgroundColor: tag.color }} />
      {tag.name}
      {onRemove && (
        <span
          style={styles.removeBtn}
          onClick={(e) => { e.stopPropagation(); onRemove() }}
        >
          &#x2715;
        </span>
      )}
    </span>
  )
}

const styles: Record<string, React.CSSProperties> = {
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderRadius: 'var(--radius-full)',
    fontSize: 11,
    fontWeight: 500,
    border: '1px solid',
    whiteSpace: 'nowrap'
  },
  small: {
    padding: '1px 5px',
    fontSize: 10,
    gap: 3
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0
  },
  removeBtn: {
    fontSize: 8,
    cursor: 'pointer',
    opacity: 0.7,
    marginLeft: 2
  }
}
