import React, { useState } from 'react';
import { X, Play, Shield, Globe, Terminal, Plus, Trash2, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { MCPServerConfig, SaveMCPServerInput, MCPServerTestResult } from '../../../../../shared/mcp';

interface AddEditMCPServerModalProps {
  server?: MCPServerConfig | null;
  onClose: () => void;
  onSaved: (saved: MCPServerConfig) => void;
}

export const AddEditMCPServerModal: React.FC<AddEditMCPServerModalProps> = ({
  server,
  onClose,
  onSaved
}) => {
  const isEditing = Boolean(server);

  const [name, setName] = useState(server?.name || '');
  const [description, setDescription] = useState(server?.description || '');
  const [transport, setTransport] = useState<'stdio' | 'streamable_http' | 'sse'>(server?.transport || 'stdio');
  const [command, setCommand] = useState(server?.command || '');
  const [argsText, setArgsText] = useState((server?.args || []).join(' '));
  const [url, setUrl] = useState(server?.url || '');
  const [authType, setAuthType] = useState<'none' | 'api_key' | 'bearer' | 'oauth2'>(server?.authType || 'none');
  const [authToken, setAuthToken] = useState('');
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([]);
  const [allowAllAgents, setAllowAllAgents] = useState(server?.agentPermissions.all ?? true);
  const [allowedAgents, setAllowedAgents] = useState<string[]>(server?.agentPermissions.allowedAgents || ['claude', 'codex', 'antigravity', 'opencode']);
  const [autoReconnect, setAutoReconnect] = useState(server?.autoReconnect ?? true);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<MCPServerTestResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableAgentOptions = [
    { id: 'claude', name: 'Claude Code' },
    { id: 'codex', name: 'OpenAI Codex' },
    { id: 'antigravity', name: 'Antigravity' },
    { id: 'opencode', name: 'OpenCode' }
  ];

  const handleAddEnvVar = () => {
    setEnvVars((prev) => [...prev, { key: '', value: '' }]);
  };

  const handleRemoveEnvVar = (index: number) => {
    setEnvVars((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEnvChange = (index: number, field: 'key' | 'value', val: string) => {
    setEnvVars((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: val } : item))
    );
  };

  const handleToggleAgent = (agentId: string) => {
    if (allowedAgents.includes(agentId)) {
      setAllowedAgents(allowedAgents.filter((id) => id !== agentId));
    } else {
      setAllowedAgents([...allowedAgents, agentId]);
    }
  };

  const buildPayload = (): SaveMCPServerInput => {
    const args = argsText
      .trim()
      .split(/\s+/)
      .filter((a) => a.length > 0);

    const env: Record<string, string> = {};
    for (const item of envVars) {
      if (item.key.trim()) {
        env[item.key.trim()] = item.value;
      }
    }

    return {
      id: server?.id,
      name: name.trim(),
      description: description.trim(),
      transport,
      command: transport === 'stdio' ? command.trim() : undefined,
      args: transport === 'stdio' ? args : [],
      url: transport !== 'stdio' ? url.trim() : undefined,
      enabled: server?.enabled ?? true,
      authType,
      authToken: authToken.trim() || undefined,
      env: Object.keys(env).length > 0 ? env : undefined,
      agentPermissions: {
        all: allowAllAgents,
        allowedAgents: allowAllAgents ? [] : allowedAgents
      },
      projectScope: server?.projectScope ?? null,
      autoReconnect
    };
  };

  const handleTestConnection = async () => {
    setError(null);
    setTesting(true);
    setTestResult(null);

    try {
      const payload = buildPayload();
      const res = await window.api.testMCPConnection({ config: payload });
      setTestResult(res);
      if (!res.success) {
        setError(res.errorMessage || 'Connection failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Connection test encountered an error.');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Server name is required.');
      return;
    }

    if (transport === 'stdio' && !command.trim()) {
      setError('Command is required for stdio transport.');
      return;
    }

    if (transport !== 'stdio' && !url.trim()) {
      setError('URL is required for Streamable HTTP transport.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = buildPayload();
      const saved = await window.api.saveMCPServer(payload);
      onSaved(saved);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save MCP server.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-[#0e1015] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#ECEDEF]">
              {isEditing ? 'Configure MCP Server' : 'Add New MCP Server'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-foreground-muted hover:text-white hover:bg-white/[0.04] transition-colors"
            title="Close"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-6 py-5 space-y-6 text-xs text-foreground-secondary">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 text-red-400 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Server Identity */}
          <div className="space-y-4">
            <div>
              <label className="block text-foreground-muted mb-1 font-mono uppercase tracking-wider text-[11px]">
                Server Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. github-mcp, filesystem-mcp, postgres-mcp"
                className="w-full px-3 py-2 bg-white/[0.03] text-[#ECEDEF] rounded-lg focus:outline-none focus:bg-white/[0.06] transition-colors border-0"
                required
              />
            </div>

            <div>
              <label className="block text-foreground-muted mb-1 font-mono uppercase tracking-wider text-[11px]">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief purpose of this MCP server and its toolset"
                className="w-full px-3 py-2 bg-white/[0.03] text-[#ECEDEF] rounded-lg focus:outline-none focus:bg-white/[0.06] transition-colors border-0"
              />
            </div>

            {/* Transport Selector */}
            <div>
              <label className="block text-foreground-muted mb-1 font-mono uppercase tracking-wider text-[11px]">
                Transport Protocol
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTransport('stdio')}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors border-0 ${
                    transport === 'stdio'
                      ? 'bg-white/[0.08] text-white font-medium'
                      : 'bg-white/[0.02] text-foreground-muted hover:bg-white/[0.04]'
                  }`}
                >
                  <Terminal className="w-4 h-4" />
                  <div>
                    <div className="font-semibold text-xs">Standard I/O (stdio)</div>
                    <div className="text-[10px] text-foreground-muted">Spawn local process (npx, uvx, binary)</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTransport('streamable_http')}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors border-0 ${
                    transport !== 'stdio'
                      ? 'bg-white/[0.08] text-white font-medium'
                      : 'bg-white/[0.02] text-foreground-muted hover:bg-white/[0.04]'
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  <div>
                    <div className="font-semibold text-xs">Streamable HTTP / SSE</div>
                    <div className="text-[10px] text-foreground-muted">Remote endpoint via Server-Sent Events</div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Transport Specific Configuration */}
          {transport === 'stdio' ? (
            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-foreground-muted mb-1 font-mono uppercase tracking-wider text-[11px]">
                  Executable Command *
                </label>
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="e.g. npx, node, uvx, docker"
                  className="w-full px-3 py-2 bg-white/[0.03] text-[#ECEDEF] font-mono rounded-lg focus:outline-none focus:bg-white/[0.06] transition-colors border-0"
                  required
                />
              </div>

              <div>
                <label className="block text-foreground-muted mb-1 font-mono uppercase tracking-wider text-[11px]">
                  Arguments (space separated)
                </label>
                <input
                  type="text"
                  value={argsText}
                  onChange={(e) => setArgsText(e.target.value)}
                  placeholder="e.g. -y @modelcontextprotocol/server-filesystem /path/to/folder"
                  className="w-full px-3 py-2 bg-white/[0.03] text-[#ECEDEF] font-mono rounded-lg focus:outline-none focus:bg-white/[0.06] transition-colors border-0"
                />
              </div>

              {/* Encrypted Environment Variables */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-mono uppercase tracking-wider text-[11px] text-foreground-muted">
                      Secured Environment Variables (OS Keychain Encrypted)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddEnvVar}
                    className="flex items-center gap-1 text-[11px] text-foreground-muted hover:text-white transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add Variable
                  </button>
                </div>

                {envVars.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.key}
                      onChange={(e) => handleEnvChange(idx, 'key', e.target.value)}
                      placeholder="KEY (e.g. GITHUB_TOKEN)"
                      className="w-1/2 px-2.5 py-1.5 bg-white/[0.03] text-[#ECEDEF] font-mono rounded focus:outline-none focus:bg-white/[0.06] border-0"
                    />
                    <input
                      type="password"
                      value={item.value}
                      onChange={(e) => handleEnvChange(idx, 'value', e.target.value)}
                      placeholder="Secret Value"
                      className="w-1/2 px-2.5 py-1.5 bg-white/[0.03] text-[#ECEDEF] font-mono rounded focus:outline-none focus:bg-white/[0.06] border-0"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveEnvVar(idx)}
                      className="p-1.5 text-foreground-muted hover:text-red-400 transition-colors"
                      title="Remove variable"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-foreground-muted mb-1 font-mono uppercase tracking-wider text-[11px]">
                  Server Endpoint URL *
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://mcp.internal.domain/sse"
                  className="w-full px-3 py-2 bg-white/[0.03] text-[#ECEDEF] font-mono rounded-lg focus:outline-none focus:bg-white/[0.06] transition-colors border-0"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-foreground-muted mb-1 font-mono uppercase tracking-wider text-[11px]">
                    Authentication Type
                  </label>
                  <select
                    value={authType}
                    onChange={(e: any) => setAuthType(e.target.value)}
                    className="w-full px-3 py-2 bg-white/[0.03] text-[#ECEDEF] rounded-lg focus:outline-none focus:bg-white/[0.06] transition-colors border-0"
                  >
                    <option value="none">None (Public / Internal)</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="api_key">API Key Header</option>
                  </select>
                </div>

                {authType !== 'none' && (
                  <div>
                    <label className="block text-foreground-muted mb-1 font-mono uppercase tracking-wider text-[11px]">
                      Authentication Token / Key
                    </label>
                    <input
                      type="password"
                      value={authToken}
                      onChange={(e) => setAuthToken(e.target.value)}
                      placeholder={isEditing ? '•••••••• (leave blank to keep unchanged)' : 'Enter secret token'}
                      className="w-full px-3 py-2 bg-white/[0.03] text-[#ECEDEF] font-mono rounded-lg focus:outline-none focus:bg-white/[0.06] transition-colors border-0"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Agent Permissions & Scoping */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="font-mono uppercase tracking-wider text-[11px] text-foreground-muted">
                Agent Access Authorization
              </span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowAllAgents}
                  onChange={(e) => setAllowAllAgents(e.target.checked)}
                  className="rounded bg-white/[0.04] text-white"
                />
                <span className="text-[11px] text-[#ECEDEF]">Available to all AI agents</span>
              </label>
            </div>

            {!allowAllAgents && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                {availableAgentOptions.map((opt) => (
                  <label
                    key={opt.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={allowedAgents.includes(opt.id)}
                      onChange={() => handleToggleAgent(opt.id)}
                      className="rounded bg-white/[0.04] text-white"
                    />
                    <span className="text-xs text-[#ECEDEF]">{opt.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Live Test Feedback Banner */}
          {testResult && (
            <div className={`p-3 rounded-lg flex items-start gap-2.5 ${testResult.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              {testResult.success ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <div className="space-y-1">
                <div className="font-semibold text-xs">
                  {testResult.success ? `Connected Successfully (${testResult.latencyMs}ms)` : 'Connection Test Failed'}
                </div>
                <div className="text-[11px]">
                  {testResult.success
                    ? `Discovered ${testResult.toolsCount} MCP tool(s) ready for use.`
                    : testResult.errorMessage}
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-white/[0.02]">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing || saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-foreground-secondary hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors border-0 disabled:opacity-50"
          >
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Test Connection
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-1.5 text-xs text-foreground-muted hover:text-white transition-colors border-0"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-black bg-[#ECEDEF] hover:bg-white rounded-lg transition-colors border-0 disabled:opacity-50"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Add Server'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
