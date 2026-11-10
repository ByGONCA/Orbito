import React from 'react';
import {
  Bot,
  Layers,
  Database,
  Blocks,
  Radio,
  Palette,
  Keyboard,
  Sliders,
  Info
} from 'lucide-react';
import type { SettingsSectionId } from '../../../../../shared/types';

export interface SettingItemMetadata {
  id: string;
  sectionId: SettingsSectionId;
  label: string;
  description: string;
  keywords: string[];
}

export interface SettingsSectionMetadata {
  id: SettingsSectionId;
  label: string;
  category: 'AI & Intelligence' | 'Workspace' | 'Interface' | 'System';
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
  settings: SettingItemMetadata[];
}

export interface SettingsCategoryGroup {
  category: 'AI & Intelligence' | 'Workspace' | 'Interface' | 'System';
  sections: SettingsSectionMetadata[];
}

export const SETTINGS_SECTIONS: SettingsSectionMetadata[] = [
  // Category: AI & Intelligence
  {
    id: 'agents',
    label: 'Agents',
    category: 'AI & Intelligence',
    description: 'Execution runtimes, CLI detection, custom executable paths, and per-agent permissions.',
    icon: Bot,
    keywords: ['agent', 'cli', 'codex', 'copilot', 'gemini', 'opencode', 'antigravity', 'claude', 'aider', 'qwen', 'kimi', 'terminal', 'permissions'],
    settings: [
      {
        id: 'agents-default-host',
        sectionId: 'agents',
        label: 'Default Host Agent',
        description: 'Choose the primary execution engine used when launching new terminal sessions.',
        keywords: ['default agent', 'host agent', 'active provider', 'primary agent']
      },
      {
        id: 'agents-discovery-scan',
        sectionId: 'agents',
        label: 'CLI Binary Discovery',
        description: 'Scan system PATH and custom directories to detect installed coding agent binaries.',
        keywords: ['detect', 'scan', 'cli path', 'installed agents', 'find binaries']
      },
      {
        id: 'agents-permissions',
        sectionId: 'agents',
        label: 'Agent Permission Boundaries',
        description: 'Configure approval requirements (Full Access, Supervised, or Read-Only) per agent runtime.',
        keywords: ['permissions', 'sandbox', 'supervised', 'approval', 'full access', 'read only']
      }
    ]
  },
  {
    id: 'orchestration',
    label: 'Orchestration',
    category: 'AI & Intelligence',
    description: 'Multi-agent coordination DAG architecture and pending approval resolution queue.',
    icon: Layers,
    keywords: ['orchestration', 'coordinator', 'multi-agent', 'dag', 'tasks', 'scheduler', 'approvals'],
    settings: [
      {
        id: 'orchestration-architecture',
        sectionId: 'orchestration',
        label: 'Multi-Agent Execution Pipeline',
        description: 'Inspect Coordinator Agent DAG planning and parallel task scheduler architecture.',
        keywords: ['dag', 'coordinator', 'scheduler', 'worktree execution']
      },
      {
        id: 'orchestration-pending-approvals',
        sectionId: 'orchestration',
        label: 'Pending Task Approvals',
        description: 'Review and approve or reject tasks waiting for human confirmation.',
        keywords: ['approvals', 'confirm', 'pending tasks', 'decision']
      }
    ]
  },
  {
    id: 'memory',
    label: 'Memory',
    category: 'AI & Intelligence',
    description: 'Persistent agent memory records across global, workspace, project, task, and session tiers.',
    icon: Database,
    keywords: ['memory', 'context', 'tier', 'global', 'workspace', 'project', 'task', 'session', 'cache', 'sqlite'],
    settings: [
      {
        id: 'memory-records',
        sectionId: 'memory',
        label: 'Cross-Session Memory Records',
        description: 'Inspect, search, and delete persistent memory entries stored in local SQLite.',
        keywords: ['memories', 'search memory', 'delete memory', 'entity key']
      },
      {
        id: 'memory-tiers',
        sectionId: 'memory',
        label: 'Tier Filtering',
        description: 'Filter memories by scope: Global, Workspace, Project, Task, or Session.',
        keywords: ['tier filter', 'scope', 'session memory', 'project memory']
      }
    ]
  },

  // Category: Workspace
  {
    id: 'plugins',
    label: 'Plugins',
    category: 'Workspace',
    description: 'Extension Host architecture, process limits, local plugin directory, and marketplace hub.',
    icon: Blocks,
    keywords: ['plugins', 'extensions', 'host', 'ecosystem', 'marketplace', 'concurrency'],
    settings: [
      {
        id: 'plugins-host-architecture',
        sectionId: 'plugins',
        label: 'Extension Host Architecture',
        description: 'Sandboxed Node.js child processes with 128 MB memory limits and 5-host concurrency cap.',
        keywords: ['extension host', 'memory limit', 'concurrency limit', 'child process']
      },
      {
        id: 'plugins-local-storage',
        sectionId: 'plugins',
        label: 'Local Extensions Directory',
        description: 'Location where installed plugins and manifests are stored in local workspace data.',
        keywords: ['plugin path', 'extension directory', 'ai-workspace-data']
      }
    ]
  },
  {
    id: 'integrations',
    label: 'Integrations',
    category: 'Workspace',
    description: 'External service connections and Discord Rich Presence live desktop status daemon.',
    icon: Radio,
    keywords: ['integrations', 'discord', 'rich presence', 'rpc', 'status', 'client id'],
    settings: [
      {
        id: 'integrations-discord-rpc',
        sectionId: 'integrations',
        label: 'Discord Rich Presence',
        description: 'Broadcast active project name, workspace status, and elapsed time to local Discord.',
        keywords: ['discord', 'rich presence', 'rpc', 'presence', 'client id']
      }
    ]
  },

  // Category: Interface
  {
    id: 'appearance',
    label: 'Appearance',
    category: 'Interface',
    description: 'Window material styling, file explorer iconography, and Git status indicators.',
    icon: Palette,
    keywords: ['appearance', 'theme', 'glassmorphism', 'solid', 'icons', 'vscode icons', 'git colors', 'ui'],
    settings: [
      {
        id: 'appearance-theme-material',
        sectionId: 'appearance',
        label: 'Theme Material Architecture',
        description: 'Switch between dark Glassmorphism translucent surfaces and Solid Dark opaque panels.',
        keywords: ['theme', 'glass', 'solid', 'dark mode', 'glassmorphism']
      },
      {
        id: 'appearance-file-icons',
        sectionId: 'appearance',
        label: 'File Explorer Icon Theme',
        description: 'Select between Material Icon Theme or Minimal Monochrome.',
        keywords: ['file icons', 'icon theme', 'material icons', 'minimal']
      },
      {
        id: 'appearance-git-colors',
        sectionId: 'appearance',
        label: 'Source Control File Colors',
        description: 'Color-code modified, untracked, and deleted files in the project tree.',
        keywords: ['git colors', 'modified files', 'status colors']
      }
    ]
  },
  {
    id: 'shortcuts',
    label: 'Shortcuts',
    category: 'Interface',
    description: 'Keyboard shortcuts customization with Discord-style key recording and conflict detection.',
    icon: Keyboard,
    keywords: ['shortcuts', 'keyboard', 'keybinds', 'hotkeys', 'key combo', 'keybindings'],
    settings: [
      {
        id: 'shortcuts-recorder',
        sectionId: 'shortcuts',
        label: 'Custom Keybindings',
        description: 'Rebind any workspace action by clicking and pressing the desired key combination.',
        keywords: ['record key', 'rebind', 'hotkey', 'reset shortcut']
      }
    ]
  },

  // Category: System
  {
    id: 'general',
    label: 'General',
    category: 'System',
    description: 'Application background preferences, system keep-awake power blocker, and workspace defaults.',
    icon: Sliders,
    keywords: ['general', 'power', 'keep awake', 'auto index', 'system', 'startup'],
    settings: [
      {
        id: 'general-keep-awake',
        sectionId: 'general',
        label: 'System Keep-Awake Daemon',
        description: 'Prevent OS sleep or suspension while long-running autonomous tasks are active.',
        keywords: ['keep awake', 'power save blocker', 'sleep', 'prevent suspension']
      },
      {
        id: 'general-auto-indexing',
        sectionId: 'general',
        label: 'Workspace Auto-Indexing',
        description: 'Automatically analyze repository AST and symbol graphs upon opening a project.',
        keywords: ['auto index', 'indexing', 'ast', 'graphify']
      }
    ]
  },
  {
    id: 'about',
    label: 'About',
    category: 'System',
    description: 'Orbito desktop version, platform runtime specifications, and dual SQLite WAL persistence status.',
    icon: Info,
    keywords: ['about', 'version', 'electron', 'node', 'sqlite', 'wal', 'diagnostics', 'license'],
    settings: [
      {
        id: 'about-version-info',
        sectionId: 'about',
        label: 'System & Runtime Specifications',
        description: 'Orbito 0.1.0 Desktop build, Electron 34, Node 20 runtime, and SQLite WAL diagnostics.',
        keywords: ['version', 'build', 'electron', 'node', 'sqlite', 'specs']
      }
    ]
  }
];

