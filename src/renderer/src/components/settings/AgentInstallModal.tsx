import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { X, Check, Loader2, AlertCircle, Terminal as TerminalIcon } from 'lucide-react';
import { OfficialLogoRenderer } from '../OfficialLogos';
import type { CLIProvider } from '../../../../shared/cli';

export interface AgentItemToInstall {
  id: string;
  name: string;
  provider: CLIProvider;
  installCommand?: string;
}

interface AgentInstallModalProps {
  agent: AgentItemToInstall | null;
  isOpen: boolean;
  onClose: () => void;
  onInstalled?: () => void;
}

export const AgentInstallModal: React.FC<AgentInstallModalProps> = ({
  agent,
  isOpen,
  onClose,
  onInstalled
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const terminalIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<'running' | 'success' | 'failed'>('running');

  useEffect(() => {
    if (!isOpen || !agent || !containerRef.current) return;

    setStatus('running');
    const termId = `install-${agent.id}-${Date.now()}`;
    terminalIdRef.current = termId;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: "'Cascadia Code', 'Consolas', 'JetBrains Mono', monospace",
      fontSize: 12,
      lineHeight: 1.3,
      allowTransparency: true,
      theme: {
        background: '#090A0D',
        foreground: '#D5D8DD',
        cursor: '#D5D8DD',
        black: '#12141A',
        brightBlack: '#404550',
        green: '#34D399',
        brightGreen: '#4ADE80',
        yellow: '#FBBF24',
        brightYellow: '#FDE047',
        red: '#F87171',
        brightRed: '#EF4444',
        blue: '#60A5FA',
        brightBlue: '#93C5FD',
        white: '#ECEDEF',
        brightWhite: '#FFFFFF'
      }
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    let cleanupData: (() => void) | undefined;
    let cleanupExit: (() => void) | undefined;

    const startSession = async () => {
      try {
        term.writeln(`\x1b[38;2;116;121;130m[Orc Installer] Initializing mini terminal for ${agent.name}...\x1b[0m\r\n`);

        cleanupData = window.api.onTerminalData((e) => {
          if (e.terminalId === termId) {
            term.write(e.data);
          }
        });

        cleanupExit = window.api.onTerminalExit((e) => {
          if (e.terminalId === termId) {
            if (e.exitCode === 0) {
              setStatus('success');
              term.writeln(`\r\n\x1b[32m✔ ${agent.name} installed successfully!\x1b[0m`);
            } else {
              setStatus('failed');
              term.writeln(`\r\n\x1b[31m✖ Process finished with exit code ${e.exitCode}.\x1b[0m`);
            }
            onInstalled?.();
          }
        });

        const res = await window.api.terminalCreate({
          terminalId: termId,
          provider: 'powershell',
          cols: 75,
          rows: 15
        });

        if (!res.success) {
          term.writeln(`\x1b[31mFailed to start terminal: ${res.error || 'Unknown error'}\x1b[0m`);
          setStatus('failed');
          return;
        }

        const cmd = agent.installCommand || `npm install -g ${agent.id}`;
        setTimeout(() => {
          window.api.terminalWrite({
            terminalId: termId,
            data: `${cmd}\r`
          });
        }, 500);
      } catch (err: any) {
        term.writeln(`\x1b[31mError launching terminal: ${err.message}\x1b[0m`);
        setStatus('failed');
      }
    };

    startSession();

    const handleResize = () => {
      try {
        fitAddon.fit();
      } catch {}
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cleanupData?.();
      cleanupExit?.();
      if (terminalIdRef.current) {
        window.api.terminalKill({ terminalId: terminalIdRef.current }).catch(() => {});
      }
      term.dispose();
      termRef.current = null;
    };
  }, [isOpen, agent]);

  if (!isOpen || !agent) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-[#0C0E12] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.05]">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
            </div>
            <div className="h-3 w-px bg-white/10 mx-1" />
            <div className="flex items-center gap-1.5">
              <OfficialLogoRenderer
                provider={agent.provider}
                title={agent.name}
                className="w-3.5 h-3.5"
              />
              <span className="text-xs font-medium text-white font-mono">
                terminal : install-{agent.id}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-foreground-muted hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="Close mini terminal"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Terminal Container */}
        <div
          ref={containerRef}
          className="h-64 p-3 bg-[#090A0D] overflow-hidden select-text"
        />

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.02] border-t border-white/[0.05]">
          <div className="flex items-center gap-2 text-xs">
            {status === 'running' && (
              <>
                <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
                <span className="text-foreground-secondary font-mono text-[11px]">
                  Running installation command...
                </span>
              </>
            )}
            {status === 'success' && (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-mono text-[11px]">
                  Installation complete
                </span>
              </>
            )}
            {status === 'failed' && (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-rose-400 font-mono text-[11px]">
                  Process ended with errors
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-xs font-medium rounded-md bg-white/[0.06] hover:bg-white/[0.1] text-foreground hover:text-white transition-colors cursor-pointer font-mono"
          >
            {status === 'running' ? 'Cancel' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};
