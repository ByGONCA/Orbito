import React from 'react';
import { Search, X } from 'lucide-react';

export interface SearchFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
  shortcut?: string;
}

export const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  ({ value, onChange, onClear, placeholder = 'Search...', shortcut, className = '', ...props }, ref) => {
    return (
      <div className={`relative flex items-center w-full ${className}`}>
        <Search className="w-3.5 h-3.5 text-foreground-muted absolute left-2.5 pointer-events-none" />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full glass-input text-foreground text-xs rounded-lg pl-8 pr-8 py-1.5 placeholder:text-foreground-muted transition-colors duration-150 focus:outline-none"
          {...props}
        />
        {value && onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2 p-0.5 rounded text-foreground-muted hover:text-foreground transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        ) : shortcut ? (
          <kbd className="absolute right-2 px-1.5 py-0.5 bg-surface-elevated text-[9px] font-mono text-foreground-muted rounded border border-border pointer-events-none">
            {shortcut}
          </kbd>
        ) : null}
      </div>
    );
  }
);

SearchField.displayName = 'SearchField';

export default SearchField;
