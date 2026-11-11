import React, { useEffect } from 'react';
import { X, Check, Mic } from 'lucide-react';
import { useVoiceStore } from '../../stores/voice.store';
import { useWorkspaceStore } from '../../stores/workspace.store';

export const VoiceDictationPill: React.FC = () => {
  const { isListening, transcript, interimTranscript, stopListening } = useVoiceStore();
  const { activeTerminalId } = useWorkspaceStore();

  const handleCommit = () => {
    const textToInsert = (transcript || interimTranscript).trim();
    if (textToInsert && activeTerminalId) {
      window.api?.terminalWrite?.({
        terminalId: activeTerminalId,
        data: `${textToInsert} `
      });
    }
    stopListening();
  };

  const handleCancel = () => {
    stopListening();
  };

  if (!isListening) return null;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[1000] animate-in fade-in slide-in-from-bottom-2 duration-150 select-none font-sans">
      <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[#16181d]/95 backdrop-blur-xl border border-white/[0.12] shadow-2xl text-xs text-white">
        {/* Cancel Button (X) */}
        <button
          type="button"
          onClick={handleCancel}
          className="w-5 h-5 rounded-full bg-white/[0.08] hover:bg-rose-500/20 hover:text-rose-400 flex items-center justify-center text-[#8A8F98] transition-colors cursor-pointer"
          title="Cancel dictation"
        >
          <X className="w-3 h-3" />
        </button>

        {/* Pulsing Mic Indicator */}
        <div className="flex items-center gap-1.5 px-1">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <Mic className="w-3.5 h-3.5 text-rose-400" />
        </div>

        {/* Waveform / Live Transcript Preview */}
        <div className="max-w-xs md:max-w-md truncate text-xs text-[#ECEDEF]">
          {transcript || interimTranscript || 'Listening... Speak clearly'}
        </div>

        {/* Audio Dots Animation */}
        <div className="flex items-center gap-0.5 px-1">
          <span className="w-1 h-3 rounded-full bg-blue-400 animate-pulse" />
          <span className="w-1 h-4 rounded-full bg-purple-400 animate-pulse delay-75" />
          <span className="w-1 h-2 rounded-full bg-cyan-400 animate-pulse delay-150" />
          <span className="w-1 h-3.5 rounded-full bg-indigo-400 animate-pulse delay-100" />
        </div>

        {/* Commit Button (✓) */}
        <button
          type="button"
          onClick={handleCommit}
          className="w-5 h-5 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white transition-colors cursor-pointer"
          title="Insert into active terminal"
        >
          <Check className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
