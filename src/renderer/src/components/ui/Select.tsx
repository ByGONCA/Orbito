import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

export interface CustomSelectProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  size?: 'sm' | 'md';
}

export function CustomSelect<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = 'Select an option...',
  disabled = false,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  size = 'sm'
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);

  const sizeClasses =
    size === 'sm'
      ? 'px-2.5 py-1 text-xs rounded-lg gap-1.5'
      : 'px-3 py-1.5 text-xs rounded-lg gap-2';

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex items-center justify-between bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.1] text-[#ECEDEF] font-medium border border-white/[0.1] hover:border-white/[0.16] transition-all cursor-pointer select-none focus:outline-none focus:ring-1 focus:ring-white/20 disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses} ${buttonClassName}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5 truncate">
          {selectedOption?.icon && (
            <span className="flex-shrink-0 text-[#8E929B]">{selectedOption.icon}</span>
          )}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#8E929B] transition-transform duration-150 flex-shrink-0 ${
            isOpen ? 'rotate-180 text-white' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute left-0 top-full mt-1.5 min-w-[210px] w-max max-w-xs bg-[#14161b]/98 backdrop-blur-2xl border border-white/[0.1] rounded-xl p-1 shadow-2xl shadow-black/80 z-50 animate-in fade-in zoom-in-95 duration-100 ${menuClassName}`}
          role="listbox"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-start justify-between gap-3 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer group ${
                  isSelected
                    ? 'bg-white/[0.09] text-white'
                    : 'text-[#A4A8AF] hover:text-white hover:bg-white/[0.05]'
                }`}
                role="option"
                aria-selected={isSelected}
              >
                <div className="flex items-start gap-2 min-w-0">
                  {option.icon && (
                    <span className="mt-0.5 flex-shrink-0 text-[#8E929B] group-hover:text-white">
                      {option.icon}
                    </span>
                  )}
                  <div className="min-w-0">
                    <div
                      className={`text-xs ${
                        isSelected ? 'font-semibold text-white' : 'font-medium'
                      }`}
                    >
                      {option.label}
                    </div>
                    {option.description && (
                      <div className="text-[10px] text-[#717784] group-hover:text-[#8E929B] leading-tight mt-0.5 font-normal">
                        {option.description}
                      </div>
                    )}
                  </div>
                </div>

                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-white flex-shrink-0 mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
