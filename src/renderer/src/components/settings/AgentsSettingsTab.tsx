import React, { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Check,
  Download,
  Search,
  Shield
} from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace.store';
import type { CLIProvider } from '../../../../shared/cli';
import { OfficialLogoRenderer } from '../OfficialLogos';
import { CustomSelect, type SelectOption } from '../ui/Select';
import { AgentInstallModal, type AgentItemToInstall } from './AgentInstallModal';

const PERMISSION_OPTIONS: SelectOption<'full_access' | 'supervised' | 'read_only'>[] = [
  { value: 'full_access', label: 'Full access' },
  { value: 'supervised', label: 'Supervised' },
  { value: 'read_only', label: 'Read-only' }
];

interface AgentItem {
  id: string;
  name: string;
  provider: CLIProvider;
  command: string;
  hasOwnSettings?: boolean;
  hasChatMode?: boolean;
  defaultInstalled?: boolean;
  docUrl?: string;
  installCommand?: string;
}

const ALL_AGENTS: AgentItem[] = [
  {
    id: 'codex',
    name: 'Codex',
    provider: 'codex',
    command: 'codex --dangerously-bypass-approvals-and-sandbox',
    hasChatMode: true,
    defaultInstalled: true,
    installCommand: 'npm install -g @openai/codex'
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    provider: 'copilot',
    command: 'copilot --yolo',
    hasChatMode: false,
    defaultInstalled: true,
    installCommand: 'gh extension install github/gh-copilot'
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    provider: 'opencode',
    command: 'opencode',
    hasOwnSettings: true,
    hasChatMode: true,
    defaultInstalled: true,
    installCommand: 'npm install -g opencode-ai'
  },
  {
    id: 'gemini',
    name: 'Gemini',
    provider: 'gemini',
    command: 'gemini --yolo',
    hasChatMode: false,
    defaultInstalled: true,
    installCommand: 'npm install -g @google/gemini-cli'
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    provider: 'antigravity',
    command: 'agy --dangerously-skip-permissions',
    hasChatMode: true,
    defaultInstalled: true,
    installCommand: 'npm install -g @google/antigravity'
  },
  {
    id: 'codebuff',
    name: 'Freebuff',
    provider: 'codebuff',
    command: 'freebuff',
    hasChatMode: false,
    defaultInstalled: true,
    installCommand: 'npm install -g freebuff'
  },
  {
    id: 'kimi',
    name: 'Kimi',
    provider: 'kimi',
    command: 'kimi --yolo',
    hasChatMode: false,
    defaultInstalled: true,
    installCommand: 'pip install kimi-code'
  },
  {
    id: 'qwen',
    name: 'Qwen Code',
    provider: 'qwen',
    command: 'qwen --approval-mode yolo',
    hasChatMode: false,
    defaultInstalled: true,
    installCommand: 'pip install qwen-code'
  },
  {
    id: 'claude',
    name: 'Claude',
    provider: 'claude',
    command: 'claude --dangerously-skip-permissions',
    hasChatMode: true,
    installCommand: 'npm install -g @anthropic-ai/claude-code'
  },
  {
    id: 'claude-teams',
    name: 'Claude Agent Teams',
    provider: 'claude',
    command: 'orca.cmd claude-teams --dangerously-skip-permissions',
    hasChatMode: false,
    installCommand: 'npm install -g @anthropic-ai/claude-teams'
  },
  {
    id: 'openclaude',
    name: 'OpenClaude',
    provider: 'claude',
    command: 'openclaude --dangerously-skip-permissions',
    hasChatMode: false,
    installCommand: 'npm install -g openclaude'
  },
  {
    id: 'grok',
    name: 'Grok',
    provider: 'ollama',
    command: 'grok --permission-mode bypassPermissions',
    hasChatMode: true,
    installCommand: 'npm install -g xai-grok-cli'
  },
  {
    id: 'opencode2',
    name: 'OpenCode 2',
    provider: 'opencode',
    command: 'opencode2',
    hasOwnSettings: true,
    hasChatMode: true,
    installCommand: 'npm install -g opencode2'
  },
  {
    id: 'mimo',
    name: 'MiMo Code',
    provider: 'ollama',
    command: 'mimo',
    hasChatMode: false,
    installCommand: 'pip install mimo-code'
  },
  {
    id: 'ante',
    name: 'Ante',
    provider: 'ante',
    command: 'ante',
    hasChatMode: false,
    installCommand: 'npm install -g ante-cli'
  },
  {
    id: 'auggie',
    name: 'Auggie',
    provider: 'auggie',
    command: 'auggie',
    hasChatMode: false,
    installCommand: 'npm install -g @augmentcode/auggie'
  },
  {
    id: 'cline',
    name: 'Cline',
    provider: 'cline',
    command: 'cline',
    hasChatMode: true,
    installCommand: 'npm install -g cline'
  },
  {
    id: 'continue',
    name: 'Continue',
    provider: 'continue',
    command: 'continue',
    hasChatMode: true,
    installCommand: 'npm install -g continue'
  },
  {
    id: 'crush',
    name: 'Crush',
    provider: 'crush',
    command: 'crush',
    hasChatMode: false,
    installCommand: 'npm install -g crush-cli'
  },
  {
    id: 'cursor',
    name: 'Cursor Agent',
    provider: 'cursor',
    command: 'cursor --agent',
    hasChatMode: true,
    installCommand: 'npm install -g cursor-cli'
  },
  {
    id: 'devin',
    name: 'Devin',
    provider: 'devin',
    command: 'devin',
    hasChatMode: false,
    installCommand: 'npm install -g @cognition/devin-cli'
  },
  {
    id: 'droid',
    name: 'Droid (Factory)',
    provider: 'droid',
    command: 'droid exec',
    hasChatMode: false,
    installCommand: 'npm install -g @factory/droid'
  },
  {
    id: 'goose',
    name: 'Goose',
    provider: 'goose',
    command: 'goose run',
    hasChatMode: false,
    installCommand: 'pip install block-goose'
  },
  {
    id: 'hermes',
    name: 'Hermes Agent',
    provider: 'hermes',
    command: 'hermes',
    hasChatMode: false,
    installCommand: 'pip install hermes-agent'
  },
  {
    id: 'kilocode',
    name: 'Kilo Code',
    provider: 'kilocode',
    command: 'kilocode',
    hasChatMode: false,
    installCommand: 'npm install -g kilocode'
  },
  {
    id: 'kiro',
    name: 'Kiro CLI',
    provider: 'kiro',
    command: 'kiro',
    hasChatMode: false,
    installCommand: 'npm install -g kiro-cli'
  },
  {
    id: 'vibe',
    name: 'Mistral Vibe',
    provider: 'vibe',
    command: 'vibe',
    hasChatMode: false,
    installCommand: 'pip install mistral-vibe'
  },
  {
    id: 'openhands',
    name: 'OpenHands',
    provider: 'openhands',
    command: 'openhands',
    hasChatMode: false,
    installCommand: 'pip install openhands-ai'
  },
  {
    id: 'pi',
    name: 'Pi Coding Agent',
    provider: 'pi',
    command: 'pi',
    hasChatMode: false,
    installCommand: 'pip install pi-agent'
  },
  {
    id: 'roocode',
    name: 'Roo Code',
    provider: 'roocode',
    command: 'roocode',
    hasChatMode: true,
    installCommand: 'npm install -g roocode'
  },
  {
    id: 'rovo',
    name: 'Rovo Dev',
    provider: 'rovo',
    command: 'rovo',
    hasChatMode: false,
    installCommand: 'npm install -g @atlassian/rovo-dev'
  },
  {
    id: 'trae',
    name: 'Trae CLI',
    provider: 'trae',
    command: 'trae --agent',
    hasChatMode: true,
    installCommand: 'npm install -g trae-agent'
  },
  {
    id: 'zed',
    name: 'Zed Agent',
    provider: 'zed',
    command: 'zed --agent',
    hasChatMode: false,
    installCommand: 'npm install -g zed-agent'
  },
  {
    id: 'aider',
    name: 'Aider',
    provider: 'aider',
    command: 'aider',
    hasChatMode: false,
    installCommand: 'pip install aider-chat'
  },
  {
    id: 'amp',
    name: 'Amp',
    provider: 'amp',
    command: 'amp',
    hasChatMode: false,
    installCommand: 'npm install -g amp-cli'
  },
  {
    id: 'codebuddy',
    name: 'CodeBuddy',
    provider: 'codebuddy',
    command: 'codebuddy',
    hasChatMode: false,
    installCommand: 'npm install -g codebuddy'
  }
];

