import React from 'react';
import {
  FolderGit2,
  RefreshCw,
  GitBranch,
  FolderMinus
} from 'lucide-react';
import { SettingSection } from '../common/SettingSection';
import { SettingRow } from '../common/SettingRow';
import { Button } from '../../ui/Button';
import { useWorkspaceStore } from '../../../stores/workspace.store';

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
          Git & Version Control
        </h2>
        <p className="text-xs text-[#A4A8AF] mt-1">
          Active repository details, branch tracking, and codebase indexing exclusions.
        </p>
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
    </div>
  );
};
