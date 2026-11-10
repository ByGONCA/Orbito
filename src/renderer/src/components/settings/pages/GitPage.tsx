import React, { useState, useEffect } from 'react';
import {
  FolderGit2,
  RefreshCw,
  GitBranch,
  FolderMinus,
  Globe2,
  Link2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { SettingSection } from '../common/SettingSection';
import { SettingRow } from '../common/SettingRow';
import { Button } from '../../ui/Button';
import { useWorkspaceStore } from '../../../stores/workspace.store';
import type { GitProviderStatus } from '../../../../../shared/types';

const DEFAULT_EXCLUSIONS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  'graphify-out',
  '.agents',
  '.ai-workspace-data'
];

export const GitPage: React.FC = () => {
  const {
    project,
    gitStatus,
    loadGitStatus,
    addLog
  } = useWorkspaceStore();

  const [providers, setProviders] = useState<GitProviderStatus[]>([]);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);

  const fetchProviders = async () => {
    setIsLoadingProviders(true);
    try {
      if (window.api?.getGitProvidersStatus) {
        const list = await window.api.getGitProvidersStatus();
        setProviders(list);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoadingProviders(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleDisconnect = async (providerId: string) => {
    try {
      await window.api.disconnectGitProvider({ provider: providerId as any });
      await fetchProviders();
      addLog(`Disconnected provider ${providerId}.`, 'info');
    } catch (err: any) {
      addLog(`Failed to disconnect provider: ${err.message}`, 'error');
    }
  };

  const handleRefresh = () => {
    if (project) {
      loadGitStatus(project.path);
      addLog('Refreshed Git status and file tree index.', 'info');
    }
  };

  const changedCount = gitStatus?.changedFiles?.length || 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      <div>
        <h2 className="text-xl font-semibold text-[#ECEDEF] tracking-tight">
          Git
        </h2>
      </div>

      {/* Section 1: Active Repository */}
      <SettingSection
        title="Active Repository Status"
        description="Current workspace project tracked by Orbito and local Git."
        action={
          project ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              title="Refresh Git status"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              <span>Refresh Status</span>
            </Button>
          ) : undefined
        }
      >
        {project ? (
          <div className="space-y-3 pt-1">
            <SettingRow
              title="Repository Name"
              description="Project identifier loaded from directory configuration."
            >
              <span className="text-xs font-mono text-[#ECEDEF] font-medium">
                {project.name}
              </span>
            </SettingRow>

            <SettingRow
              title="Local Path"
              description="Absolute filesystem path on the host machine."
            >
              <span className="text-xs font-mono text-[#A4A8AF] truncate max-w-sm">
                {project.path}
              </span>
            </SettingRow>

            <SettingRow
              title="Active Branch"
              description="Current HEAD branch checked out in the working directory."
            >
              <span className="text-xs font-mono text-[#ECEDEF]">
                {gitStatus?.branch || 'main'}
              </span>
            </SettingRow>

            <SettingRow
              title="Working Tree Changes"
              description="Modified, staged, and untracked files awaiting commit."
            >
              {/* Clean typographic count without boxed pill background */}
              <span className="text-xs font-mono text-[#E5A93C] font-semibold">
                {changedCount} {changedCount === 1 ? 'file changed' : 'files changed'}
              </span>
            </SettingRow>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-[#747982] font-mono">
            No active repository currently open in Orbito.
          </div>
        )}
      </SettingSection>

      {/* Section 2: Excluded Directories */}
      <SettingSection
        title="Indexing Exclusions"
        description="Directories ignored by intelligence graphs, symbol extraction, and file crawlers for peak performance."
      >
        <div className="pt-2">
          <div className="flex flex-wrap gap-2 text-xs font-mono">
            {DEFAULT_EXCLUSIONS.map((dir) => (
              <span
                key={dir}
                className="text-[#747982] hover:text-[#ECEDEF] transition-colors py-0.5"
              >
                {dir}/
              </span>
            ))}
          </div>
        </div>
      </SettingSection>

      {/* Section 3: Remote Git Providers */}
      <SettingSection
        title="Remote Git Providers & Integrations"
        description="Authenticated repository sources for cloning and multi-agent coordination."
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchProviders}
            disabled={isLoadingProviders}
            title="Refresh providers"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoadingProviders ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        }
      >
        <div className="space-y-2 pt-1">
          {providers.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between py-2 text-xs border-0"
            >
              <div>
                <div className="font-medium text-[#ECEDEF] flex items-center gap-2">
                  <span>{p.name}</span>
                  {p.username && (
                    <span className="text-[11px] font-mono text-[#747982]">
                      (@{p.username})
                    </span>
                  )}
                </div>
                {p.serverUrl && (
                  <div className="text-[11px] font-mono text-[#747982]">
                    {p.serverUrl}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                {p.isConfigured ? (
                  <>
                    <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Connected
                    </span>
                    <button
                      onClick={() => handleDisconnect(p.id)}
                      className="text-[11px] text-[#747982] hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <span className="text-[11px] text-[#E5A93C] font-medium">
                    Setup Required
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </SettingSection>
    </div>
  );
};
