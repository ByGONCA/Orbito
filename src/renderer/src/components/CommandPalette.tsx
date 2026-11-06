import React, { useState, useEffect } from 'react';
import {
  Search,
  FileCode,
  FolderOpen,
  Bot,
  Workflow,
  BrainCircuit,
  Network,
  Cpu,
  BarChart3,
  Blocks,
  CheckSquare,
  PanelRight,
  Settings,
  X
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspace.store';
import { Badge } from './ui/Badge';
import { IconButton } from './ui/IconButton';

export const CommandPalette: React.FC = () => {
  const {
    isCommandPaletteOpen,
    setCommandPaletteOpen,
    files,
    project,
    setActiveFile,
    setActiveSection,
    openGraphTab,
    toggleExplorer,
    toggleSettings,
    addLog
  } = useWorkspaceStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
      } else if (e.key === 'Escape' && isCommandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, setCommandPaletteOpen]);

  // Flatten files for search
  const flatFiles = React.useMemo(() => {
    const list: Array<{ name: string; path: string }> = [];
    const traverse = (items: any[]) => {
      for (const item of items) {
        if (!item.isDirectory) {
          list.push({ name: item.name, path: item.path });
        }
        if (item.children) traverse(item.children);
      }
    };
    traverse(files);
    return list;
  }, [files]);

  // Actions list
  const actions: Array<{ id: string; label: string; icon: React.ComponentType<{ className?: string }>; category: string; execute: () => void }> = [
    { id: 'tab-projects', label: 'Go to Projects Workspace', icon: FolderOpen, category: 'Navigation', execute: () => setActiveSection('projects') },
    { id: 'tab-graph', label: 'Go to AI Intelligence Graph', icon: Network, category: 'Navigation', execute: () => openGraphTab() },
    { id: 'tab-agents', label: 'Go to Multi-Agent Orchestration', icon: Bot, category: 'Navigation', execute: () => setActiveSection('agents') },
    { id: 'tab-tasks', label: 'Go to Task Orchestration & Approvals', icon: CheckSquare, category: 'Navigation', execute: () => setActiveSection('tasks') },
    { id: 'tab-flows', label: 'Go to Visual Flow Builder', icon: Workflow, category: 'Navigation', execute: () => setActiveSection('flows') },
    { id: 'tab-context', label: 'Go to Context & Knowledge Graph', icon: BrainCircuit, category: 'Navigation', execute: () => setActiveSection('context') },
    { id: 'tab-providers', label: 'Go to AI Providers & Local Models', icon: Cpu, category: 'Navigation', execute: () => setActiveSection('providers') },
    { id: 'tab-analytics', label: 'Go to Analytics & Telemetry', icon: BarChart3, category: 'Navigation', execute: () => setActiveSection('analytics') },
    { id: 'tab-extensions', label: 'Go to Extensions & Sandboxing', icon: Blocks, category: 'Navigation', execute: () => setActiveSection('extensions') },
    { id: 'toggle-explorer', label: 'Toggle Right Explorer Panel', icon: PanelRight, category: 'Layout', execute: () => toggleExplorer() },
    { id: 'open-settings', label: 'Open Settings & API Keys', icon: Settings, category: 'Preferences', execute: () => toggleSettings(true) },
  ];

  // Combined filtered items
  const q = query.toLowerCase().trim();
  const filteredActions = actions.filter((a) => a.label.toLowerCase().includes(q));
  const filteredFiles = flatFiles.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 10);

  const allItems = [
    ...filteredActions.map((a) => ({ type: 'action', ...a })),
    ...filteredFiles.map((f) => ({
      type: 'file',
      id: f.path,
      label: f.name,
      icon: FileCode,
      category: 'Files',
      execute: async () => {
        if (!project) return;
        try {
          const content = await window.api.readFileContent({ filePath: f.path, projectPath: project.path });
          setActiveFile(f.path, content);
        } catch (err: any) {
          addLog(`Failed to open: ${err.message}`, 'error');
        }
      }
    }))
  ];

  const handleSelect = (item: any) => {
    item.execute();
    setCommandPaletteOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, allItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + allItems.length) % Math.max(1, allItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems[selectedIndex]) {
        handleSelect(allItems[selectedIndex]);
      }
    }
  };

  if (!isCommandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/70 backdrop-blur-xs p-4">
      <div
        className="fixed inset-0"
        onClick={() => setCommandPaletteOpen(false)}
      />
      <div className="relative frosted-canvas rounded-xl border border-white/[0.10] max-w-lg w-full shadow-2xl overflow-hidden flex flex-col z-50 animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.07] bg-transparent">
          <Search className="w-4 h-4 text-[#A4A8AF] flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, navigate, or search files..."
            className="flex-1 bg-transparent text-[#ECEDEF] text-xs font-sans focus:outline-none placeholder:text-[#747982]"
            autoFocus
          />
          <IconButton
            icon={X}
            onClick={() => setCommandPaletteOpen(false)}
            tooltip="Close (Esc)"
            size="sm"
            className="text-[#747982] hover:text-[#ECEDEF]"
          />
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-1.5 font-sans text-xs space-y-0.5">
          {allItems.length === 0 ? (
            <div className="p-8 text-center text-[#747982] text-xs">
              No matching commands or files found.
            </div>
          ) : (
            allItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = selectedIndex === idx;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer rounded-lg transition-all ${
                    isSelected
                      ? 'bg-white/[0.08] text-[#ECEDEF] font-medium border border-white/[0.10] shadow-xs'
                      : 'text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.04] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-[#ECEDEF]' : 'text-[#747982]'}`} />
                    <span className="text-[11px] font-medium truncate">{item.label}</span>
                  </div>
                  <Badge variant="neutral" size="sm" className="uppercase font-mono text-[9px]">
                    {item.category}
                  </Badge>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts tip */}
        <div className="h-7 border-t border-white/[0.06] bg-transparent px-3 flex items-center justify-between text-[10px] font-mono text-[#747982] select-none">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <span className="text-[#A4A8AF] font-medium">AI Workspace</span>
        </div>
      </div>
    </div>
  );
};
