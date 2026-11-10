import React from 'react';
import { AgentsSettingsTab } from '../AgentsSettingsTab';

export const AgentsPage: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div>
        <h2 className="text-xl font-semibold text-foreground tracking-tight">
          All Agents
        </h2>
      </div>
      <AgentsSettingsTab />
    </div>
  );
};
