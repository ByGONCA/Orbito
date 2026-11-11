import React from 'react';
import {
  Sliders,
  Palette,
  Keyboard,
  Mic,
  Crop,
  Globe,
  Smartphone,
  Bot,
  Layers,
  Database,
  Blocks,
  Radio,
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
  category: 'Interface' | 'Tools & AI' | 'Agents & Engine' | 'System';
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
  badge?: string;
  disabled?: boolean;
  settings: SettingItemMetadata[];
}

export interface SettingsCategoryGroup {
  category: 'Interface' | 'Tools & AI' | 'Agents & Engine' | 'System';
  sections: SettingsSectionMetadata[];
}

export const SETTINGS_SECTIONS: SettingsSectionMetadata[] = [
  // Category 1: Interface
  {
    id: 'general',
    label: 'General',
    category: 'Interface',
    description: 'Application background preferences, system keep-awake power blocker, and workspace defaults.',
    icon: Sliders,
    keywords: ['general', 'power', 'keep awake', 'auto index', 'system', 'startup'],
    settings: [
      {
        id: 'general-keep-awake',
        sectionId: 'general',
        label: 'System Keep-Awake Daemon',
        description: 'Prevent OS sleep or suspension while long-running autonomous tasks are active.',
        keywords: ['keep awake', 'power save blocker', 'sleep']
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
    id: 'appearance',
    label: 'Appearance',
    category: 'Interface',
    description: 'Window material styling, file explorer iconography, and Git status indicators.',
    icon: Palette,
    keywords: ['appearance', 'theme', 'glassmorphism', 'solid', 'icons', 'git colors', 'ui'],
    settings: [
      {
        id: 'appearance-theme-material',
        sectionId: 'appearance',
        label: 'Theme Material Architecture',
        description: 'Switch between dark Glassmorphism translucent surfaces and Solid Dark opaque panels.',
        keywords: ['theme', 'glass', 'solid', 'dark mode']
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
    id: 'keybindings',
    label: 'Keybindings',
    category: 'Interface',
    description: 'Keyboard shortcuts customization with Discord-style key recording and conflict detection.',
    icon: Keyboard,
    keywords: ['shortcuts', 'keyboard', 'keybinds', 'hotkeys', 'key combo', 'keybindings'],
    settings: [
      {
        id: 'shortcuts-recorder',
        sectionId: 'keybindings',
        label: 'Custom Keybindings',
        description: 'Rebind any workspace action by clicking and pressing the desired key combination.',
        keywords: ['record key', 'rebind', 'hotkey']
      }
    ]
  },

  // Category 2: Tools & AI
  {
    id: 'voice',
    label: 'Voice',
    category: 'Tools & AI',
    description: 'Microphone input testing, dictation shortcuts, speech-to-text transcription, and project dictionaries.',
    icon: Mic,
    keywords: ['voice', 'speech to text', 'stt', 'dictation', 'microphone', 'whisper', 'audio'],
    settings: [
      {
        id: 'voice-microphone',
        sectionId: 'voice',
        label: 'Microphone & Input Audio',
        description: 'Select system audio device, record 10-second test audio and monitor audio level.',
        keywords: ['mic', 'microphone', 'test audio', 'input device']
      },
      {
        id: 'voice-transcription',
        sectionId: 'voice',
        label: 'Speech-to-Text Transcription',
        description: 'Configure real-time voice transcription engine and silence filter.',
        keywords: ['transcribe', 'stt', 'speech recognition', 'whisper']
      }
    ]
  },
  {
    id: 'snapshots',
    label: 'SnapShots',
    category: 'Tools & AI',
    description: 'Capture active window states, app text inclusion, capture shortcuts, and sound effects.',
    icon: Crop,
    keywords: ['snapshots', 'capture', 'window', 'screenshot', 'whoosh'],
    settings: [
      {
        id: 'snapshots-capture',
        sectionId: 'snapshots',
        label: 'Window SnapShots',
        description: 'Capture active workspace windows and attach them directly to current drafts.',
        keywords: ['snapshot', 'window capture', 'shortcut']
      }
    ]
  },
  {
    id: 'browser',
    label: 'Browser',
    category: 'Tools & AI',
    description: 'Agent browser access, profile isolation, in-app split preview, search engines, and recording fps.',
    icon: Globe,
    keywords: ['browser', 'web', 'split terminal', 'profiles', 'duckduckgo', 'google', 'recordings'],
    settings: [
      {
        id: 'browser-agent-access',
        sectionId: 'browser',
        label: 'Agent Browser Access',
        description: 'Allow autonomous agents to interact with shared in-app browser sessions.',
        keywords: ['agent browser', 'shared browser']
      },
      {
        id: 'browser-profiles',
        sectionId: 'browser',
        label: 'Browser Profiles & Cookies',
        description: 'Separate sessions, logins, and isolated cookies across projects.',
        keywords: ['profiles', 'cookies', 'incognito']
      }
    ]
  },
  {
    id: 'devices',
    label: 'Devices',
    category: 'Tools & AI',
    description: 'Mobile companion pairing, iOS/Android screen mirroring, and hardware emulator tethering.',
    icon: Smartphone,
    badge: 'Soon',
    disabled: true,
    keywords: ['devices', 'phone', 'mobile', 'android', 'ios', 'emulator'],
    settings: []
  },

  // Category 3: Agents & Engine
  {
    id: 'providers',
    label: 'Providers',
    category: 'Agents & Engine',
    description: 'Execution runtimes, CLI detection, custom executable paths, and per-agent permissions.',
    icon: Bot,
    keywords: ['providers', 'agents', 'cli', 'codex', 'copilot', 'gemini', 'opencode', 'antigravity', 'claude'],
    settings: [
      {
        id: 'agents-default-host',
        sectionId: 'providers',
        label: 'Default Host Agent',
        description: 'Choose the primary execution engine used when launching new terminal sessions.',
        keywords: ['default agent', 'host agent', 'provider']
      },
      {
        id: 'agents-discovery-scan',
        sectionId: 'providers',
        label: 'CLI Binary Discovery',
        description: 'Scan system PATH and custom directories to detect installed coding agent binaries.',
        keywords: ['detect', 'scan', 'cli path', 'installed agents']
      }
    ]
  },
  {
    id: 'orchestration',
    label: 'Orchestration',
    category: 'Agents & Engine',
    description: 'Multi-agent coordination DAG architecture and pending approval resolution queue.',
    icon: Layers,
    keywords: ['orchestration', 'coordinator', 'multi-agent', 'dag', 'tasks', 'scheduler', 'approvals'],
    settings: [
      {
        id: 'orchestration-architecture',
        sectionId: 'orchestration',
        label: 'Multi-Agent Execution Pipeline',
        description: 'Inspect Coordinator Agent DAG planning and parallel task scheduler architecture.',
        keywords: ['dag', 'coordinator', 'scheduler']
      }
    ]
  },
  {
    id: 'memory',
    label: 'Memory',
    category: 'Agents & Engine',
    description: 'Persistent agent memory records across global, workspace, project, task, and session tiers.',
    icon: Database,
    keywords: ['memory', 'context', 'tier', 'global', 'workspace', 'project', 'sqlite'],
    settings: [
      {
        id: 'memory-records',
        sectionId: 'memory',
        label: 'Cross-Session Memory Records',
        description: 'Inspect, search, and delete persistent memory entries stored in local SQLite.',
        keywords: ['memories', 'search memory', 'delete memory']
      }
    ]
  },

  // Category 4: System
  {
    id: 'plugins',
    label: 'Plugins',
    category: 'System',
    description: 'Extension host architecture, sandbox memory limits, local plugin directory, and marketplace hub.',
    icon: Blocks,
    keywords: ['plugins', 'extensions', 'marketplace', 'concurrency'],
    settings: [
      {
        id: 'plugins-host-architecture',
        sectionId: 'plugins',
        label: 'Extension Host Architecture',
        description: 'Sandboxed Node.js child processes with 128 MB memory limits and 5-host concurrency cap.',
        keywords: ['extension host', 'memory limit']
      }
    ]
  },
  {
    id: 'integrations',
    label: 'Integrations',
    category: 'System',
    description: 'External service connections and Discord Rich Presence live desktop status daemon.',
    icon: Radio,
    keywords: ['integrations', 'discord', 'rpc', 'status'],
    settings: [
      {
        id: 'integrations-discord-rpc',
        sectionId: 'integrations',
        label: 'Discord Rich Presence',
        description: 'Broadcast active project name, workspace status, and elapsed time to local Discord.',
        keywords: ['discord', 'rich presence', 'rpc']
      }
    ]
  },
  {
    id: 'about',
    label: 'About',
    category: 'System',
    description: 'Orbito desktop version, platform runtime specifications, and dual SQLite WAL persistence status.',
    icon: Info,
    keywords: ['about', 'version', 'electron', 'node', 'sqlite', 'specs'],
    settings: [
      {
        id: 'about-version-info',
        sectionId: 'about',
        label: 'System & Runtime Specifications',
        description: 'Orbito 0.1.0 Desktop build, Electron 34, Node 20 runtime, and SQLite WAL diagnostics.',
        keywords: ['version', 'build', 'electron', 'node', 'sqlite']
      }
    ]
  }
];

export const SETTINGS_CATEGORIES_GROUPED: SettingsCategoryGroup[] = [
  {
    category: 'Interface',
    sections: SETTINGS_SECTIONS.filter((s) => s.category === 'Interface')
  },
  {
    category: 'Tools & AI',
    sections: SETTINGS_SECTIONS.filter((s) => s.category === 'Tools & AI')
  },
  {
    category: 'Agents & Engine',
    sections: SETTINGS_SECTIONS.filter((s) => s.category === 'Agents & Engine')
  },
  {
    category: 'System',
    sections: SETTINGS_SECTIONS.filter((s) => s.category === 'System')
  }
];

export function normalizeSettingsSection(rawId?: string | null): SettingsSectionId {
  if (!rawId) return 'general';

  // Normalize aliases
  if (rawId === 'shortcuts') return 'keybindings';
  if (rawId === 'agents') return 'providers';
  if (rawId === 'ai-providers') return 'providers';

  const valid = SETTINGS_SECTIONS.find((s) => s.id === rawId);
  if (valid) return valid.id;

  return 'general';
}

export interface SearchResult {
  sectionId: SettingsSectionId;
  sectionLabel: string;
  settingId?: string;
  settingLabel?: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function searchSettingsRegistry(query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: SearchResult[] = [];

  for (const section of SETTINGS_SECTIONS) {
    if (section.disabled) continue;

    const sectionMatched =
      section.label.toLowerCase().includes(q) ||
      section.description.toLowerCase().includes(q) ||
      section.keywords.some((kw) => kw.toLowerCase().includes(q));

    if (sectionMatched) {
      results.push({
        sectionId: section.id,
        sectionLabel: section.label,
        description: section.description,
        icon: section.icon
      });
    }

    for (const setting of section.settings) {
      const settingMatched =
        setting.label.toLowerCase().includes(q) ||
        setting.description.toLowerCase().includes(q) ||
        setting.keywords.some((kw) => kw.toLowerCase().includes(q));

      if (settingMatched) {
        results.push({
          sectionId: section.id,
          sectionLabel: section.label,
          settingId: setting.id,
          settingLabel: setting.label,
          description: setting.description,
          icon: section.icon
        });
      }
    }
  }

  return results.slice(0, 8);
}
