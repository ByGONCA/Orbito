import React, { useState, useEffect, useMemo } from 'react';
import {
  Keyboard,
  Search,
  RotateCcw,
  Check
} from 'lucide-react';
import { SettingSection } from '../common/SettingSection';
import {
  useKeyboardShortcutsStore,
  formatKeyComboFromEvent,
  type ShortcutDefinition
} from '../../../stores/keyboard-shortcuts.store';

export const ShortcutsPage: React.FC = () => {
  const {
    shortcuts,
    recordingId,
    setRecordingId,
    updateShortcut,
    resetShortcut,
    resetAllToDefault
  } = useKeyboardShortcutsStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [resetFeedback, setResetFeedback] = useState(false);

  // Keybind recording listener
  useEffect(() => {
    if (!recordingId) return;

    const handleRecordKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setRecordingId(null);
        return;
      }

      const combo = formatKeyComboFromEvent(e);
      if (combo) {
        updateShortcut(recordingId, combo);
      }
    };

    window.addEventListener('keydown', handleRecordKey, { capture: true });
    return () => window.removeEventListener('keydown', handleRecordKey, { capture: true });
  }, [recordingId, updateShortcut, setRecordingId]);

  const handleResetAll = () => {
    resetAllToDefault();
    setResetFeedback(true);
    setTimeout(() => setResetFeedback(false), 2000);
  };

  const filteredShortcuts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return shortcuts;
    return shortcuts.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.currentCombo.toLowerCase().includes(q)
    );
  }, [shortcuts, searchQuery]);

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground tracking-tight">
            Keyboard Shortcuts
          </h2>
          <p className="text-xs text-foreground-muted mt-1">
            Customize key combinations for rapid workspace navigation and commands.
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetAll}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-150 cursor-pointer shadow-xs active:scale-[0.98] ${
            resetFeedback
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
              : 'border-border/70 bg-surface-elevated/70 hover:bg-surface-hover text-foreground-secondary hover:text-foreground'
          }`}
          title="Reset all shortcuts to defaults"
        >
          {resetFeedback ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Defaults Restored</span>
            </>
          ) : (
            <>
              <RotateCcw className="w-3.5 h-3.5 text-foreground-muted" />
              <span>Reset All to Defaults</span>
            </>
          )}
        </button>
      </div>

      {recordingId && (
        <div className="py-2.5 px-3.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300 flex items-center justify-between">
          <span>Recording shortcut... Press your desired key combination.</span>
          <button
            onClick={() => setRecordingId(null)}
            className="px-2 py-0.5 rounded text-[11px] bg-white/10 hover:bg-white/20 text-white cursor-pointer font-mono"
          >
            Cancel (Esc)
          </button>
        </div>
      )}

      <SettingSection
        title="Command Keybindings"
        description="Click any shortcut key combination to record a new hotkey."
      >
        <div className="space-y-3 pt-1">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-foreground-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shortcuts by command or key..."
              className="w-full bg-surface border border-border/70 focus:border-accent/40 rounded-lg pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-foreground-muted focus:outline-none transition-colors font-mono"
            />
          </div>

          <div className="divide-y divide-border/40">
            {filteredShortcuts.map((sc) => {
              const isRecording = recordingId === sc.id;
              const isCustom = sc.currentCombo !== sc.defaultCombo;

              return (
                <div
                  key={sc.id}
                  className={`flex items-center justify-between py-3 px-1 transition-colors rounded-lg ${
                    isRecording ? 'bg-amber-500/10' : 'hover:bg-surface-hover/30'
                  }`}
                >
                  <div className="space-y-0.5 max-w-[65%]">
                    <span className="text-sm font-medium text-foreground block">
                      {sc.label}
                    </span>
                    <p className="text-xs text-foreground-muted">{sc.description}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isRecording ? (
                      <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-amber-500 text-black font-semibold animate-pulse">
                        Press keys...
                      </span>
                    ) : (
                      <button
                        onClick={() => setRecordingId(sc.id)}
                        className="font-mono text-xs text-foreground hover:text-foreground bg-surface-elevated hover:bg-surface-hover border border-border px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                        title="Click to record new key combo"
                      >
                        {sc.currentCombo || 'None'}
                      </button>
                    )}

                    {isCustom && !isRecording && (
                      <button
                        onClick={() => resetShortcut(sc.id)}
                        className="text-[11px] text-foreground-muted hover:text-foreground px-1.5 py-0.5 rounded transition-colors cursor-pointer font-mono"
                        title="Reset this shortcut to default"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </SettingSection>
    </div>
  );
};
