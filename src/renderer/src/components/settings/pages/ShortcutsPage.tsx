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
            Keybindings
          </h2>
        </div>

        <button
          type="button"
          onClick={handleResetAll}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer rounded-md ${
            resetFeedback
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'text-foreground-muted hover:text-foreground hover:bg-white/[0.04]'
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
        <div className="py-2.5 px-3.5 bg-amber-500/10 rounded-lg text-xs text-amber-300 flex items-center justify-between">
          <span>Recording shortcut... Press your desired key combination.</span>
          <button
            onClick={() => setRecordingId(null)}
            className="px-2 py-0.5 rounded text-[11px] text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/20 cursor-pointer font-mono transition-colors"
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
              className="w-full bg-white/[0.03] hover:bg-white/[0.05] focus:bg-white/[0.06] rounded-md pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-foreground-muted/60 focus:outline-none transition-colors font-mono border-0"
            />
          </div>

          <div className="space-y-0.5 pt-1">
            {filteredShortcuts.map((sc) => {
              const isRecording = recordingId === sc.id;
              const isCustom = sc.currentCombo !== sc.defaultCombo;

              return (
                <div
                  key={sc.id}
                  className={`flex items-center justify-between py-2.5 px-2.5 transition-colors rounded-md ${
                    isRecording ? 'bg-amber-500/10' : 'hover:bg-white/[0.03]'
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
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-amber-500 text-black font-semibold animate-pulse">
                        Press keys...
                      </span>
                    ) : (
                      <button
                        onClick={() => setRecordingId(sc.id)}
                        className="font-mono text-xs text-foreground-secondary hover:text-foreground hover:bg-white/[0.05] px-2 py-1 rounded transition-colors cursor-pointer tracking-wide"
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

export const KeybindingsPage = ShortcutsPage;
