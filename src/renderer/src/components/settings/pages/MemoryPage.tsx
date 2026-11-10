import React, { useState, useEffect, useMemo } from 'react';
import {
  Database,
  Search,
  Trash2,
  RefreshCw,
  Filter
} from 'lucide-react';
import { SettingSection } from '../common/SettingSection';
import { SettingRow } from '../common/SettingRow';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { useWorkspaceStore } from '../../../stores/workspace.store';
import type { MemoryRecord } from '../../../../../shared/types';

const TIERS = ['all', 'global', 'workspace', 'project', 'task', 'session'] as const;
type TierFilter = typeof TIERS[number];

export const MemoryPage: React.FC = () => {
  const addLog = useWorkspaceStore((state) => state.addLog);
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState<TierFilter>('all');

  const loadMemories = async () => {
    setIsLoading(true);
    try {
      const list = await window.api.listMemories();
      setMemories(list || []);
    } catch (err: any) {
      addLog(`Failed to load memories: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMemories();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await window.api.deleteMemory({ id });
      setMemories((prev) => prev.filter((m) => m.id !== id));
      addLog(`Deleted memory record ${id}`, 'info');
    } catch (err: any) {
      addLog(`Failed to delete memory: ${err.message}`, 'error');
    }
  };

  const filteredMemories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return memories.filter((m) => {
      if (selectedTier !== 'all' && m.tier !== selectedTier) return false;
      if (!q) return true;
      return (
        m.entityKey.toLowerCase().includes(q) ||
        m.content.toLowerCase().includes(q) ||
        m.tier.toLowerCase().includes(q)
      );
    });
  }, [memories, searchQuery, selectedTier]);

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#ECEDEF] tracking-tight">
            Agent Persistent Memory
          </h2>
          <p className="text-xs text-[#A4A8AF] mt-1">
            Cross-session memory records stored in local SQLite across hierarchy tiers.
          </p>
        </div>
        <div className="text-xs font-mono text-[#747982]">
          {memories.length} records stored
        </div>
      </div>

      <SettingSection
        title="Stored Memory Records"
        description="Agents record facts, user preferences, and repository insights to maintain long-term context."
        action={
          <Button
            variant="ghost"
            size="sm"
            disabled={isLoading}
            onClick={loadMemories}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        }
      >
        {/* Tier Filters & Search Bar */}
        <div className="space-y-3 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {TIERS.map((tier) => (
              <button
                key={tier}
                onClick={() => setSelectedTier(tier)}
                className={`px-2.5 py-1 rounded text-xs font-mono capitalize transition-colors cursor-pointer border ${
                  selectedTier === tier
                    ? 'bg-white/[0.12] text-white border-white/20'
                    : 'bg-white/[0.03] text-[#747982] hover:text-[#ECEDEF] border-transparent'
                }`}
              >
                {tier}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#747982] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by entity key or memory content..."
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-md pl-9 pr-3 py-1.5 text-xs text-[#ECEDEF] placeholder:text-[#747982] focus:outline-none focus:border-white/30 font-mono"
            />
          </div>

          {/* List of records */}
          <div className="divide-y divide-white/[0.04] pt-2">
            {filteredMemories.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#747982] font-mono">
                {memories.length === 0
                  ? 'No persistent memories stored yet.'
                  : 'No memory matches the current filter.'}
              </div>
            ) : (
              filteredMemories.map((m) => (
                <div
                  key={m.id}
                  className="py-3 px-1 flex items-start justify-between gap-4 group hover:bg-white/[0.01] rounded-md transition-colors"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase text-emerald-400">
                        [{m.tier}]
                      </span>
                      <span className="text-xs font-semibold text-[#ECEDEF] font-mono">
                        {m.entityKey}
                      </span>
                    </div>
                    <p className="text-xs text-[#A4A8AF] leading-relaxed font-sans">
                      {m.content}
                    </p>
                  </div>

                  <IconButton
                    icon={Trash2}
                    onClick={() => handleDelete(m.id)}
                    tooltip="Delete memory record"
                    size="sm"
                    className="text-[#747982] hover:text-rose-400 opacity-60 group-hover:opacity-100 transition-opacity"
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </SettingSection>
    </div>
  );
};
