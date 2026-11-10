import React from 'react';
import {
  Blocks,
  ExternalLink,
  ChevronRight,
  HardDrive,
  Cpu,
  Layers
} from 'lucide-react';
import { SettingSection } from '../common/SettingSection';
import { SettingRow } from '../common/SettingRow';
import { Button } from '../../ui/Button';
import { useWorkspaceStore } from '../../../stores/workspace.store';

interface PluginsPageProps {
  onCloseSettings: () => void;
}

export const PluginsPage: React.FC<PluginsPageProps> = ({ onCloseSettings }) => {
  const openPluginsTab = useWorkspaceStore((state) => state.openPluginsTab);

  const handleOpenHub = () => {
    onCloseSettings();
    openPluginsTab();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#ECEDEF] tracking-tight">
            Plugins & Extension Runtime
          </h2>
          <p className="text-xs text-[#A4A8AF] mt-1">
            Extension Host architecture, process limits, and local extensions repository.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenHub}
          className="flex items-center gap-1.5"
        >
          <Blocks className="w-3.5 h-3.5" />
          <span>Open Plugins Hub</span>
          <ChevronRight className="w-3.5 h-3.5 opacity-60" />
        </Button>
      </div>

      {/* Section 1: Host Architecture */}
      <SettingSection
        title="Extension Host Architecture"
        description="Every extension with active code runs in an isolated Node.js child process with memory boundaries."
      >
        <div className="space-y-3 pt-1">
          <SettingRow
            title="Max Concurrent Hosts"
            description="Upper limit of simultaneous extension processes permitted to run."
          >
            <span className="text-xs font-mono text-[#ECEDEF]">5 hosts</span>
          </SettingRow>

          <SettingRow
            title="Memory Ceiling"
            description="Heap limit allocated per Extension Host before memory recycling."
          >
            <span className="text-xs font-mono text-[#ECEDEF]">128 MB / host</span>
          </SettingRow>

          <SettingRow
            title="IPC Communication Channel"
            description="Inter-process protocol connecting Extension Hosts to the Main Electron process."
          >
            <span className="text-xs font-mono text-emerald-400">Bidirectional JSON-RPC</span>
          </SettingRow>
        </div>
      </SettingSection>

      {/* Section 2: Storage Directory */}
      <SettingSection
        title="Local Extensions Directory"
        description="Installed plugins and packages are persisted in the local workspace data folder."
      >
        <div className="pt-1">
          <SettingRow
            title="Storage Location"
            description="Relative workspace path where unpacked extension bundles are cached."
          >
            <span className="text-xs font-mono text-[#A4A8AF]">
              .ai-workspace-data/extensions
            </span>
          </SettingRow>
        </div>
      </SettingSection>
    </div>
  );
};
