import React, { useState, useEffect } from 'react';
import {
  Blocks,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Shield,
  Layers,
  Code2,
  Sparkles,
  RefreshCw,
  Info
} from 'lucide-react';
import type { ExtensionRecord } from '../../../shared/extensions';

export const ExtensionsManager: React.FC = () => {
  const [extensions, setExtensions] = useState<ExtensionRecord[]>([]);
  const [selectedExtension, setSelectedExtension] = useState<ExtensionRecord | null>(null);
  const [installPathInput, setInstallPathInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadExtensions = async () => {
    setIsLoading(true);
    try {
      const list = await window.api.listExtensions();
      setExtensions(list);
      if (list.length > 0 && !selectedExtension) {
        setSelectedExtension(list[0]);
      }
    } catch (err) {
      console.error('Failed to load extensions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadExtensions();
  }, []);

  const handleToggle = async (extensionId: string, currentEnabled: boolean) => {
    const nextState = !currentEnabled;
    const res = await window.api.toggleExtension({
      extensionId,
      enabled: nextState
    });

    if (res.success) {
      setExtensions((prev) =>
        prev.map((e) => (e.id === extensionId ? { ...e, enabled: nextState } : e))
      );
      if (selectedExtension?.id === extensionId) {
        setSelectedExtension((prev) => (prev ? { ...prev, enabled: nextState } : null));
      }
    }
  };

  const handleInstall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!installPathInput.trim()) return;

    setIsLoading(true);
    setStatusMessage(null);
    try {
      const res = await window.api.installExtension({
        directoryPath: installPathInput.trim()
      });

      if (res.success && res.extension) {
        setStatusMessage(`Successfully installed extension "${res.extension.displayName}"!`);
        setInstallPathInput('');
        await loadExtensions();
        setSelectedExtension(res.extension);
      } else {
        setStatusMessage(`Installation failed: ${res.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUninstall = async (extensionId: string) => {
    if (!confirm(`Are you sure you want to uninstall extension "${extensionId}"?`)) return;

    const res = await window.api.uninstallExtension({ extensionId });
    if (res.success) {
      setExtensions((prev) => prev.filter((e) => e.id !== extensionId));
      if (selectedExtension?.id === extensionId) {
        setSelectedExtension(null);
      }
      setStatusMessage(`Extension "${extensionId}" uninstalled.`);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background text-foreground overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Blocks className="w-5 h-5 text-primary" />
            <span>Custom Extension SDK & Package Manager</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Extend AI Workspace with sandboxed custom nodes, community skills, and third-party tools.
          </p>
        </div>

        <button
          onClick={loadExtensions}
          disabled={isLoading}
          className="p-1.5 rounded border border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Main Split: Left List, Right Details */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Extension List & Install */}
        <div className="w-80 border-r border-border flex flex-col bg-card/40">
          {/* Install Form */}
          <form onSubmit={handleInstall} className="p-3 border-b border-border space-y-2">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Install Extension from Directory
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="C:/path/to/my-extension"
                value={installPathInput}
                onChange={(e) => setInstallPathInput(e.target.value)}
                className="flex-1 px-2.5 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={isLoading || !installPathInput.trim()}
                className="px-2.5 py-1 text-xs font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Install</span>
              </button>
            </div>
            {statusMessage && (
              <p
                className={`text-[11px] ${
                  statusMessage.includes('failed') || statusMessage.includes('Error')
                    ? 'text-destructive'
                    : 'text-emerald-500'
                }`}
              >
                {statusMessage}
              </p>
            )}
          </form>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {extensions.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                <Blocks className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No extensions installed.</p>
                <p className="mt-1 text-[11px]">Install an extension directory containing an `extension.json` manifest.</p>
              </div>
            ) : (
              extensions.map((ext) => (
                <div
                  key={ext.id}
                  onClick={() => setSelectedExtension(ext)}
                  className={`p-3 cursor-pointer transition-colors flex items-center justify-between ${
                    selectedExtension?.id === ext.id
                      ? 'bg-primary/10 border-l-2 border-primary'
                      : 'hover:bg-secondary/40'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs truncate text-foreground">
                        {ext.displayName}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">v{ext.version}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {ext.description || 'No description provided.'}
                    </p>
                  </div>

                  {/* Switch */}
                  <input
                    type="checkbox"
                    checked={ext.enabled}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleToggle(ext.id, ext.enabled);
                    }}
                    className="accent-primary cursor-pointer w-4 h-4 flex-shrink-0"
                    title={ext.enabled ? 'Click to disable' : 'Click to enable'}
                  />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Extension Detail & Manifest Inspector */}
        <div className="flex-1 overflow-y-auto p-6 bg-background">
          {selectedExtension ? (
            <div className="max-w-2xl space-y-6">
              {/* Header Card */}
              <div className="p-5 border border-border rounded-lg bg-card flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold">{selectedExtension.displayName}</h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-secondary text-foreground border border-border">
                      v{selectedExtension.version}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                        selectedExtension.enabled
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {selectedExtension.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{selectedExtension.description}</p>
                  <div className="text-[11px] text-muted-foreground font-mono mt-2">
                    Author: {selectedExtension.author} | ID: {selectedExtension.id}
                  </div>
                </div>

                <button
                  onClick={() => handleUninstall(selectedExtension.id)}
                  className="p-1.5 rounded border border-destructive/30 hover:bg-destructive/10 text-destructive text-xs flex items-center gap-1"
                  title="Uninstall extension"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Uninstall</span>
                </button>
              </div>

              {/* Contribution Points */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border border-border rounded-lg bg-card">
                  <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                    <Layers className="w-4 h-4" />
                    <span>Contributed Workflow Nodes</span>
                  </div>
                  <div className="text-xl font-bold mt-2">
                    {selectedExtension.manifest.contributes?.nodes?.length || 0}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Available in Flow Builder canvas
                  </div>
                </div>

                <div className="p-4 border border-border rounded-lg bg-card">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-500">
                    <Sparkles className="w-4 h-4" />
                    <span>Contributed AI Skills</span>
                  </div>
                  <div className="text-xl font-bold mt-2">
                    {selectedExtension.manifest.contributes?.skills?.length || 0}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Available in Skills Engine & Orchestrator
                  </div>
                </div>
              </div>

              {/* Permissions & Security Sandbox */}
              <div className="p-4 border border-border rounded-lg bg-card space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span>Security Sandbox & Permissions</span>
                </div>
                <div className="text-xs text-muted-foreground font-mono bg-secondary/50 p-2.5 rounded border border-border">
                  <div>Shell Execution: {selectedExtension.manifest.permissions?.shell ? 'Allowed' : 'Blocked'}</div>
                  <div>
                    Network Egress:{' '}
                    {selectedExtension.manifest.permissions?.network?.allowExternal ? 'Allowed' : 'Local Only (Air-gapped)'}
                  </div>
                  <div>
                    Filesystem Access:{' '}
                    {selectedExtension.manifest.permissions?.filesystem ? 'Scoped' : 'Restricted'}
                  </div>
                </div>
              </div>

              {/* SHA-256 Tamper Protection */}
              <div className="p-4 border border-border rounded-lg bg-card space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <Info className="w-4 h-4 text-primary" />
                  <span>Integrity Checksum</span>
                </div>
                <p className="text-[11px] font-mono text-muted-foreground break-all bg-secondary/40 p-2 rounded">
                  SHA-256: {selectedExtension.checksum}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Installed at: {selectedExtension.installPath}
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              Select an extension to inspect details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
