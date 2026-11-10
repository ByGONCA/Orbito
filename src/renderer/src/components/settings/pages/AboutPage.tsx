import React, { useState, useEffect } from 'react';
import {
  Info,
  Cpu,
  HardDrive,
  Clock,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { SettingSection } from '../common/SettingSection';
import { SettingRow } from '../common/SettingRow';
import type { SystemResourceMetrics } from '../../../../../shared/types';
import orbitLogo from '../../../assets/Orbit.png';

export const AboutPage: React.FC = () => {
  const [metrics, setMetrics] = useState<SystemResourceMetrics | null>(null);

  useEffect(() => {
    window.api?.getSystemMetrics?.()
      .then(setMetrics)
      .catch(() => {});
  }, []);

  const formatUptime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}h ${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      <div className="flex items-center gap-3.5">
        <img
          src={orbitLogo}
          alt="Orbito Logo"
          className="w-10 h-10 object-contain drop-shadow select-none pointer-events-none"
        />
        <div>
          <h2 className="text-xl font-semibold text-[#ECEDEF] tracking-tight">
            About Orbito
          </h2>
          <p className="text-xs text-[#A4A8AF] mt-0.5">
            Unified AI Coding Workspace with Local & Cloud Agent Orchestration.
          </p>
        </div>
      </div>

      {/* Section 1: Application Specifications */}
      <SettingSection
        title="Application Specifications"
        description="Version, runtime environment, and storage engine specifications."
      >
        <div className="space-y-3 pt-1">
          <SettingRow
            title="Desktop Version"
            description="Production release binary build."
          >
            <span className="text-xs font-mono text-[#ECEDEF] font-semibold">
              0.1.0 (Desktop)
            </span>
          </SettingRow>

          <SettingRow
            title="Runtime Host"
            description="Embedded Chromium and Node.js execution environment."
          >
            <span className="text-xs font-mono text-[#A4A8AF]">
              Electron 34.5.8 / Node v20.19.1
            </span>
          </SettingRow>

          <SettingRow
            title="Persistence Engine"
            description="Dual SQLite WAL architecture with concurrent index processing."
          >
            <span className="text-xs font-mono text-emerald-400">
              Dual SQLite WAL (app.sqlite & index.sqlite)
            </span>
          </SettingRow>

          <SettingRow
            title="Design System"
            description="Neutral Charcoal Glassmorphism design tokens."
          >
            <span className="text-xs font-mono text-[#A4A8AF]">
              Linear & Raycast Inspired Glass
            </span>
          </SettingRow>
        </div>
      </SettingSection>

      {/* Section 2: Real-time Runtime Diagnostics */}
      {metrics && (
        <SettingSection
          title="Runtime Performance Diagnostics"
          description="Live memory footprint and CPU utilization for the active Orbito desktop process."
        >
          <div className="space-y-3 pt-1">
            <SettingRow
              title="Process Memory Usage"
              description="Resident set memory consumed across Main and Renderer processes."
            >
              <span className="text-xs font-mono text-[#ECEDEF]">
                {Math.round(metrics.totalAppMemoryMb)} MB total ({Math.round(metrics.mainProcessMemoryMb)} MB main)
              </span>
            </SettingRow>

            <SettingRow
              title="Session Uptime"
              description="Continuous runtime duration of the current application session."
            >
              <span className="text-xs font-mono text-[#A4A8AF]">
                {formatUptime(metrics.uptimeSeconds)}
              </span>
            </SettingRow>
          </div>
        </SettingSection>
      )}

      {/* Section 3: Open Source & Community */}
      <SettingSection
        title="Community & Updates"
        description="Source code repository, documentation, and release notes."
      >
        <div className="space-y-3 pt-1">
          <SettingRow
            title="GitHub Repository"
            description="Contribute, view changelogs, or report issues on GitHub."
          >
            <a
              href="https://github.com/ByGONCA/Orbito"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-[#A4A8AF] hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>ByGONCA/Orbito</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </SettingRow>
        </div>
      </SettingSection>
    </div>
  );
};