export const AgentsSettingsTab: React.FC = () => {
  const {
    agentPermissions,
    setAgentPermissions,
    agentModes,
    setAgentMode,
    agentEnabled,
    setAgentEnabled,
    customPaths,
    setCustomPath,
    createTerminalSession,
    openTerminalTab,
    toggleSettings,
    cliStatuses,
    setCLIStatuses,
    addLog
  } = useWorkspaceStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [testStatus, setTestStatus] = useState<Record<string, string>>({});
  const [installingAgent, setInstallingAgent] = useState<AgentItemToInstall | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await window.api.detectCLIs({ customPaths });
      setCLIStatuses(res as any);
      addLog('Agent discovery scan completed successfully.', 'info');
    } catch (err: any) {
      addLog(`Failed to scan agents: ${err.message}`, 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!cliStatuses) {
      handleRefresh();
    }
  }, []);

  const handleLaunchCLI = (agent: AgentItem) => {
    const newId = createTerminalSession(agent.provider);
    openTerminalTab(newId);
    toggleSettings(false);
    addLog(`Launched ${agent.name} CLI agent in terminal.`, 'info');
  };

  const handleTestConnection = async (agent: AgentItem) => {
    setTestStatus((prev) => ({ ...prev, [agent.id]: 'Testing...' }));
    try {
      const res = await window.api.checkCLIAuth({
        provider: agent.provider,
        customPath: customPaths[agent.provider]
      });
      const msg = res.isAuthenticated
        ? `Authenticated (${res.authType})`
        : `Auth required: ${res.details || 'No active key'}`;
      setTestStatus((prev) => ({ ...prev, [agent.id]: msg }));
      addLog(`Auth check for ${agent.name}: ${msg}`, 'info');
    } catch (err: any) {
      setTestStatus((prev) => ({ ...prev, [agent.id]: `Error: ${err.message}` }));
      addLog(`Auth check error for ${agent.name}: ${err.message}`, 'error');
    }
  };

  const isAgentInstalled = (agent: AgentItem): boolean => {
    if (cliStatuses?.[agent.provider]?.isInstalled) return true;
    return Boolean(agent.defaultInstalled);
  };

  const filteredAgents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ALL_AGENTS;
    return ALL_AGENTS.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.provider.toLowerCase().includes(q) ||
        a.command.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  return (
    <div className="space-y-4 text-foreground font-sans pb-12 animate-in fade-in duration-150">
      {/* Top Bar: Search on the LEFT, Permissions on the RIGHT */}
      <div className="flex items-center justify-between gap-4">
        {/* Left: Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-foreground-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search agents and models..."
            className="w-full bg-white/[0.03] hover:bg-white/[0.05] focus:bg-white/[0.06] rounded-md pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-foreground-muted/60 focus:outline-none transition-colors font-mono border-0"
          />
        </div>

        {/* Right: Permissions selector */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded-md text-foreground-muted hover:text-foreground hover:bg-white/[0.04] transition-colors cursor-pointer"
            title="Scan installed agents"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-foreground-muted" />
            <span className="text-xs text-foreground-secondary font-medium">Permissions</span>
            <CustomSelect<'full_access' | 'supervised' | 'read_only'>
              value={agentPermissions}
              onChange={(val) => setAgentPermissions(val)}
              options={PERMISSION_OPTIONS}
              menuClassName="w-48"
            />
          </div>
        </div>
      </div>

      {/* Unified Agents List */}
      <div className="space-y-0.5 pt-1">
        {filteredAgents.map((agent) => {
          const installed = isAgentInstalled(agent);
          const isEnabled = agentEnabled[agent.id] !== false;
          const currentMode = agentModes[agent.id] || 'cli';
          const isExpanded = expandedAgentId === agent.id;

          return (
            <div
              key={agent.id}
              className="group rounded-md transition-colors px-2.5 py-2 hover:bg-white/[0.03]"
            >
              <div className="flex items-center justify-between gap-3">
                {/* Left: Logo + Name + Command */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <OfficialLogoRenderer
                    provider={agent.provider}
                    title={agent.name}
                    className="w-5 h-5 flex-shrink-0"
                  />

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground truncate">
                        {agent.name}
                      </span>
                      {agent.hasOwnSettings && (
                        <span className="text-[10px] text-foreground-muted font-mono">
                          (Custom Config)
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-foreground-muted font-mono truncate">
                      {agent.command}
                    </div>
                  </div>
                </div>

                {/* Right: Status Symbol + Controls */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Status Indicator Symbol */}
                  {installed ? (
                    <span
                      title="Installed"
                      className="flex items-center justify-center w-6 h-6 rounded-md text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setInstallingAgent(agent)}
                      title={`Install ${agent.name}`}
                      className="flex items-center justify-center w-6 h-6 rounded-md text-foreground-muted hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Mode Toggle: [Chat] [CLI] */}
                  {agent.hasChatMode && (
                    <div className="flex items-center p-0.5 rounded-md bg-white/[0.04]">
                      <button
                        type="button"
                        onClick={() => setAgentMode(agent.id, 'chat')}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                          currentMode === 'chat'
                            ? 'bg-white/[0.12] text-white shadow-xs'
                            : 'text-foreground-muted hover:text-white'
                        }`}
                      >
                        Chat
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAgentMode(agent.id, 'cli');
                          handleLaunchCLI(agent);
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                          currentMode === 'cli'
                            ? 'bg-white/[0.12] text-white shadow-xs'
                            : 'text-foreground-muted hover:text-white'
                        }`}
                      >
                        CLI
                      </button>
                    </div>
                  )}

                  {/* Enabled / Disabled Toggle */}
                  <div className="flex items-center p-0.5 rounded-md bg-white/[0.04]">
                    <button
                      type="button"
                      onClick={() => setAgentEnabled(agent.id, true)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        isEnabled
                          ? 'bg-white/[0.12] text-white shadow-xs'
                          : 'text-foreground-muted hover:text-white'
                      }`}
                    >
                      On
                    </button>
                    <button
                      type="button"
                      onClick={() => setAgentEnabled(agent.id, false)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        !isEnabled
                          ? 'bg-white/[0.12] text-white shadow-xs'
                          : 'text-foreground-muted hover:text-white'
                      }`}
                    >
                      Off
                    </button>
                  </div>

                  {/* Launch Terminal Button */}
                  <button
                    type="button"
                    onClick={() => handleLaunchCLI(agent)}
                    className="p-1 rounded text-foreground-muted hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                    title={`Launch ${agent.name} CLI Terminal`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>

                  {/* Expand Chevron */}
                  <button
                    type="button"
                    onClick={() => setExpandedAgentId(isExpanded ? null : agent.id)}
                    className="p-1 rounded text-foreground-muted hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                    title="Details"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded Details Panel */}
              {isExpanded && (
                <div className="mt-2.5 pt-2 pl-8 space-y-2 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-foreground-muted block mb-1">
                        Custom Executable Path
                      </label>
                      <input
                        type="text"
                        value={customPaths[agent.provider] || ''}
                        onChange={(e) => setCustomPath(agent.provider, e.target.value)}
                        placeholder="Detected automatically on PATH"
                        className="w-full bg-white/[0.04] rounded px-2.5 py-1 text-xs font-mono text-white placeholder:text-foreground-muted/50 focus:outline-none border-0"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-foreground-muted block mb-1">
                        Execution Command
                      </label>
                      <div className="font-mono text-[11px] text-foreground-secondary bg-white/[0.02] rounded px-2.5 py-1">
                        {agent.command}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="text-[11px] text-foreground-muted">
                      {testStatus[agent.id] && (
                        <span className="font-mono text-emerald-400">
                          {testStatus[agent.id]}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleTestConnection(agent)}
                        className="px-2.5 py-1 rounded bg-white/[0.05] hover:bg-white/[0.1] text-[11px] text-white transition-colors cursor-pointer"
                      >
                        Check Authentication
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLaunchCLI(agent)}
                        className="px-2.5 py-1 rounded bg-white text-black hover:bg-white/90 text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        Launch in Terminal
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mini Terminal Install Modal */}
      <AgentInstallModal
        agent={installingAgent}
        isOpen={Boolean(installingAgent)}
        onClose={() => setInstallingAgent(null)}
        onInstalled={() => {
          handleRefresh();
        }}
      />
    </div>
  );
};
