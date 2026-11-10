import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ShieldCheck,
  Check,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  Server,
  Lock
} from 'lucide-react';
import { SettingSection } from '../common/SettingSection';
import { SettingRow } from '../common/SettingRow';
import { Button } from '../../ui/Button';
import { useWorkspaceStore } from '../../../stores/workspace.store';
import type { CLIProvider } from '../../../../../shared/cli';

interface ProviderConfig {
  id: string;
  name: string;
  secretKey: string;
  cliProvider: CLIProvider;
  description: string;
  defaultModel: string;
}

const CLOUD_PROVIDERS: ProviderConfig[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    secretKey: 'ANTHROPIC_API_KEY',
    cliProvider: 'claude',
    description: 'Claude 3.7 Sonnet, Claude 3.5 Haiku reasoning and agent models.',
    defaultModel: 'claude-3-7-sonnet-20250219'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    secretKey: 'OPENAI_API_KEY',
    cliProvider: 'codex',
    description: 'GPT-4o, o1, o3-mini models and reasoning APIs.',
    defaultModel: 'gpt-4o'
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    secretKey: 'GEMINI_API_KEY',
    cliProvider: 'gemini',
    description: 'Gemini 2.5 Flash, Gemini 2.5 Pro multimodal models.',
    defaultModel: 'gemini-2.5-pro'
  },
  {
    id: 'groq',
    name: 'Groq',
    secretKey: 'GROQ_API_KEY',
    cliProvider: 'codex',
    description: 'LPU high-speed inference for Llama 3 and open models.',
    defaultModel: 'llama-3.3-70b-versatile'
  }
];

