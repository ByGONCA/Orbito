import React, { useState, useEffect } from 'react';
import { useWorkspaceStore } from '../stores/workspace.store';
import { SettingsHeader } from './settings/layout/SettingsHeader';
import { SettingsSidebar } from './settings/layout/SettingsSidebar';
import { SettingsContent } from './settings/layout/SettingsContent';
import {
  normalizeSettingsSection,
  SETTINGS_SECTIONS
} from './settings/registry/settings-registry';
import type { SettingsSectionId } from '../../../shared/types';

export type SettingsSection = SettingsSectionId;
export const normalizeSettingsTab = normalizeSettingsSection;

export const SettingsModal: React.FC = () => {
  const {
    isSettingsOpen,
    toggleSettings,
    settingsActiveTab,
    setSettingsActiveTab
  } = useWorkspaceStore();

  const [activeSection, setActiveSection] = useState<SettingsSectionId>(
    normalizeSettingsSection(settingsActiveTab)
  );

  useEffect(() => {
    if (settingsActiveTab) {
      setActiveSection(normalizeSettingsSection(settingsActiveTab));
    }
  }, [settingsActiveTab]);

  const handleSelectSection = (sectionId: SettingsSectionId) => {
    setActiveSection(sectionId);
    setSettingsActiveTab(sectionId);
  };

  // Keyboard shortcut listener (ESC to close)
  useEffect(() => {
    if (!isSettingsOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        toggleSettings(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen, toggleSettings]);

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col settings-modal-root text-foreground select-none font-sans overflow-hidden animate-in fade-in duration-150">
      {/* Settings ambient mesh */}
      <div
        className="absolute inset-0 pointer-events-none z-0 opacity-75"
        style={{
          background:
            'radial-gradient(36rem 28rem at 25% 25%, rgba(99, 102, 241, 0.12), transparent 60%), radial-gradient(32rem 26rem at 75% 65%, rgba(56, 189, 248, 0.08), transparent 60%)'
        }}
      />
      <div className="relative z-10 flex flex-col h-full w-full">
        <SettingsHeader
          onClose={() => toggleSettings(false)}
          onSelectSection={handleSelectSection}
        />
        <div className="flex-1 flex overflow-hidden">
          <SettingsSidebar
            activeSection={activeSection}
            onSelectSection={handleSelectSection}
          />
          <SettingsContent
            activeSection={activeSection}
            onCloseSettings={() => toggleSettings(false)}
          />
        </div>
      </div>
    </div>
  );
};
