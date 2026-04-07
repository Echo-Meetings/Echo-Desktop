import React, { useState } from 'react';

interface ButtonProps {
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'ghost' | 'destructive';
  iconOnly?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

const sizeStyles: Record<string, React.CSSProperties> = {
  small: { height: 28, fontSize: 12, padding: '0 10px' },
  medium: { height: 36, fontSize: 'var(--font-button)' as any, padding: '0 16px' },
  large: { height: 40, fontSize: 14, padding: '0 20px' },
};

const baseStyle: React.CSSProperties = {
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  fontWeight: 500,
  fontFamily: 'inherit',
  transition: 'var(--transition-fast)',
  outline: 'none',
};

export const Button: React.FC<ButtonProps> = ({
  size = 'medium',
  variant = 'default',
  iconOnly = false,
  disabled = false,
  children,
  onClick,
  style,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const getVariantStyle = (): React.CSSProperties => {
    switch (variant) {
      case 'ghost':
        return {
          border: 'none',
          backgroundColor: isHovered ? 'var(--color-surface)' : 'transparent',
          color: 'var(--color-foreground)',
        };
      case 'destructive':
        return {
          border: '1px solid var(--color-destructive)',
          color: 'var(--color-destructive)',
          backgroundColor: isHovered ? 'rgba(204,0,0,0.08)' : 'transparent',
        };
      default:
        return {
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: isHovered ? 'var(--color-border-strong)' : 'var(--color-border)',
          backgroundColor: 'var(--color-background)',
          color: 'var(--color-foreground)',
        };
    }
  };

  const iconOnlyStyle: React.CSSProperties = iconOnly
    ? {
        width: sizeStyles[size].height,
        padding: 0,
        borderRadius: '50%',
      }
    : {};

  const pressStyle: React.CSSProperties = {
    transform: isPressed ? 'scale(0.97)' : 'scale(1)',
    transition: `transform 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94), var(--transition-fast)`,
  };

  const disabledStyle: React.CSSProperties = disabled
    ? { opacity: 0.4, pointerEvents: 'none' }
    : {};

  const combined: React.CSSProperties = {
    ...baseStyle,
    ...sizeStyles[size],
    ...getVariantStyle(),
    ...iconOnlyStyle,
    ...pressStyle,
    ...disabledStyle,
    ...style,
  };

  return (
    <button
      style={combined}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
    >
      {children}
    </button>
  );
};
