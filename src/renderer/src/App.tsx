import React, { useEffect, useState } from 'react';
import { GlassScene, GlassContent, GlassSurface } from '@glass-sdk/liquid-glass';
import { LeftSidebar } from './components/LeftSidebar';
import { TopTabBar } from './components/TopTabBar';
import { CenterArea } from './components/CenterArea';
import { RightPanel } from './components/RightPanel';
import { BottomStatusBar } from './components/BottomStatusBar';
import { BottomPanel } from './components/BottomPanel';
import { CommandPalette } from './components/CommandPalette';
import { SettingsModal } from './components/SettingsModal';
import { ArcLauncherModal } from './components/ArcLauncherModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppLoadingScreen } from './components/AppLoadingScreen';
import { DetachedTabWindow } from './components/DetachedTabWindow';
import { useWorkspaceStore } from './stores/workspace.store';
import { useKeyboardShortcutsStore } from './stores/keyboard-shortcuts.store';

if (typeof window !== 'undefined') {
  (window as any).__WORKSPACE_STORE__ = useWorkspaceStore;
}

export const App: React.FC = () => {
  // Check if running as a detached single-tab window
  const detachedTabParam = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('detachedTab')
    : null;

  if (detachedTabParam) {
    try {
      const tabData = JSON.parse(decodeURIComponent(detachedTabParam));
      return <DetachedTabWindow tabData={tabData} />;
    } catch (e) {
      console.error('Failed to parse detached tab param:', e);
    }
  }

  const {
    setProject,
    setFiles,
    addLog,
    setTheme,
    loadProjectGraph,
    isLeftSidebarOpen,
    leftSidebarWidth,
    setLeftSidebarWidth,
    isRightPanelOpen,
    rightPanelWidth,
    setRightPanelWidth
  } = useWorkspaceStore();

  const [isAppReady, setIsAppReady] = useState(false);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);

  // System log broadcast and error subscribers
  useEffect(() => {
    window.api?.getSystemLogs?.().then((initialLogs) => {
      if (Array.isArray(initialLogs)) {
        for (const l of initialLogs) {
          const level: 'info' | 'warn' | 'error' = l.level === 'debug' ? 'info' : l.level;
          addLog(`[${l.component || 'System'}] ${l.message}`, level);
        }
      }
    }).catch(() => {});

    const unsubLogs = window.api?.onSystemLog?.((log) => {
      addLog(log.message, log.level);
    });

    if (!useWorkspaceStore.getState().cliStatuses && window.api?.detectCLIs) {
      window.api.detectCLIs({ customPaths: useWorkspaceStore.getState().customPaths }).then((res) => {
        if (res) useWorkspaceStore.getState().setCLIStatuses(res);
      }).catch(() => {});
    }

    const handleWindowError = (event: ErrorEvent) => {
      addLog(`[Renderer Error] ${event.message}`, 'error');
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.message || String(event.reason);
      addLog(`[Renderer Unhandled Rejection] ${reason}`, 'error');
    };

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      const shortcuts = useKeyboardShortcutsStore.getState();

      if (shortcuts.matchesEvent('commandPalette', event)) {
        event.preventDefault();
        useWorkspaceStore.getState().setCommandPaletteOpen(true);
        return;
      }
      if (shortcuts.matchesEvent('toggleLeftSidebar', event)) {
        event.preventDefault();
        useWorkspaceStore.getState().toggleLeftSidebar();
        return;
      }
      if (shortcuts.matchesEvent('toggleRightPanel', event)) {
        event.preventDefault();
        useWorkspaceStore.getState().toggleRightPanel();
        return;
      }
      if (shortcuts.matchesEvent('toggleBottomPanel', event)) {
        event.preventDefault();
        useWorkspaceStore.getState().toggleBottomPanel();
        return;
      }
      if (shortcuts.matchesEvent('openBrowser', event)) {
        event.preventDefault();
        useWorkspaceStore.getState().openBrowserTab('https://www.google.com');
        return;
      }
      if (shortcuts.matchesEvent('openArcLauncher', event)) {
        event.preventDefault();
        useWorkspaceStore.getState().setArcLauncherOpen(true);
        return;
      }
      if (shortcuts.matchesEvent('openSettings', event)) {
        event.preventDefault();
        useWorkspaceStore.getState().toggleSettings(true);
        return;
      }
      if (shortcuts.matchesEvent('newTerminal', event)) {
        event.preventDefault();
        const store = useWorkspaceStore.getState();
        store.createTerminalSession('powershell');
        return;
      }
      if (shortcuts.matchesEvent('splitTerminal', event)) {
        event.preventDefault();
        const store = useWorkspaceStore.getState();
        if (store.terminalSessions.length > 1) {
          const other = store.terminalSessions.find((s) => s.id !== store.activeTerminalId);
          if (other) {
            store.setSplitTerminalId(store.splitTerminalId ? null : other.id);
          }
        }
        return;
      }
    };

    const handleBeforeUnload = () => {
      useWorkspaceStore.getState().flushSaveCurrentWorkspaceState();
    };

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('keydown', handleWindowKeyDown);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unsubLogs?.();
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('keydown', handleWindowKeyDown);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [addLog]);

  // Stepped startup restoration handler invoked by AppLoadingScreen
  const handleRestoreWorkspace = async (
    onProgress: (percent: number, msg: string, detail: string, stepId: string) => void
  ) => {
    // 1. Verify Electron API & Environment
    onProgress(15, 'Verifying Electron runtime...', 'Validating secure communication channels', 'ipc');
    if (typeof window.api === 'undefined') {
      throw new Error('Electron IPC interface (window.api) is not available in renderer process.');
    }
    await new Promise((r) => setTimeout(r, 120));

    // 2. Settings & Database
    onProgress(40, 'Loading user settings...', 'Reading preferences and theme configuration', 'db');
    try {
      const settings = await window.api.getSettings?.();
      if (settings) {
        if (settings.theme && ['glass', 'solid', 'light'].includes(settings.theme)) {
          setTheme(settings.theme as 'glass' | 'solid' | 'light');
        } else {
          setTheme('glass');
        }
        if (settings.fileIconTheme) {
          useWorkspaceStore.getState().setFileIconTheme(settings.fileIconTheme);
        }
        if (typeof settings.showGitFileColors === 'boolean') {
          useWorkspaceStore.getState().setShowGitFileColors(settings.showGitFileColors);
        }
      } else {
        setTheme('glass');
      }

      // Restore layout & UI configuration
      const layout = await window.api.getAppLayout?.();
      if (layout) {
        useWorkspaceStore.setState({
          isLeftSidebarOpen: layout.isLeftSidebarOpen ?? true,
          leftSidebarWidth: layout.leftSidebarWidth ?? 240,
          isRightPanelOpen: layout.isRightPanelOpen ?? true,
          rightPanelWidth: layout.rightPanelWidth ?? 280,
          isBottomPanelOpen: layout.isBottomPanelOpen ?? false,
          bottomPanelHeight: layout.bottomPanelHeight ?? 220,
          activeSection: (layout.activeSection as any) || 'editor',
          activeSidebarSection: (layout.activeSidebarSection as any) || 'projects',
          rightPanelTab: (layout.rightPanelTab === 'models' ? 'files' : (layout.rightPanelTab as any)) || 'files',
          bottomPanelTab: (layout.bottomPanelTab as any) || 'terminal',
          terminalLayout: (layout.terminalLayout as any) || '1'
        });
      }
    } catch (err: any) {
      addLog(`Settings init notice: ${err.message}`, 'warn');
    }

    // 3. Skills & CLI Extensions
    onProgress(65, 'Loading skills and extensions...', 'Inspecting available CLI agents and tools', 'skills');
    if (window.api.listSkills) {
      await window.api.listSkills().catch(() => []);
    }

    // 4. Workspace & Recent Projects
    onProgress(85, 'Restoring workspace context...', 'Checking repository state and active tabs', 'workspace');
    try {
      const recent = await window.api.getRecentProjects?.();
      if (recent && recent.length > 0) {
        const settings = await window.api.getSettings?.();
        let target = recent.find((p) => p.id === settings?.currentProjectId);
        if (!target) {
          target = recent[0];
        }

        const exists = await window.api.verifyProjectPath?.(target.path);
        if (exists) {
          await useWorkspaceStore.getState().restoreProjectWorkspace(target);
          addLog(`Restored workspace: ${target.name}`, 'info');
        } else {
          addLog(`Notice: Last project path no longer exists: ${target.path}`, 'warn');
          const validNext = recent.find((p) => p.id !== target!.id);
          if (validNext && (await window.api.verifyProjectPath?.(validNext.path))) {
            await useWorkspaceStore.getState().restoreProjectWorkspace(validNext);
          } else {
            setProject(null);
          }
        }
      }
    } catch (wsErr: any) {
      addLog(`Workspace restore notice: ${wsErr.message}`, 'warn');
    }
  };

  const handleBypassWorkspace = () => {
    setProject(null);
    setFiles([]);
    setIsAppReady(true);
  };

  // Ensure at least one terminal tab is open when the app becomes ready
  useEffect(() => {
    if (isAppReady) {
      const store = useWorkspaceStore.getState();
      if (store.openTabs.length === 0) {
        if (store.terminalSessions.length > 0) {
          const first = store.terminalSessions[0];
          store.setActiveTerminalId(first.id);
        } else {
          store.openTerminalTab();
        }
      }
    }
  }, [isAppReady]);

  // Left sidebar horizontal resize drag handler
  const handleLeftMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingLeft(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      setLeftSidebarWidth(moveEvent.clientX);
    };

    const onMouseUp = () => {
      setIsResizingLeft(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

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

  return (
    <ErrorBoundary fallbackTitle="AI Workspace Desktop Crash">
      {!isAppReady && (
        <AppLoadingScreen
          onComplete={() => setIsAppReady(true)}
          onBypassWorkspace={handleBypassWorkspace}
          restoreWorkspace={handleRestoreWorkspace}
        />
      )}

      <div
        className={`flex flex-col h-screen w-screen overflow-hidden app-canvas-root text-foreground select-none font-sans relative ${
          !isAppReady ? 'opacity-0 pointer-events-none' : 'opacity-100 transition-opacity duration-300'
        }`}
      >
        {/* Subtle, soft neutral ambient gradient (no bright/blue saturation) */}
        <div
          className="absolute inset-0 pointer-events-none z-0 app-canvas-ambient"
          style={{
            background: 'radial-gradient(1200px 700px at 50% 0%, rgba(255, 255, 255, 0.012) 0%, transparent 70%)'
          }}
        />

        {/* 1. GLOBAL WINDOW TITLEBAR (100% Full Width, Frameless Top Chrome) */}
        <TopTabBar />

        {/* 2. MAIN APPLICATION WORKSPACE (Sidebar + Center Canvas + Right Panel) */}
        <div className="flex-1 flex overflow-hidden relative z-10 min-h-0">
          {/* Left Sidebar */}
          {isLeftSidebarOpen && (
            <div
              style={{ width: `${leftSidebarWidth}px` }}
              className="flex-shrink-0 h-full overflow-hidden frosted-sidebar relative"
            >
              <LeftSidebar />
              {/* Left Resize Drag Handle (Overlay on edge, zero layout gap) */}
              <div
                onMouseDown={handleLeftMouseDown}
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-white/20 transition-colors z-30"
              />
            </div>
          )}

          {/* Center Main Dynamic Workspace */}
          <main className="flex-1 h-full min-w-0 overflow-hidden bg-transparent relative flex flex-col">
            <ErrorBoundary fallbackTitle="Workspace Section Error">
              <CenterArea />
            </ErrorBoundary>
          </main>

          {/* Right Panel: Technical Project & Session Explorer */}
          {isRightPanelOpen && (
            <div
              style={{ width: `${rightPanelWidth}px` }}
              className="flex-shrink-0 h-full overflow-hidden frosted-explorer relative"
            >
              <RightPanel />
              {/* Right Resize Drag Handle (Overlay on edge, zero layout gap) */}
              <div
                onMouseDown={handleRightMouseDown}
                className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-white/20 transition-colors z-30"
              />
            </div>
          )}
        </div>

        {/* Optional Collapsible Logs & Telemetry Panel */}
        <BottomPanel />

        {/* 3. BOTTOM STATUS BAR: Compact Operational Indicators */}
        <BottomStatusBar />

        {/* Global Modals: Command Palette, Settings & Arc Launcher */}
        <CommandPalette />
        <SettingsModal />
        <ArcLauncherModal />
      </div>
    </ErrorBoundary>
  );
};

export default App;
