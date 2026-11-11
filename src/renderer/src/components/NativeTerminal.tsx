import React, { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { useWorkspaceStore, TerminalSessionItem } from '../stores/workspace.store';

export interface NativeTerminalProps {
  session: TerminalSessionItem;
  isActive: boolean;
  onFocus: () => void;
}

// Module-level ring buffer cache to preserve terminal state across pane moves and tab switches
// without triggering costly React component re-renders during high-speed typing
const terminalBufferCache = new Map<string, string>();

export const NativeTerminal: React.FC<NativeTerminalProps> = ({ session, isActive, onFocus }) => {
  const { project, customPaths } = useWorkspaceStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const isCreatedRef = useRef(false);

  // Initialize xterm and connect to PTY
  useEffect(() => {
    if (!containerRef.current || termRef.current) return;

    const isWin = typeof navigator !== 'undefined' ? navigator.userAgent.includes('Windows') : true;

    // Visible dark charcoal/graphite grey theme (#21242d) for clear distinction from outer chrome
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      cursorInactiveStyle: 'outline',
      fontFamily: "'Cascadia Code', 'Consolas', 'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 13,
      lineHeight: 1.35,
      letterSpacing: 0,
      theme: {
        background: '#0a0b0d',
        foreground: '#e2e8f0',
        cursor: '#d5d8dd',
        cursorAccent: '#0a0b0d',
        selectionBackground: 'rgba(255, 255, 255, 0.15)',
        black: '#121418',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f1f5f9',
        brightBlack: '#64748b',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#fde047',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff'
      },
      allowTransparency: true,
      windowsPty: isWin ? { backend: 'conpty' } : undefined,
      scrollback: 5000
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(containerRef.current);
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Direct hardware-accelerated keystroke dispatch: zero promise latency, zero React state dispatch
    const onDataDisposable = term.onData((data) => {
      window.api?.terminalWrite({
        terminalId: session.id,
        data
      });
    });

    // Listen for incoming PTY stream data directly into xterm with zero React diffing overhead
    const removeDataListener = window.api?.onTerminalData((event) => {
      if (event.terminalId === session.id) {
        term.write(event.data);
        // Retain bounded ring buffer for pane transitions without React state pollution
        const existing = terminalBufferCache.get(session.id) || '';
        terminalBufferCache.set(session.id, (existing + event.data).slice(-150000));
      }
    });

    // Listen for process exit events
    const removeExitListener = window.api?.onTerminalExit((event) => {
      if (event.terminalId === session.id) {
        const exitMsg = `\r\n\x1b[90m[Process exited with code ${event.exitCode}]\x1b[0m\r\n`;
        term.write(exitMsg);
        const existing = terminalBufferCache.get(session.id) || '';
        terminalBufferCache.set(session.id, (existing + exitMsg).slice(-150000));
      }
    });

    // Spawns native PTY session with verified container geometry
    const spawnSession = (cols: number, rows: number) => {
      if (isCreatedRef.current) return;
      isCreatedRef.current = true;

      window.api?.terminalCreate({
        terminalId: session.id,
        provider: session.provider,
        workingDirectory: session.workingDirectory || project?.path,
        customPath: customPaths[session.provider],
        cols,
        rows
      }).then((res) => {
        if (!res.success) {
          term.writeln(`\r\n\x1b[31;1m[Orbito CLI Gateway] Unable to launch agent: ${session.provider}\x1b[0m`);
          if (res.error) {
            term.writeln(`\x1b[90m${res.error}\x1b[0m\r\n`);
          }
          if (res.installCommand) {
            term.writeln(`\x1b[33mInstallation command:\x1b[0m`);
            term.writeln(`  \x1b[36m${res.installCommand}\x1b[0m\r\n`);
          }
          if (res.installGuideUrl) {
            term.writeln(`\x1b[33mDocumentation & Setup:\x1b[0m`);
            term.writeln(`  \x1b[4;34m${res.installGuideUrl}\x1b[0m\r\n`);
          }
          term.writeln(`\x1b[90mConfigure custom executable paths anytime in Settings > Agents.\x1b[0m\r\n`);
        } else if (res.isExisting) {
          // Instantly restore cached buffer when tab is moved across split panes or re-mounted
          const cached = terminalBufferCache.get(session.id);
          if (cached && term.buffer.active.length <= 1) {
            term.write(cached);
          } else {
            const isShell = session.provider === 'powershell' || session.provider === 'cmd' || session.provider === 'bash';
            if (isShell && session.streamOutput && term.buffer.active.length <= 1) {
              term.write(session.streamOutput);
            }
          }
        }
      }).catch((err) => {
        term.writeln(`\r\n\x1b[31m[Failed to start session: ${err.message}]\x1b[0m\r\n`);
      });
    };

    let isDisposed = false;

    // Measure exact container geometry after DOM layout and font metrics are settled
    const initAndSpawn = () => {
      if (isDisposed || !termRef.current || !fitAddonRef.current || !containerRef.current) return;
      try {
        fitAddonRef.current.fit();
      } catch {}

      const dims = fitAddonRef.current.proposeDimensions();
      const cols = dims?.cols && dims.cols > 10 ? dims.cols : (termRef.current.cols > 10 ? termRef.current.cols : 120);
      const rows = dims?.rows && dims.rows > 4 ? dims.rows : (termRef.current.rows > 4 ? termRef.current.rows : 30);

      try {
        if (cols !== termRef.current.cols || rows !== termRef.current.rows) {
          termRef.current.resize(cols, rows);
        }
      } catch {}

      spawnSession(cols, rows);
    };

    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(() => {
        requestAnimationFrame(initAndSpawn);
      }).catch(() => {
        requestAnimationFrame(initAndSpawn);
      });
    } else {
      requestAnimationFrame(initAndSpawn);
    }

    // High-performance resize handling:
    // 1. Fits xterm canvas visually immediately for instant zero-lag UI feedback
    // 2. Throttles backend ConPTY resize by 50ms to prevent buffer corruption during fast split divider dragging
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let lastPtyCols = 0;
    let lastPtyRows = 0;

    const commitPtyResize = () => {
      if (!termRef.current || !fitAddonRef.current) return;
      try {
        fitAddonRef.current.fit();
        const cols = termRef.current.cols;
        const rows = termRef.current.rows;
        if (cols > 10 && rows > 4 && (cols !== lastPtyCols || rows !== lastPtyRows)) {
          lastPtyCols = cols;
          lastPtyRows = rows;
          window.api?.terminalResize({
            terminalId: session.id,
            cols,
            rows
          });
        }
      } catch {}
    };

    const resizeObserver = new ResizeObserver((entries) => {
      if (!fitAddonRef.current || !termRef.current) return;
      const entry = entries[0];
      if (entry && (entry.contentRect.width === 0 || entry.contentRect.height === 0)) {
        return;
      }
      try {
        fitAddonRef.current.fit();
      } catch {}

      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        commitPtyResize();
        resizeTimer = null;
      }, 50);
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Initial focus if active
    if (isActive) {
      setTimeout(() => {
        term.focus();
      }, 50);
    }

    // Handle clear/reset custom event from workspace toolbar
    const handleResetEvent = () => {
      terminalBufferCache.delete(session.id);
      term.reset();
      isCreatedRef.current = false;
      initAndSpawn();
    };
    window.addEventListener(`terminal:reset:${session.id}`, handleResetEvent);

    return () => {
      isDisposed = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener(`terminal:reset:${session.id}`, handleResetEvent);
      resizeObserver.disconnect();
      onDataDisposable.dispose();
      removeDataListener?.();
      removeExitListener?.();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [session.id, session.provider]);

  // Keep focus and fit in sync when active tab / split pane changes
  useEffect(() => {
    if (isActive && termRef.current && fitAddonRef.current) {
      const timer = setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
          termRef.current?.focus();
          if (termRef.current && termRef.current.cols > 0 && termRef.current.rows > 0) {
            window.api?.terminalResize({
              terminalId: session.id,
              cols: termRef.current.cols,
              rows: termRef.current.rows
            });
          }
        } catch {
          // ignore
        }
      }, 40);
      return () => clearTimeout(timer);
    }
  }, [isActive, session.id]);

  const handleContainerClick = useCallback(() => {
    onFocus();
    if (termRef.current) {
      termRef.current.focus();
    }
  }, [onFocus]);

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      className="w-full h-full p-0 m-0 bg-[#21242d] overflow-hidden select-text cursor-text relative"
      style={{
        outline: 'none'
      }}
    />
  );
};
