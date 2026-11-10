import React from 'react';

interface SettingRowProps {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  badge?: React.ReactNode;
  alignTop?: boolean;
  className?: string;
  id?: string;
}

export const SettingRow: React.FC<SettingRowProps> = ({
  title,
  description,
  children,
  badge,
  alignTop = false,
  className = '',
  id
}) => {
  return (
    <div
      id={id}
      className={`group flex ${
        alignTop ? 'items-start' : 'items-center'
      } justify-between gap-6 py-3.5 px-1 rounded-lg transition-colors hover:bg-surface-hover/50 ${className}`}
    >
      <div className="space-y-1 min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground leading-snug tracking-tight">
            {title}
          </span>
          {badge}
        </div>
        {description && (
          <div className="text-xs text-foreground-muted leading-relaxed max-w-2xl">
            {description}
          </div>
        )}
      </div>

      {children && (
        <div className="flex-shrink-0 flex items-center gap-2">
          {children}
        </div>
      )}
    </div>
  );
};
