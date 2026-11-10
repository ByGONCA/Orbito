import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FolderOpen,
  FolderPlus,
  Link2,
  ChevronLeft,
  Loader2,
  AlertCircle,
  Check,
  Search,
  ExternalLink,
  Lock,
  Globe2,
  RefreshCw,
  LogOut,
  Folder,
  Eye,
  EyeOff,
  Star,
  CornerDownLeft
} from 'lucide-react';
import type {
  ProjectTemplateId,
  ProjectTemplateInfo,
  GitProviderSourceId,
  GitProviderStatus,
  RemoteGitRepo
} from '../../../shared/types';
import { useWorkspaceStore } from '../stores/workspace.store';

export interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalView = 'sources' | 'template' | 'clone_url' | 'provider_setup' | 'provider_repos';

// ==========================================
// Brand Icons for Git Providers
// ==========================================

const GitHubIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={`${className} text-white`} viewBox="0 0 24 24" fill="currentColor">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
    />
  </svg>
);

const AzureDevOpsIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={`${className} text-[#0078D7]`} viewBox="0 0 24 24" fill="currentColor">
    <path d="M0 8.877L2.247 5.91l7.857-2.922L17.29 0l4.464 3.013v17.974l-4.464 3.013-8.082-2.92-7.07-3.014L0 15.123V8.877zm21.754-4.526l-3.34-2.275-5.908 2.213v15.422l5.908 2.213 3.34-2.275V4.351zM10.104 4.351L3.568 6.786l-1.32 1.74v6.948l1.32 1.74 6.536 2.435V4.351z" />
  </svg>
);

const BitbucketIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={`${className} text-[#0052CC]`} viewBox="0 0 24 24" fill="currentColor">
    <path d="M2.08 3.375A.875.875 0 0 1 2.95 2.5h18.1a.875.875 0 0 1 .87.973l-2.64 16.79a1.75 1.75 0 0 1-1.73 1.487H6.45a1.75 1.75 0 0 1-1.73-1.487L2.08 3.375zm12.38 12.875l.93-5.5H8.61l.93 5.5h4.92z" />
  </svg>
);

const CursorIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={`${className} text-gray-300`} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 1.5L2.5 7v10L12 22.5l9.5-5.5V7L12 1.5zm0 2.42l6.83 3.95-6.83 3.95-6.83-3.95L12 3.92zM4.5 8.78l6.5 3.76v7.54l-6.5-3.76V8.78zm15 7.54l-6.5 3.76v-7.54l6.5-3.76v7.54z" />
  </svg>
);

const ForgejoIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={`${className} text-[#e05d44]`} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" />
  </svg>
);

const GitCafeIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={`${className} text-[#7952B3]`} viewBox="0 0 24 24" fill="currentColor">
    <rect x="2" y="2" width="20" height="20" rx="4" fill="#7952B3" />
    <path d="M7 7h10v2.5H7V7zm0 4h10v2.5H7V11zm0 4h6.5v2.5H7V15z" fill="white" />
  </svg>
);

const GitLabIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={`${className} text-[#FC6D26]`} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.6 9.89l-.92-2.84a.97.97 0 0 0-.36-.46.99.99 0 0 0-.58-.19.98.98 0 0 0-.59.2.97.97 0 0 0-.35.45l-1.92 5.92H4.72L2.8 7.05a.97.97 0 0 0-.35-.45.98.98 0 0 0-.59-.2.99.99 0 0 0-.58.19.97.97 0 0 0-.36.46L0 9.89a1.05 1.05 0 0 0 .38 1.18l11.17 8.12a.85.85 0 0 0 .9 0l11.17-8.12a1.05 1.05 0 0 0 .38-1.18z" />
  </svg>
);

// Templates list for New project
const TEMPLATES: ProjectTemplateInfo[] = [
  {
    id: 'empty',
    name: 'Empty Project',
    description: 'Clean slate with basic .gitignore and README.md',
    icon: 'folder'
  },
  {
    id: 'node',
    name: 'Node.js',
    description: 'ESM package.json, src/index.js & start script',
    icon: 'node'
  },
  {
    id: 'react',
    name: 'React + Vite',
    description: 'React 18, TypeScript, Vite & modern build setup',
    icon: 'react'
  },
  {
    id: 'python',
    name: 'Python',
    description: 'Python 3 script with main.py & requirements.txt',
    icon: 'python'
  }
];

