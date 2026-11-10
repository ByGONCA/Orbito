import React from 'react';
import type { SettingsSectionId } from '../../../../../shared/types';
import { AgentsPage } from '../pages/AgentsPage';
import { ProvidersPage } from '../pages/ProvidersPage';
import { OrchestrationPage } from '../pages/OrchestrationPage';
import { MemoryPage } from '../pages/MemoryPage';
import { SecurityPage } from '../pages/SecurityPage';
import { GitPage } from '../pages/GitPage';
import { PluginsPage } from '../pages/PluginsPage';
import { IntegrationsPage } from '../pages/IntegrationsPage';
import { AppearancePage } from '../pages/AppearancePage';
import { ShortcutsPage } from '../pages/ShortcutsPage';
import { GeneralPage } from '../pages/GeneralPage';
import { AboutPage } from '../pages/AboutPage';

interface SettingsContentProps {
  activeSection: SettingsSectionId;
  onCloseSettings: () => void;
}

export const SettingsContent: React.FC<SettingsContentProps> = ({
  activeSection,
  onCloseSettings
}) => {
  return (
    <main className="flex-1 overflow-y-auto px-8 py-6 max-w-4xl">
      {activeSection === 'agents' && <AgentsPage />}
      {activeSection === 'providers' && <ProvidersPage />}
      {activeSection === 'orchestration' && <OrchestrationPage />}
      {activeSection === 'memory' && <MemoryPage />}
      {activeSection === 'security' && <SecurityPage />}
      {activeSection === 'git' && <GitPage />}
      {activeSection === 'plugins' && <PluginsPage onCloseSettings={onCloseSettings} />}
      {activeSection === 'integrations' && <IntegrationsPage />}
      {activeSection === 'appearance' && <AppearancePage />}
      {activeSection === 'shortcuts' && <ShortcutsPage />}
      {activeSection === 'general' && <GeneralPage />}
      {activeSection === 'about' && <AboutPage />}
    </main>
  );
};
