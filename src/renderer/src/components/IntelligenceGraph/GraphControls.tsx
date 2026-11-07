import React from 'react';
import {
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Tag,
  Filter,
  Layers,
  Sparkles,
  FileCode,
  Bot,
  BrainCircuit,
  FileQuestion,
  RefreshCw,
  Play,
  Pause,
  Terminal
} from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { Badge } from '../ui/Badge';
import { IconButton } from '../ui/IconButton';

interface GraphControlsProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: string | null;
  onSelectCategory: (cat: string | null) => void;
  showLabels: boolean;
  onToggleLabels: () => void;
  orphanOnly: boolean;
  onToggleOrphanOnly: () => void;
  orphanCount: number;
  totalNodes: number;
  totalEdges: number;
  onRefresh: () => void;
  isLoading: boolean;
  isPhysicsPaused?: boolean;
  onTogglePhysics?: () => void;
}

export const GraphControls: React.FC<GraphControlsProps> = ({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onSelectCategory,
  showLabels,
  onToggleLabels,
  orphanOnly,
  onToggleOrphanOnly,
  orphanCount,
  totalNodes,
  totalEdges,
  onRefresh,
  isLoading,
  isPhysicsPaused = false,
  onTogglePhysics
}) => {
  const categories: Array<{ id: string | null; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: null, label: 'All', icon: Layers },
    { id: 'file', label: 'Files', icon: FileCode },
    { id: 'agent', label: 'Agents', icon: Bot },
    { id: 'skill', label: 'Skills', icon: Sparkles },
    { id: 'context', label: 'Context', icon: BrainCircuit }
  ];

  return (
    <div className="absolute top-4 left-4 right-4 z-20 pointer-events-none flex flex-wrap items-center justify-between gap-3 select-none">
      {/* 1. Left: Search & Category Filter Bar */}
      <div className="pointer-events-auto flex items-center gap-2 p-1.5 rounded-2xl glass-card backdrop-blur-glass border border-border shadow-dropdown font-mono text-xs">
        {/* Search Input */}
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-foreground-muted absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search graph nodes..."
            className="w-48 bg-surface-elevated/60 border border-border/80 focus:border-accent text-foreground text-xs rounded-xl pl-8 pr-2.5 py-1.5 placeholder:text-foreground-muted focus:outline-none transition-all"
          />
        </div>

        <div className="w-[1px] h-5 bg-border/60 mx-1" />

        {/* Category Pills */}
        <div className="flex items-center gap-1">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id && !orphanOnly;
            const Icon = cat.icon;
            return (
              <button
                key={cat.label}
                onClick={() => {
                  if (orphanOnly) onToggleOrphanOnly();
                  onSelectCategory(cat.id);
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-accent text-background font-semibold shadow-xs'
                    : 'text-foreground-secondary hover:text-foreground hover:bg-surface-elevated/50'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        <div className="w-[1px] h-5 bg-border/60 mx-1" />

        {/* Orphaned Files Filter Toggle */}
        <button
          onClick={onToggleOrphanOnly}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
            orphanOnly
              ? 'bg-warning/20 text-warning shadow-xs'
              : 'text-foreground-secondary hover:text-foreground hover:bg-surface-elevated/50'
          }`}
          title="Filter files with no detected incoming or outgoing connections"
        >
          <FileQuestion className="w-3.5 h-3.5" />
          <span>Orphaned</span>
          <span className="text-[10px] font-mono opacity-80">({orphanCount})</span>
        </button>
      </div>

      {/* 2. Right: Action Buttons & Stats */}
      <div className="pointer-events-auto flex items-center gap-2">
        {/* Return to Terminal Button */}
        <button
          onClick={() => {
            const store = useWorkspaceStore.getState();
            const term = store.terminalSessions.find((t) => t.id === store.activeTerminalId) || store.terminalSessions[0];
            if (term) {
              store.openTerminalTab(term.id);
            } else {
              store.openTerminalTab();
            }
            store.setActiveSection('terminal');
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-card backdrop-blur-glass border border-white/[0.1] hover:border-white/[0.2] hover:bg-white/[0.08] text-xs font-mono text-[#ECEDEF] hover:text-white transition-all cursor-pointer shadow-xs"
          title="Switch to Terminal"
        >
          <Terminal className="w-3.5 h-3.5 text-accent" />
          <span className="hidden sm:inline">Terminal</span>
        </button>

        {/* Graph Stats Pill */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl glass-card backdrop-blur-glass border border-border text-[11px] font-mono text-foreground-secondary">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span>
            {totalNodes} nodes · {totalEdges} edges
          </span>
        </div>

        {/* Controls Strip */}
        <div className="flex items-center gap-1 p-1 rounded-xl glass-card backdrop-blur-glass border border-border shadow-dropdown">
          {onTogglePhysics && (
            <IconButton
              icon={isPhysicsPaused ? Play : Pause}
              onClick={onTogglePhysics}
              tooltip={isPhysicsPaused ? 'Resume Physics Simulation' : 'Freeze Physics Layout'}
              size="sm"
              className={isPhysicsPaused ? 'text-amber-400' : 'text-foreground-muted hover:text-foreground'}
            />
          )}

          <IconButton
            icon={Tag}
            onClick={onToggleLabels}
            tooltip={showLabels ? 'Hide Labels' : 'Show Labels'}
            size="sm"
            className={showLabels ? 'text-accent' : 'text-foreground-muted hover:text-foreground'}
          />

          <IconButton
            icon={RefreshCw}
            onClick={onRefresh}
            tooltip="Refresh Codebase Graph"
            size="sm"
            className={isLoading ? 'animate-spin text-accent' : 'text-foreground-muted hover:text-foreground'}
          />
        </div>
      </div>
    </div>
  );
};
