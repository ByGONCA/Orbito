import React, { useState, useEffect, useRef } from 'react';
import {
  FileCode,
  Terminal,
  Workflow,
  Network,
  X,
  Plus,
  PanelLeft,
  PanelRight,
  ArrowLeft,
  ArrowRight,
  Minus,
  Square,
  Copy,
  FolderGit2,
  ChevronRight,
  MoreHorizontal,
  FolderOpen,
  Settings,
  HelpCircle,
  Search,
  Globe
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspace.store';
import { FileIcon } from '../utils/file-icons';
import { OfficialLogoRenderer } from './OfficialLogos';

export const TopTabBar: React.FC = () => {
  const {
    openTabs,
    activeTabId,
    setActiveTabId,
    closeTab,
    openTerminalTab,
    openGraphTab,
    isLeftSidebarOpen,
    toggleLeftSidebar,
    leftSidebarWidth,
    isRightPanelOpen,
    toggleRightPanel,
    rightPanelWidth,
    setCommandPaletteOpen,
    setArcLauncherOpen,
    toggleSettings,
    project,
    setProject,
    setFiles,
    activeFilePath,
    terminalSessions,
    addLog
  } = useWorkspaceStore();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeMenuSub, setActiveMenuSub] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const activeTab = openTabs.find((t) => t.id === activeTabId);

  // Check initial maximized state & listen to window state changes
  useEffect(() => {
    window.api.isWindowMaximized?.().then(setIsMaximized).catch(() => {});
    const unsub = window.api.onWindowStateChange?.((state) => {
      setIsMaximized(state.isMaximized);
    });
    return () => unsub?.();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
        setActiveMenuSub(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Window control actions
  const handleMinimize = () => {
    window.api.minimizeWindow?.();
  };

  const handleMaximize = async () => {
    const max = await window.api.maximizeWindow?.();
    setIsMaximized(Boolean(max));
  };

  const handleClose = () => {
    window.api.closeWindow?.();
  };

  const handleOpenFolder = async () => {
    setIsMenuOpen(false);
    try {
      const selected = await window.api.openDirectoryDialog();
      if (selected) {
        setProject(selected);
        const fileList = await window.api.listFiles({ projectPath: selected.path });
        setFiles(fileList);
        addLog(`Opened workspace: ${selected.name}`, 'info');
      }
    } catch (err: any) {
      addLog(`Failed to open folder: ${err.message}`, 'error');
    }
  };

  // Compute breadcrumbs if active tab is a file
  const breadcrumbs = React.useMemo(() => {
    if (!activeTab || activeTab.type !== 'file' || !activeFilePath) return null;
    const cleanPath = activeFilePath.replace(/\\/g, '/');
    const parts = cleanPath.split('/').filter(Boolean);
    return parts.slice(-4);
  }, [activeTab, activeFilePath]);

  const getTabIcon = (type: string) => {
    switch (type) {
      case 'file':
        return FileCode;
      case 'flow':
        return Workflow;
      case 'graph':
        return Network;
      case 'terminal':
      default:
        return Terminal;
    }
  };

  return (
    <div
      onDoubleClick={handleMaximize}
      className="flex flex-col flex-shrink-0 z-30 border-b border-white/[0.07] bg-[#121418]/90 backdrop-blur-xl select-none font-sans"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* 1. Main Header Strip Row */}
      <div className="h-9 flex items-stretch justify-between">
        {/* Left Section: Aligned with sidebar width (seamless, NO vertical divider line) */}
        <div
          className="flex items-center gap-1.5 flex-shrink-0 px-2"
          style={{
            WebkitAppRegion: 'no-drag',
            width: isLeftSidebarOpen ? `${leftSidebarWidth}px` : 'auto'
          } as React.CSSProperties}
        >
          {/* Orc Stylized Wave Logo */}
          <div
            className="flex items-center justify-center w-6 h-6 text-[#ECEDEF] hover:text-white cursor-pointer transition-colors"
            title="AI Workspace"
          >
            <svg
              className="w-4 h-4 fill-current"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M2.5 14.5C4 11 8 8 13.5 8.5C18 9 20.5 7 21.5 5.5C21 8.5 18.5 12 14.5 13C10.5 14 7 17 4.5 20C4 18 3 16 2.5 14.5Z" />
              <path d="M14 6C15.5 4.5 18 3.5 21 3C19.5 5 17 6.5 14 6Z" opacity="0.6" />
            </svg>
          </div>

          {/* Three-Dots Menu (···) */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`p-1 rounded-md text-[#A4A8AF] hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer ${
                isMenuOpen ? 'bg-white/[0.12] text-white' : ''
              }`}
              title="Application Menu"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>

            {/* Application Dropdown Menu */}
            {isMenuOpen && (
              <div
                className="absolute left-0 top-full mt-1.5 w-56 frosted-canvas py-1 text-xs shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 border border-white/[0.09]"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              >
                {/* File */}
                <div className="px-1 py-0.5">
                  <div className="px-2 py-1 text-[10px] font-mono text-[#747982] uppercase tracking-wider">
                    File
                  </div>
                  <button
                    onClick={handleOpenFolder}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-[#ECEDEF] hover:text-white hover:bg-white/[0.08] flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <FolderOpen className="w-3.5 h-3.5 text-[#A4A8AF]" />
                      <span>Open Folder...</span>
                    </span>
                    <span className="text-[10px] font-mono text-[#747982]">Ctrl+O</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      openTerminalTab();
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-[#ECEDEF] hover:text-white hover:bg-white/[0.08] flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5 text-[#A4A8AF]" />
                      <span>New Terminal</span>
                    </span>
                    <span className="text-[10px] font-mono text-[#747982]">Ctrl+`</span>
                  </button>
                </div>

                <div className="h-px bg-white/[0.06] my-1" />

                {/* View */}
                <div className="px-1 py-0.5">
                  <div className="px-2 py-1 text-[10px] font-mono text-[#747982] uppercase tracking-wider">
                    View
                  </div>
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      setCommandPaletteOpen(true);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-[#ECEDEF] hover:text-white hover:bg-white/[0.08] flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Search className="w-3.5 h-3.5 text-[#A4A8AF]" />
                      <span>Command Palette...</span>
                    </span>
                    <span className="text-[10px] font-mono text-[#747982]">Ctrl+K</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      toggleLeftSidebar();
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-[#ECEDEF] hover:text-white hover:bg-white/[0.08] flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <PanelLeft className="w-3.5 h-3.5 text-[#A4A8AF]" />
                      <span>Toggle Sidebar</span>
                    </span>
                    <span className="text-[10px] font-mono text-[#747982]">Ctrl+B</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      openGraphTab();
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-[#ECEDEF] hover:text-white hover:bg-white/[0.08] flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Network className="w-3.5 h-3.5 text-[#A4A8AF]" />
                      <span>Intelligence Graph</span>
                    </span>
                  </button>
                </div>

                <div className="h-px bg-white/[0.06] my-1" />

                {/* Settings & Exit */}
                <div className="px-1 py-0.5">
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      toggleSettings(true);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-[#ECEDEF] hover:text-white hover:bg-white/[0.08] flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Settings className="w-3.5 h-3.5 text-[#A4A8AF]" />
                      <span>Settings & Keyring</span>
                    </span>
                  </button>
                  <button
                    onClick={handleClose}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span>Exit</span>
                    <span className="text-[10px] font-mono text-[#747982]">Alt+F4</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Left Sidebar Toggle Icon [|] */}
          <button
            onClick={toggleLeftSidebar}
            className={`p-1 rounded-md text-[#A4A8AF] hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer ${
              isLeftSidebarOpen ? 'text-white' : ''
            }`}
            title={isLeftSidebarOpen ? 'Collapse Left Sidebar' : 'Expand Left Sidebar'}
          >
            <PanelLeft className="w-3.5 h-3.5" />
          </button>

          {/* Navigation Arrows (← →) */}
          <div className="flex items-center gap-0.5 text-[#747982]">
            <button
              onClick={() => window.history.back()}
              className="p-1 rounded-md hover:text-[#ECEDEF] hover:bg-white/[0.06] transition-colors cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => window.history.forward()}
              className="p-1 rounded-md hover:text-[#ECEDEF] hover:bg-white/[0.06] transition-colors cursor-pointer"
              title="Forward"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Center Section: Tabs Strip & Plus Button */}
        <div
          className="flex items-center gap-1.5 overflow-x-auto flex-1 min-w-0 pl-1.5 pr-2 h-full"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          {openTabs.map((tab) => {
            const isActive = activeTabId === tab.id;
            const isFile = tab.type === 'file';
            const isTerminal = tab.type === 'terminal';
            const term = isTerminal
              ? terminalSessions.find((ts) => ts.id === tab.terminalId)
              : null;
            const Icon = getTabIcon(tab.type);

            return (
              <div
                key={tab.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', tab.id);
                  e.dataTransfer.setData('application/orc-tab-id', tab.id);
                  if (tab.terminalId) {
                    e.dataTransfer.setData('application/orc-term-id', tab.terminalId);
                  }
                }}
                onClick={() => {
                  setActiveTabId(tab.id);
                  if (isTerminal) {
                    useWorkspaceStore.getState().setActiveSection('terminal');
                    if (tab.terminalId) {
                      useWorkspaceStore.getState().setActiveTerminalId(tab.terminalId);
                    }
                  }
                }}
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                className={`group relative flex items-center gap-2 px-3 h-7 rounded-md text-xs cursor-pointer transition-all max-w-[210px] flex-shrink-0 ${
                  isActive
                    ? 'bg-[#1e2129] text-white font-medium shadow-xs'
                    : 'bg-transparent hover:bg-white/[0.05] text-[#A4A8AF] hover:text-[#ECEDEF]'
                }`}
              >
                {/* Official Icon & Status badge */}
                {isTerminal ? (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        term?.status === 'running'
                          ? 'bg-emerald-400 animate-pulse'
                          : 'bg-emerald-400'
                      }`}
                    />
                    <OfficialLogoRenderer
                      provider={term?.provider}
                      title={tab.title}
                      className="w-3.5 h-3.5 flex-shrink-0"
                    />
                  </div>
                ) : tab.type === 'browser' ? (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Globe className="w-3.5 h-3.5 text-[#A4A8AF] flex-shrink-0" />
                  </div>
                ) : isFile ? (
                  <FileIcon
                    name={tab.title}
                    isDirectory={false}
                    className="w-3.5 h-3.5 flex-shrink-0"
                    theme="material"
                  />
                ) : (
                  <Icon
                    className={`w-3.5 h-3.5 flex-shrink-0 ${
                      isActive ? 'text-[#ECEDEF]' : 'text-[#747982]'
                    }`}
                  />
                )}

                <span className="truncate text-[11px] font-mono">{tab.title}</span>

                {/* Modified badge */}
                {tab.isDirty && (
                  <span className="text-[10px] text-amber-400 font-mono font-bold">M</span>
                )}

                {/* Tab Close Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="p-0.5 hover:bg-white/20 rounded text-[#747982] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 cursor-pointer"
                  title="Close Tab"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            );
          })}

          {/* Plus Button (+) - Opens Arc Launcher */}
          <button
            onClick={() => setArcLauncherOpen(true)}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className="p-1 hover:bg-white/[0.08] rounded-md text-[#A4A8AF] hover:text-[#ECEDEF] flex-shrink-0 transition-colors cursor-pointer"
            title="New Terminal / Tab (Ctrl+T)"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right Section: Right Sidebar Toggle & Window Controls (— □ ✕) */}
        <div
          className="flex items-center justify-end gap-1.5 flex-shrink-0"
          style={{
            WebkitAppRegion: 'no-drag',
            width: isRightPanelOpen ? `${rightPanelWidth}px` : 'auto'
          } as React.CSSProperties}
        >
          {/* Right Sidebar Toggle [|] */}
          <button
            onClick={toggleRightPanel}
            className={`p-1 rounded-md transition-colors cursor-pointer ${
              isRightPanelOpen ? 'text-[#ECEDEF]' : 'text-[#A4A8AF]'
            } hover:text-white hover:bg-white/[0.08]`}
            title={isRightPanelOpen ? 'Hide Right Panel' : 'Show Right Panel'}
          >
            <PanelRight className="w-3.5 h-3.5" />
          </button>

          {/* Window Controls Divider */}
          <div className="h-3.5 w-px bg-white/10 mx-1 flex-shrink-0" />

          {/* Integrated Frameless Window Controls (— □ ✕) */}
          <div className="flex items-center gap-0.5">
            {/* Minimize (—) */}
            <button
              onClick={handleMinimize}
              className="w-8 h-7 flex items-center justify-center rounded-sm text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.08] transition-colors cursor-pointer"
              title="Minimize"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            {/* Maximize / Restore (□) */}
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

            {/* Close (✕) */}
            <button
              onClick={handleClose}
              className="w-8 h-7 flex items-center justify-center rounded-sm text-[#A4A8AF] hover:text-white hover:bg-[#E81123] transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. File Breadcrumbs Row (if a file tab is active) */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div
          className="h-6 px-3 bg-white/[0.02] border-t border-white/[0.04] flex items-center gap-1.5 text-[11px] text-[#A4A8AF] font-mono overflow-x-auto"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {project && (
            <span className="flex items-center gap-1 text-[#ECEDEF] font-medium">
              <FolderGit2 className="w-3 h-3 text-[#747982]" />
              <span>{project.name}</span>
            </span>
          )}
          {breadcrumbs.map((part, index) => (
            <React.Fragment key={`${part}-${index}`}>
              <ChevronRight className="w-3 h-3 text-[#747982] flex-shrink-0" />
              <span
                className={
                  index === breadcrumbs.length - 1
                    ? 'text-[#ECEDEF] font-medium'
                    : 'text-[#A4A8AF]'
                }
              >
                {part}
              </span>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

export default TopTabBar;
