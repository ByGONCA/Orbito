import React, { useState, useEffect, useMemo } from 'react';
import {
  Keyboard,
  Search,
  RotateCcw
} from 'lucide-react';
import { SettingSection } from '../common/SettingSection';
import { Button } from '../../ui/Button';
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

  const filteredShortcuts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return shortcuts;
    return shortcuts.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.currentCombo.toLowerCase().includes(q)
    );
  }, [shortcuts, searchQuery]);

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#ECEDEF] tracking-tight">
            Keyboard Shortcuts
          </h2>
          <p className="text-xs text-[#A4A8AF] mt-1">
            Customize key combinations for rapid workspace navigation and commands.
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={resetAllToDefault}
          className="text-xs text-[#A4A8AF] hover:text-white"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
          <span>Reset All to Defaults</span>
        </Button>
      </div>

      {recordingId && (
        <div className="py-2.5 px-3.5 bg-amber-500/10 border border-amber-500/20 rounded-md text-xs text-amber-300 flex items-center justify-between">
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
            <Search className="w-3.5 h-3.5 text-[#747982] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shortcuts by command or key..."
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-md pl-9 pr-3 py-1.5 text-xs text-[#ECEDEF] placeholder:text-[#747982] focus:outline-none focus:border-white/30 font-mono"
            />
          </div>

          <div className="divide-y divide-white/[0.04]">
            {filteredShortcuts.map((sc) => {
              const isRecording = recordingId === sc.id;
              const isCustom = sc.currentCombo !== sc.defaultCombo;

              return (
                <div
                  key={sc.id}
                  className={`flex items-center justify-between py-3 px-1 transition-colors rounded-md ${
                    isRecording ? 'bg-amber-500/10' : 'hover:bg-white/[0.01]'
                  }`}
                >
                  <div className="space-y-0.5 max-w-[65%]">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#ECEDEF]">{sc.label}</span>
                      <span className="text-[10px] text-[#747982] font-mono uppercase">
                        {sc.category}
                      </span>
                    </div>
                    <p className="text-xs text-[#747982]">{sc.description}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isRecording ? (
                      <span className="font-mono text-xs px-2.5 py-1 rounded bg-amber-500 text-black font-semibold animate-pulse">
                        Press keys...
                      </span>
                    ) : (
                      <button
                        onClick={() => setRecordingId(sc.id)}
                        className="font-mono text-xs text-[#ECEDEF] hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] px-2.5 py-1 rounded transition-colors cursor-pointer"
                        title="Click to record new key combo"
                      >
                        {sc.currentCombo || 'None'}
                      </button>
                    )}

                    {isCustom && !isRecording && (
                      <button
                        onClick={() => resetShortcut(sc.id)}
                        className="text-[11px] text-[#747982] hover:text-[#ECEDEF] px-1.5 py-0.5 rounded transition-colors cursor-pointer font-mono"
                        title="Reset to default"
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
