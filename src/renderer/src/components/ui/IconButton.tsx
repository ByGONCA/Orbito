import React from 'react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode | React.ComponentType<{ className?: string }>;
  label?: string;
  tooltip?: string;
  variant?: 'ghost' | 'secondary' | 'accent' | 'destructive';
  size?: 'xs' | 'sm' | 'md';
  isActive?: boolean;
  badge?: number | string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  label,
  tooltip,
  variant = 'ghost',
  size = 'md',
  isActive = false,
  badge,
  className = '',
  ...props
}) => {
  const sizeStyles = {
    xs: 'w-6 h-6 rounded-lg text-xs',
    sm: 'w-7 h-7 rounded-lg text-xs',
    md: 'w-8 h-8 rounded-xl text-sm'
  }[size];

  const variantStyles = {
    ghost: isActive
      ? 'liquid-pill text-white border border-white/35 shadow-sm'
      : 'text-foreground-secondary hover:text-white hover:bg-white/[0.08] active:bg-white/[0.14]',
    secondary: isActive
      ? 'liquid-pill text-white'
      : 'liquid-glass text-foreground-secondary hover:text-white',
    accent: 'liquid-primary font-semibold',
    destructive: 'text-foreground-muted hover:text-error hover:bg-error/20'
  }[variant];

  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    if (
      typeof icon === 'function' ||
      (typeof icon === 'object' && icon !== null && ('$$typeof' in (icon as any) || 'render' in (icon as any)))
    ) {
      const IconComponent = icon as React.ComponentType<{ className?: string }>;
      return <IconComponent className="w-3.5 h-3.5" />;
    }
    return icon as React.ReactNode;
  };

  return (
    <div className="relative group inline-flex items-center justify-center">
      <button
        aria-label={label || tooltip}
        className={`relative inline-flex items-center justify-center transition-all duration-150 ease-out select-none cursor-pointer disabled:opacity-40 disabled:pointer-events-none focus:outline-none focus-visible:ring-1 focus-visible:ring-accent active:scale-[0.96] ${sizeStyles} ${variantStyles} ${className}`}
        {...props}
      >
        <span className="flex items-center justify-center flex-shrink-0">{renderIcon()}</span>
        {badge !== undefined && badge !== '' && (
          <span className="absolute -top-1 -right-1 px-1 min-w-[14px] h-[14px] rounded-full bg-accent text-background text-[9px] font-bold flex items-center justify-center leading-none shadow-subtle">
            {badge}
          </span>
        )}
      </button>

      {/* Floating Hover Tooltip */}
      {tooltip && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 glass-card bg-surface-elevated/95 backdrop-blur-md border border-border text-foreground text-[10px] font-mono rounded-lg shadow-dropdown z-50 whitespace-nowrap">
          {tooltip}
        </div>
      )}
    </div>
  );
};

export default IconButton;
