import React, { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useSnapShotsSettingsStore } from '../../../stores/snapshots-settings.store';

interface SnapShotsPageProps {
  onCloseSettings?: () => void;
}

export const SnapShotsPage: React.FC<SnapShotsPageProps> = () => {
  const {
    enabled,
    setEnabled,
    includeAppText,
    setIncludeAppText,
    captureShortcut,
    setCaptureShortcut,
    captureSound,
    setCaptureSound,
    captureFlash,
    setCaptureFlash,
    captureAnimations,
    setCaptureAnimations
  } = useSnapShotsSettingsStore();

  const [isSoundDropdownOpen, setIsSoundDropdownOpen] = useState(false);

  const soundLabels: Record<string, string> = {
    whoosh: 'Whoosh (Default)',
    shutter: 'Camera shutter',
    chime: 'Chime',
    silent: 'Silent'
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150 text-[#ECEDEF] font-sans pb-12">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-white">SnapShots</h3>

        <div className="rounded-xl bg-[#111216]/90 border border-white/[0.07] divide-y divide-white/[0.05]">
          {/* Row 1: SnapShots toggle */}
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="space-y-1 max-w-lg">
              <div className="text-xs font-medium text-white">SnapShots</div>
              <p className="text-[11.5px] text-[#8A8F98]">
                Capture a window and attach it to your current draft.
              </p>
              <div className="text-[11px] text-[#717784]">Shortcut saved</div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 border-0 ${
                enabled ? 'bg-blue-600' : 'bg-white/10'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition duration-200 mt-[3px] ml-[3px] ${
                  enabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Row 2: Include app text */}
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="space-y-1 max-w-lg">
              <div className="text-xs font-medium text-white">Include app text</div>
              <p className="text-[11.5px] text-[#8A8F98]">
                Include text and controls when the app makes them available.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={includeAppText}
              onClick={() => setIncludeAppText(!includeAppText)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 border-0 ${
                includeAppText ? 'bg-blue-600' : 'bg-white/10'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition duration-200 mt-[3px] ml-[3px] ${
                  includeAppText ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Row 3: Capture shortcut */}
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="space-y-1 max-w-lg">
              <div className="text-xs font-medium text-white">Capture shortcut</div>
              <p className="text-[11.5px] text-[#8A8F98]">
                Capture the window you&apos;re using without switching apps.
              </p>
              <div className="text-[11px] text-[#717784]">Shortcut saved.</div>
            </div>

            <div className="flex items-center gap-1">
              <span className="px-2 py-1 rounded bg-white/[0.08] text-xs font-mono text-[#ECEDEF] border border-white/[0.08]">
                ⇧
              </span>
              <span className="px-2 py-1 rounded bg-white/[0.08] text-xs font-mono text-[#ECEDEF] border border-white/[0.08]">
                ⇧
              </span>
            </div>
          </div>

          {/* Row 4: Capture sound */}
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="space-y-1 max-w-lg">
              <div className="text-xs font-medium text-white">Capture sound</div>
              <p className="text-[11.5px] text-[#8A8F98]">
                Choose the sound played when capture starts.
              </p>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSoundDropdownOpen(!isSoundDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-[#ECEDEF] transition-colors cursor-pointer min-w-[150px] justify-between"
              >
                <span>{soundLabels[captureSound]}</span>
                <ChevronDown className="w-3 h-3 text-[#747982] flex-shrink-0" />
              </button>

              {isSoundDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 rounded-lg bg-[#181a20] border border-white/[0.1] shadow-2xl py-1 z-50">
                  {Object.entries(soundLabels).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setCaptureSound(key as any);
                        setIsSoundDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/[0.08] flex items-center justify-between text-[#ECEDEF]"
                    >
                      <span>{label}</span>
                      {captureSound === key && <Check className="w-3 h-3 text-blue-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 5: Capture flash */}
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="space-y-1 max-w-lg">
              <div className="text-xs font-medium text-white">Capture flash</div>
              <p className="text-[11.5px] text-[#8A8F98]">
                Show a gentle cue on the captured window.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={captureFlash}
              onClick={() => setCaptureFlash(!captureFlash)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 border-0 ${
                captureFlash ? 'bg-blue-600' : 'bg-white/10'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition duration-200 mt-[3px] ml-[3px] ${
                  captureFlash ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Row 6: Capture animations */}
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="space-y-1 max-w-lg">
              <div className="text-xs font-medium text-white">Capture animations</div>
              <p className="text-[11.5px] text-[#8A8F98]">
                Animate captured windows into your draft.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={captureAnimations}
              onClick={() => setCaptureAnimations(!captureAnimations)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 border-0 ${
                captureAnimations ? 'bg-blue-600' : 'bg-white/10'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition duration-200 mt-[3px] ml-[3px] ${
                  captureAnimations ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
