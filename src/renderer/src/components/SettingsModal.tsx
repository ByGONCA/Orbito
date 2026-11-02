import React, { useState, useEffect } from 'react';
import { X, Key, ShieldCheck, Database, Trash2, Sun, Moon, Laptop } from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspace.store';
import type { MemoryRecord } from '../../../shared/types';

export const SettingsModal: React.FC = () => {
  const { isSettingsOpen, toggleSettings, theme, setTheme, addLog } = useWorkspaceStore();

  const [testKey, setTestKey] = useState('test-provider-key');
  const [testSecret, setTestSecret] = useState('');
  const [retrievedSecret, setRetrievedSecret] = useState<string | null>(null);
  const [memories, setMemories] = useState<MemoryRecord[]>([]);

  useEffect(() => {
    if (isSettingsOpen) {
      loadMemories();
    }
  }, [isSettingsOpen]);

  const loadMemories = async () => {
    try {
      const list = await window.api.listMemories();
      setMemories(list);
    } catch (err: any) {
      addLog(`Failed to load memories: ${err.message}`, 'error');
    }
  };

  const handleStoreSecret = async () => {
    if (!testKey || !testSecret) return;
    try {
      await window.api.storeSecret({ key: testKey, value: testSecret });
      addLog(`Encrypted and stored secret with key: '${testKey}' via safeStorage.`, 'info');
      setTestSecret('');
      const val = await window.api.getSecret({ key: testKey });
      setRetrievedSecret(val);
    } catch (err: any) {
      addLog(`SafeStorage error: ${err.message}`, 'error');
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      await window.api.deleteMemory({ id });
      setMemories((prev) => prev.filter((m) => m.id !== id));
      addLog(`Deleted memory record ${id}`, 'info');
    } catch (err: any) {
      addLog(`Delete memory error: ${err.message}`, 'error');
    }
  };

  const handleThemeChange = async (newTheme: 'dark' | 'light' | 'system') => {
    setTheme(newTheme);
    const root = document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else if (newTheme === 'light') {
      root.classList.remove('dark');
    }
    await window.api.updateSettings({ theme: newTheme });
  };

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none animate-in fade-in duration-150">
      <div className="bg-card border border-border rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden text-xs">
        {/* Modal Header */}
        <div className="h-10 px-4 border-b border-border flex items-center justify-between">
          <span className="font-semibold text-foreground text-sm">Settings & Security Keyring</span>
          <button
            onClick={() => toggleSettings(false)}
            className="p-1 text-muted-foreground hover:text-foreground rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-auto p-4 space-y-5">
          {/* Theme Selector */}
          <div className="space-y-2">
            <span className="font-medium text-foreground block">Appearance Theme</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleThemeChange('dark')}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded border text-xs ${
                  theme === 'dark' ? 'bg-primary/10 border-primary text-primary' : 'bg-secondary border-border'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Dark</span>
              </button>
              <button
                onClick={() => handleThemeChange('light')}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded border text-xs ${
                  theme === 'light' ? 'bg-primary/10 border-primary text-primary' : 'bg-secondary border-border'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Light</span>
              </button>
              <button
                onClick={() => handleThemeChange('system')}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded border text-xs ${
                  theme === 'system' ? 'bg-primary/10 border-primary text-primary' : 'bg-secondary border-border'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>System</span>
              </button>
            </div>
          </div>

          {/* safeStorage Keyring Verification */}
          <div className="border border-border rounded-lg p-3 space-y-3 bg-secondary/20">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>OS Credential Encryption (safeStorage)</span>
              </span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded border border-emerald-500/20">
                DPAPI / Keychain
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-normal">
              Test credential encryption. Values are encrypted at the OS level before persistence in SQLite.
            </p>

            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testKey}
                  onChange={(e) => setTestKey(e.target.value)}
                  placeholder="Secret Key Identifier"
                  className="w-1/3 px-2 py-1 bg-background border border-border rounded text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="password"
                  value={testSecret}
                  onChange={(e) => setTestSecret(e.target.value)}
                  placeholder="Enter secret token to encrypt"
                  className="flex-1 px-2 py-1 bg-background border border-border rounded text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <button
                onClick={handleStoreSecret}
                className="w-full py-1.5 bg-primary text-primary-foreground font-medium rounded text-xs hover:bg-primary/90 transition-colors"
              >
                Encrypt & Store in Keychain
              </button>

              {retrievedSecret && (
                <div className="p-2 bg-background border border-border rounded text-[11px] space-y-1">
                  <span className="text-muted-foreground block">Decrypted Value Verification:</span>
                  <span className="font-mono text-emerald-500 break-all">{retrievedSecret}</span>
                </div>
              )}
            </div>
          </div>

          {/* Memory Records Inspector */}
          <div className="border border-border rounded-lg p-3 space-y-2 bg-secondary/20">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-primary" />
              <span>Inspect Persistent Memory</span>
            </span>
            <div className="max-h-36 overflow-auto space-y-1">
              {memories.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic py-2">No memory records saved.</p>
              ) : (
                memories.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-1.5 bg-background border border-border rounded text-[11px]"
                  >
                    <div className="truncate pr-2">
                      <span className="font-semibold text-primary uppercase text-[10px] mr-1.5">
                        [{m.tier}]
                      </span>
                      <span className="font-mono text-muted-foreground">{m.entityKey}: </span>
                      <span className="text-foreground">{m.content}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteMemory(m.id)}
                      className="p-1 text-muted-foreground hover:text-destructive rounded"
                      title="Delete record"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
