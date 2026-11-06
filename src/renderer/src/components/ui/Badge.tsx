import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'neutral' | 'accent' | 'success' | 'warning' | 'error' | 'danger' | 'outline';
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className = ''
}) => {
  const sizeStyles = {
    sm: 'text-[9px] px-1.5 py-0.2',
    md: 'text-[10px] px-2 py-0.5'
  }[size];

  const variantStyles = {
    default: 'bg-white/[0.04] text-[#A4A8AF]',
    neutral: 'bg-white/[0.04] text-[#A4A8AF]',
    accent: 'bg-white/[0.08] text-white font-medium',
    success: 'text-emerald-400 font-medium',
    warning: 'text-amber-400 font-medium',
    error: 'text-rose-400 font-medium',
    danger: 'text-rose-400 font-medium',
    outline: 'bg-transparent text-neutral-400'
  }[variant];

  const dotColors = {
    default: 'bg-foreground-muted',
    neutral: 'bg-foreground-muted',
    accent: 'bg-accent',
    success: 'bg-success',
    warning: 'bg-warning',
    error: 'bg-error',
    danger: 'bg-error',
    outline: 'bg-foreground-muted'
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-mono select-none tracking-tight ${sizeStyles} ${variantStyles} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColors}`} />}
      <span className="truncate">{children}</span>
    </span>
  );
};

export default Badge;
