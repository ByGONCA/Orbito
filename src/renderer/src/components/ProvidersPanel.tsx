import React, { useEffect, useState } from 'react';
import {
  Cpu,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Key,
  FolderSearch,
  Sparkles
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspace.store';
import type { CLIProvider } from '../../../shared/cli';

interface ProviderCardProps {
  id: CLIProvider;
  name: string;
  tagline: string;
  badgeColor: string;
}

const PROVIDERS: ProviderCardProps[] = [
  {
    id: 'claude',
    name: 'Claude Code CLI',
    tagline: 'Interactive agentic coding by Anthropic (@anthropic-ai/claude-code)',
    badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-500'
  },
  {
    id: 'codex',
    name: 'OpenAI Codex CLI',
    tagline: 'Command-line execution and code automation via OpenAI tools',
    badgeColor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
  },
  {
    id: 'gemini',
    name: 'Google Gemini CLI',
    tagline: 'Multimodal and code intelligence via Google GenAI developer CLI',
    badgeColor: 'border-blue-500/30 bg-blue-500/10 text-blue-500'
  }
];

export const ProvidersPanel: React.FC = () => {
  const {
    cliStatuses,
    cliAuthStatuses,
    setCLIStatuses,
    setCLIAuthStatuses,
    activeProvider,
    setActiveProvider,
    customPaths,
    setCustomPath,
    addLog
  } = useWorkspaceStore();

  const [isLoading, setIsLoading] = useState(false);
  const [editingPath, setEditingPath] = useState<Record<string, string>>({});

  const refreshStatuses = async () => {
    setIsLoading(true);
    addLog('Detecting CLI installations and authentication...', 'info');
    try {
      const statuses = await window.api.detectCLIs({ customPaths });
      setCLIStatuses(statuses);

      const auths: any = {};
      for (const p of ['claude', 'codex', 'gemini'] as CLIProvider[]) {
        if (statuses[p]?.isInstalled) {
          auths[p] = await window.api.checkCLIAuth({
            provider: p,
            customPath: customPaths[p]
          });
        }
      }
      setCLIAuthStatuses(auths);
      addLog('CLI status check completed.', 'info');
    } catch (err: any) {
      addLog(`CLI Detection failed: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshStatuses();
  }, []);

  const handleSaveCustomPath = (provider: CLIProvider) => {
    const val = editingPath[provider];
    if (val !== undefined) {
      setCustomPath(provider, val);
      addLog(`Saved custom path for ${provider}: ${val}`, 'info');
      refreshStatuses();
    }
  };

  return (
    <div className="flex flex-col h-full bg-background p-6 overflow-auto select-none space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Cpu className="w-5 h-5 text-primary" />
            <span>AI Providers & CLI Integrations</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Phase 2: Decoupled adapters for Claude Code, OpenAI Codex, and Google Gemini.
          </p>
        </div>

        <button
          onClick={refreshStatuses}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Scanning...' : 'Refresh Status'}</span>
        </button>
      </div>

      {/* Provider Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PROVIDERS.map((p) => {
          const status = cliStatuses ? cliStatuses[p.id] : null;
          const auth = cliAuthStatuses ? cliAuthStatuses[p.id] : null;
          const isSelected = activeProvider === p.id;

          return (
            <div
              key={p.id}
              className={`rounded-xl border p-4 flex flex-col justify-between transition-all ${
                isSelected
                  ? 'border-primary ring-1 ring-primary bg-card shadow-sm'
                  : 'border-border bg-card/60 hover:border-border/80'
              }`}
            >
              <div className="space-y-3">
                {/* Title & Badge */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">{p.name}</h3>
                    <p className="text-[11px] text-muted-foreground leading-normal mt-0.5">
                      {p.tagline}
                    </p>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${p.badgeColor}`}>
                    {p.id}
                  </span>
                </div>

                {/* Installation Badge */}
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Installation:</span>
                    {status?.isInstalled ? (
                      <span className="flex items-center gap-1 text-emerald-500 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>v{status.version}</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground italic">
                        <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>Not Detected</span>
                      </span>
                    )}
                  </div>

                  {/* Auth Badge */}
                  <div className="flex items-center justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Authentication:</span>
                    {auth?.isAuthenticated ? (
                      <span className="flex items-center gap-1 text-emerald-500 font-medium capitalize">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{auth.authType}</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-500 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Unauthenticated</span>
                      </span>
                    )}
                  </div>

                  {/* Resolved Binary Path */}
                  {status?.resolvedPath && (
                    <div className="py-1">
                      <span className="text-[10px] text-muted-foreground block">Binary Path:</span>
                      <span className="font-mono text-[10px] text-foreground/80 break-all select-text">
                        {status.resolvedPath}
                      </span>
                    </div>
                  )}
                </div>

                {/* Custom Path Override Input */}
                <div className="pt-1 space-y-1">
                  <label className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <FolderSearch className="w-3 h-3" />
                    <span>Custom Executable Path (Optional):</span>
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder={`e.g. C:\\bin\\${p.id}.cmd`}
                      value={
                        editingPath[p.id] !== undefined
                          ? editingPath[p.id]
                          : customPaths[p.id] || ''
                      }
                      onChange={(e) =>
                        setEditingPath({ ...editingPath, [p.id]: e.target.value })
                      }
                      className="flex-1 px-2 py-1 bg-background border border-border rounded text-[11px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      onClick={() => handleSaveCustomPath(p.id)}
                      className="px-2 py-1 bg-secondary hover:bg-secondary/80 rounded border border-border text-[11px] font-medium"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="pt-4 border-t border-border/60 mt-4 flex items-center justify-between">
                {status?.installGuideUrl && (
                  <a
                    href={status.installGuideUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-primary hover:underline flex items-center gap-1"
                  >
                    <span>Guide</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}

                <button
                  onClick={() => {
                    setActiveProvider(p.id);
                    addLog(`Active provider selected: ${p.name}`, 'info');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary hover:bg-secondary/80 text-foreground'
                  }`}
                >
                  {isSelected ? 'Active Provider' : 'Select'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