export const ProvidersPage: React.FC = () => {
  const addLog = useWorkspaceStore((state) => state.addLog);

  // Status mapping: provider id -> boolean configured
  const [configuredStatus, setConfiguredStatus] = useState<Record<string, boolean>>({});
  // Editing state: provider id -> draft string
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [draftKey, setDraftKey] = useState<string>('');
  const [savingId, setSavingId] = useState<string | null>(null);
  // Auth test results: provider id -> { testing, status, message }
  const [testResults, setTestResults] = useState<
    Record<string, { testing: boolean; authenticated?: boolean; error?: string }>
  >({});

  // Ollama local settings
  const [ollamaUrl, setOllamaUrl] = useState('http://127.0.0.1:11434');
  const [ollamaModel, setOllamaModel] = useState('llama3:8b');
  const [ollamaStatus, setOllamaStatus] = useState<'idle' | 'checking' | 'connected' | 'disconnected'>('idle');

  // Load configured statuses via hasSecret (safe, zero plaintext exposed)
  useEffect(() => {
    const loadStatuses = async () => {
      const statuses: Record<string, boolean> = {};
      for (const provider of CLOUD_PROVIDERS) {
        try {
          const has = await window.api.hasSecret({ key: provider.secretKey });
          statuses[provider.id] = has;
        } catch {
          statuses[provider.id] = false;
        }
      }
      setConfiguredStatus(statuses);
    };

    loadStatuses();
  }, []);

  const handleSaveSecret = async (provider: ProviderConfig) => {
    if (!draftKey.trim()) return;
    setSavingId(provider.id);
    try {
      await window.api.storeSecret({
        key: provider.secretKey,
        value: draftKey.trim()
      });
      setConfiguredStatus((prev) => ({ ...prev, [provider.id]: true }));
      setEditingProvider(null);
      setDraftKey('');
      addLog(`Encrypted and stored ${provider.name} credential in OS safeStorage.`, 'info');
    } catch (err: any) {
      addLog(`Failed to store credential: ${err.message}`, 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleTestAuth = async (provider: ProviderConfig) => {
    setTestResults((prev) => ({
      ...prev,
      [provider.id]: { testing: true }
    }));

    try {
      const res = await window.api.checkCLIAuth({ provider: provider.cliProvider });
      setTestResults((prev) => ({
        ...prev,
        [provider.id]: {
          testing: false,
          authenticated: res.isAuthenticated,
          error: res.details
        }
      }));
      if (res.isAuthenticated) {
        addLog(`${provider.name} authentication verified.`, 'info');
      } else {
        addLog(`${provider.name} auth check: ${res.details || 'Authentication required'}`, 'warn');
      }
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [provider.id]: { testing: false, authenticated: false, error: err.message }
      }));
      addLog(`Error testing ${provider.name} auth: ${err.message}`, 'error');
    }
  };

  const handleCheckOllama = async () => {
    setOllamaStatus('checking');
    try {
      const res = await fetch(`${ollamaUrl}/api/version`, { method: 'GET' });
      if (res.ok) {
        setOllamaStatus('connected');
        addLog('Successfully connected to local Ollama daemon.', 'info');
      } else {
        setOllamaStatus('disconnected');
        addLog('Ollama returned non-200 response.', 'warn');
      }
    } catch {
      setOllamaStatus('disconnected');
      addLog('Could not reach Ollama daemon at ' + ollamaUrl, 'warn');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      <div>
        <h2 className="text-xl font-semibold text-[#ECEDEF] tracking-tight">
          AI Providers & Model Accounts
        </h2>
        <p className="text-xs text-[#A4A8AF] mt-1">
          Manage API authentication, encryption status, and local inference models.
        </p>
      </div>

      {/* Section 1: Cloud Providers */}
      <SettingSection
        title="Cloud Providers & API Credentials"
        description="Keys are encrypted through the OS safeStorage keyring (DPAPI on Windows) and never transmitted to external telemetry."
      >
        <div className="divide-y divide-white/[0.04]">
          {CLOUD_PROVIDERS.map((provider) => {
            const isConfigured = configuredStatus[provider.id];
            const isEditing = editingProvider === provider.id;
            const testResult = testResults[provider.id];

            return (
              <div key={provider.id} className="py-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-medium text-[#ECEDEF]">
                        {provider.name}
                      </span>
                      <span
                        className={`text-[11px] font-mono ${
                          isConfigured ? 'text-emerald-400' : 'text-[#747982]'
                        }`}
                      >
                        {isConfigured ? 'Configured (OS Keyring)' : 'Not Configured'}
                      </span>
                    </div>
                    <p className="text-xs text-[#747982] leading-relaxed">
                      {provider.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isConfigured && !isEditing && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={testResult?.testing}
                        onClick={() => handleTestAuth(provider)}
                      >
                        {testResult?.testing ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                        ) : null}
                        <span>Test Auth</span>
                      </Button>
                    )}

                    <Button
                      variant={isEditing ? 'ghost' : 'secondary'}
                      size="sm"
                      onClick={() => {
                        if (isEditing) {
                          setEditingProvider(null);
                          setDraftKey('');
                        } else {
                          setEditingProvider(provider.id);
                          setDraftKey('');
                        }
                      }}
                    >
                      {isEditing ? 'Cancel' : isConfigured ? 'Update Key' : 'Add Key'}
                    </Button>
                  </div>
                </div>

                {/* Display masked status or input field */}
                {isEditing ? (
                  <div className="flex items-center gap-2 pt-1 max-w-xl">
                    <input
                      type="password"
                      value={draftKey}
                      onChange={(e) => setDraftKey(e.target.value)}
                      placeholder={`Enter new ${provider.name} API key...`}
                      className="flex-1 bg-white/[0.04] border border-white/[0.1] rounded-md px-3 py-1.5 text-xs text-[#ECEDEF] placeholder:text-[#747982] focus:outline-none focus:border-white/30 font-mono"
                      autoFocus
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!draftKey.trim() || savingId === provider.id}
                      onClick={() => handleSaveSecret(provider)}
                    >
                      {savingId === provider.id ? 'Saving...' : 'Save Encrypted'}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-xs font-mono text-[#747982]">
                    <span className="text-[11px] text-[#525866]">Key Token:</span>
                    <span>{isConfigured ? '••••••••••••••••••••••••' : 'None stored'}</span>
                    {testResult && (
                      <span
                        className={`text-[11px] ${
                          testResult.authenticated ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {testResult.authenticated
                          ? '✓ Verified'
                          : `✗ ${testResult.error || 'Auth failed'}`}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SettingSection>

      {/* Section 2: Local Models (Ollama) */}
      <SettingSection
        title="Local Inference (Ollama)"
        description="Run models completely offline and private on your machine without transmitting code to cloud servers."
      >
        <div className="space-y-4 pt-1">
          <SettingRow
            title="Ollama Daemon Endpoint"
            description="Default REST service URL for the local Ollama instance."
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                placeholder="http://127.0.0.1:11434"
                className="w-56 bg-white/[0.04] border border-white/[0.08] rounded-md px-2.5 py-1 text-xs text-[#ECEDEF] font-mono focus:outline-none focus:border-white/30"
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={ollamaStatus === 'checking'}
                onClick={handleCheckOllama}
              >
                {ollamaStatus === 'checking' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  'Check Status'
                )}
              </Button>
            </div>
          </SettingRow>

          <SettingRow
            title="Active Local Model"
            description="Target model identifier pulled in your Ollama installation."
          >
            <input
              type="text"
              value={ollamaModel}
              onChange={(e) => setOllamaModel(e.target.value)}
              placeholder="e.g. llama3:8b, mistral, deepseek-coder"
              className="w-56 bg-white/[0.04] border border-white/[0.08] rounded-md px-2.5 py-1 text-xs text-[#ECEDEF] font-mono focus:outline-none focus:border-white/30"
            />
          </SettingRow>

          {ollamaStatus !== 'idle' && (
            <div
              className={`text-xs font-mono py-2 px-3 rounded-md border ${
                ollamaStatus === 'connected'
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                  : 'border-rose-500/20 bg-rose-500/10 text-rose-300'
              }`}
            >
              {ollamaStatus === 'connected'
                ? '✓ Connected to local Ollama daemon at ' + ollamaUrl
                : '✗ Could not connect to Ollama. Ensure the Ollama daemon is running locally.'}
            </div>
          )}
        </div>
      </SettingSection>
    </div>
  );
};
