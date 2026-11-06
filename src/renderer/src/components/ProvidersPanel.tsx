import React, { useEffect, useState } from 'react';
import {
  Cpu,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  FolderSearch,
  Sparkles,
  ShieldCheck,
  Check,
  Copy
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspace.store';
import type { CLIProvider } from '../../../shared/cli';

interface ProviderCardProps {
  id: CLIProvider;
  name: string;
  tagline: string;
  badge: string;
  installCmd?: string;
  authCmd?: string;
  guideUrl?: string;
}

const PROVIDERS: ProviderCardProps[] = [
  {
    id: 'claude',
    name: 'Claude Code CLI',
    tagline: 'Interactive agentic coding by Anthropic (@anthropic-ai/claude-code)',
    badge: 'Anthropic',
    installCmd: 'npm install -g @anthropic-ai/claude-code',
    authCmd: 'claude',
    guideUrl: 'https://docs.anthropic.com/en/docs/agents-and-tools/claude-code'
  },
  {
    id: 'codex',
    name: 'OpenAI Codex CLI',
    tagline: 'Command-line execution and code automation via OpenAI tools',
    badge: 'OpenAI',
    installCmd: 'npm install -g @openai/codex',
    authCmd: 'codex login',
    guideUrl: 'https://learn.chatgpt.com/docs/cli/reference'
  },
  {
    id: 'gemini',
    name: 'Google Gemini CLI',
    tagline: 'Multimodal and code intelligence via Google GenAI developer CLI',
    badge: 'Google',
    installCmd: 'npm install -g @google/genai-cli',
    authCmd: 'gcloud auth application-default login',
    guideUrl: 'https://ai.google.dev/gemini-api/docs'
  },
  {
    id: 'ollama',
    name: 'Ollama (Local Models)',
    tagline: 'Local air-gapped LLM inference (Llama 3, Mistral, DeepSeek-R1)',
    badge: 'Air-Gap / Local',
    installCmd: 'https://ollama.com/download',
    authCmd: 'ollama run llama3:latest',
    guideUrl: 'https://ollama.com/download'
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
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const refreshStatuses = async () => {
    setIsLoading(true);
    addLog('Detecting CLI installations and authentication...', 'info');
    try {
      const statuses = await window.api.detectCLIs({ customPaths });
      setCLIStatuses(statuses);

      const auths: any = {};
      for (const p of ['claude', 'codex', 'gemini', 'ollama'] as CLIProvider[]) {
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
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Cpu className="w-4 h-4 text-foreground" />
            <span>AI Providers & CLI Integrations</span>
          </h2>
          <p className="text-xs text-foreground-secondary mt-0.5 font-mono">
            Decoupled adapters with streaming parsers for Claude, Codex, Gemini, and local Ollama air-gap models.
          </p>
        </div>

        <button
          onClick={refreshStatuses}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-surface-elevated hover:bg-surface-hover text-foreground text-xs font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Scanning...' : 'Refresh Status'}</span>
        </button>
      </div>

      {/* Provider Cards Grid (4 columns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {PROVIDERS.map((p) => {
          const status = cliStatuses ? cliStatuses[p.id] : null;
          const auth = cliAuthStatuses ? cliAuthStatuses[p.id] : null;
          const isSelected = activeProvider === p.id;

          return (
            <div
              key={p.id}
              className={`rounded border p-3.5 flex flex-col justify-between transition-all ${
                isSelected
                  ? 'border-foreground/80 bg-surface-elevated shadow-xs'
                  : 'border-border bg-surface hover:border-border/80'
              }`}
            >
              <div className="space-y-3">
                {/* Title & Badge */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-xs text-foreground">{p.name}</h3>
                    <p className="text-[10px] text-foreground-secondary leading-normal mt-0.5">
                      {p.tagline}
                    </p>
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded border border-border bg-background text-foreground-muted">
                    {p.badge}
                  </span>
                </div>

                {/* Installation Badge */}
                <div className="space-y-1 text-[11px] font-mono">
                  <div className="flex items-center justify-between py-1 border-b border-border/40">
                    <span className="text-foreground-muted">Installed:</span>
                    {status?.isInstalled ? (
                      <span className="flex items-center gap-1 text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>v{status.version}</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-foreground-muted italic">
                        <XCircle className="w-3 h-3 text-foreground-muted" />
                        <span>Not Found</span>
                      </span>
                    )}
                  </div>

                  {/* Auth Badge */}
                  <div className="flex flex-col py-1 border-b border-border/40 gap-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-muted">Auth Status:</span>
                      {auth?.state === 'authenticated' ? (
                        <span className="flex items-center gap-1 text-emerald-400 font-medium capitalize">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{auth.state}</span>
                        </span>
                      ) : auth?.state === 'authentication_required' ? (
                        <span className="flex items-center gap-1 text-amber-400 font-medium">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Needs Login</span>
                        </span>
                      ) : (
                        <span className="text-foreground-muted italic">{auth?.state || '--'}</span>
                      )}
                    </div>
                    {auth?.details && (
                      <span className="text-[9px] text-foreground-muted truncate" title={auth.details}>
                        {auth.details}
                      </span>
                    )}
                  </div>

                  {/* Executable Path */}
                  <div className="py-1">
                    <span className="text-foreground-muted text-[10px] block mb-0.5">Custom Path:</span>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        placeholder={status?.resolvedPath || 'Auto PATH'}
                        value={editingPath[p.id] ?? customPaths[p.id] ?? ''}
                        onChange={(e) => setEditingPath({ ...editingPath, [p.id]: e.target.value })}
                        className="flex-1 bg-background border border-border rounded px-1.5 py-0.5 text-[10px] text-foreground focus:outline-none"
                      />
                      <button
                        onClick={() => handleSaveCustomPath(p.id)}
                        className="px-2 py-0.5 bg-surface-elevated hover:bg-surface-hover text-foreground rounded border border-border text-[10px]"
                      >
                        Set
                      </button>
                    </div>
                  </div>

                  {/* Setup & Login Guidance */}
                  {!status?.isInstalled ? (
                    <div className="pt-2 border-t border-border/40 text-[10px] space-y-1">
                      <div className="flex items-center justify-between text-foreground-muted">
                        <span>Install:</span>
                        {p.guideUrl && (
                          <a
                            href={p.guideUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-0.5 text-foreground hover:underline text-[9.5px]"
                          >
                            <span>Guide</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                      {p.installCmd && (
                        <div className="flex items-center justify-between bg-background border border-border/70 rounded px-1.5 py-0.5 font-mono text-[9px]">
                          <span className="truncate text-foreground-secondary">{p.installCmd}</span>
                          <button
                            onClick={() => copyToClipboard(p.installCmd!, `inst-${p.id}`)}
                            className="text-foreground-muted hover:text-foreground ml-1"
                            title="Copy install command"
                          >
                            {copiedKey === `inst-${p.id}` ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : auth?.state === 'authentication_required' ? (
                    <div className="pt-2 border-t border-border/40 text-[10px] space-y-1">
                      <span className="text-foreground-muted block">Login / Auth Command:</span>
                      {p.authCmd && (
                        <div className="flex items-center justify-between bg-background border border-border/70 rounded px-1.5 py-0.5 font-mono text-[9px]">
                          <span className="truncate text-foreground-secondary">{p.authCmd}</span>
                          <button
                            onClick={() => copyToClipboard(p.authCmd!, `auth-${p.id}`)}
                            className="text-foreground-muted hover:text-foreground ml-1"
                            title="Copy auth command"
                          >
                            {copiedKey === `auth-${p.id}` ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-3">
                <button
                  onClick={() => {
                    setActiveProvider(p.id);
                    addLog(`Active AI Provider set to: ${p.name}`, 'info');
                  }}
                  className={`w-full py-1 rounded text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors border ${
                    isSelected
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-surface-elevated hover:bg-surface-hover text-foreground border-border'
                  }`}
                >
                  {isSelected ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Active Provider</span>
                    </>
                  ) : (
                    <span>Select for CLI</span>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
