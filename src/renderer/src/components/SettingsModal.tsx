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
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground select-none font-sans overflow-hidden animate-in fade-in duration-150">
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
  );
};
