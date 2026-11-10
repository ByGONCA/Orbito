import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Blocks,
  Search,
  CheckCircle2,
  Download,
  Trash2,
  ExternalLink,
  Shield,
  Layers,
  Code2,
  Sparkles,
  Terminal,
  FolderOpen,
  X,
  Star,
  RefreshCw,
  Info,
  ChevronRight,
  Package,
  Cpu
} from 'lucide-react';
import type { ExtensionRecord, CatalogPluginItem } from '../../../../shared/extensions';

interface PluginManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PluginManagerModal: React.FC<PluginManagerModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'discover' | 'installed' | 'developer'>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const [catalog, setCatalog] = useState<CatalogPluginItem[]>([]);
  const [installed, setInstalled] = useState<ExtensionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [localPathInput, setLocalPathInput] = useState('');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [catList, instList] = await Promise.all([
        window.api.getCatalogPlugins?.() || Promise.resolve([]),
        window.api.listExtensions()
      ]);
      setCatalog(catList);
      setInstalled(instList);
    } catch (err) {
      console.error('Failed to load plugin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const installedMap = new Map(installed.map((p) => [p.id, p]));

  const handleInstallCatalog = async (pluginId: string) => {
    setInstallingId(pluginId);
    try {
      const res = await window.api.installCatalogPlugin({ pluginId });
      if (res.success && res.extension) {
        setInstalled((prev) => [...prev.filter((p) => p.id !== res.extension!.id), res.extension!]);
        setStatusNotice(`Plugin installed successfully!`);
        setTimeout(() => setStatusNotice(null), 3000);
      } else {
        alert(res.error || 'Failed to install plugin');
      }
    } catch (err: any) {
      alert(`Installation error: ${err.message}`);
    } finally {
      setInstallingId(null);
    }
  };

  const handleToggle = async (extensionId: string, currentEnabled: boolean) => {
    const nextState = !currentEnabled;
    const res = await window.api.toggleExtension({
      extensionId,
      enabled: nextState
    });
    if (res.success) {
      setInstalled((prev) =>
        prev.map((e) => (e.id === extensionId ? { ...e, enabled: nextState } : e))
      );
    }
  };

  const handleUninstall = async (extensionId: string) => {
    if (!confirm('Are you sure you want to uninstall this plugin?')) return;
    const res = await window.api.uninstallExtension({ extensionId });
    if (res.success) {
      setInstalled((prev) => prev.filter((p) => p.id !== extensionId));
      setStatusNotice('Plugin uninstalled.');
      setTimeout(() => setStatusNotice(null), 3000);
    }
  };

  const handleInstallLocal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localPathInput.trim()) return;
    setIsLoading(true);
    try {
      const res = await window.api.installExtension({ directoryPath: localPathInput.trim() });
      if (res.success && res.extension) {
        setInstalled((prev) => [...prev.filter((p) => p.id !== res.extension!.id), res.extension!]);
        setLocalPathInput('');
        setStatusNotice('Local plugin installed successfully!');
        setActiveTab('installed');
        setTimeout(() => setStatusNotice(null), 3000);
      } else {
        alert(res.error || 'Failed to install local plugin');
      }
    } catch (err: any) {
      alert(`Local install error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter catalog
  const filteredCatalog = catalog.filter((item) => {
    const matchesSearch =
      item.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div className="relative w-full max-w-4xl max-h-[88vh] bg-[#141517] border border-white/[0.12] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-neutral-200">
        {/* Header */}
        <div className="p-4 px-6 border-b border-white/[0.08] flex items-center justify-between bg-[#111214]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Blocks className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-tight">Orbito Plugins & Ecosystem</h2>
              <p className="text-[11px] text-neutral-400">Discover official extensions and community integrations</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/[0.08] text-xs">
            <button
              onClick={() => setActiveTab('discover')}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === 'discover'
                  ? 'bg-white text-black shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Discover
            </button>
            <button
              onClick={() => setActiveTab('installed')}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'installed'
                  ? 'bg-white text-black shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span>Installed</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-500/20 text-neutral-300 font-mono">
                {installed.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('developer')}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === 'developer'
                  ? 'bg-white text-black shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Developer
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status notice */}
        {statusNotice && (
          <div className="px-6 py-2 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{statusNotice}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* TAB 1: DISCOVER */}
          {activeTab === 'discover' && (
            <div className="space-y-4">
              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search catalog by name or keyword..."
                    className="w-full bg-[#18191B] border border-white/[0.10] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500/50"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {['all', 'editor', 'git', 'developer', 'ai-tools'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] capitalize transition-colors cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-white/[0.12] text-white font-medium border border-white/[0.15]'
                          : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                      }`}
                    >
                      {cat.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Plugin Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredCatalog.map((plugin) => {
                  const isInstalled = installedMap.has(plugin.id);
                  const isInstalling = installingId === plugin.id;

                  return (
                    <div
                      key={plugin.id}
                      className="p-4 bg-white/[0.025] border border-white/[0.06] rounded-xl hover:border-white/[0.14] transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white text-[13px]">
                                {plugin.displayName}
                              </span>
                              {plugin.isOfficial && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-300 border border-blue-500/25 font-mono">
                                  Official
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-neutral-500 font-mono">
                              by {plugin.author} • v{plugin.version}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-[11px] text-amber-400">
                            <Star className="w-3 h-3 fill-amber-400" />
                            <span>{plugin.rating}</span>
                          </div>
                        </div>

                        <p className="text-neutral-400 text-xs leading-relaxed line-clamp-2">
                          {plugin.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/[0.04] text-[11px]">
                        <span className="text-neutral-500 flex items-center gap-1">
                          <Download className="w-3 h-3" />
                          <span>{plugin.downloads.toLocaleString()} downloads</span>
                        </span>

                        {isInstalled ? (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Installed</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleInstallCatalog(plugin.id)}
                            disabled={isInstalling}
                            className="px-3 py-1 rounded-lg bg-white text-black font-medium hover:bg-neutral-200 transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                          >
                            <Download className={`w-3 h-3 ${isInstalling ? 'animate-bounce' : ''}`} />
                            <span>{isInstalling ? 'Installing...' : 'Install'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: INSTALLED */}
          {activeTab === 'installed' && (
            <div className="space-y-3">
              {installed.length === 0 ? (
                <div className="py-12 text-center space-y-2 text-neutral-500">
                  <Package className="w-8 h-8 mx-auto text-neutral-600" />
                  <p>No plugins installed yet.</p>
                  <button
                    onClick={() => setActiveTab('discover')}
                    className="text-xs text-blue-400 hover:underline"
                  >
                    Browse the Discovery Catalog
                  </button>
                </div>
              ) : (
                installed.map((ext) => (
                  <div
                    key={ext.id}
                    className="p-4 bg-white/[0.025] border border-white/[0.06] rounded-xl flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-[13px]">
                          {ext.displayName || ext.name}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono">v{ext.version}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                            ext.enabled
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                              : 'bg-neutral-500/15 text-neutral-400 border border-neutral-500/25'
                          }`}
                        >
                          {ext.enabled ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <p className="text-neutral-400 text-xs truncate">{ext.description}</p>
                      <div className="flex items-center gap-3 text-[10px] text-neutral-500 pt-0.5">
                        <span>Author: {ext.author}</span>
                        {ext.manifest.permissions && (
                          <span className="flex items-center gap-1">
                            <Shield className="w-3 h-3 text-neutral-400" />
                            <span>
                              {Object.keys(ext.manifest.permissions).filter(Boolean).join(', ') || 'Sandboxed'}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggle(ext.id, ext.enabled)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          ext.enabled
                            ? 'bg-white/[0.08] hover:bg-white/[0.14] text-white'
                            : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {ext.enabled ? 'Disable' : 'Enable'}
                      </button>

                      <button
                        onClick={() => handleUninstall(ext.id)}
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Uninstall"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: DEVELOPER */}
          {activeTab === 'developer' && (
            <div className="space-y-6">
              {/* Install local plugin form */}
              <div className="p-4 bg-white/[0.025] border border-white/[0.08] rounded-xl space-y-3">
                <h3 className="font-semibold text-white text-xs flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-blue-400" />
                  <span>Install Local Plugin from Folder</span>
                </h3>
                <form onSubmit={handleInstallLocal} className="flex gap-2">
                  <input
                    type="text"
                    value={localPathInput}
                    onChange={(e) => setLocalPathInput(e.target.value)}
                    placeholder="Full path to directory containing extension.json..."
                    className="flex-1 bg-[#18191B] border border-white/[0.10] rounded-xl px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500/50"
                  />
                  <button
                    type="submit"
                    disabled={!localPathInput.trim()}
                    className="px-4 py-1.5 rounded-xl bg-white text-black font-medium hover:bg-neutral-200 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    Install Folder
                  </button>
                </form>
              </div>

              {/* CLI Cheatsheet */}
              <div className="space-y-2">
                <h3 className="font-semibold text-white text-xs flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span>Orbito Plugin CLI Commands</span>
                </h3>
                <div className="p-3 bg-black/50 border border-white/[0.06] rounded-xl font-mono text-[11px] text-neutral-300 space-y-1">
                  <div><span className="text-blue-400">orbito plugins list</span> — List installed plugins</div>
                  <div><span className="text-blue-400">orbito plugins search &lt;query&gt;</span> — Search discovery catalog</div>
                  <div><span className="text-blue-400">orbito plugins install &lt;plugin-id | ./path&gt;</span> — Install plugin</div>
                  <div><span className="text-blue-400">orbito plugins uninstall &lt;plugin-id&gt;</span> — Remove plugin</div>
                  <div><span className="text-blue-400">orbito plugins validate ./my-plugin</span> — Validate manifest & checksum</div>
                </div>
              </div>

              {/* Manifest Schema Reference */}
              <div className="space-y-2">
                <h3 className="font-semibold text-white text-xs flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-purple-400" />
                  <span>Plugin Manifest (extension.json)</span>
                </h3>
                <pre className="p-3 bg-black/50 border border-white/[0.06] rounded-xl font-mono text-[11px] text-neutral-300 overflow-x-auto">
{`{
  "id": "my-custom-plugin",
  "name": "my-custom-plugin",
  "displayName": "My Custom Plugin",
  "version": "1.0.0",
  "description": "Adds custom productivity tools to Orbito",
  "author": "Your Name",
  "permissions": {
    "filesystem": { "read": true },
    "network": { "allowExternal": false }
  },
  "contributes": {
    "commands": [{ "id": "myPlugin.run", "title": "Run Custom Task" }]
  }
}`}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 px-6 border-t border-white/[0.08] bg-[#111214] flex items-center justify-between text-xs">
          <span className="text-neutral-500 font-mono text-[10px]">
            Orbito Plugin Engine v1.0 • Isolated Sandbox
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white text-black font-medium hover:bg-neutral-200 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
