import React from 'react';

interface SettingSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  id?: string;
}

export const SettingSection: React.FC<SettingSectionProps> = ({
  title,
  description,
  children,
  action,
  id
}) => {
  return (
    <section id={id} className="space-y-4 pt-2">
      <div className="flex items-start justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary font-mono">
            {title}
          </h3>
          {description && (
            <p className="text-[12px] text-foreground-muted mt-0.5 leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>

      <div className="space-y-1">
        {children}
      </div>
    </section>
  );
};
