import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Network,
  Check,
  AlertTriangle,
  RefreshCw,
  Key
} from 'lucide-react';
import { SettingSection } from '../common/SettingSection';
import { SettingRow } from '../common/SettingRow';
import { SettingToggle } from '../common/SettingToggle';
import { Button } from '../../ui/Button';
import { useWorkspaceStore } from '../../../stores/workspace.store';
import type { AirGapConfig } from '../../../../../shared/analytics';

export const SecurityPage: React.FC = () => {
  const addLog = useWorkspaceStore((state) => state.addLog);
  const [airGap, setAirGap] = useState<AirGapConfig | null>(null);
  const [isUpdatingAirGap, setIsUpdatingAirGap] = useState(false);

  // Key tester state
  const [testKey, setTestKey] = useState('test_credential');
  const [testValue, setTestValue] = useState('');
  const [storedNotice, setStoredNotice] = useState<string | null>(null);
  const [isStoring, setIsStoring] = useState(false);

  useEffect(() => {
    window.api?.getAirGapConfig?.()
      .then((config) => setAirGap(config))
      .catch((err) => {
        addLog(`Could not load Air-Gap configuration: ${err.message}`, 'error');
      });
  }, []);

  const handleToggleAirGap = async (enabled: boolean) => {
    if (!airGap || isUpdatingAirGap) return;
    setIsUpdatingAirGap(true);
    try {
      const updated = await window.api.updateAirGapConfig({
        enabled,
        blockExternalNetwork: enabled,
        enforceLocalModels: enabled
      });
      setAirGap(updated);
      addLog(`Air-Gap Isolation Guard ${enabled ? 'enabled' : 'disabled'}.`, 'info');
    } catch (err: any) {
      addLog(`Failed to update Air-Gap status: ${err.message}`, 'error');
    } finally {
      setIsUpdatingAirGap(false);
    }
  };

  const handleTestStore = async () => {
    if (!testKey.trim() || !testValue.trim()) return;
    setIsStoring(true);
    try {
      await window.api.storeSecret({ key: testKey.trim(), value: testValue.trim() });
      setStoredNotice(`Successfully encrypted '${testKey}' in OS DPAPI safeStorage.`);
      setTestValue('');
      setTimeout(() => setStoredNotice(null), 4000);
      addLog(`Encrypted secret '${testKey}' using OS safeStorage.`, 'info');
    } catch (err: any) {
      addLog(`Encryption error: ${err.message}`, 'error');
    } finally {
      setIsStoring(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      <div>
        <h2 className="text-xl font-semibold text-[#ECEDEF] tracking-tight">
          Security
        </h2>
      </div>

      {/* Section 1: OS Keychain Encryption */}
      <SettingSection
        title="Operating System Keychain Encryption"
        description="Credentials and provider keys are protected using Electron safeStorage (Windows Data Protection API — DPAPI). Secrets are bound to the current OS user session and never stored in plaintext."
      >
        <div className="space-y-3 pt-1">
          <SettingRow
            title="Encryption Mechanism"
            description="OS user-key encryption via Windows DPAPI. Decryption requires active OS login."
          >
            <span className="text-xs font-mono text-emerald-400">DPAPI Active</span>
          </SettingRow>

          <SettingRow
            title="Renderer Protection"
            description="Stored secrets are never loaded in plaintext into the UI for display."
          >
            <span className="text-xs font-mono text-[#A4A8AF]">Strict Write-Only Contract</span>
          </SettingRow>

          {/* Keyring tester */}
          <div className="pt-2 space-y-2">
            <span className="text-xs font-medium text-[#ECEDEF] block">
              Verify OS SafeStorage Encryption
            </span>
            <div className="flex gap-2 max-w-lg">
              <input
                type="text"
                value={testKey}
                onChange={(e) => setTestKey(e.target.value)}
                placeholder="Key name..."
                className="w-40 bg-white/[0.04] border-0 rounded-md px-2.5 py-1 text-xs text-[#ECEDEF] font-mono focus:outline-none"
              />
              <input
                type="password"
                value={testValue}
                onChange={(e) => setTestValue(e.target.value)}
                placeholder="Secret value to encrypt..."
                className="flex-1 bg-white/[0.04] border-0 rounded-md px-2.5 py-1 text-xs text-[#ECEDEF] font-mono focus:outline-none"
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={!testValue.trim() || isStoring}
                onClick={handleTestStore}
              >
                {isStoring ? 'Encrypting...' : 'Encrypt'}
              </Button>
            </div>
            {storedNotice && (
              <p className="text-[11px] text-emerald-400 font-mono">{storedNotice}</p>
            )}
          </div>
        </div>
      </SettingSection>

      {/* Section 2: Air-Gap Isolation */}
      <SettingSection
        title="Air-Gap Network Isolation Guard"
        description="When enabled, Orbito strictly blocks all outbound network calls from community extensions and prompts, routing execution exclusively to local models (e.g. Ollama)."
      >
        <div className="space-y-3 pt-1">
          <SettingRow
            title="Enable Air-Gap Isolation"
            description="Force offline operation and deny outgoing internet traffic."
          >
            <SettingToggle
              checked={Boolean(airGap?.enabled)}
              onChange={handleToggleAirGap}
              disabled={isUpdatingAirGap}
              ariaLabel="Enable Air-Gap Isolation"
            />
          </SettingRow>

          <SettingRow
            title="Local Model Enforcement"
            description="Reroute cloud agent requests to local Ollama daemon automatically when Air-Gap is active."
          >
            <span className="text-xs font-mono text-[#A4A8AF]">
              {airGap?.enforceLocalModels ? 'Enforced' : 'Disabled'}
            </span>
          </SettingRow>
        </div>
      </SettingSection>

      {/* Section 3: Extension Sandbox */}
      <SettingSection
        title="Extension Process Sandboxing"
        description="Community and local plugins run in isolated Node.js child processes with constrained environment variables and memory limits."
      >
        <div className="space-y-3 pt-1">
          <SettingRow
            title="Process Isolation"
            description="Each extension with running code runs in an independent child process."
          >
            <span className="text-xs font-mono text-emerald-400">Sandboxed Node Child</span>
          </SettingRow>

          <SettingRow
            title="Memory Ceiling"
            description="Hard heap limit enforced per Extension Host before process recycling."
          >
            <span className="text-xs font-mono text-[#ECEDEF]">128 MB</span>
          </SettingRow>
        </div>
      </SettingSection>
    </div>
  );
};
