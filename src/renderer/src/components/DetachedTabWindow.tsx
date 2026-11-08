import React, { useState, useEffect } from 'react';
import {
  Terminal as TerminalIcon,
  Minus,
  Square,
  Copy,
  X,
  Globe,
  PanelRight
} from 'lucide-react';
import { CodeEditor } from './CodeEditor';
import { EmbeddedBrowser } from './EmbeddedBrowser';
import { NativeTerminal } from './NativeTerminal';
import { RightPanel } from './RightPanel';
import { OfficialLogoRenderer } from './OfficialLogos';
import { FileIcon } from '../utils/file-icons';
import { useWorkspaceStore, TerminalSessionItem } from '../stores/workspace.store';

interface DetachedTabWindowProps {
  tabData: any;
}

export const DetachedTabWindow: React.FC<DetachedTabWindowProps> = ({ tabData }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [, setIsResizingRight] = useState(false);

  const {
    activeFilePath,
    isRightPanelOpen,
    toggleRightPanel,
    rightPanelWidth,
    setRightPanelWidth,
    restoreProjectWorkspace,
    openFileTab,
    setTheme
  } = useWorkspaceStore();

  // Create an isolated, dedicated terminal session with a unique ID for this detached window
  // This guarantees a clean, responsive PTY that never collides with killed or background parent sessions
  const [session] = useState<TerminalSessionItem | null>(() => {
    if (tabData.type === 'terminal') {
      const rawSess = tabData.session;
      const detachedId = `term-det-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const provider = rawSess?.provider || tabData.provider || 'powershell';
      const workDir = rawSess?.workingDirectory || tabData.project?.path || '';

      return {
        id: detachedId,
        title: tabData.title || rawSess?.title || 'Terminal',
        provider,
        projectId: tabData.project?.id || rawSess?.projectId || '',
        projectName: tabData.project?.name || rawSess?.projectName || '',
        workingDirectory: workDir,
        branch: rawSess?.branch || '',
        model: rawSess?.model || '',
        activeSkills: rawSess?.activeSkills || [],
        status: 'idle',
        streamOutput: ''
      };
    }
    return null;
  });

  // Initialize Theme, Settings & Window State
  useEffect(() => {
    setTheme('glass');
    window.api?.getSettings?.().then((settings: any) => {
      if (settings?.customPaths) {
        useWorkspaceStore.setState({ customPaths: settings.customPaths });
      }
    }).catch(() => {});

    window.api?.isWindowMaximized?.().then(setIsMaximized).catch(() => {});
    const unsub = window.api?.onWindowStateChange?.((state) => {
      setIsMaximized(state.isMaximized);
    });
    return () => unsub?.();
  }, [setTheme]);

  // Sync isolated terminal session into local store
  useEffect(() => {
    if (session) {
      useWorkspaceStore.setState({
        terminalSessions: [session],
        activeTerminalId: session.id
      });
    }
  }, [session]);

  // Clean up terminal session on window close/unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (session?.id) {
        window.api?.terminalKill?.({ terminalId: session.id }).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [session?.id]);

  // Right explorer horizontal resize drag handler
  const handleRightMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingRight(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = window.innerWidth - moveEvent.clientX;
      setRightPanelWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizingRight(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleMinimize = () => window.api?.minimizeWindow?.();
  const handleMaximize = async () => {
    const max = await window.api?.maximizeWindow?.();
    setIsMaximized(Boolean(max));
  };
  const handleClose = () => {
    if (session?.id) {
      window.api?.terminalKill?.({ terminalId: session.id }).catch(() => {});
    }
    window.api?.closeWindow?.();
  };

  const isTerminal = tabData.type === 'terminal';
  const isFile = tabData.type === 'file';
  const isBrowser = tabData.type === 'browser';

  const displayedTitle = isFile
    ? (activeFilePath ? activeFilePath.split(/[/\\]/).pop() : tabData.title)
    : tabData.title;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#101113] overflow-hidden font-sans text-white relative">
      {/* 1. Frameless Window Titlebar */}
      <div
        onDoubleClick={handleMaximize}
        className="h-9 flex items-center justify-between px-3 bg-[#121418] border-b border-white/[0.08] select-none flex-shrink-0 z-30"
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
                name={displayedTitle || 'file'}
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
            {displayedTitle}
          </span>
          <span className="text-[10px] text-[#717784] font-mono px-1.5 py-0.5 rounded bg-white/[0.04]">
            Detached Window
          </span>
        </div>

        {/* Center Draggable Spacer */}
        <div className="flex-1 h-full min-w-0" />

        {/* Right: Right Panel Toggle & Window Controls */}
        <div
          className="flex items-center gap-1.5 flex-shrink-0"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {/* Toggle Right Panel (Files Explorer, Outline, Changes, Agents) */}
          <button
            onClick={toggleRightPanel}
            className={`w-7 h-7 flex items-center justify-center rounded-sm transition-colors cursor-pointer ${
              isRightPanelOpen
                ? 'text-[#ECEDEF] bg-white/[0.08]'
                : 'text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.04]'
            }`}
            title={isRightPanelOpen ? 'Hide Right Panel' : 'Show Right Panel'}
            aria-label="Toggle Right Panel"
          >
            <PanelRight className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-[1px] bg-white/10 mx-1" />

          <button
            onClick={handleMinimize}
            className="w-8 h-7 flex items-center justify-center rounded-sm text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.08] transition-colors cursor-pointer"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleMaximize}
            className="w-8 h-7 flex items-center justify-center rounded-sm text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.08] transition-colors cursor-pointer"
            title={isMaximized ? 'Restore Down' : 'Maximize'}
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
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Workspace Body (Main Tab Area + Right Sidebar) */}
      <div className="flex-1 flex overflow-hidden relative min-h-0 bg-[#101113]">
        {/* Center Canvas / Tab Surface */}
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden relative flex flex-col bg-[#101113]">
          {isTerminal && session ? (
            <NativeTerminal
              session={session}
              isActive={true}
              onFocus={() => {}}
            />
          ) : isFile ? (
            <CodeEditor filePath={activeFilePath || tabData.filePath} />
          ) : isBrowser ? (
            <EmbeddedBrowser url={tabData.url || 'https://www.google.com'} tabId={tabData.id} />
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-[#717784]">
              Tab content loaded
            </div>
          )}
        </div>

        {/* Right Sidebar (Project Explorer, Outline, Agents, Context, Skills) */}
        {isRightPanelOpen && (
          <>
            {/* Clean Resize Drag Handle (no grey pill/bar) */}
            <div
              onMouseDown={handleRightMouseDown}
              className="w-1 h-full cursor-col-resize hover:bg-white/20 transition-colors z-20 flex-shrink-0"
            />

            <div
              style={{ width: `${rightPanelWidth}px` }}
              className="flex-shrink-0 h-full overflow-hidden border-l border-white/[0.07] frosted-sidebar bg-[#121418]"
            >
              <RightPanel />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DetachedTabWindow;
