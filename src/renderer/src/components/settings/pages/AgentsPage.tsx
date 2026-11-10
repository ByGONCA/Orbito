import React from 'react';
import { AgentsSettingsTab } from '../AgentsSettingsTab';

export const AgentsPage: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div>
        <h2 className="text-xl font-semibold text-[#ECEDEF] tracking-tight">
          Agents & CLI Runtimes
        </h2>
        <p className="text-xs text-[#A4A8AF] mt-1">
          Execution runtimes, CLI detection, custom executable paths, and per-agent permissions.
        </p>
      </div>
      <AgentsSettingsTab />
    </div>
  );
};
