import React, { useEffect, useState } from 'react';
import {
  GitBranch,
  Terminal,
  AlertCircle,
  Cpu
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspace.store';
import { ResourceManagerPopover } from './ResourceManagerPopover';

export const BottomStatusBar: React.FC = () => {
  const {
    project,
    terminalSessions,
    metrics,
    setMetrics,
    logs,
    activeOrchestration,
    gitStatus,
    isBottomPanelOpen,
    setBottomPanelOpen,
    bottomPanelTab,
    setBottomPanelTab
  } = useWorkspaceStore();

  const [isResMgrOpen, setIsResMgrOpen] = useState(false);

  // System resource telemetry polling
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        if (window.api.getSystemMetrics) {
          const m = await window.api.getSystemMetrics();
          setMetrics(m);
        }
      } catch {
        // Silently skip
      }
    };

    fetchMetrics();
    const timer = setInterval(fetchMetrics, 3500);
    return () => clearInterval(timer);
  }, [setMetrics]);

  const errorCount = logs.filter((l) => l.level === 'error').length;
  const changedCount = gitStatus?.changedFiles.length || 0;

  const ramMb = metrics?.workingSetMemoryMb || metrics?.totalAppMemoryMb || metrics?.mainProcessMemoryMb || 180;
  const ramText = ramMb >= 1024 ? `${(ramMb / 1024).toFixed(2)} GB` : `${ramMb} MB`;

  return (
    <>
      <footer className="h-6.5 px-3 flex items-center justify-between text-[10px] font-mono text-[#A4A8AF] select-none z-30 app-bottom-status-bar">
        {/* 1. Left: Clean whitespace */}
        <div className="flex items-center gap-2" />

        {/* 2. Center: Empty / Clean whitespace */}
        <div className="flex-1" />

        {/* 3. Right: Agent status, Terminals + RAM, Keep Awake, Output, Errors */}
        <div className="flex items-center gap-3">
          {/* Agent Activity Indicator */}
          <div
            className="flex items-center gap-1.5 text-neutral-400"
            title={activeOrchestration ? `Agent running: ${activeOrchestration.id}` : 'Agent idle'}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                activeOrchestration ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'
              }`}
            />
            <span className="text-[10px]">Agent</span>
          </div>

          <span className="text-white/10">|</span>

          {/* Grouped RAM & Terminals Trigger (Orca-inspired) */}
          <button
            onClick={() => setIsResMgrOpen(!isResMgrOpen)}
            className={`flex items-center gap-2 px-1.5 py-0.5 rounded-[3px] transition-colors cursor-pointer ${
              isResMgrOpen ? 'bg-white/[0.1] text-white' : 'hover:bg-white/[0.05] text-[#A4A8AF] hover:text-white'
            }`}
            title="Open Resource Manager"
          >
            <div className="flex items-center gap-1">
              <Cpu className="w-3 h-3 text-[#747982]" />
              <span>{ramText}</span>
            </div>

            <div className="flex items-center gap-1 text-[#747982]">
              <span>&gt;_</span>
              <span className="text-[#A4A8AF]">{terminalSessions.length}</span>
            </div>
          </button>

          <span className="text-white/10">|</span>

          {/* Terminal Output Trigger */}
          <button
            onClick={() => {
              if (isBottomPanelOpen && bottomPanelTab === 'terminal') {
                setBottomPanelOpen(false);
              } else {
                setBottomPanelTab('terminal');
                setBottomPanelOpen(true);
              }
            }}
            className={`flex items-center gap-1 transition-colors cursor-pointer ${
              isBottomPanelOpen && bottomPanelTab === 'terminal' ? 'text-[#ECEDEF]' : 'text-[#747982] hover:text-[#A4A8AF]'
            }`}
            title="Toggle Terminal Output Panel"
          >
            <Terminal className="w-3 h-3 text-[#747982]" />
            <span>Output</span>
          </button>

          {/* Problems & Errors Trigger */}
          <button
            onClick={() => {
              if (isBottomPanelOpen && bottomPanelTab === 'problems') {
                setBottomPanelOpen(false);
              } else {
                setBottomPanelTab('problems');
                setBottomPanelOpen(true);
              }
            }}
            className={`flex items-center gap-1 transition-colors cursor-pointer ${
              isBottomPanelOpen && bottomPanelTab === 'problems'
                ? 'text-white'
                : errorCount > 0
                  ? 'text-rose-400 font-semibold'
                  : 'text-[#747982] hover:text-[#A4A8AF]'
            }`}
            title="Toggle Problems & System Logs"
          >
            <AlertCircle className={`w-3 h-3 ${errorCount > 0 ? 'text-rose-400' : 'text-[#747982]'}`} />
            <span>{errorCount}</span>
          </button>
        </div>
      </footer>

      {/* Resource Manager Popover */}
      <ResourceManagerPopover
        isOpen={isResMgrOpen}
        onClose={() => setIsResMgrOpen(false)}
      />
    </>
  );
};

export default BottomStatusBar;