export const SETTINGS_CATEGORIES: SettingsCategoryGroup[] = [
  {
    category: 'AI & Intelligence',
    sections: SETTINGS_SECTIONS.filter((s) => s.category === 'AI & Intelligence')
  },
  {
    category: 'Workspace',
    sections: SETTINGS_SECTIONS.filter((s) => s.category === 'Workspace')
  },
  {
    category: 'Interface',
    sections: SETTINGS_SECTIONS.filter((s) => s.category === 'Interface')
  },
  {
    category: 'System',
    sections: SETTINGS_SECTIONS.filter((s) => s.category === 'System')
  }
];

export const SETTINGS_CATEGORIES_GROUPED = SETTINGS_CATEGORIES;

export interface SearchResult {
  sectionId: SettingsSectionId;
  sectionLabel: string;
  settingId?: string;
  settingLabel?: string;
  description: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * Searches the entire settings manifest and returns matching sections and specific settings.
 */
export function searchSettingsRegistry(query: string): SearchResult[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const results: SearchResult[] = [];

  for (const section of SETTINGS_SECTIONS) {
    const sectionMatch =
      section.label.toLowerCase().includes(normalized) ||
      section.id.toLowerCase().includes(normalized) ||
      section.description.toLowerCase().includes(normalized) ||
      section.keywords.some((kw) => kw.toLowerCase().includes(normalized));

    if (sectionMatch) {
      results.push({
        sectionId: section.id,
        sectionLabel: section.label,
        description: section.description,
        category: section.category,
        icon: section.icon
      });
    }

    for (const setting of section.settings) {
      const settingMatch =
        setting.label.toLowerCase().includes(normalized) ||
        setting.description.toLowerCase().includes(normalized) ||
        setting.keywords.some((kw) => kw.toLowerCase().includes(normalized));

      if (settingMatch) {
        results.push({
          sectionId: section.id,
          sectionLabel: section.label,
          settingId: setting.id,
          settingLabel: setting.label,
          description: setting.description,
          category: section.category,
          icon: section.icon
        });
      }
    }
  }

  // De-duplicate results matching both section and setting
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = `${r.sectionId}-${r.settingId || 'root'}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Normalizes legacy tab strings to one of the verified active section IDs.
 */
export function normalizeSettingsSection(rawId?: string | null): SettingsSectionId {
  if (!rawId) return 'agents';
  switch (rawId) {
    case 'agents':
    case 'computer-use':
    case 'automations':
    case 'providers':
    case 'ai-providers':
    case 'security':
    case 'keyring':
    case 'git':
    case 'workspace':
    case 'general-git':
    case 'task-sources':
    case 'session-search':
    case 'browser':
    case 'artifacts':
    case 'share-skills':
    case 'mobile':
      return 'agents';
    case 'orchestration':
      return 'orchestration';
    case 'memory':
      return 'memory';
    case 'plugins':
      return 'plugins';
    case 'integrations':
    case 'linear':
    case 'voice':
    case 'discord':
      return 'integrations';
    case 'appearance':
    case 'chat-ui':
      return 'appearance';
    case 'shortcuts':
    case 'quick-commands':
      return 'shortcuts';
    case 'general':
      return 'general';
    case 'about':
    case 'orca-account':
    case 'stats-usage':
      return 'about';
    default:
      return 'agents';
  }
}
