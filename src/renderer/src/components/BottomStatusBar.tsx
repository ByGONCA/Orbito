import React, { useEffect, useState } from 'react';
import {
  Cpu
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspace.store';
import { ResourceManagerPopover } from './ResourceManagerPopover';

export const BottomStatusBar: React.FC = () => {
  const {
    terminalSessions,
    metrics,
    setMetrics,
    activeOrchestration
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

  const ramMb = metrics?.workingSetMemoryMb || metrics?.totalAppMemoryMb || metrics?.mainProcessMemoryMb || 180;
  const ramText = ramMb >= 1024 ? `${(ramMb / 1024).toFixed(2)} GB` : `${ramMb} MB`;

  return (
    <>
      <footer className="h-6.5 px-3 flex items-center justify-between text-[10px] font-mono text-[#A4A8AF] select-none z-30 app-bottom-status-bar">
        {/* 1. Left: Clean whitespace */}
        <div className="flex items-center gap-2" />

        {/* 2. Center: Empty / Clean whitespace */}
        <div className="flex-1" />

        {/* 3. Right: Agent status, Terminals + RAM */}
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
