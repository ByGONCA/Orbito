import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Moon,
  Zap,
  FolderSearch,
  Power
} from 'lucide-react';
import { SettingSection } from '../common/SettingSection';
import { SettingRow } from '../common/SettingRow';
import { SettingToggle } from '../common/SettingToggle';
import { useWorkspaceStore } from '../../../stores/workspace.store';

export const GeneralPage: React.FC = () => {
  const addLog = useWorkspaceStore((state) => state.addLog);
  const [keepAwake, setKeepAwake] = useState(false);
  const [isTogglingKeepAwake, setIsTogglingKeepAwake] = useState(false);
  const [autoIndex, setAutoIndex] = useState(true);

  useEffect(() => {
    window.api?.getKeepAwake?.()
      .then((res) => setKeepAwake(res?.enabled || false))
      .catch(() => {});

    window.api?.getSettings?.()
      .then((cfg) => {
        if (typeof cfg?.autoIndex === 'boolean') {
          setAutoIndex(cfg.autoIndex);
        }
      })
      .catch(() => {});
  }, []);

  const handleToggleKeepAwake = async (enabled: boolean) => {
    setIsTogglingKeepAwake(true);
    try {
      const res = await window.api.toggleKeepAwake(enabled);
      setKeepAwake(res.enabled);
      addLog(
        `Keep-Awake power blocker ${res.enabled ? 'activated' : 'deactivated'}.`,
        'info'
      );
    } catch (err: any) {
      addLog(`Failed to toggle Keep-Awake: ${err.message}`, 'error');
    } finally {
      setIsTogglingKeepAwake(false);
    }
  };

  const handleToggleAutoIndex = async (enabled: boolean) => {
    setAutoIndex(enabled);
    try {
      await window.api.updateSettings({ autoIndex: enabled });
      addLog(`Codebase auto-indexing ${enabled ? 'enabled' : 'disabled'}.`, 'info');
    } catch (err: any) {
      addLog(`Failed to update auto-indexing preference: ${err.message}`, 'error');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      <div>
        <h2 className="text-xl font-semibold text-[#ECEDEF] tracking-tight">
          General
        </h2>
      </div>

      {/* Section 1: Power & Sleep */}
      <SettingSection
        title="Power & Execution"
        description="Prevent machine sleep states during unattended multi-agent execution."
      >
        <div className="space-y-3 pt-1">
          <SettingRow
            title="Keep-Awake Power Blocker"
            description="Block the operating system from entering sleep or idle power states while agents are running."
          >
            <SettingToggle
              checked={keepAwake}
              onChange={handleToggleKeepAwake}
              disabled={isTogglingKeepAwake}
              ariaLabel="Enable Keep-Awake Power Blocker"
            />
          </SettingRow>
        </div>
      </SettingSection>

      {/* Section 2: Indexing & Intelligence */}
      <SettingSection
        title="Workspace Intelligence"
        description="Configure automatic codebase indexing and symbol caching."
      >
        <div className="space-y-3 pt-1">
          <SettingRow
            title="Automatic Codebase Indexing"
            description="Automatically parse files, build symbol trees, and generate dependency graphs when opening a workspace."
          >
            <SettingToggle
              checked={autoIndex}
              onChange={handleToggleAutoIndex}
              ariaLabel="Enable Automatic Codebase Indexing"
            />
          </SettingRow>
        </div>
      </SettingSection>
    </div>
  );
};
