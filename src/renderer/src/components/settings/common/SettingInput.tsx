import React from 'react';

interface SettingInputProps {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'password';
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  id?: string;
  actions?: React.ReactNode;
}

export const SettingInput: React.FC<SettingInputProps> = ({
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
  readOnly = false,
  className = '',
  id,
  actions
}) => {
  return (
    <div className={`relative flex items-center ${className}`}>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        className={`w-full bg-surface-elevated border border-border rounded-md px-3 py-1.5 text-xs text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-accent font-mono transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          actions ? 'pr-20' : ''
        }`}
      />
      {actions && (
        <div className="absolute right-1.5 flex items-center gap-1">
          {actions}
        </div>
      )}
    </div>
  );
};
