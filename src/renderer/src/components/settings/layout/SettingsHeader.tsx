import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Search,
  X,
  Minus,
  Square,
  Copy
} from 'lucide-react';
import {
  searchSettingsRegistry,
  type SearchResult
} from '../registry/settings-registry';
import type { SettingsSectionId } from '../../../../../shared/types';

interface SettingsHeaderProps {
  onClose: () => void;
  onSelectSection: (sectionId: SettingsSectionId) => void;
}

export const SettingsHeader: React.FC<SettingsHeaderProps> = ({
  onClose,
  onSelectSection
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isMaximized, setIsMaximized] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const searchResults = searchSettingsRegistry(searchQuery);

  useEffect(() => {
    window.api?.isWindowMaximized?.().then(setIsMaximized).catch(() => {});
    const unsub = window.api?.onWindowStateChange?.((state) => {
      setIsMaximized(state.isMaximized);
    });
    return () => unsub?.();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleResultClick = (result: SearchResult) => {
    onSelectSection(result.sectionId);
    setSearchQuery('');
    setIsDropdownOpen(false);
  };

  return (
    <div
      className="h-11 w-full flex items-center justify-between px-3 bg-surface/90 backdrop-blur-md flex-shrink-0 relative z-30 border-0"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left: Back Button & Title */}
      <div
        className="flex items-center gap-2.5"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.05] hover:bg-white/[0.08] text-xs text-foreground transition-colors cursor-pointer border-0"
          title="Back to Workspace (Esc)"
          aria-label="Back to Workspace"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-foreground-secondary" />
          <span className="font-medium text-[12px]">Back</span>
        </button>

        <div className="w-[1px] h-3.5 bg-white/10 mx-1" />

        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
          <span>Settings</span>
          <span className="text-[11px] font-mono text-foreground-muted">
            Esc to exit
          </span>
        </div>
      </div>

      {/* Center: Search Registry */}
      <div
        ref={searchContainerRef}
        className="relative w-80 max-w-sm hidden sm:block"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <Search className="w-3.5 h-3.5 text-foreground-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsDropdownOpen(true);
          }}
          onFocus={() => setIsDropdownOpen(true)}
          placeholder="Search all settings..."
          className="w-full bg-white/[0.04] hover:bg-white/[0.06] focus:bg-white/[0.08] text-xs text-foreground rounded-md pl-8 pr-7 py-1 placeholder:text-foreground-muted focus:outline-none transition-colors border-0"
        />
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery('');
              setIsDropdownOpen(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground p-0.5 rounded transition-colors cursor-pointer"
            title="Clear search"
            aria-label="Clear search"
          >
            <X className="w-3 h-3" />
          </button>
        )}

        {/* Instant Search Results Dropdown */}
        {isDropdownOpen && searchQuery.trim() && (
          <div className="absolute top-full left-0 right-0 mt-1 max-h-80 overflow-y-auto bg-surface rounded-lg shadow-2xl py-1 space-y-0.5 z-50 border-0">
            {searchResults.length === 0 ? (
              <div className="px-3 py-3 text-xs text-foreground-muted text-center font-mono">
                No matching settings found
              </div>
            ) : (
              searchResults.map((result, idx) => {
                const Icon = result.icon;
                return (
                  <button
                    key={`${result.sectionId}-${result.settingId || idx}`}
                    onClick={() => handleResultClick(result)}
                    className="w-full text-left px-3 py-2 hover:bg-surface-hover transition-colors flex items-start gap-2.5 cursor-pointer"
                  >
                    <Icon className="w-3.5 h-3.5 text-foreground-secondary mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground">
                          {result.settingLabel || result.sectionLabel}
                        </span>
                        <span className="text-[10px] font-mono text-foreground-muted uppercase">
                          {result.sectionLabel}
                        </span>
                      </div>
                      <p className="text-[11px] text-foreground-muted truncate mt-0.5">
                        {result.description}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Right: Window Controls */}
      <div
        className="flex items-center gap-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={() => window.api?.minimizeWindow?.()}
          className="p-1.5 hover:bg-surface-hover text-foreground-secondary hover:text-foreground rounded transition-colors cursor-pointer"
          title="Minimize"
          aria-label="Minimize Window"
        >
          <Minus className="w-3 h-3" />
        </button>

        <button
          onClick={() => window.api?.maximizeWindow?.()}
          className="p-1.5 hover:bg-surface-hover text-foreground-secondary hover:text-foreground rounded transition-colors cursor-pointer"
          title={isMaximized ? 'Restore' : 'Maximize'}
          aria-label={isMaximized ? 'Restore Window' : 'Maximize Window'}
        >
          {isMaximized ? (
            <Copy className="w-2.5 h-2.5 rotate-180" />
          ) : (
            <Square className="w-2.5 h-2.5" />
          )}
        </button>

        <button
          onClick={onClose}
          className="p-1.5 hover:bg-rose-500/20 hover:text-rose-400 text-foreground-secondary rounded transition-colors cursor-pointer"
          title="Close Settings (Esc)"
          aria-label="Close Settings"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
