import React, { useState, useEffect } from 'react';
import {
  Terminal as TerminalIcon,
  Minus,
  Square,
  Copy,
  X,
  Globe
} from 'lucide-react';
import { CodeEditor } from './CodeEditor';
import { EmbeddedBrowser } from './EmbeddedBrowser';
import { TerminalSurface } from './TerminalWorkspace';
import { OfficialLogoRenderer } from './OfficialLogos';
import { FileIcon } from '../utils/file-icons';
import { useWorkspaceStore, TerminalSessionItem } from '../stores/workspace.store';

interface DetachedTabWindowProps {
  tabData: any;
}

export const DetachedTabWindow: React.FC<DetachedTabWindowProps> = ({ tabData }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const { terminalSessions, createTerminalSession } = useWorkspaceStore();

  const [session, setSession] = useState<TerminalSessionItem | null>(tabData.session || null);

  useEffect(() => {
    window.api?.isWindowMaximized?.().then(setIsMaximized).catch(() => {});
    const unsub = window.api?.onWindowStateChange?.((state) => {
      setIsMaximized(state.isMaximized);
    });
    return () => unsub?.();
  }, []);

  // If it's a terminal and has no existing session, create one
  useEffect(() => {
    if (tabData.type === 'terminal' && !session) {
      const provider = tabData.session?.provider || 'powershell';
      const id = createTerminalSession(provider);
      const newSession: TerminalSessionItem = {
        id,
        title: tabData.title || 'Terminal',
        provider,
        projectId: tabData.session?.projectId || '',
        projectName: tabData.session?.projectName || '',
        workingDirectory: tabData.session?.workingDirectory || '',
        branch: tabData.session?.branch || '',
        model: tabData.session?.model || '',
        activeSkills: [],
        status: 'idle',
        streamOutput: ''
      };
      setSession(newSession);
    }
  }, [tabData, session, createTerminalSession]);

  const handleMinimize = () => window.api?.minimizeWindow?.();
  const handleMaximize = async () => {
    const max = await window.api?.maximizeWindow?.();
    setIsMaximized(Boolean(max));
  };
  const handleClose = () => window.api?.closeWindow?.();

  const isTerminal = tabData.type === 'terminal';
  const isFile = tabData.type === 'file';
  const isBrowser = tabData.type === 'browser';

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0a0b0d] select-none overflow-hidden font-sans text-white">
      {/* 1. Frameless Window Titlebar */}
      <div
        onDoubleClick={handleMaximize}
        className="h-9 flex items-center justify-between px-3 bg-[#0c0d10]/90 border-b border-white/[0.045] select-none flex-shrink-0 z-30"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* Left: Tab Title & Icon */}
        <div
          className="flex items-center gap-2 min-w-0"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
            {isTerminal ? (
              <OfficialLogoRenderer
                provider={session?.provider || 'powershell'}
                title={tabData.title}
                className="w-3.5 h-3.5"
              />
            ) : isFile ? (
              <FileIcon
                name={tabData.title}
                isDirectory={false}
                className="w-3.5 h-3.5"
                theme="material"
              />
            ) : isBrowser ? (
              <Globe className="w-3.5 h-3.5 text-[#A4A8AF]" />
            ) : (
              <TerminalIcon className="w-3.5 h-3.5 text-[#A4A8AF]" />
            )}
          </div>
          <span className="text-xs font-mono font-medium text-[#ECEDEF] truncate">
            {tabData.title}
          </span>
          <span className="text-[10px] text-[#717784] font-mono tracking-wide">
            Detached Window
          </span>
        </div>

        {/* Center Draggable Spacer */}
        <div className="flex-1 h-full min-w-0" />

        {/* Right: Window Controls */}
        <div
          className="flex items-center gap-0.5 flex-shrink-0"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={handleMinimize}
            className="w-8 h-7 flex items-center justify-center rounded-sm text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.08] transition-colors cursor-pointer"
            title="Minimize"
            aria-label="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleMaximize}
            className="w-8 h-7 flex items-center justify-center rounded-sm text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.08] transition-colors cursor-pointer"
            title={isMaximized ? 'Restore Down' : 'Maximize'}
            aria-label={isMaximized ? 'Restore Down' : 'Maximize'}
          >
            {isMaximized ? (
              <Copy className="w-3 h-3 rotate-180" />
            ) : (
              <Square className="w-3 h-3" />
            )}
          </button>
          <button
            onClick={handleClose}
            className="w-8 h-7 flex items-center justify-center rounded-sm text-[#A4A8AF] hover:text-white hover:bg-[#E81123] transition-colors cursor-pointer"
            title="Close"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Full Workspace Body for this single tab */}
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden relative flex flex-col bg-[#0a0b0d]">
        {isTerminal && session ? (
          <TerminalSurface
            session={session}
            isActive={true}
            onFocus={() => {}}
          />
        ) : isFile ? (
          <CodeEditor filePath={tabData.filePath} />
        ) : isBrowser ? (
          <EmbeddedBrowser url={tabData.url || 'https://www.google.com'} tabId={tabData.id} />
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-[#717784]">
            Tab content loaded
          </div>
        )}
      </div>
    </div>
  );
};

export default DetachedTabWindow;