interface SourceItemDef {
  id: string;
  providerId?: GitProviderSourceId;
  title: string;
  description: string;
  icon: React.ReactNode;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({ isOpen, onClose }) => {
  const {
    setProject,
    setFiles,
    loadGitStatus,
    setRecentProjects,
    createProject,
    cloneProject,
    cloneRemoteRepository,
    setActiveSection,
    addLog
  } = useWorkspaceStore();

  const [view, setView] = useState<ModalView>('sources');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Providers Status
  const [providersStatus, setProvidersStatus] = useState<Record<string, GitProviderStatus>>({});
  const [activeProvider, setActiveProvider] = useState<GitProviderSourceId | null>(null);

  // Setup Form State
  const [setupToken, setSetupToken] = useState('');
  const [setupServerUrl, setSetupServerUrl] = useState('');
  const [setupUsername, setSetupUsername] = useState('');
  const [setupOrg, setSetupOrg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSavingProvider, setIsSavingProvider] = useState(false);

  // Repositories Browser State
  const [remoteRepos, setRemoteRepos] = useState<RemoteGitRepo[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');
  const [selectedRepoToClone, setSelectedRepoToClone] = useState<RemoteGitRepo | null>(null);
  const [isCloningRemote, setIsCloningRemote] = useState(false);

  // Template Form State
  const [projectName, setProjectName] = useState('');
  const [parentDir, setParentDir] = useState(() => localStorage.getItem('orbito:lastParentDir') || '');
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplateId>('empty');
  const [initGit, setInitGit] = useState(true);
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  // Clone URL State
  const [cloneUrl, setCloneUrl] = useState('');
  const [customCloneName, setCustomCloneName] = useState('');
  const [isCloningUrl, setIsCloningUrl] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load Git providers status
  const refreshProviders = async () => {
    try {
      if (window.api?.getGitProvidersStatus) {
        const statuses = await window.api.getGitProvidersStatus();
        const map: Record<string, GitProviderStatus> = {};
        for (const s of statuses) {
          map[s.id] = s;
        }
        setProvidersStatus(map);
      }
    } catch {
      // Ignore initial lookup
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshProviders();
      setSearchQuery('');
      setSelectedIndex(0);
      setView('sources');
      setError(null);
      setSelectedRepoToClone(null);
    }
  }, [isOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen && view === 'sources') {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen, view]);

  // Derived Sources List matching the reference UI
  const sourcesList: SourceItemDef[] = useMemo(() => {
    return [
      {
        id: 'new_project',
        title: 'New project',
        description: 'Start a new Git repository from a name',
        icon: <FolderPlus className="w-4 h-4 text-emerald-400" />
      },
      {
        id: 'local_folder',
        title: 'Local folder',
        description: 'Browse a folder on disk',
        icon: <Folder className="w-4 h-4 text-amber-400" />
      },
      {
        id: 'git_url',
        title: 'Git URL',
        description: 'Clone from a remote URL',
        icon: <Link2 className="w-4 h-4 text-cyan-400" />
      },
      {
        id: 'github',
        providerId: 'github',
        title: 'GitHub repository',
        description: 'Clone GitHub owner/repo',
        icon: <GitHubIcon className="w-4 h-4" />
      },
      {
        id: 'azure-devops',
        providerId: 'azure-devops',
        title: 'Azure DevOps repository',
        description: 'Clone Azure DevOps project/repository',
        icon: <AzureDevOpsIcon className="w-4 h-4" />
      },
      {
        id: 'bitbucket',
        providerId: 'bitbucket',
        title: 'Bitbucket repository',
        description: 'Clone Bitbucket workspace/repository',
        icon: <BitbucketIcon className="w-4 h-4" />
      },
      {
        id: 'cursor',
        providerId: 'cursor',
        title: 'Cursor Origin repository',
        description: 'Clone Cursor Origin owner/repo',
        icon: <CursorIcon className="w-4 h-4" />
      },
      {
        id: 'forgejo',
        providerId: 'forgejo',
        title: 'Forgejo / Gitea repository',
        description: 'Clone Forgejo / Gitea owner/repo',
        icon: <ForgejoIcon className="w-4 h-4" />
      },
      {
        id: 'gitcafe',
        providerId: 'gitcafe',
        title: 'GitCafe repository',
        description: 'Clone GitCafe owner/repo',
        icon: <GitCafeIcon className="w-4 h-4" />
      },
      {
        id: 'gitlab',
        providerId: 'gitlab',
        title: 'GitLab repository',
        description: 'Clone GitLab group/project',
        icon: <GitLabIcon className="w-4 h-4" />
      }
    ];
  }, []);

  // Filtered sources by search query
  const filteredSources = useMemo(() => {
    if (!searchQuery.trim()) return sourcesList;
    const q = searchQuery.toLowerCase().trim();
    return sourcesList.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
    );
  }, [sourcesList, searchQuery]);

