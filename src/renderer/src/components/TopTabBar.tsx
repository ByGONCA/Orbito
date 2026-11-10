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
import orbitLogo from '../assets/Orbit.png';

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



  return (
    <div
      onDoubleClick={handleMaximize}
      className="flex flex-col flex-shrink-0 z-30 select-none font-sans app-top-tab-bar"
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
          {/* Orbito Logo */}
          <div
            className="flex items-center justify-center w-6 h-6 cursor-pointer transition-opacity hover:opacity-85 select-none"
            title="Orbito"
          >
            <img
              src={orbitLogo}
              alt="Orbito"
              className="w-5 h-5 object-contain select-none pointer-events-none"
              style={{ imageRendering: 'auto' }}
            />
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

        {/* Center Section: Draggable Title Bar Area */}
        <div
          className="flex-1 min-w-0 h-full"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        />

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
    </div>
  );
};

export default TopTabBar;
