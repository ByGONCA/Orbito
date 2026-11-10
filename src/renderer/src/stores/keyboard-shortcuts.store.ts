import { create } from 'zustand';

export type ShortcutCategory =
  | 'Navigation'
  | 'Windows & Panels'
  | 'Terminals'
  | 'General'
  | 'Navegação'
  | 'Janelas & Painéis'
  | 'Terminais'
  | 'Geral';

export interface ShortcutDefinition {
  id: string;
  label: string;
  category: ShortcutCategory;
  defaultCombo: string; // e.g. "Ctrl+K"
  currentCombo: string;
  description: string;
}

const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  {
    id: 'commandPalette',
    label: 'Command Palette',
    category: 'General',
    defaultCombo: 'Ctrl+K',
    currentCombo: 'Ctrl+K',
    description: 'Open global search for files, actions, and workspace commands.'
  },
  {
    id: 'toggleLeftSidebar',
    label: 'Toggle Left Sidebar',
    category: 'Windows & Panels',
    defaultCombo: 'Ctrl+B',
    currentCombo: 'Ctrl+B',
    description: 'Expand or collapse the project navigation sidebar.'
  },
  {
    id: 'toggleRightPanel',
    label: 'Toggle Right Panel',
    category: 'Windows & Panels',
    defaultCombo: 'Ctrl+Shift+B',
    currentCombo: 'Ctrl+Shift+B',
    description: 'Show or hide the file explorer, agents, and context panel.'
  },
  {
    id: 'toggleBottomPanel',
    label: 'Toggle Bottom Terminal Panel',
    category: 'Windows & Panels',
    defaultCombo: 'Ctrl+`',
    currentCombo: 'Ctrl+`',
    description: 'Open or close the bottom terminal and diagnostics panel.'
  },
  {
    id: 'newTerminal',
    label: 'New Terminal',
    category: 'Terminals',
    defaultCombo: 'Ctrl+Shift+`',
    currentCombo: 'Ctrl+Shift+`',
    description: 'Create a new terminal session in the active project or worktree.'
  },
  {
    id: 'splitTerminal',
    label: 'Split Terminal',
    category: 'Terminals',
    defaultCombo: 'Ctrl+\\',
    currentCombo: 'Ctrl+\\',
    description: 'Split the terminal horizontally or vertically for multitasking.'
  },
  {
    id: 'openBrowser',
    label: 'Open Browser Tab',
    category: 'Navigation',
    defaultCombo: 'Ctrl+Shift+U',
    currentCombo: 'Ctrl+Shift+U',
    description: 'Open the embedded web browser directly in the workspace canvas.'
  },
  {
    id: 'openArcLauncher',
    label: 'Command Launcher (Arc Launcher)',
    category: 'General',
    defaultCombo: 'Ctrl+T',
    currentCombo: 'Ctrl+T',
    description: 'Launch quick commands and omni-directional search.'
  },
  {
    id: 'openSettings',
    label: 'Workspace Settings',
    category: 'General',
    defaultCombo: 'Ctrl+,',
    currentCombo: 'Ctrl+,',
    description: 'Open settings modal, integrations, and keyboard shortcuts.'
  }
];

const STORAGE_KEY = 'orbito_keybindings_v1';

function loadPersistedShortcuts(): ShortcutDefinition[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SHORTCUTS;
    const parsed = JSON.parse(raw);
    return DEFAULT_SHORTCUTS.map((item) => ({
      ...item,
      currentCombo: parsed[item.id] || item.defaultCombo
    }));
  } catch {
    return DEFAULT_SHORTCUTS;
  }
}

interface KeyboardShortcutsState {
  shortcuts: ShortcutDefinition[];
  recordingId: string | null;
  setRecordingId: (id: string | null) => void;
  updateShortcut: (id: string, newCombo: string) => void;
  resetShortcut: (id: string) => void;
  resetAllToDefault: () => void;
  matchesEvent: (id: string, e: KeyboardEvent) => boolean;
}

export const useKeyboardShortcutsStore = create<KeyboardShortcutsState>((set, get) => ({
  shortcuts: loadPersistedShortcuts(),
  recordingId: null,

  setRecordingId: (recordingId) => set({ recordingId }),

  updateShortcut: (id, newCombo) => {
    set((state) => {
      const updated = state.shortcuts.map((s) => (s.id === id ? { ...s, currentCombo: newCombo } : s));
      try {
        const toSave: Record<string, string> = {};
        for (const s of updated) toSave[s.id] = s.currentCombo;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      } catch {}
      return { shortcuts: updated, recordingId: null };
    });
  },

  resetShortcut: (id) => {
    set((state) => {
      const updated = state.shortcuts.map((s) => (s.id === id ? { ...s, currentCombo: s.defaultCombo } : s));
      try {
        const toSave: Record<string, string> = {};
        for (const s of updated) toSave[s.id] = s.currentCombo;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      } catch {}
      return { shortcuts: updated, recordingId: null };
    });
  },

  resetAllToDefault: () => {
    set({ shortcuts: DEFAULT_SHORTCUTS, recordingId: null });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  },

  matchesEvent: (id, e) => {
    const shortcut = get().shortcuts.find((s) => s.id === id);
    if (!shortcut || !shortcut.currentCombo) return false;

    const parts = shortcut.currentCombo.split('+').map((p) => p.trim().toLowerCase());
    const needsCtrl = parts.includes('ctrl');
    const needsShift = parts.includes('shift');
    const needsAlt = parts.includes('alt');
    const needsMeta = parts.includes('meta') || parts.includes('cmd');

    const keyPart = parts.find((p) => !['ctrl', 'shift', 'alt', 'meta', 'cmd'].includes(p)) || '';

    const hasCtrl = e.ctrlKey;
    const hasShift = e.shiftKey;
    const hasAlt = e.altKey;
    const hasMeta = e.metaKey;

    if (needsCtrl !== hasCtrl) return false;
    if (needsShift !== hasShift) return false;
    if (needsAlt !== hasAlt) return false;
    if (needsMeta !== hasMeta) return false;

    const eventKey = e.key.toLowerCase();

    // Map common key aliases
    if (keyPart === '`' && (eventKey === '`' || eventKey === '~')) return true;
    if (keyPart === '\\' && eventKey === '\\') return true;
    if (keyPart === ',' && eventKey === ',') return true;

    return eventKey === keyPart;
  }
}));

export function formatKeyComboFromEvent(e: KeyboardEvent): string | null {
  // If only modifier is pressed, don't finalize yet
  if (['Control', 'Shift', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) {
    return null;
  }

  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');
  if (e.metaKey) parts.push('Meta');

  let keyName = e.key;
  if (keyName === ' ') keyName = 'Space';
  else if (keyName.length === 1) keyName = keyName.toUpperCase();

  parts.push(keyName);
  return parts.join('+');
}