  // Keep selected index within bounds
  useEffect(() => {
    if (selectedIndex >= filteredSources.length) {
      setSelectedIndex(Math.max(0, filteredSources.length - 1));
    }
  }, [filteredSources, selectedIndex]);

  // Fetch repositories from active provider
  const loadRepositories = async (provider: GitProviderSourceId) => {
    setIsLoadingRepos(true);
    setError(null);
    try {
      const res = await window.api.fetchRemoteRepositories({ provider });
      if (!res.success) {
        setError(res.error || 'Failed to fetch repositories.');
        setRemoteRepos([]);
      } else {
        setRemoteRepos(res.repos);
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching repositories.');
      setRemoteRepos([]);
    } finally {
      setIsLoadingRepos(false);
    }
  };

  // Open provider flow
  const handleSelectProvider = async (providerId: GitProviderSourceId) => {
    setActiveProvider(providerId);
    setError(null);
    const status = providersStatus[providerId];
    if (status?.isConfigured) {
      setView('provider_repos');
      loadRepositories(providerId);
    } else {
      // Defaults for setup
      setSetupToken('');
      setSetupServerUrl(status?.serverUrl || '');
      setSetupUsername(status?.username || '');
      setSetupOrg('');
      setView('provider_setup');
    }
  };

  // 1. Direct Browse Folder Action
  const handleBrowseFolder = async () => {
    try {
      const selected = await window.api.openDirectoryDialog();
      if (selected) {
        setProject(selected);
        const files = await window.api.listFiles({ projectPath: selected.path });
        setFiles(files);
        const recents = await window.api.getRecentProjects();
        setRecentProjects(recents);
        loadGitStatus(selected.path);
        setActiveSection('terminal');
        addLog(`Opened workspace: ${selected.name}`, 'info');
        onClose();
      }
    } catch (err: any) {
      setError(`Failed to open project: ${err.message}`);
    }
  };

  // Browse Directory for Parent Folder
  const handleSelectParentDir = async () => {
    try {
      const selected = await window.api.selectDirectory('Select Destination Folder');
      if (selected) {
        setParentDir(selected);
        localStorage.setItem('orbito:lastParentDir', selected);
        setError(null);
      }
    } catch (err: any) {
      setError(`Failed to select directory: ${err.message}`);
    }
  };

  // Action dispatcher for selected source item
  const handleExecuteSource = (item: SourceItemDef) => {
    setError(null);
    if (item.id === 'new_project') {
      setView('template');
    } else if (item.id === 'local_folder') {
      handleBrowseFolder();
    } else if (item.id === 'git_url') {
      setView('clone_url');
    } else if (item.providerId) {
      handleSelectProvider(item.providerId);
    }
  };

  // Keyboard navigation listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (view !== 'sources') {
          setView('sources');
          setError(null);
          setSelectedRepoToClone(null);
        } else {
          onClose();
        }
      } else if (view === 'sources') {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => (filteredSources.length > 0 ? (prev + 1) % filteredSources.length : 0));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => (filteredSources.length > 0 ? (prev - 1 + filteredSources.length) % filteredSources.length : 0));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (filteredSources[selectedIndex]) {
            handleExecuteSource(filteredSources[selectedIndex]);
          }
        }
      } else if (e.key === 'Backspace' && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault();
        setView('sources');
        setError(null);
        setSelectedRepoToClone(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, view, selectedIndex, filteredSources]);

  // Connect Provider Form Submission
  const handleConnectProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProvider) return;
    if (!setupToken.trim()) {
      setError('Please provide an access token or API key.');
      return;
    }

    setIsSavingProvider(true);
    setError(null);

    try {
      const res = await window.api.saveGitProviderConfig({
        provider: activeProvider,
        token: setupToken.trim(),
        serverUrl: setupServerUrl.trim() || undefined,
        username: setupUsername.trim() || undefined,
        organization: setupOrg.trim() || undefined
      });

      if (!res.success) {
        setError(res.error || 'Failed to authenticate with provider.');
      } else {
        await refreshProviders();
        setView('provider_repos');
        loadRepositories(activeProvider);
        addLog(`Connected ${activeProvider} successfully (${res.user || 'authenticated'}).`, 'info');
      }
    } catch (err: any) {
      setError(err.message || 'Connection failed.');
    } finally {
      setIsSavingProvider(false);
    }
  };

  // Disconnect Provider Action
  const handleDisconnect = async () => {
    if (!activeProvider) return;
    try {
      await window.api.disconnectGitProvider({ provider: activeProvider });
      await refreshProviders();
      setView('sources');
      addLog(`Disconnected ${activeProvider}.`, 'info');
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect.');
    }
  };

  // Clone Remote Repository Action
  const handleCloneRemote = async (repo: RemoteGitRepo) => {
    if (!parentDir) {
      setError('Please choose a destination directory.');
      return;
    }

    setIsCloningRemote(true);
    setError(null);

    try {
      await cloneRemoteRepository({
        provider: repo.provider,
        cloneUrl: repo.cloneUrl,
        parentDirectory: parentDir,
        customName: repo.name
      });
      setActiveSection('terminal');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to clone repository.');
    } finally {
      setIsCloningRemote(false);
    }
  };

  // Create Project Submit
  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = projectName.trim();
    if (!trimmed) {
      setError('Please enter a valid project name.');
      return;
    }
    if (/[<>:"/\\|?*]/.test(trimmed)) {
      setError('Project name cannot contain invalid characters (<>:"/\\|?*).');
      return;
    }
    if (!parentDir) {
      setError('Please choose a destination directory.');
      return;
    }

    setIsCreatingProject(true);
    setError(null);

    try {
      await createProject({
        name: trimmed,
        parentDirectory: parentDir,
        template: selectedTemplate,
        initGit
      });
      setActiveSection('terminal');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create project.');
    } finally {
      setIsCreatingProject(false);
    }
  };

  // Clone URL Submit
  const handleCloneUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawUrl = cloneUrl.trim();
    if (!rawUrl) {
      setError('Please provide a valid Git repository URL.');
      return;
    }
    if (!parentDir) {
      setError('Please choose a destination directory.');
      return;
    }

    setIsCloningUrl(true);
    setError(null);

    try {
      await cloneProject({
        url: rawUrl,
        parentDirectory: parentDir,
        customName: customCloneName.trim() || undefined
      });
      setActiveSection('terminal');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to clone repository.');
    } finally {
      setIsCloningUrl(false);
    }
  };

  // Filtered remote repositories
  const filteredRemoteRepos = useMemo(() => {
    if (!repoSearch.trim()) return remoteRepos;
    const q = repoSearch.toLowerCase().trim();
    return remoteRepos.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.fullName.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q))
    );
  }, [remoteRepos, repoSearch]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in font-sans">
      <div className="w-full max-w-[620px] bg-[#0A0A0C] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-xs text-[#ECEDEF]">
        {/* Top Header / Search Bar */}
        <div className="px-4 py-3 flex items-center gap-3 border-b border-white/[0.06] bg-[#0D0E11]/80">
          <button
            type="button"
            onClick={() => {
              if (view !== 'sources') {
                setView('sources');
                setError(null);
                setSelectedRepoToClone(null);
              } else {
                onClose();
              }
            }}
            className="p-1 rounded-md text-[#747982] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            title={view === 'sources' ? 'Close' : 'Back to sources'}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {view === 'sources' ? (
            <div className="flex-1 flex items-center gap-2">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Search..."
                className="w-full bg-transparent text-sm text-[#ECEDEF] placeholder-[#747982] focus:outline-none"
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">
                {view === 'template' && 'Start a new Git repository'}
                {view === 'clone_url' && 'Clone from Git URL'}
                {view === 'provider_setup' && `Connect ${activeProvider ? sourcesList.find(s => s.id === activeProvider)?.title : 'Provider'}`}
                {view === 'provider_repos' && `${activeProvider ? sourcesList.find(s => s.id === activeProvider)?.title : 'Repositories'}`}
              </span>
              {view === 'provider_repos' && activeProvider && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadRepositories(activeProvider)}
                    className="p-1.5 rounded-lg text-[#747982] hover:text-white hover:bg-white/[0.06] transition-colors"
                    title="Refresh repositories"
                    disabled={isLoadingRepos}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRepos ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="p-1.5 rounded-lg text-[#747982] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Disconnect account"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 1: SOURCES COMMAND LIST (Exact Reference UI)        */}
        {/* ======================================================== */}
        {view === 'sources' && (
          <div className="p-3">
            <div className="px-3 pt-1 pb-2">
              <span className="text-[11px] font-medium text-[#747982]">Sources</span>
            </div>

            <div className="max-h-[380px] overflow-y-auto space-y-0.5 custom-scrollbar">
              {filteredSources.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                const isProvider = Boolean(item.providerId);
                const isConfigured = item.providerId ? providersStatus[item.providerId]?.isConfigured : false;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleExecuteSource(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    role="button"
                    tabIndex={0}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                      isSelected ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                        {item.icon}
                      </div>
                      <div>
                        <div className="text-xs font-medium text-white">{item.title}</div>
                        <div className="text-[11px] text-[#747982]">{item.description}</div>
                      </div>
                    </div>

                    <div>
                      {isProvider && !isConfigured && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium text-[#E5A93C] bg-[#E5A93C]/10 border border-[#E5A93C]/30">
                          Setup Required
                        </span>
                      )}
                      {isProvider && isConfigured && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                          Connected
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredSources.length === 0 && (
                <div className="py-8 text-center text-[#747982]">
                  No sources match your search.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 2: PROVIDER SETUP (Personal Access Token / Config)   */}
        {/* ======================================================== */}
        {view === 'provider_setup' && activeProvider && (
          <form onSubmit={handleConnectProvider} className="p-5 space-y-4">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
                {sourcesList.find(s => s.id === activeProvider)?.icon}
              </div>
              <div>
                <div className="text-xs font-semibold text-white">
                  Connect {sourcesList.find(s => s.id === activeProvider)?.title}
                </div>
                <div className="text-[11px] text-[#747982]">
                  Authenticate with a personal access token to clone and search your repositories.
                </div>
              </div>
            </div>

            {/* Server URL for self-hosted providers */}
            {(activeProvider === 'gitlab' || activeProvider === 'forgejo' || activeProvider === 'gitcafe' || activeProvider === 'cursor') && (
              <div>
                <label className="block text-[11px] font-medium text-[#A4A8AF] mb-1.5">
                  Server / Instance URL
                </label>
                <input
                  type="text"
                  value={setupServerUrl}
                  onChange={(e) => setSetupServerUrl(e.target.value)}
                  placeholder={
                    activeProvider === 'gitlab'
                      ? 'https://gitlab.com'
                      : activeProvider === 'forgejo'
                      ? 'https://codeberg.org'
                      : 'https://...'
                  }
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-white/20"
                />
              </div>
            )}

            {/* Azure DevOps Organization */}
            {activeProvider === 'azure-devops' && (
              <div>
                <label className="block text-[11px] font-medium text-[#A4A8AF] mb-1.5">
                  Azure DevOps Organization Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={setupOrg}
                  onChange={(e) => setSetupOrg(e.target.value)}
                  placeholder="e.g. my-organization (from dev.azure.com/my-organization)"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-white/20"
                />
              </div>
            )}

            {/* Bitbucket Username / Workspace */}
            {activeProvider === 'bitbucket' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#A4A8AF] mb-1.5">
                    Bitbucket Username
                  </label>
                  <input
                    type="text"
                    value={setupUsername}
                    onChange={(e) => setSetupUsername(e.target.value)}
                    placeholder="e.g. jdoe"
                    className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-white/20"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#A4A8AF] mb-1.5">
                    Workspace Slug (Optional)
                  </label>
                  <input
                    type="text"
                    value={setupOrg}
                    onChange={(e) => setSetupOrg(e.target.value)}
                    placeholder="e.g. my-team"
                    className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-white/20"
                  />
                </div>
              </div>
            )}

            {/* Token / PAT */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-medium text-[#A4A8AF]">
                  Personal Access Token (PAT) <span className="text-rose-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[10px] text-[#747982] hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={setupToken}
                onChange={(e) => setSetupToken(e.target.value)}
                placeholder="Paste your token here..."
                required
                className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-white/20 font-mono"
              />
              <p className="mt-1.5 text-[11px] text-[#747982] leading-normal">
                {activeProvider === 'github' && 'Requires "repo" scope for private repositories or public repo access.'}
                {activeProvider === 'gitlab' && 'Requires "read_api" and "read_repository" scopes.'}
                {activeProvider === 'azure-devops' && 'Requires "Code (Read)" personal access token permissions.'}
                {activeProvider === 'bitbucket' && 'Requires an App Password with "Repositories: Read" permission.'}
                {activeProvider === 'forgejo' && 'Requires repository read permissions created in user settings.'}
                {(activeProvider === 'cursor' || activeProvider === 'gitcafe') && 'Paste your cloud API access token.'}
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setView('sources')}
                className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs text-[#ECEDEF] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingProvider}
                className="px-4 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-white/90 disabled:opacity-50 transition-colors flex items-center gap-2 cursor-pointer"
              >
                {isSavingProvider && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Connect & Fetch Repositories
              </button>
            </div>
          </form>
        )}

        {/* ======================================================== */}
        {/* VIEW 3: REMOTE REPOSITORIES BROWSER                     */}
        {/* ======================================================== */}
        {view === 'provider_repos' && activeProvider && (
          <div className="p-4 flex flex-col space-y-3">
            {/* Search within repositories */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#747982] absolute left-3 top-2.5" />
              <input
                type="text"
                value={repoSearch}
                onChange={(e) => setRepoSearch(e.target.value)}
                placeholder="Filter repositories by name or description..."
                className="w-full pl-8.5 pr-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-white/20"
              />
            </div>

            {/* Destination folder selector */}
            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2 truncate pr-2">
                <span className="text-[#747982]">Destination:</span>
                <span className="text-white font-mono truncate">
                  {parentDir || 'Select local destination folder'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleSelectParentDir}
                className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white transition-colors cursor-pointer flex-shrink-0"
              >
                Browse
              </button>
            </div>

            {/* Repositories List */}
            <div className="max-h-[300px] overflow-y-auto space-y-1 custom-scrollbar pr-1">
              {isLoadingRepos ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-[#747982]">
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                  <span>Fetching repositories...</span>
                </div>
              ) : filteredRemoteRepos.length === 0 ? (
                <div className="py-10 text-center text-[#747982]">
                  {remoteRepos.length === 0 ? 'No repositories found for this account.' : 'No repositories match filter.'}
                </div>
              ) : (
                filteredRemoteRepos.map((repo) => {
                  const isCloningThis = isCloningRemote && selectedRepoToClone?.id === repo.id;

                  return (
                    <div
                      key={repo.id}
                      className="p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] hover:border-white/[0.08] transition-all flex items-start justify-between gap-3 group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {repo.isPrivate ? (
                            <span title="Private repository" className="flex items-center">
                              <Lock className="w-3 h-3 text-[#A4A8AF]" />
                            </span>
                          ) : (
                            <span title="Public repository" className="flex items-center">
                              <Globe2 className="w-3 h-3 text-[#747982]" />
                            </span>
                          )}
                          <span className="font-semibold text-xs text-white truncate">
                            {repo.fullName}
                          </span>
                        </div>

                        {repo.description && (
                          <p className="text-[11px] text-[#747982] line-clamp-1 mt-0.5">
                            {repo.description}
                          </p>
                        )}

                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[#A4A8AF]">
                          {repo.language && (
                            <span className="px-1.5 py-0.2 rounded bg-white/[0.05] text-[#ECEDEF]">
                              {repo.language}
                            </span>
                          )}
                          {repo.stars !== undefined && repo.stars > 0 && (
                            <span className="flex items-center gap-1">
                              <Star className="w-2.5 h-2.5 text-amber-400" />
                              {repo.stars}
                            </span>
                          )}
                          <span>branch: {repo.defaultBranch}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isCloningRemote}
                        onClick={() => {
                          setSelectedRepoToClone(repo);
                          handleCloneRemote(repo);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white text-white hover:text-black font-medium text-xs transition-colors cursor-pointer flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
                      >
                        {isCloningThis ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Cloning...</span>
                          </>
                        ) : (
                          <span>Clone</span>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 4: START A NEW GIT REPOSITORY (TEMPLATE FORM)       */}
        {/* ======================================================== */}
        {view === 'template' && (
          <form onSubmit={handleCreateProjectSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-[11px] font-medium text-[#A4A8AF] mb-1.5">
                Project Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="my-awesome-project"
                required
                autoFocus
                className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-white/20 font-mono"
              />
            </div>

            {/* Destination folder */}
            <div>
              <label className="block text-[11px] font-medium text-[#A4A8AF] mb-1.5">
                Destination Directory <span className="text-rose-400">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={parentDir}
                  readOnly
                  placeholder="Select local folder..."
                  className="flex-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white focus:outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={handleSelectParentDir}
                  className="px-3 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Browse
                </button>
              </div>
            </div>

            {/* Templates Selector */}
            <div>
              <label className="block text-[11px] font-medium text-[#A4A8AF] mb-1.5">
                Starter Template
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATES.map((tmpl) => {
                  const isSelected = selectedTemplate === tmpl.id;
                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => setSelectedTemplate(tmpl.id)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-white/[0.08] border-white/30 text-white'
                          : 'bg-white/[0.02] border-white/[0.06] text-[#A4A8AF] hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="font-semibold text-xs text-white flex items-center justify-between">
                        <span>{tmpl.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <p className="text-[10px] text-[#747982] mt-0.5 line-clamp-1">{tmpl.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Git Init Toggle */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="initGitCheckbox"
                checked={initGit}
                onChange={(e) => setInitGit(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-0 cursor-pointer"
              />
              <label htmlFor="initGitCheckbox" className="text-xs text-[#ECEDEF] cursor-pointer">
                Initialize Git repository (create default <code className="text-[#A4A8AF]">main</code> branch)
              </label>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setView('sources')}
                className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs text-[#ECEDEF] transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isCreatingProject}
                className="px-4 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-white/90 disabled:opacity-50 transition-colors flex items-center gap-2 cursor-pointer"
              >
                {isCreatingProject && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Create Project
              </button>
            </div>
          </form>
        )}

        {/* ======================================================== */}
        {/* VIEW 5: CLONE FROM GIT URL                               */}
        {/* ======================================================== */}
        {view === 'clone_url' && (
          <form onSubmit={handleCloneUrlSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-[11px] font-medium text-[#A4A8AF] mb-1.5">
                Git Repository URL <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={cloneUrl}
                onChange={(e) => setCloneUrl(e.target.value)}
                placeholder="https://github.com/owner/repository.git"
                required
                autoFocus
                className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-white/20 font-mono"
              />
            </div>

            {/* Destination folder */}
            <div>
              <label className="block text-[11px] font-medium text-[#A4A8AF] mb-1.5">
                Destination Directory <span className="text-rose-400">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={parentDir}
                  readOnly
                  placeholder="Select local destination..."
                  className="flex-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white focus:outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={handleSelectParentDir}
                  className="px-3 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Browse
                </button>
              </div>
            </div>

            {/* Custom name */}
            <div>
              <label className="block text-[11px] font-medium text-[#A4A8AF] mb-1.5">
                Local Folder Name (Optional)
              </label>
              <input
                type="text"
                value={customCloneName}
                onChange={(e) => setCustomCloneName(e.target.value)}
                placeholder="Leave blank to use repository name"
                className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-white/20 font-mono"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setView('sources')}
                className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs text-[#ECEDEF] transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isCloningUrl}
                className="px-4 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-white/90 disabled:opacity-50 transition-colors flex items-center gap-2 cursor-pointer"
              >
                {isCloningUrl && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Clone Repository
              </button>
            </div>
          </form>
        )}

        {/* Footer with keyboard shortcuts (Matching screenshot) */}
        <div className="px-4 py-2.5 border-t border-white/[0.06] bg-[#0A0A0C] flex items-center gap-4 text-[11px] text-[#747982]">
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-[10px] font-mono text-[#A4A8AF]">↑</span>
            <span className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-[10px] font-mono text-[#A4A8AF]">↓</span>
            <span>Navigate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-[10px] font-mono text-[#A4A8AF]">Enter</span>
            <span>Select</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-[10px] font-mono text-[#A4A8AF]">Backspace</span>
            <span>Back</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-[10px] font-mono text-[#A4A8AF]">Esc</span>
            <span>Close</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewProjectModal;
