import { create } from 'zustand';

export interface SnapShotsSettingsState {
  enabled: boolean;
  includeAppText: boolean;
  captureShortcut: string;
  captureSound: 'whoosh' | 'shutter' | 'chime' | 'silent';
  captureFlash: boolean;
  captureAnimations: boolean;

  setEnabled: (enabled: boolean) => void;
  setIncludeAppText: (include: boolean) => void;
  setCaptureShortcut: (shortcut: string) => void;
  setCaptureSound: (sound: 'whoosh' | 'shutter' | 'chime' | 'silent') => void;
  setCaptureFlash: (flash: boolean) => void;
  setCaptureAnimations: (anim: boolean) => void;
}

export const useSnapShotsSettingsStore = create<SnapShotsSettingsState>((set) => ({
  enabled: true,
  includeAppText: true,
  captureShortcut: 'Shift Shift',
  captureSound: 'whoosh',
  captureFlash: true,
  captureAnimations: true,

  setEnabled: (enabled) => set({ enabled }),
  setIncludeAppText: (includeAppText) => set({ includeAppText }),
  setCaptureShortcut: (captureShortcut) => set({ captureShortcut }),
  setCaptureSound: (captureSound) => set({ captureSound }),
  setCaptureFlash: (captureFlash) => set({ captureFlash }),
  setCaptureAnimations: (captureAnimations) => set({ captureAnimations })
}));
