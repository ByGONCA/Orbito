import { create } from 'zustand';

export interface ShortcutDefinition {
  id: string;
  label: string;
  category: 'Navegação' | 'Janelas & Painéis' | 'Terminais' | 'Geral';
  defaultCombo: string; // e.g. "Ctrl+K"
  currentCombo: string;
  description: string;
}

const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  {
    id: 'commandPalette',
    label: 'Paleta de Comandos',
    category: 'Geral',
    defaultCombo: 'Ctrl+K',
    currentCombo: 'Ctrl+K',
    description: 'Abre a pesquisa global de ficheiros, ações e comandos do workspace.'
  },
  {
    id: 'toggleLeftSidebar',
    label: 'Alternar Barra Lateral Esquerda',
    category: 'Janelas & Painéis',
    defaultCombo: 'Ctrl+B',
    currentCombo: 'Ctrl+B',
    description: 'Expande ou recolhe a barra lateral de projetos e navegação.'
  },
  {
    id: 'toggleRightPanel',
    label: 'Alternar Painel Direito',
    category: 'Janelas & Painéis',
    defaultCombo: 'Ctrl+Shift+B',
    currentCombo: 'Ctrl+Shift+B',
    description: 'Mostra ou oculta o explorador de ficheiros, agentes e contexto.'
  },
  {
    id: 'newTerminal',
    label: 'Novo Terminal',
    category: 'Terminais',
    defaultCombo: 'Ctrl+Shift+`',
    currentCombo: 'Ctrl+Shift+`',
    description: 'Cria uma nova sessão de terminal no projeto ou worktree ativo.'
  },
  {
    id: 'splitTerminal',
    label: 'Dividir Terminal (Split)',
    category: 'Terminais',
    defaultCombo: 'Ctrl+\\',
    currentCombo: 'Ctrl+\\',
    description: 'Divide o terminal horizontal ou verticalmente para multitarefa.'
  },
  {
    id: 'openBrowser',
    label: 'Abrir Separador do Navegador',
    category: 'Navegação',
    defaultCombo: 'Ctrl+Shift+U',
    currentCombo: 'Ctrl+Shift+U',
    description: 'Abre o browser web embutido diretamente no canvas de trabalho.'
  },
  {
    id: 'openArcLauncher',
    label: 'Lançador de Comandos (Arc Launcher)',
    category: 'Geral',
    defaultCombo: 'Ctrl+T',
    currentCombo: 'Ctrl+T',
    description: 'Lança comandos rápidos e pesquisa omni-direcional.'
  },
  {
    id: 'openSettings',
    label: 'Definições do Workspace',
    category: 'Geral',
    defaultCombo: 'Ctrl+,',
    currentCombo: 'Ctrl+,',
    description: 'Abre a janela de definições, integrações e atalhos.'
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
