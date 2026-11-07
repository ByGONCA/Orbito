import React, { useEffect, useState, useMemo } from 'react';
import {
  Search,
  RefreshCw,
  ExternalLink,
  Terminal,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Copy,
  Check,
  Globe,
  Sliders,
  ChevronRight,
  ShieldCheck,
  Cpu,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspace.store';
import type { CLIProvider, CLIInstallationStatus, CLIAuthStatus } from '../../../shared/cli';
import { OfficialLogoRenderer } from './OfficialLogos';

export interface AgentRegistryItem {
  id: CLIProvider;
  name: string;
  vendor: string;
  tagline: string;
  category: 'Pair Programming' | 'Autonomous Agent' | 'Enterprise & CI' | 'Open Weights' | 'Terminal Native';
  executable: string;
  officialWebsite: string;
  documentationUrl: string;
  installCommand: string;
  authCommand: string;
  supportedPlatforms: ('win32' | 'darwin' | 'linux')[];
  integrationAvailability: 'standalone_cli' | 'sdk' | 'extension' | 'hosted_service' | 'desktop_app';
  description: string;
}

export const ALL_30_AGENTS: AgentRegistryItem[] = [
  {
    id: 'aider',
    name: 'Aider',
    vendor: 'Aider AI',
    tagline: 'AI pair programming in your terminal',
    category: 'Pair Programming',
    executable: 'aider',
    officialWebsite: 'https://aider.chat',
    documentationUrl: 'https://aider.chat/docs',
    installCommand: 'pip install aider-chat',
    authCommand: 'export OPENAI_API_KEY=... / ANTHROPIC_API_KEY=...',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    integrationAvailability: 'standalone_cli',
    description: 'Aider lets you pair program with LLMs to edit code in your local git repository directly from your shell.'
  },
  {
    id: 'amp',
    name: 'Amp',
    vendor: 'Amp AI',
    tagline: 'Modern extensible AI developer environment CLI',
    category: 'Terminal Native',
    executable: 'amp',
    officialWebsite: 'https://amp.dev',
    documentationUrl: 'https://amp.dev/documentation',
    installCommand: 'npm install -g @amp/cli',
    authCommand: 'amp login',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    integrationAvailability: 'standalone_cli',
    description: 'Amp CLI provides command-line code intelligence, automated refactoring, and multi-file code editing.'
  },
  {
    id: 'ante',
    name: 'Ante',
    vendor: 'Antigma Labs',
    tagline: 'Blazing fast, zero-dependency Rust AI coding agent',
    category: 'Terminal Native',
    executable: 'ante',
    officialWebsite: 'https://ante.run',
    documentationUrl: 'https://ante.run/docs',
    installCommand: 'curl -fsSL https://ante.run/install.sh | bash',
    authCommand: 'ante auth',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    integrationAvailability: 'standalone_cli',
    description: 'Self-contained AI coding agent built in Rust with built-in llama.cpp local inference and cloud LLM routing.'
  },
  {
    id: 'auggie',
    name: 'Auggie',
    vendor: 'Augment Code',
    tagline: 'Enterprise codebase context CLI companion by Augment Code',
    category: 'Enterprise & CI',
    executable: 'auggie',
    officialWebsite: 'https://augmentcode.com',
    documentationUrl: 'https://docs.augmentcode.com',
    installCommand: 'npm install -g @augmentcode/auggie@latest',
    authCommand: 'auggie login',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    integrationAvailability: 'standalone_cli',
    description: 'Brings Augment Code deep context engine and agentic capabilities into your shell and CI/CD pipelines.'
  },
  {
    id: 'claude',
    name: 'Claude Code',
    vendor: 'Anthropic',
    tagline: 'Interactive agentic coding by Anthropic',
    category: 'Autonomous Agent',
    executable: 'claude',
    officialWebsite: 'https://claude.ai',
    documentationUrl: 'https://docs.anthropic.com/en/docs/agents-and-tools/claude-code',
    installCommand: 'npm install -g @anthropic-ai/claude-code',
    authCommand: 'claude',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    integrationAvailability: 'standalone_cli',
    description: 'Anthropic official research agent CLI for autonomous code exploration, editing, test execution, and Git commits.'
  },
  {
    id: 'cline',
    name: 'Cline',
    vendor: 'Cline Bot',
    tagline: 'Autonomous coding agent with file system and CLI tools',
    category: 'Autonomous Agent',
    executable: 'cline',
    officialWebsite: 'https://cline.bot',
    documentationUrl: 'https://docs.cline.bot',
    installCommand: 'npm install -g cline',
    authCommand: 'cline configure',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    integrationAvailability: 'standalone_cli',
    description: 'Autonomous coding assistant capable of executing shell commands, browsing docs, and making multi-file diffs.'
  },
  {
    id: 'codex',
    name: 'OpenAI Codex CLI',
    vendor: 'OpenAI',
    tagline: 'Command-line execution and code automation via OpenAI tools',
    category: 'Pair Programming',
    executable: 'codex',
    officialWebsite: 'https://openai.com',
    documentationUrl: 'https://platform.openai.com/docs',
    installCommand: 'npm install -g @openai/codex',
    authCommand: 'codex login',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    integrationAvailability: 'standalone_cli',
    description: 'OpenAI command line tool for code generation, transformation, and shell workflow automation.'
  },
  {
    id: 'codebuddy',
    name: 'CodeBuddy',
    vendor: 'CodeBuddy',
    tagline: 'Interactive CLI code assistant and project builder',
    category: 'Pair Programming',
    executable: 'codebuddy',
    officialWebsite: 'https://codebuddy.ca',
    documentationUrl: 'https://codebuddy.ca/docs',
    installCommand: 'npm install -g codebuddy-cli',
    authCommand: 'codebuddy login',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    integrationAvailability: 'standalone_cli',
    description: 'Streamlined coding agent for full-stack code navigation, refactoring, and automated testing.'
  },
  {
    id: 'codebuff',
    name: 'Codebuff',
    vendor: 'Codebuff AI (YC F24)',
    tagline: 'Multi-agent AI coding assistant in your terminal',
    category: 'Autonomous Agent',
    executable: 'codebuff',
    officialWebsite: 'https://codebuff.com',
    documentationUrl: 'https://github.com/codebuff/codebuff',
    installCommand: 'npm install -g codebuff',
    authCommand: 'codebuff login',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    integrationAvailability: 'standalone_cli',
    description: 'Coordinates specialized internal agents (planner, editor, reviewer) for complex multi-file codebase changes with knowledge.md support.'
  },
  {
    id: 'continue',
    name: 'Continue',
    vendor: 'Continue.dev',
    tagline: 'Open-source AI code assistant CLI',
    category: 'Pair Programming',
    executable: 'continue',
    officialWebsite: 'https://continue.dev',
    documentationUrl: 'https://docs.continue.dev',
    installCommand: 'pip install continue-cli',
    authCommand: 'continue login',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    integrationAvailability: 'standalone_cli',
    description: 'Modular AI coding assistant supporting custom models, context providers, and prompt configurations.'
  },
  {
    id: 'crush',
    name: 'Crush',
    vendor: 'Charmbracelet',
    tagline: 'Glamorous terminal-native AI coding agent',
    category: 'Terminal Native',
    executable: 'crush',
    officialWebsite: 'https://charm.land',
    documentationUrl: 'https://github.com/charmbracelet/crush',
    installCommand: 'go install github.com/charmbracelet/crush@latest',
    authCommand: 'export OPENAI_API_KEY=... / ANTHROPIC_API_KEY=...',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    integrationAvailability: 'standalone_cli',
    description: 'Terminal AI coding assistant by Charmbracelet featuring mid-session model switching, LSP analysis, and MCP integration.'
  },
  {
    id: 'cursor',
    name: 'Cursor Agent',
    vendor: 'Anysphere',
    tagline: 'Cursor Composer and CLI agent for terminal execution',
    category: 'Autonomous Agent',
    executable: 'cursor',
    officialWebsite: 'https://cursor.com',
    documentationUrl: 'https://docs.cursor.com',
    installCommand: 'https://cursor.com/download',
    authCommand: 'cursor --login',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    integrationAvailability: 'desktop_app',
    description: 'Executes Cursor agent workflows from the command line with multi-file code editing and repo indexing.'
  },
  {
    id: 'devin',
    name: 'Devin',
    vendor: 'Cognition AI',
    tagline: 'Autonomous AI software engineer CLI runner',
    category: 'Autonomous Agent',
    executable: 'devin',
    officialWebsite: 'https://devin.ai',
    documentationUrl: 'https://docs.devin.ai',
    installCommand: 'npm install -g @cognition/devin',
    authCommand: 'devin login',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    integrationAvailability: 'hosted_service',
    description: 'Connects to Cognition AI Devin service to delegate end-to-end software engineering tasks.'
  },
  {
    id: 'droid',
    name: 'Droid (Factory)',
    vendor: 'Factory AI',
    tagline: 'Enterprise-grade agentic software engineering platform',
    category: 'Enterprise & CI',
    executable: 'droid',
    officialWebsite: 'https://factory.ai',
    documentationUrl: 'https://docs.factory.ai',
    installCommand: 'curl -fsSL https://app.factory.ai/install.sh | bash',
    authCommand: 'droid login',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    integrationAvailability: 'standalone_cli',
    description: 'Factory code droid for terminal automation, missions, and multi-file code maintenance.'
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    vendor: 'Google',
    tagline: 'Multimodal and code intelligence via Google GenAI developer CLI',
    category: 'Pair Programming',
    executable: 'gemini',
    officialWebsite: 'https://ai.google.dev',
    documentationUrl: 'https://ai.google.dev/gemini-api/docs',
    installCommand: 'npm install -g @google/gemini-cli',
    authCommand: 'gcloud auth application-default login',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    integrationAvailability: 'standalone_cli',
    description: 'Google Developer CLI for Gemini multimodal context, code analysis, and high-speed API prototyping.'
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot CLI',
    vendor: 'GitHub / Microsoft',
    tagline: 'AI command-line code suggestion and explanation',
    category: 'Pair Programming',
    executable: 'gh',
    officialWebsite: 'https://github.com/features/copilot',
    documentationUrl: 'https://docs.github.com/copilot/github-copilot-in-the-cli',
    installCommand: 'gh extension install github/gh-copilot',
    authCommand: 'gh auth login',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    integrationAvailability: 'standalone_cli',
    description: 'GitHub Copilot extension for command line shell suggestions, code explanation, and Git commit workflows.'
  },
  {
    id: 'goose',
    name: 'Goose',
    vendor: 'Block',
    tagline: 'Open-source autonomous on-machine coding agent',
    category: 'Autonomous Agent',
    executable: 'goose',
    officialWebsite: 'https://block.github.io/goose',
    documentationUrl: 'https://block.github.io/goose/docs',
    installCommand: 'curl -fsSL https://github.com/block/goose/releases/latest/download/goose.sh | bash',
    authCommand: 'goose configure',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    integrationAvailability: 'standalone_cli',
    description: 'Extensible open-source agent that writes code, runs terminal commands, and edits local projects.'
  },
  {
    id: 'hermes',
    name: 'Hermes Agent',
    vendor: 'Nous Research',
    tagline: 'Autonomous reasoning and function-calling coding agent',
    category: 'Autonomous Agent',
    executable: 'hermes',
    officialWebsite: 'https://hermes-agent.io',
    documentationUrl: 'https://hermes-agent.io/docs',
    installCommand: 'pip install hermes-agent',
    authCommand: 'hermes config',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    integrationAvailability: 'standalone_cli',
    description: 'Hermes agent powered by Nous Hermes models for structured code analysis, task decomposition, and code generation.'
  },
  {
    id: 'kilocode',
    name: 'Kilo Code',
    vendor: 'Kilo AI',
    tagline: 'Fast terminal-native code comprehension agent',
    category: 'Terminal Native',
    executable: 'kilocode',
    officialWebsite: 'https://kilocode.ai',
    documentationUrl: 'https://kilocode.ai/docs',
    installCommand: 'npm install -g kilocode',
    authCommand: 'kilocode login',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    integrationAvailability: 'standalone_cli',
    description: 'Lightweight agent focused on rapid bug diagnosis, refactoring, and code explanation.'
  },
  {
    id: 'kimi',
    name: 'Kimi Code',
    vendor: 'Moonshot AI',
    tagline: 'Long-context code intelligence CLI by Moonshot AI',
    category: 'Enterprise & CI',
    executable: 'kimi',
    officialWebsite: 'https://moonshot.cn',
    documentationUrl: 'https://platform.moonshot.cn/docs',
    installCommand: 'pip install kimi-cli',
    authCommand: 'kimi login',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    integrationAvailability: 'standalone_cli',
    description: 'Excels at ultra-long codebase analysis and repository understanding powered by Moonshot models.'
  },
  {
    id: 'kiro',
    name: 'Kiro CLI',
    vendor: 'Kiro AI',
    tagline: 'Developer CLI for code synthesis and test generation',
    category: 'Terminal Native',
    executable: 'kiro',
    officialWebsite: 'https://kiro.ai',
    documentationUrl: 'https://kiro.ai/docs',
    installCommand: 'npm install -g kiro-cli',
    authCommand: 'kiro auth',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    integrationAvailability: 'standalone_cli',
    description: 'Terminal assistant specializing in automated test generation, code coverage, and documentation.'
  },
  {
    id: 'vibe',
    name: 'Mistral Vibe',
    vendor: 'Mistral AI',
    tagline: 'High-speed code reasoning powered by Mistral Codestral',
    category: 'Open Weights',
    executable: 'vibe',
    officialWebsite: 'https://mistral.ai',
    documentationUrl: 'https://docs.mistral.ai',
    installCommand: 'pip install mistral-vibe',
    authCommand: 'export MISTRAL_API_KEY=...',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    integrationAvailability: 'standalone_cli',
    description: 'Mistral AI developer CLI integrating Codestral for fill-in-the-middle, instruction following, and fast code completion.'
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    vendor: 'OpenCode AI',
    tagline: 'Open-weights code orchestration CLI',
    category: 'Open Weights',
    executable: 'opencode',
    officialWebsite: 'https://opencode.ai',
    documentationUrl: 'https://opencode.ai/docs',
    installCommand: 'npm install -g opencode-cli',
    authCommand: 'opencode configure',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    integrationAvailability: 'standalone_cli',
    description: 'Terminal-based coding agent connecting to local or cloud open weights models for code refactoring and creation.'
  },
  {
    id: 'openhands',
    name: 'OpenHands',
    vendor: 'All-Hands AI',
    tagline: 'Open-source autonomous AI software developer',
    category: 'Autonomous Agent',
    executable: 'openhands',
    officialWebsite: 'https://all-hands.dev',
    documentationUrl: 'https://docs.all-hands.dev',
    installCommand: 'pip install openhands-ai',
    authCommand: 'openhands setup',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    integrationAvailability: 'standalone_cli',
    description: 'Full-stack software engineering agent that writes code, fixes bugs, and executes tests in an isolated sandbox.'
  },
  {
    id: 'pi',
    name: 'Pi Coding Agent',
    vendor: 'Inflection AI',
    tagline: 'Empathetic conversational terminal pair programmer',
    category: 'Pair Programming',
    executable: 'pi',
    officialWebsite: 'https://pi.ai',
    documentationUrl: 'https://pi.ai',
    installCommand: 'npm install -g pi-coding-agent',
    authCommand: 'pi login',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    integrationAvailability: 'standalone_cli',
    description: 'Conversational coding assistant designed for conceptual planning, code architecture, and debugging discussions.'
  },
  {
    id: 'qwen',
    name: 'Qwen Code',
    vendor: 'Alibaba Cloud',
    tagline: 'State-of-the-art open code intelligence powered by Qwen 2.5 Coder',
    category: 'Open Weights',
    executable: 'qwen',
    officialWebsite: 'https://qwenlm.github.io',
    documentationUrl: 'https://help.aliyun.com/document_detail/2712521.html',
    installCommand: 'pip install qwen-code',
    authCommand: 'export DASHSCOPE_API_KEY=...',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    integrationAvailability: 'standalone_cli',
    description: 'Command line coding assistant leveraging Alibaba Qwen 2.5 Coder models for polyglot code generation.'
  },
  {
    id: 'roocode',
    name: 'Roo Code',
    vendor: 'Roo Code Team',
    tagline: 'Customizable role-based autonomous coding agent',
    category: 'Autonomous Agent',
    executable: 'roocode',
    officialWebsite: 'https://roocode.com',
    documentationUrl: 'https://docs.roocode.com',
    installCommand: 'npm install -g roo-code-cli',
    authCommand: 'roocode configure',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    integrationAvailability: 'standalone_cli',
    description: 'Fork of Cline featuring custom agent modes, rules integration, and multi-provider token optimization.'
  },
  {
    id: 'rovo',
    name: 'Rovo Dev',
    vendor: 'Atlassian',
    tagline: 'Enterprise dev knowledge and issue-driven coding agent',
    category: 'Enterprise & CI',
    executable: 'rovo',
    officialWebsite: 'https://www.atlassian.com/software/rovo',
    documentationUrl: 'https://support.atlassian.com/rovo',
    installCommand: 'npm install -g @atlassian/rovo-cli',
    authCommand: 'rovo login',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    integrationAvailability: 'standalone_cli',
    description: 'Atlassian Rovo Dev CLI connecting Jira issue context, Bitbucket repos, and enterprise pull requests.'
  },
  {
    id: 'trae',
    name: 'Trae CLI',
    vendor: 'ByteDance',
    tagline: 'Adaptive AI coding environment CLI',
    category: 'Terminal Native',
    executable: 'trae',
    officialWebsite: 'https://trae.ai',
    documentationUrl: 'https://docs.trae.ai',
    installCommand: 'https://trae.ai/download',
    authCommand: 'trae login',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    integrationAvailability: 'desktop_app',
    description: 'Trae agent runtime providing automated code scaffolding, linting, and workspace transformation.'
  },
  {
    id: 'zed',
    name: 'Zed Agent',
    vendor: 'Zed Industries',
    tagline: 'High-performance collaborative AI editor CLI agent',
    category: 'Terminal Native',
    executable: 'zed',
    officialWebsite: 'https://zed.dev',
    documentationUrl: 'https://zed.dev/docs',
    installCommand: 'https://zed.dev/download',
    authCommand: 'zed --login',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    integrationAvailability: 'desktop_app',
    description: 'Interacts with Zed assistant engine and headless agent runner for fast Rust-native code transformations.'
  }
];

export const ProvidersPanel: React.FC = () => {
  const {
    project,
    cliStatuses,
    cliAuthStatuses,
    setCLIStatuses,
    setCLIAuthStatuses,
    activeProvider,
    setActiveProvider,
    customPaths,
    setCustomPath,
    createTerminalSession,
    updateTerminalSession,
    openTerminalTab,
    setActiveSection,
    addLog
  } = useWorkspaceStore();

  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'installed' | 'auth_required' | 'not_installed'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedAgentId, setSelectedAgentId] = useState<CLIProvider>('claude');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [customPathInput, setCustomPathInput] = useState('');

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const refreshStatuses = async () => {
    setIsLoading(true);
    addLog('Scanning and verifying all 30 AI agent integrations...', 'info');
    try {
      const statuses = await window.api.detectCLIs({ customPaths });
      setCLIStatuses(statuses);

      const auths: Record<string, CLIAuthStatus> = {};
      for (const agent of ALL_30_AGENTS) {
        if (statuses[agent.id]?.isInstalled) {
          auths[agent.id] = await window.api.checkCLIAuth({
            provider: agent.id,
            customPath: customPaths[agent.id]
          });
        }
      }
      setCLIAuthStatuses(auths as any);
      addLog('Agent integration scan completed', 'info');
    } catch (err: any) {
      addLog(`Failed to scan agents: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!cliStatuses) {
      refreshStatuses();
    }
  }, []);

  const selectedAgent = useMemo(() => {
    return ALL_30_AGENTS.find((a) => a.id === selectedAgentId) || ALL_30_AGENTS[0];
  }, [selectedAgentId]);

  useEffect(() => {
    setCustomPathInput(customPaths[selectedAgent.id] || '');
  }, [selectedAgent.id, customPaths]);

  const handleLaunchAgent = (agent: AgentRegistryItem) => {
    const newId = createTerminalSession(agent.id);
    const workDir = project?.path || '';
    const branch = project?.activeBranch || '';

    updateTerminalSession(newId, {
      title: `${agent.name} Session`,
      projectName: project?.name || '',
      workingDirectory: workDir,
      branch
    });
    openTerminalTab(newId);
    setActiveSection('terminal');
    addLog(`Launched active session for ${agent.name}`, 'info');
  };

  const handleSaveCustomPath = () => {
    setCustomPath(selectedAgent.id, customPathInput.trim());
    addLog(`Updated custom path for ${selectedAgent.name}`, 'info');
    refreshStatuses();
  };

  // Metrics
  const metrics = useMemo(() => {
    let installed = 0;
    let authenticated = 0;
    for (const a of ALL_30_AGENTS) {
      if (cliStatuses?.[a.id]?.isInstalled) installed++;
      if (cliAuthStatuses?.[a.id]?.isAuthenticated) authenticated++;
    }
    return { total: ALL_30_AGENTS.length, installed, authenticated };
  }, [cliStatuses, cliAuthStatuses]);

  // Filtered list
  const filteredAgents = useMemo(() => {
    return ALL_30_AGENTS.filter((agent) => {
      const q = search.toLowerCase();
      const matchesSearch =
        agent.name.toLowerCase().includes(q) ||
        agent.vendor.toLowerCase().includes(q) ||
        agent.tagline.toLowerCase().includes(q) ||
        agent.executable.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (categoryFilter !== 'all' && agent.category !== categoryFilter) {
        return false;
      }

      const isInstalled = !!cliStatuses?.[agent.id]?.isInstalled;
      const isAuth = !!cliAuthStatuses?.[agent.id]?.isAuthenticated;

      if (statusFilter === 'installed') return isInstalled;
      if (statusFilter === 'auth_required') return isInstalled && !isAuth;
      if (statusFilter === 'not_installed') return !isInstalled;

      return true;
    });
  }, [search, statusFilter, categoryFilter, cliStatuses, cliAuthStatuses]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0E1015] text-[#ECEFF4] font-sans overflow-hidden select-none">
      {/* 1. Header (Anti-Boxiness: borderless, clean typographic hierarchy) */}
      <div className="px-8 pt-8 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2.5">
            AI Agent Registry & CLI Integration
          </h1>
          <p className="text-xs text-[#8F96A3] mt-1">
            Discover, configure, and orchestrate all 30 unified AI coding agents across projects and terminals.
          </p>
        </div>

        {/* Clean Typographic Metrics (NO pill containers or boxy backgrounds per Rule 4) */}
        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[#6C7280]">Total</span>
            <span className="text-white font-medium">{metrics.total}</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[#6C7280]">Detected</span>
            <span className="text-[#38BDF8] font-medium">{metrics.installed}</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[#6C7280]">Ready</span>
            <span className="text-[#22C55E] font-medium">{metrics.authenticated}</span>
          </div>

          <button
            onClick={refreshStatuses}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs text-[#A4A8AF] hover:text-white transition-colors cursor-pointer disabled:opacity-50 ml-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#38BDF8]' : ''}`} />
            <span>Scan Agents</span>
          </button>
        </div>
      </div>

      {/* 2. Controls & Search Filter Bar */}
      <div className="px-8 py-3 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.04]">
        {/* Search */}
        <div className="relative w-72">
          <Search className="w-3.5 h-3.5 text-[#6C7280] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search 30 CLI agents by name or vendor..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white/[0.03] text-white placeholder-[#6C7280] rounded-lg border border-white/[0.06] focus:outline-none focus:border-white/20 transition-all font-sans"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1 text-[#8F96A3]">
            {(['all', 'installed', 'auth_required', 'not_installed'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer ${
                  statusFilter === tab
                    ? 'text-white font-medium'
                    : 'text-[#6C7280] hover:text-[#A4A8AF]'
                }`}
              >
                {tab === 'all' && 'All 30'}
                {tab === 'installed' && 'Installed'}
                {tab === 'auth_required' && 'Auth Needed'}
                {tab === 'not_installed' && 'Not Installed'}
              </button>
            ))}
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-transparent text-[#8F96A3] text-xs focus:outline-none cursor-pointer hover:text-white"
          >
            <option value="all" className="bg-[#14161b]">All Categories</option>
            <option value="Pair Programming" className="bg-[#14161b]">Pair Programming</option>
            <option value="Autonomous Agent" className="bg-[#14161b]">Autonomous Agent</option>
            <option value="Enterprise & CI" className="bg-[#14161b]">Enterprise & CI</option>
            <option value="Open Weights" className="bg-[#14161b]">Open Weights</option>
            <option value="Terminal Native" className="bg-[#14161b]">Terminal Native</option>
          </select>
        </div>
      </div>

      {/* 3. Main Workspace Split: Agent Master List + Details Drawer */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Master Agent List */}
        <div className="w-1/2 md:w-5/12 lg:w-4/12 border-r border-white/[0.04] overflow-y-auto p-4 space-y-1 custom-scrollbar">
          {filteredAgents.map((agent) => {
            const isSelected = selectedAgent.id === agent.id;
            const status = cliStatuses?.[agent.id];
            const auth = cliAuthStatuses?.[agent.id];

            return (
              <div
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-white/[0.07] text-white shadow-xs'
                    : 'text-[#A4A8AF] hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    <OfficialLogoRenderer provider={agent.id} className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs text-white truncate">{agent.name}</span>
                      <span className="text-[10px] text-[#6C7280]">{agent.vendor}</span>
                    </div>
                    <p className="text-[11px] text-[#717784] truncate">{agent.tagline}</p>
                  </div>
                </div>

                {/* Status indicator */}
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  {status?.isInstalled ? (
                    auth?.isAuthenticated ? (
                      <span className="text-[11px] text-[#22C55E] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Ready</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#EAB308] flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Auth</span>
                      </span>
                    )
                  ) : (
                    <span className="text-[11px] text-[#6B7280]">
                      Missing
                    </span>
                  )}
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isSelected ? 'text-white' : 'text-[#444850] group-hover:text-[#717784]'}`} />
                </div>
              </div>
            );
          })}

          {filteredAgents.length === 0 && (
            <div className="py-12 text-center text-[#717784] text-xs">
              No AI agents matched the search filter
            </div>
          )}
        </div>

        {/* Right: Rich Agent Details View */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          {/* Header */}
          <div className="flex items-start justify-between gap-6 pb-6 border-b border-white/[0.04]">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                <OfficialLogoRenderer provider={selectedAgent.id} className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-white tracking-tight">{selectedAgent.name}</h2>
                  <span className="text-xs text-[#717784] font-medium">{selectedAgent.vendor}</span>
                  <span className="text-[11px] text-[#818CF8] font-mono">{selectedAgent.category}</span>
                </div>
                <p className="text-xs text-[#9CA3AF] mt-1 max-w-xl">{selectedAgent.description}</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                onClick={() => handleLaunchAgent(selectedAgent)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white text-black hover:bg-neutral-200 text-xs font-medium transition-all cursor-pointer shadow-xs"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Launch Session</span>
              </button>
            </div>
          </div>

          {/* Status & Verification Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-[11px] text-[#6C7280] font-medium">Installation Status</div>
              <div className="text-xs font-medium text-white mt-1 flex items-center gap-1.5">
                {cliStatuses?.[selectedAgent.id]?.isInstalled ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" />
                    <span>Installed (v{cliStatuses[selectedAgent.id]?.version || 'active'})</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5 text-[#EF4444]" />
                    <span>Not installed in PATH</span>
                  </>
                )}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-[#6C7280] font-medium">Authentication</div>
              <div className="text-xs font-medium text-white mt-1 flex items-center gap-1.5">
                {cliAuthStatuses?.[selectedAgent.id]?.isAuthenticated ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-[#22C55E]" />
                    <span>Authenticated & Ready</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-[#EAB308]" />
                    <span>{cliAuthStatuses?.[selectedAgent.id]?.details || 'Setup Required'}</span>
                  </>
                )}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-[#6C7280] font-medium">Integration Mode</div>
              <div className="text-xs font-medium text-white mt-1 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span className="capitalize">{selectedAgent.integrationAvailability.replace('_', ' ')}</span>
              </div>
            </div>
          </div>

          {/* Installation & Guide section */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-white tracking-tight">Official Installation</div>
            <div className="flex items-center gap-3">
              <div className="flex-1 font-mono text-xs bg-white/[0.03] text-[#A4A8AF] px-3 py-2 rounded-lg border border-white/[0.06] truncate">
                {selectedAgent.installCommand}
              </div>
              <button
                onClick={() => copyToClipboard(selectedAgent.installCommand, 'install')}
                className="px-3 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-xs text-white flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                {copiedKey === 'install' ? <Check className="w-3.5 h-3.5 text-[#22C55E]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy</span>
              </button>
            </div>
            <div className="flex items-center gap-4 text-xs pt-1">
              <a
                href={selectedAgent.officialWebsite}
                target="_blank"
                rel="noreferrer"
                className="text-[#38BDF8] hover:underline flex items-center gap-1"
              >
                <span>Official Website</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href={selectedAgent.documentationUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[#38BDF8] hover:underline flex items-center gap-1"
              >
                <span>Documentation</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Configuration & Custom Path */}
          <div className="space-y-3 pt-4 border-t border-white/[0.04]">
            <div className="text-xs font-semibold text-white tracking-tight flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-[#9CA3AF]" />
              <span>Executable & Path Configuration</span>
            </div>
            <p className="text-xs text-[#8F96A3]">
              Override the automatic discovery path if you maintain a custom build or isolated virtualenv.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={customPathInput}
                onChange={(e) => setCustomPathInput(e.target.value)}
                placeholder={`Default path or custom path to ${selectedAgent.executable}...`}
                className="flex-1 px-3 py-2 text-xs bg-white/[0.03] text-white placeholder-[#6C7280] rounded-lg border border-white/[0.06] focus:outline-none focus:border-white/20 font-mono"
              />
              <button
                onClick={handleSaveCustomPath}
                className="px-3 py-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-xs text-white font-medium cursor-pointer transition-colors"
              >
                Save Path
              </button>
            </div>
          </div>

          {/* Authentication Command Guidance */}
          <div className="space-y-2 pt-4 border-t border-white/[0.04]">
            <div className="text-xs font-semibold text-white tracking-tight">Authentication Instructions</div>
            <div className="font-mono text-xs bg-white/[0.02] text-[#8F96A3] p-3 rounded-lg border border-white/[0.04]">
              {selectedAgent.authCommand}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
