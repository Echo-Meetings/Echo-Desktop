import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';

interface ComboBoxProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

export const ComboBox: React.FC<ComboBoxProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  style,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number>(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const selectedOption = options.find((o) => o.value === value);

  const openDropdown = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 200),
    });
    setIsOpen(true);
    setHoveredIndex(-1);
  }, []);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSelect = useCallback(
    (optionValue: string) => {
      onChange(optionValue);
      closeDropdown();
    },
    [onChange, closeDropdown]
  );

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        closeDropdown();
      }
    };

    // Use setTimeout so the opening click doesn't immediately close
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, closeDropdown]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDropdown();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeDropdown]);

  const getTriggerBg = (): string => {
    if (isPressed) return 'var(--color-border)';
    if (isHovered) return 'var(--color-highlight)';
    return 'var(--color-surface)';
  };

  const triggerStyle: React.CSSProperties = {
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    backgroundColor: getTriggerBg(),
    padding: '6px 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 'var(--font-body)' as any,
    color: 'var(--color-foreground)',
    minHeight: 32,
    cursor: 'pointer',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'var(--transition-fast)',
    width: '100%',
    ...style,
  };

  const dropdownStyle: React.CSSProperties = {
    position: 'fixed',
    top: dropdownPos.top,
    left: dropdownPos.left,
    minWidth: dropdownPos.width,
    maxHeight: 300,
    overflowY: 'auto',
    backgroundColor: 'var(--color-background)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--color-border)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    zIndex: 1000,
    padding: '4px 0',
  };

  const getItemStyle = (index: number, isSelected: boolean): React.CSSProperties => {
    const hovered = hoveredIndex === index && !isSelected;
    return {
      height: 24,
      padding: '0 12px',
      display: 'flex',
      alignItems: 'center',
      fontSize: 'var(--font-caption)' as any,
      backgroundColor: isSelected
        ? '#3478F6'
        : hovered
          ? 'var(--color-highlight)'
          : 'transparent',
      color: isSelected ? '#ffffff' : 'var(--color-foreground)',
      cursor: 'pointer',
      userSelect: 'none',
    };
  };

  const dropdown = isOpen
    ? ReactDOM.createPortal(
        <div style={dropdownStyle}>
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <div
                key={option.value}
                style={getItemStyle(index, isSelected)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(-1)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(option.value);
                }}
              >
                <span
                  style={{
                    width: 16,
                    flexShrink: 0,
                    fontSize: 11,
                    lineHeight: 1,
                  }}
                >
                  {isSelected ? '\u2713' : ''}
                </span>
                {option.label}
              </div>
            );
          })}
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <button
        ref={triggerRef}
        style={triggerStyle}
        onClick={() => (isOpen ? closeDropdown() : openDropdown())}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setIsPressed(false);
        }}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span style={{ color: 'var(--color-secondary)', marginLeft: 8, flexShrink: 0 }}>
          &#9662;
        </span>
      </button>
      {dropdown}
    </>
  );
};
