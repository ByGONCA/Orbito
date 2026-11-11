import React, { useState, useEffect } from 'react';
import {
  Mic,
  RotateCw,
  ChevronDown,
  Volume2,
  Check,
  X
} from 'lucide-react';
import { useVoiceStore } from '../../../stores/voice.store';

interface VoicePageProps {
  onCloseSettings?: () => void;
}

export const VoicePage: React.FC<VoicePageProps> = ({ onCloseSettings }) => {
  const {
    selectedMicId,
    setSelectedMicId,
    dictationShortcut,
    setDictationShortcut,
    transcribeProvider,
    setTranscribeProvider,
    silenceFiltering,
    setSilenceFiltering,
    removeFillerWords,
    setRemoveFillerWords,
    dictionary,
    addDictionaryWord,
    removeDictionaryWord,
    sharedDictionary,
    addSharedDictionaryWord,
    removeSharedDictionaryWord,
    availableMics,
    refreshMicrophones,
    isTestingMic,
    testCountdown,
    testAudioUrl,
    testMicrophone,
    stopTestMicrophone
  } = useVoiceStore();

  const [dictInput, setDictInput] = useState('');
  const [sharedDictInput, setSharedDictInput] = useState('');
  const [isMicDropdownOpen, setIsMicDropdownOpen] = useState(false);
  const [isShortcutDropdownOpen, setIsShortcutDropdownOpen] = useState(false);
  const [isTranscribeDropdownOpen, setIsTranscribeDropdownOpen] = useState(false);

  useEffect(() => {
    refreshMicrophones();
  }, [refreshMicrophones]);

  const handleAddDict = () => {
    if (!dictInput.trim()) return;
    dictInput.split(/[,;\n]+/).forEach((w) => addDictionaryWord(w));
    setDictInput('');
  };

  const handleAddSharedDict = () => {
    if (!sharedDictInput.trim()) return;
    sharedDictInput.split(/[,;\n]+/).forEach((w) => addSharedDictionaryWord(w));
    setSharedDictInput('');
  };

  const selectedMicLabel =
    availableMics.find((m) => m.deviceId === selectedMicId)?.label ||
    (selectedMicId === 'default' ? 'System default' : 'Microphone');

  const shortcutLabels: Record<string, string> = {
    auto: 'Auto: press to toggle, hold to record',
    toggle: 'Press to toggle recording',
    hold: 'Hold while speaking',
    off: 'Disabled'
  };

  const transcribeLabels: Record<string, string> = {
    off: 'Off',
    webspeech: 'Web Speech API (Built-in)',
    whisper: 'OpenAI Whisper API',
    local: 'Local Whisper (Desktop)'
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150 text-[#ECEDEF] font-sans pb-12">
      {/* Scope row */}
      <div className="flex items-center gap-1.5 text-xs text-[#8A8F98]">
        <span>Applying settings for</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.05] hover:bg-white/[0.08] text-[#ECEDEF] font-medium transition-colors"
        >
          <span>All projects</span>
          <ChevronDown className="w-3 h-3 text-[#747982]" />
        </button>
        <span>across</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.05] hover:bg-white/[0.08] text-[#ECEDEF] font-medium transition-colors"
        >
          <span>All environments</span>
          <ChevronDown className="w-3 h-3 text-[#747982]" />
        </button>
      </div>

      {/* SECTION 1: Input */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Input</h3>

        <div className="rounded-xl bg-[#111216]/90 border border-white/[0.07] divide-y divide-white/[0.05]">
          {/* Row 1: Microphone */}
          <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1 max-w-lg">
              <div className="text-xs font-medium text-white">Microphone</div>
              <p className="text-[11.5px] text-[#8A8F98] leading-relaxed">
                System default follows your operating system. Record a ten-second test and play it
                back here. Test audio stays on this device and is never transcribed.
              </p>
              {testAudioUrl && !isTestingMic && (
                <div className="flex items-center gap-2 pt-1 text-[11px] text-emerald-400">
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Playback ready (played automatically)</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={testMicrophone}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-white/[0.08] cursor-pointer ${
                  isTestingMic
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                    : 'bg-white/[0.05] hover:bg-white/[0.08] text-[#ECEDEF]'
                }`}
              >
                <Mic className="w-3.5 h-3.5 text-foreground-secondary" />
                <span>
                  {isTestingMic ? `Recording... (${testCountdown}s)` : 'Test microphone'}
                </span>
              </button>

              {/* Mic Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsMicDropdownOpen(!isMicDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-[#ECEDEF] transition-colors cursor-pointer min-w-[140px] justify-between"
                >
                  <span className="truncate max-w-[120px]">{selectedMicLabel}</span>
                  <ChevronDown className="w-3 h-3 text-[#747982] flex-shrink-0" />
                </button>

                {isMicDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 w-56 rounded-lg bg-[#181a20] border border-white/[0.1] shadow-2xl py-1 z-50">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMicId('default');
                        setIsMicDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/[0.08] flex items-center justify-between text-[#ECEDEF]"
                    >
                      <span>System default</span>
                      {selectedMicId === 'default' && <Check className="w-3 h-3 text-blue-400" />}
                    </button>
                    {availableMics.map((mic) => (
                      <button
                        key={mic.deviceId}
                        type="button"
                        onClick={() => {
                          setSelectedMicId(mic.deviceId);
                          setIsMicDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/[0.08] flex items-center justify-between text-[#ECEDEF]"
                      >
                        <span className="truncate">{mic.label || 'Microphone'}</span>
                        {selectedMicId === mic.deviceId && (
                          <Check className="w-3 h-3 text-blue-400" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={refreshMicrophones}
                className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-[#8A8F98] hover:text-white transition-colors border border-white/[0.08]"
                title="Refresh microphones"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Row 2: Dictation shortcut */}
          <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-medium text-white">Dictation shortcut</div>
              <p className="text-[11.5px] text-[#8A8F98]">
                How the dictation shortcut starts and stops recording.
              </p>
            </div>

            <div className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsShortcutDropdownOpen(!isShortcutDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-[#ECEDEF] transition-colors cursor-pointer min-w-[220px] justify-between"
              >
                <span>{shortcutLabels[dictationShortcut] || dictationShortcut}</span>
                <ChevronDown className="w-3 h-3 text-[#747982] flex-shrink-0" />
              </button>

              {isShortcutDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-64 rounded-lg bg-[#181a20] border border-white/[0.1] shadow-2xl py-1 z-50">
                  {Object.entries(shortcutLabels).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setDictationShortcut(key);
                        setIsShortcutDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/[0.08] flex items-center justify-between text-[#ECEDEF]"
                    >
                      <span>{label}</span>
                      {dictationShortcut === key && <Check className="w-3 h-3 text-blue-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: Transcription */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Transcription</h3>

        <div className="rounded-xl bg-[#111216]/90 border border-white/[0.07] p-4 flex items-center justify-between">
          <div className="text-xs font-medium text-white">Transcribe with</div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsTranscribeDropdownOpen(!isTranscribeDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-[#ECEDEF] transition-colors cursor-pointer min-w-[120px] justify-between"
            >
              <span className="flex items-center gap-1.5">
                {transcribeProvider === 'off' ? (
                  <Mic className="w-3 h-3 text-[#747982]" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
                <span>{transcribeLabels[transcribeProvider] || transcribeProvider}</span>
              </span>
              <ChevronDown className="w-3 h-3 text-[#747982] flex-shrink-0" />
            </button>

            {isTranscribeDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 rounded-lg bg-[#181a20] border border-white/[0.1] shadow-2xl py-1 z-50">
                {Object.entries(transcribeLabels).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setTranscribeProvider(key);
                      setIsTranscribeDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/[0.08] flex items-center justify-between text-[#ECEDEF]"
                  >
                    <span>{label}</span>
                    {transcribeProvider === key && <Check className="w-3 h-3 text-blue-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 3: Transcription options */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Transcription options</h3>

        <div className="rounded-xl bg-[#111216]/90 border border-white/[0.07] divide-y divide-white/[0.05]">
          {/* Silence filtering */}
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="space-y-1 max-w-lg">
              <div className="text-xs font-medium text-white">Silence filtering</div>
              <p className="text-[11.5px] text-[#8A8F98]">
                Skip silence and other non-speech audio before transcription, keeping a short buffer
                so words aren&apos;t cut off.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={silenceFiltering}
              onClick={() => setSilenceFiltering(!silenceFiltering)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 border-0 ${
                silenceFiltering ? 'bg-blue-600' : 'bg-white/10'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition duration-200 mt-[3px] ml-[3px] ${
                  silenceFiltering ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Remove filler words */}
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="space-y-1 max-w-lg">
              <div className="text-xs font-medium text-white">Remove filler words</div>
              <p className="text-[11.5px] text-[#8A8F98]">
                Remove filler words like &quot;um&quot; and &quot;uh&quot; from transcripts.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={removeFillerWords}
              onClick={() => setRemoveFillerWords(!removeFillerWords)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 border-0 ${
                removeFillerWords ? 'bg-blue-600' : 'bg-white/10'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition duration-200 mt-[3px] ml-[3px] ${
                  removeFillerWords ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Dictionary */}
          <div className="p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-white">Dictionary</div>
              <span className="text-[11px] font-mono text-[#747982]">
                {dictionary.length} {dictionary.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>
            <p className="text-[11.5px] text-[#8A8F98] max-w-2xl leading-relaxed">
              Names and terms transcription should spell your way, saved on this device. Add an
              alias when it keeps hearing a term wrong. The name of the project you dictate in is
              also sent as a hint.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={dictInput}
                onChange={(e) => setDictInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddDict()}
                placeholder="Add words or phrases, separated by commas or line breaks"
                className="flex-1 bg-black/40 border border-white/[0.08] focus:border-white/20 rounded-lg px-3 py-1.5 text-xs text-[#ECEDEF] placeholder:text-[#555A64] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddDict}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition-colors cursor-pointer"
              >
                Add
              </button>
            </div>

            {dictionary.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {dictionary.map((word) => (
                  <span
                    key={word}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.08] text-xs text-[#ECEDEF]"
                  >
                    <span>{word}</span>
                    <button
                      type="button"
                      onClick={() => removeDictionaryWord(word)}
                      className="hover:text-rose-400 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Shared dictionary */}
          <div className="p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-white">Shared dictionary</div>
              <span className="text-[11px] font-mono text-[#747982]">
                {sharedDictionary.length} {sharedDictionary.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>
            <p className="text-[11.5px] text-[#8A8F98] max-w-2xl leading-relaxed">
              Saved on the environment and used in every project there, along with each person&apos;s
              own dictionary. Pick a project above to limit these words to one project.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={sharedDictInput}
                onChange={(e) => setSharedDictInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSharedDict()}
                placeholder="Add words or phrases, separated by commas or line breaks"
                className="flex-1 bg-black/40 border border-white/[0.08] focus:border-white/20 rounded-lg px-3 py-1.5 text-xs text-[#ECEDEF] placeholder:text-[#555A64] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddSharedDict}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition-colors cursor-pointer"
              >
                Add
              </button>
            </div>

            {sharedDictionary.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {sharedDictionary.map((word) => (
                  <span
                    key={word}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.08] text-xs text-[#ECEDEF]"
                  >
                    <span>{word}</span>
                    <button
                      type="button"
                      onClick={() => removeSharedDictionaryWord(word)}
                      className="hover:text-rose-400 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
