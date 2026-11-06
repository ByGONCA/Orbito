import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'accent-ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
  iconRight?: React.ReactNode | React.ComponentType<{ className?: string }>;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  isLoading,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all duration-200 ease-out select-none cursor-pointer disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-1 focus-visible:ring-white/60';

  const sizeStyles = {
    sm: 'h-7 px-3 text-[11px] gap-1.5 rounded-full',
    md: 'h-8 px-4 text-xs gap-2 rounded-full',
    lg: 'h-9 px-5 text-sm gap-2.5 rounded-full'
  }[size];

  const variantStyles = {
    primary:
      'bg-[#ECEEF2] text-[#101113] hover:bg-white active:scale-[0.98] font-semibold border border-white/20 shadow-xs',
    secondary:
      'bg-white/[0.04] text-[#ECEDEF] hover:bg-white/[0.08] hover:text-white border border-white/[0.08] active:scale-[0.98]',
    ghost:
      'bg-transparent text-[#A4A8AF] hover:text-white hover:bg-white/[0.06] active:bg-white/[0.10] rounded-full',
    destructive:
      'bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/30 active:scale-[0.98] rounded-full',
    'accent-ghost':
      'bg-white/[0.06] text-[#ECEDEF] hover:bg-white/[0.12] border border-white/[0.12] active:scale-[0.98] rounded-full'
  }[variant];

  const renderIconItem = (item?: React.ReactNode | React.ComponentType<{ className?: string }>) => {
    if (!item) return null;
    if (React.isValidElement(item)) return <span className="flex-shrink-0">{item}</span>;
    if (
      typeof item === 'function' ||
      (typeof item === 'object' && item !== null && ('$$typeof' in (item as any) || 'render' in (item as any)))
    ) {
      const IconComponent = item as React.ComponentType<{ className?: string }>;
      return <IconComponent className="w-3.5 h-3.5 flex-shrink-0" />;
    }
    return <span className="flex-shrink-0">{item as React.ReactNode}</span>;
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
      ) : (
        renderIconItem(icon)
      )}
      {children && <span className="truncate">{children}</span>}
      {!isLoading && renderIconItem(iconRight)}
    </button>
  );
};

export default Button;
