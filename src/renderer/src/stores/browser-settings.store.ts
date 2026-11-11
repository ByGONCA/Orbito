import { create } from 'zustand';

export interface BrowserProfile {
  id: string;
  name: string;
  isDefault?: boolean;
}

export interface BrowserSettingsState {
  agentBrowserAccess: boolean;
  profiles: BrowserProfile[];
  activeProfileId: string;
  openLinksIn: 'embedded' | 'system';
  autoShowFloatingPreview: boolean;
  searchEngine: 'duckduckgo' | 'google' | 'bing';
  recordingFrameRate: '15' | '30' | '60';
  showKeyPressesInRecordings: boolean;
  showMousePressesInRecordings: boolean;

  setAgentBrowserAccess: (enabled: boolean) => void;
  addProfile: (name: string) => void;
  removeProfile: (id: string) => void;
  setOpenLinksIn: (val: 'embedded' | 'system') => void;
  setAutoShowFloatingPreview: (enabled: boolean) => void;
  setSearchEngine: (engine: 'duckduckgo' | 'google' | 'bing') => void;
  setRecordingFrameRate: (rate: '15' | '30' | '60') => void;
  setShowKeyPresses: (enabled: boolean) => void;
  setShowMousePresses: (enabled: boolean) => void;
}

export const useBrowserSettingsStore = create<BrowserSettingsState>((set) => ({
  agentBrowserAccess: true,
  profiles: [
    { id: 'default', name: 'Default', isDefault: true }
  ],
  activeProfileId: 'default',
  openLinksIn: 'embedded',
  autoShowFloatingPreview: true,
  searchEngine: 'duckduckgo',
  recordingFrameRate: '30',
  showKeyPressesInRecordings: false,
  showMousePressesInRecordings: false,

  setAgentBrowserAccess: (agentBrowserAccess) => set({ agentBrowserAccess }),
  addProfile: (name) => {
    const clean = name.trim();
    if (!clean) return;
    const newProfile: BrowserProfile = {
      id: `prof-${Date.now()}`,
      name: clean
    };
    set((s) => ({ profiles: [...s.profiles, newProfile] }));
  },
  removeProfile: (id) =>
    set((s) => ({
      profiles: s.profiles.filter((p) => p.id !== id || p.isDefault)
    })),
  setOpenLinksIn: (openLinksIn) => set({ openLinksIn }),
  setAutoShowFloatingPreview: (autoShowFloatingPreview) => set({ autoShowFloatingPreview }),
  setSearchEngine: (searchEngine) => set({ searchEngine }),
  setRecordingFrameRate: (recordingFrameRate) => set({ recordingFrameRate }),
  setShowKeyPresses: (showKeyPressesInRecordings) => set({ showKeyPressesInRecordings }),
  setShowMousePresses: (showMousePressesInRecordings) => set({ showMousePressesInRecordings })
}));
