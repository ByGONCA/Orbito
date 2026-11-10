import React, { useEffect } from 'react';
import {
  FolderTree,
  GitBranch,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles
} from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { FilesTab } from './FilesTab';
import { ChangesTab } from './ChangesTab';
import { ReviewTab } from './ReviewTab';

export const ProjectExplorer: React.FC = () => {
  const {
    explorerActiveTab,
    setExplorerActiveTab,
    gitStatus,
    codeReview,
    executions,
    project
  } = useWorkspaceStore();

  const changedFilesCount = gitStatus?.changedFiles.length || 0;
  const isReviewApproved = codeReview?.status === 'approved';

  const tabs: Array<{
    id: 'files' | 'changes' | 'review';
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number | string;
  }> = [
    {
      id: 'files',
      label: 'Files',
      icon: FolderTree
    },
    {
      id: 'changes',
      label: 'Changes',
      icon: GitBranch,
      badge: changedFilesCount > 0 ? changedFilesCount : undefined
    },
    {
      id: 'review',
      label: 'Review',
      icon: ShieldCheck,
      badge: isReviewApproved ? '✓' : codeReview?.status === 'changes_requested' ? '!' : undefined
    }
  ];

  return (
    <div className="h-full flex flex-col bg-transparent select-none overflow-hidden font-sans text-xs">
      {/* Compact Top Navigation Bar for Explorer */}
      <div className="h-9 px-2 border-b border-white/[0.05] bg-transparent flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const isActive = explorerActiveTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                onClick={() => setExplorerActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-white/[0.08] text-white font-medium'
                    : 'text-neutral-400 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`font-mono text-[10px] ml-0.5 ${
                      isActive ? 'text-neutral-200' : 'text-neutral-500'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Explorer Tab Content View (Preserving Context) */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {explorerActiveTab === 'files' && <FilesTab />}
        {explorerActiveTab === 'changes' && <ChangesTab />}
        {explorerActiveTab === 'review' && <ReviewTab />}
      </div>
    </div>
  );
};

export default ProjectExplorer;
