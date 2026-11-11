import React, { useState, useEffect } from 'react';
import {
  Radio,
  ExternalLink,
  AlertTriangle,
  Check,
  RefreshCw
} from 'lucide-react';
import { SettingSection } from '../common/SettingSection';
import { SettingRow } from '../common/SettingRow';
import { SettingToggle } from '../common/SettingToggle';
import { Button } from '../../ui/Button';
import { useWorkspaceStore } from '../../../stores/workspace.store';
import type { DiscordStatusResponse } from '../../../../../shared/types';
import orbitLogo from '../../../assets/Orbit.png';

export const IntegrationsPage: React.FC = () => {
  const addLog = useWorkspaceStore((state) => state.addLog);
  const [discordStatus, setDiscordStatus] = useState<DiscordStatusResponse | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    window.api?.getDiscordStatus?.()
      .then((status) => {
        setDiscordStatus(status);
      })
      .catch(() => {});

    const unsub = window.api?.onDiscordStatusChange?.((status) => {
      setDiscordStatus(status);
    });
    return () => unsub?.();
  }, []);

  const handleToggleDiscord = async (enabled: boolean) => {
    if (isToggling) return;
    setIsToggling(true);
    try {
      const res = await window.api.updateDiscordSettings({ enabled });
      setDiscordStatus(res);
      addLog(`Discord Rich Presence ${enabled ? 'enabled' : 'disabled'}.`, 'info');
    } catch (err: any) {
      addLog(`Failed to update Discord Rich Presence: ${err.message}`, 'error');
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      <div>
        <h2 className="text-xl font-semibold text-[#ECEDEF] tracking-tight">
          Integrations
        </h2>
      </div>

      {/* Section 1: Discord RPC */}
      <SettingSection
        title="Discord Rich Presence"
        description="Communicate with your local Discord Desktop client to display coding session activity."
      >
        <div className="space-y-3 pt-1">
          <SettingRow
            title="Enable Discord Rich Presence"
            description="Broadcast your active project name and coding time to Discord profile."
          >
            <SettingToggle
              checked={Boolean(discordStatus?.enabled)}
              onChange={handleToggleDiscord}
              disabled={isToggling}
              ariaLabel="Enable Discord Rich Presence"
            />
          </SettingRow>

          <SettingRow
            title="Daemon Connection Status"
            description="Connection state to local Discord Desktop client."
          >
            <div className="flex items-center gap-2 text-xs font-mono">
              <span
                className={`w-2 h-2 rounded-full ${
                  !discordStatus?.enabled
                    ? 'bg-[#747982]'
                    : discordStatus.connected
                      ? 'bg-emerald-400 animate-pulse'
                      : discordStatus.status === 'connecting'
                        ? 'bg-amber-400 animate-ping'
                        : 'bg-rose-400'
                }`}
              />
              <span
                className={
                  !discordStatus?.enabled
                    ? 'text-[#747982]'
                    : discordStatus.connected
                      ? 'text-emerald-400'
                      : discordStatus.status === 'connecting'
                        ? 'text-amber-400'
                        : 'text-rose-400'
                }
              >
                {!discordStatus?.enabled
                  ? 'Disabled globally'
                  : discordStatus.connected
                    ? 'Connected'
                    : discordStatus.status === 'connecting'
                      ? 'Connecting...'
                      : 'Client unavailable'}
              </span>
            </div>
          </SettingRow>

          {/* Discord Preview Card */}
          <div className="pt-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#747982] block mb-2">
              Discord Profile Activity Preview
            </span>
            <div className="max-w-md rounded-xl bg-[#1e1f22] p-4 text-[#dbdee1] font-sans border-0 space-y-3">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#949ba4]">
                <span>PLAYING A GAME</span>
                <span className="text-[9px] font-mono text-[#949ba4] bg-white/[0.05] px-1 py-0.5 rounded">
                  Discord RPC
                </span>
              </div>

              <div className="flex gap-3.5 items-start">
                <div className="relative w-12 h-12 rounded-xl bg-[#111214] border-0 flex items-center justify-center flex-shrink-0">
                  <img src={orbitLogo} alt="Orbito" className="w-8 h-8 object-contain rounded-lg" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#1e1f22] flex items-center justify-center overflow-hidden bg-[#00A8FF]">
                    <div className="flex items-end gap-0.5 h-2">
                      <span className="w-0.5 h-1 bg-black rounded-full" />
                      <span className="w-0.5 h-2 bg-black rounded-full" />
                      <span className="w-0.5 h-1.5 bg-black rounded-full" />
                    </div>
                  </div>
                </div>

                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="text-sm font-bold text-white truncate leading-tight">Orbito</div>
                  <div className="text-xs text-[#dbdee1] truncate">
                    {discordStatus?.enabled
                      ? discordStatus.currentPresence?.details || 'Working in Orbito'
                      : 'Integration disabled'}
                  </div>
                  <div className="text-xs text-[#949ba4] truncate">
                    {discordStatus?.enabled
                      ? discordStatus.currentPresence?.state || 'Workspace ready'
                      : 'No activity published'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Privacy & Security */}
          <div className="pt-4 space-y-1.5 text-xs text-[#747982] leading-relaxed">
            <span className="text-xs font-semibold text-[#ECEDEF] block">
              Privacy Guarantees
            </span>
            <p>
              Only public project names, Git repository URLs, and active agent statuses are broadcasted.
            </p>
            <p className="text-[11px] text-[#525866]">
              Orbito never shares file contents, code snippets, secrets, system usernames, or API tokens over Discord RPC.
            </p>
          </div>
        </div>
      </SettingSection>
    </div>
  );
};
