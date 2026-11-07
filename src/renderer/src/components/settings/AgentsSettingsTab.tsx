import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Check,
  Terminal,
  Shield,
  HelpCircle,
  Play,
  Settings2,
  FolderOpen
} from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace.store';
import type { CLIProvider, CLIInstallationStatus } from '../../../../shared/cli';
import { OfficialLogoRenderer } from '../OfficialLogos';
import { CustomSelect, type SelectOption } from '../ui/Select';

const PERMISSION_OPTIONS: SelectOption<'full_access' | 'supervised' | 'read_only'>[] = [
  {
    value: 'full_access',
    label: 'Full access',
    description: 'Execute commands, modify files, and run code without manual approval.'
  },
  {
    value: 'supervised',
    label: 'Supervised',
    description: 'Ask for user confirmation before executing potentially destructive actions.'
  },
  {
    value: 'read_only',
    label: 'Read-only',
    description: 'Inspect code and answer queries without modifying workspace files.'
  }
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

const DEFAULT_HOST_AGENTS: { id: string; name: string; provider: CLIProvider }[] = [
  { id: 'auto', name: 'Auto', provider: 'antigravity' },
  { id: 'codex', name: 'Codex', provider: 'codex' },
  { id: 'copilot', name: 'GitHub Copilot', provider: 'copilot' },
  { id: 'opencode', name: 'OpenCode', provider: 'opencode' },
  { id: 'gemini', name: 'Gemini', provider: 'gemini' },
  { id: 'antigravity', name: 'Antigravity', provider: 'antigravity' },
  { id: 'codebuff', name: 'Freebuff', provider: 'codebuff' },
  { id: 'kimi', name: 'Kimi', provider: 'kimi' },
  { id: 'qwen', name: 'Qwen Code', provider: 'qwen' }
];

const ALL_AGENTS: AgentItem[] = [
  // Default Installed Set (matching screenshot)
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
    installCommand: 'curl -fsSL https://antigravity.google/install.sh | bash'
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

  // Available to install list
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
    installCommand: 'curl -fsSL https://ante.ai/install.sh | bash'
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
    installCommand: 'curl -fsSL https://crush.dev/install.sh | bash'
  },
  {
    id: 'cursor',
    name: 'Cursor Agent',
    provider: 'cursor',
    command: 'cursor --agent',
    hasChatMode: true,
    installCommand: 'curl -fsSL https://cursor.com/install.sh | bash'
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
    installCommand: 'curl -fsSL https://kiro.dev/install.sh | bash'
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
    installCommand: 'curl -fsSL https://inflection.ai/pi-install | bash'
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
    installCommand: 'curl -fsSL https://trae.ai/install.sh | bash'
  },
  {
    id: 'zed',
    name: 'Zed Agent',
    provider: 'zed',
    command: 'zed --agent',
    hasChatMode: false,
    installCommand: 'curl -fsSL https://zed.dev/install.sh | bash'
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
    installCommand: 'curl -fsSL https://ampcode.com/install.sh | bash'
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
    activeProvider,
    setActiveProvider,
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

  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [testStatus, setTestStatus] = useState<Record<string, string>>({});

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

  // Determine Installed vs Available
  const installedAgents = ALL_AGENTS.filter((a) => {
    if (cliStatuses?.[a.provider]?.isInstalled) return true;
    return Boolean(a.defaultInstalled);
  });

  const availableAgents = ALL_AGENTS.filter((a) => !installedAgents.some((ia) => ia.id === a.id));

  return (
    <div className="space-y-6 text-[#ECEDEF] font-sans pb-12 animate-in fade-in duration-150">
      {/* 1. HOST DEFAULTS HEADER */}
      <div className="space-y-2">
        <p className="text-xs text-[#8E929B] font-normal select-none">
          Defaults for new agents on the selected host.
        </p>

        {/* Host default pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {DEFAULT_HOST_AGENTS.map((item) => {
            const isSelected = activeProvider === item.provider;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveProvider(item.provider);
                  addLog(`Default AI host agent set to [${item.name}]`, 'info');
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer select-none border ${
                  isSelected
                    ? 'bg-white/[0.09] text-white border-white/20 shadow-xs'
                    : 'bg-white/[0.03] text-[#A4A8AF] hover:text-white hover:bg-white/[0.06] border-white/[0.06]'
                }`}
              >
                {item.id !== 'auto' && (
                  <OfficialLogoRenderer
                    provider={item.provider}
                    title={item.name}
                    className="w-3.5 h-3.5 flex-shrink-0"
                  />
                )}
                <span>{item.name}</span>
                {isSelected && <Check className="w-3 h-3 text-white ml-0.5" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. PERMISSIONS SELECTOR */}
      <div className="pt-2 border-t border-white/[0.06] space-y-1">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#ECEDEF] font-medium">Permissions</span>
          <HelpCircle className="w-3.5 h-3.5 text-[#717784]" />
          <CustomSelect<'full_access' | 'supervised' | 'read_only'>
            value={agentPermissions}
            onChange={(val) => setAgentPermissions(val)}
            options={PERMISSION_OPTIONS}
            menuClassName="w-80"
          />
        </div>
        <p className="text-[11px] text-[#717784]">
          What every agent may do without asking. You can set one agent differently below.
        </p>
      </div>

      {/* 3. INSTALLED SECTION */}
      <div className="pt-4 border-t border-white/[0.06] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#ECEDEF]">Installed</span>
            <span className="text-[10px] text-[#8E929B] font-mono">
              {installedAgents.length} detected
            </span>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-[#8E929B] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="Scan installed CLI agents"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="text-[11px]">Refresh</span>
          </button>
        </div>

        {/* Installed agents list */}
        <div className="space-y-1">
          {installedAgents.map((agent) => {
            const isDefault = activeProvider === agent.provider;
            const isEnabled = agentEnabled[agent.id] !== false;
            const currentMode = agentModes[agent.id] || 'cli';
            const isExpanded = expandedAgentId === agent.id;

            return (
              <div
                key={agent.id}
                className="group border border-transparent hover:border-white/[0.06] rounded-lg transition-colors p-2 hover:bg-white/[0.02]"
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Left: Logo + Name + Command subtitle */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <OfficialLogoRenderer
                      provider={agent.provider}
                      title={agent.name}
                      className="w-5 h-5 flex-shrink-0"
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-white truncate">
                          {agent.name}
                        </span>
                        {agent.hasOwnSettings && (
                          <span className="text-[10px] text-[#A4A8AF] bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.06]">
                            Use OpenCode's own settings
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#717784] font-mono truncate">
                        {agent.command}
                      </div>
                    </div>
                  </div>

                  {/* Right: Controls & Toggles */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Mode Toggle: [Chat] [CLI] */}
                    {agent.hasChatMode && (
                      <div className="flex items-center bg-white/[0.04] p-0.5 rounded-md border border-white/[0.06]">
                        <button
                          type="button"
                          onClick={() => setAgentMode(agent.id, 'chat')}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                            currentMode === 'chat'
                              ? 'bg-white/[0.12] text-white shadow-xs'
                              : 'text-[#8E929B] hover:text-white'
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
                              : 'text-[#8E929B] hover:text-white'
                          }`}
                        >
                          CLI
                        </button>
                      </div>
                    )}

                    {/* Enabled / Disabled Toggle */}
                    <div className="flex items-center bg-white/[0.04] p-0.5 rounded-md border border-white/[0.06]">
                      <button
                        type="button"
                        onClick={() => setAgentEnabled(agent.id, true)}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                          isEnabled
                            ? 'bg-white/[0.12] text-white shadow-xs'
                            : 'text-[#8E929B] hover:text-white'
                        }`}
                      >
                        Enabled
                      </button>
                      <button
                        type="button"
                        onClick={() => setAgentEnabled(agent.id, false)}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                          !isEnabled
                            ? 'bg-white/[0.12] text-white shadow-xs'
                            : 'text-[#8E929B] hover:text-white'
                        }`}
                      >
                        Disabled
                      </button>
                    </div>

                    {/* Default Selector Button */}
                    <button
                      type="button"
                      onClick={() => setActiveProvider(agent.provider)}
                      className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                        isDefault
                          ? 'text-white bg-white/[0.08] border border-white/20'
                          : 'text-[#8E929B] hover:text-white hover:bg-white/[0.04]'
                      }`}
                    >
                      {isDefault && <Check className="w-2.5 h-2.5 text-white" />}
                      <span>Default</span>
                    </button>

                    {/* Launch Terminal / External Action */}
                    <button
                      type="button"
                      onClick={() => handleLaunchCLI(agent)}
                      className="p-1 rounded text-[#8E929B] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                      title={`Launch ${agent.name} CLI Terminal`}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>

                    {/* Expand Chevron */}
                    <button
                      type="button"
                      onClick={() => setExpandedAgentId(isExpanded ? null : agent.id)}
                      className="p-1 rounded text-[#8E929B] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
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
                  <div className="mt-2.5 pt-2.5 border-t border-white/[0.06] pl-8 space-y-2 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-[#8E929B] block mb-1">
                          Custom Executable Path
                        </label>
                        <input
                          type="text"
                          value={customPaths[agent.provider] || ''}
                          onChange={(e) => setCustomPath(agent.provider, e.target.value)}
                          placeholder="Detected automatically on PATH"
                          className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2.5 py-1 text-xs font-mono text-white placeholder:text-[#555] focus:outline-none focus:border-white/20"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-[#8E929B] block mb-1">
                          Execution Command
                        </label>
                        <div className="font-mono text-[11px] text-[#A4A8AF] bg-white/[0.02] border border-white/[0.06] rounded px-2.5 py-1">
                          {agent.command}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="text-[11px] text-[#8E929B]">
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
      </div>

      {/* 4. AVAILABLE TO INSTALL SECTION */}
      <div className="pt-4 border-t border-white/[0.06] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#ECEDEF]">Available to install</span>
            <span className="text-[10px] text-[#8E929B] font-mono">
              {availableAgents.length} agents
            </span>
          </div>
        </div>

        {/* Available agents list */}
        <div className="space-y-1">
          {availableAgents.map((agent) => {
            const isEnabled = agentEnabled[agent.id] !== false;
            const currentMode = agentModes[agent.id] || 'cli';
            const isExpanded = expandedAgentId === agent.id;

            return (
              <div
                key={agent.id}
                className="group border border-transparent hover:border-white/[0.06] rounded-lg transition-colors p-2 hover:bg-white/[0.02]"
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Left: Logo + Name + Command subtitle */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <OfficialLogoRenderer
                      provider={agent.provider}
                      title={agent.name}
                      className="w-5 h-5 flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[#ECEDEF] truncate">
                          {agent.name}
                        </span>
                        {agent.hasOwnSettings && (
                          <span className="text-[10px] text-[#A4A8AF] bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.06]">
                            Use OpenCode 2's own settings
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#717784] font-mono truncate">
                        {agent.command}
                      </div>
                    </div>
                  </div>

                  {/* Right: Controls & Toggles */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Mode Toggle: [Chat] [CLI] */}
                    {agent.hasChatMode && (
                      <div className="flex items-center bg-white/[0.04] p-0.5 rounded-md border border-white/[0.06]">
                        <button
                          type="button"
                          onClick={() => setAgentMode(agent.id, 'chat')}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                            currentMode === 'chat'
                              ? 'bg-white/[0.12] text-white shadow-xs'
                              : 'text-[#8E929B] hover:text-white'
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
                              : 'text-[#8E929B] hover:text-white'
                          }`}
                        >
                          CLI
                        </button>
                      </div>
                    )}

                    {/* Enabled / Disabled Toggle */}
                    <div className="flex items-center bg-white/[0.04] p-0.5 rounded-md border border-white/[0.06]">
                      <button
                        type="button"
                        onClick={() => setAgentEnabled(agent.id, true)}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                          isEnabled
                            ? 'bg-white/[0.12] text-white shadow-xs'
                            : 'text-[#8E929B] hover:text-white'
                        }`}
                      >
                        Enabled
                      </button>
                      <button
                        type="button"
                        onClick={() => setAgentEnabled(agent.id, false)}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                          !isEnabled
                            ? 'bg-white/[0.12] text-white shadow-xs'
                            : 'text-[#8E929B] hover:text-white'
                        }`}
                      >
                        Disabled
                      </button>
                    </div>

                    {/* Launch / Install action */}
                    <button
                      type="button"
                      onClick={() => handleLaunchCLI(agent)}
                      className="p-1 rounded text-[#8E929B] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                      title={`Launch ${agent.name} CLI Terminal`}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>

                    {/* Expand Chevron */}
                    <button
                      type="button"
                      onClick={() => setExpandedAgentId(isExpanded ? null : agent.id)}
                      className="p-1 rounded text-[#8E929B] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
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
                  <div className="mt-2.5 pt-2.5 border-t border-white/[0.06] pl-8 space-y-2 text-xs">
                    <div>
                      <label className="text-[11px] text-[#8E929B] block mb-1">
                        Installation Command
                      </label>
                      <div className="font-mono text-[11px] text-emerald-400 bg-white/[0.02] border border-white/[0.06] rounded px-2.5 py-1.5 select-all">
                        {agent.installCommand || `npm install -g ${agent.id}`}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-[#717784]">
                        Run the command above in terminal or PowerShell to install.
                      </span>

                      <button
                        type="button"
                        onClick={() => handleLaunchCLI(agent)}
                        className="px-2.5 py-1 rounded bg-white text-black hover:bg-white/90 text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        Launch Terminal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
