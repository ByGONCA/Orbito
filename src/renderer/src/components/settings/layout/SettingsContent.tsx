import React from 'react';
import type { SettingsSectionId } from '../../../../../shared/types';
import { VoicePage } from '../pages/VoicePage';
import { SnapShotsPage } from '../pages/SnapShotsPage';
import { BrowserPage } from '../pages/BrowserPage';
import { DevicesPage } from '../pages/DevicesPage';
import { KeybindingsPage } from '../pages/ShortcutsPage';
import { GeneralPage } from '../pages/GeneralPage';
import { AppearancePage } from '../pages/AppearancePage';
import { AgentsPage } from '../pages/AgentsPage';
import { IntegrationsPage } from '../pages/IntegrationsPage';
import { PluginsPage } from '../pages/PluginsPage';
import { AboutPage } from '../pages/AboutPage';
import { OrchestrationPage } from '../pages/OrchestrationPage';
import { MemoryPage } from '../pages/MemoryPage';

interface SettingsContentProps {
  activeSection: SettingsSectionId;
  onCloseSettings: () => void;
}

export const SettingsContent: React.FC<SettingsContentProps> = ({
  activeSection,
  onCloseSettings
}) => {
  return (
    <main className="flex-1 overflow-y-auto bg-[#0a0b0e] flex flex-col min-h-0 select-none font-sans text-xs">
      <div className="flex-1 px-10 py-7 max-w-4xl w-full">
        {activeSection === 'general' && <GeneralPage />}
        {activeSection === 'appearance' && <AppearancePage />}
        {(activeSection === 'keybindings' || activeSection === 'shortcuts') && <KeybindingsPage />}
        {activeSection === 'voice' && <VoicePage onCloseSettings={onCloseSettings} />}
        {activeSection === 'snapshots' && <SnapShotsPage onCloseSettings={onCloseSettings} />}
        {activeSection === 'browser' && <BrowserPage onCloseSettings={onCloseSettings} />}
        {activeSection === 'devices' && <DevicesPage />}
        {(activeSection === 'providers' || activeSection === 'agents') && <AgentsPage />}
        {activeSection === 'orchestration' && <OrchestrationPage />}
        {activeSection === 'memory' && <MemoryPage />}
        {activeSection === 'plugins' && <PluginsPage onCloseSettings={onCloseSettings} />}
        {activeSection === 'integrations' && <IntegrationsPage />}
        {activeSection === 'about' && <AboutPage />}
      </div>
    </main>
  );
};
