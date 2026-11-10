import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  FolderX,
  Minus,
  Square,
  X
} from 'lucide-react';
import orbitLogo from '../assets/Orbit.png';

export interface AppLoadingScreenProps {
  onComplete: () => void;
  onBypassWorkspace: () => void;
  restoreWorkspace: (
    onProgress: (percent: number, msg: string, detail: string, stepId: string) => void
  ) => Promise<void>;
}

export const AppLoadingScreen: React.FC<AppLoadingScreenProps> = ({
  onComplete,
  onBypassWorkspace,
  restoreWorkspace
}) => {
  const [statusMessage, setStatusMessage] = useState('Starting Orbito...');
  const [isStalled, setIsStalled] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [errorDetails, setErrorDetails] = useState<{
    message: string;
    stack?: string;
    step?: string;
  } | null>(null);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const completedRef = useRef(false);

  // Sync window maximized state for frameless header
  useEffect(() => {
    window.api?.isWindowMaximized?.().then(setIsMaximized).catch(() => {});
    const unsub = window.api?.onWindowStateChange?.((state) => {
      setIsMaximized(state.isMaximized);
    });
    return () => unsub?.();
  }, []);

  // Watchdog timer: if startup takes more than 7 seconds, flag as stalled
  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      if (!completedRef.current && !errorDetails) {
        setIsStalled(true);
      }
    }, 7000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [errorDetails]);

  // Global error interceptor during startup
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      if (!completedRef.current) {
        setErrorDetails({
          message: event.message || 'Unexpected error during startup.',
          stack: event.error?.stack,
          step: 'Initialization'
        });
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!completedRef.current) {
        setErrorDetails({
          message: event.reason?.message || String(event.reason),
          stack: event.reason?.stack,
          step: 'Initialization'
        });
      }
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Main initialization workflow
  const startLoading = async () => {
    setErrorDetails(null);
    setIsStalled(false);
    completedRef.current = false;

    try {
      await restoreWorkspace((_percent, msg) => {
        setStatusMessage(msg);
      });

      setStatusMessage('Environment ready.');
      completedRef.current = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      // Graceful completion handoff
      setTimeout(() => {
        onComplete();
      }, 50);
    } catch (err: any) {
      console.error('[AppLoadingScreen] Startup error:', err);
      setErrorDetails({
        message: err?.message || 'Unexpected error starting the application.',
        stack: err?.stack,
        step: 'Initialization'
      });
    }
  };

  useEffect(() => {
    startLoading();
  }, []);

  const handleCopyError = async () => {
    if (!errorDetails) return;
    const info = `Orbito Startup Diagnostics\nTimestamp: ${new Date().toISOString()}\nMessage: ${errorDetails.message}\nStack: ${errorDetails.stack || 'N/A'}`;
    try {
      await navigator.clipboard.writeText(info);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleMinimize = () => window.api?.minimizeWindow?.();
  const handleMaximize = () => window.api?.maximizeWindow?.();
  const handleClose = () => window.api?.closeWindow?.();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-transparent text-[#ECEDEF] select-none font-sans overflow-hidden animate-in fade-in duration-150 app-loading-screen-root">
      {/* 1. Minimal Window Title Bar (drag region + window controls) */}
      <div
        className="h-10 w-full flex items-center justify-between px-3 bg-transparent flex-shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2 text-xs font-medium text-[#747982]">
          <span className="text-[#A4A8AF] tracking-tight text-[11px] font-mono">Orbito</span>
        </div>

        {/* Window Controls */}
        <div
          className="flex items-center gap-0.5"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={handleMinimize}
            className="w-8 h-7 flex items-center justify-center rounded-sm text-[#747982] hover:text-[#ECEDEF] hover:bg-white/[0.08] transition-colors cursor-pointer"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleMaximize}
            className="w-8 h-7 flex items-center justify-center rounded-sm text-[#747982] hover:text-[#ECEDEF] hover:bg-white/[0.08] transition-colors cursor-pointer"
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            onClick={handleClose}
            className="w-8 h-7 flex items-center justify-center rounded-sm text-[#747982] hover:text-white hover:bg-[#E81123] transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Main Centered Splash / Clean Typography (No Cards, No Boxiness) */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        {/* Soft subtle ambient glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(600px 400px at 50% 48%, rgba(255, 255, 255, 0.025) 0%, transparent 70%)'
          }}
        />

        <div className="relative z-10 flex flex-col items-center text-center space-y-4 max-w-sm">
          {/* Logo with subtle ambient blur */}
          <div className="relative flex items-center justify-center mb-1">
            <div className="absolute w-20 h-20 rounded-full bg-white/[0.03] blur-xl animate-pulse pointer-events-none" />
            <img
              src={orbitLogo}
              alt="Orbito Logo"
              className="w-14 h-14 object-contain select-none pointer-events-none drop-shadow-md"
            />
          </div>

          {/* Continuous Fluid Loading Bar (Displayed on Top) */}
          {!errorDetails && (
            <div className="w-56 h-[3px] bg-white/[0.08] rounded-full overflow-hidden relative">
              <div
                className="absolute inset-0 w-full h-full rounded-full"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(236, 237, 239, 0.25) 20%, #ECEDEF 50%, rgba(236, 237, 239, 0.25) 80%, transparent 100%)',
                  animation: 'orbito-preloader-fluid 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite',
                  willChange: 'transform'
                }}
              />
            </div>
          )}

          {/* Dynamic Loading Message: Positioned BELOW the Bar */}
          <div className="h-7 flex items-center justify-center">
            {!errorDetails ? (
              <div
                key={statusMessage}
                className="animate-in fade-in slide-in-from-top-1 duration-200 text-xs text-[#A4A8AF] font-medium tracking-wide flex items-center gap-2"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse flex-shrink-0" />
                <span>{statusMessage}</span>
              </div>
            ) : (
              <div className="text-xs text-rose-400 font-medium flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                <span>Startup failed</span>
              </div>
            )}
          </div>

          {/* Stalled notice (if loading takes > 7s) */}
          {isStalled && !errorDetails && (
            <div className="pt-3 space-y-2 text-center animate-in fade-in duration-150">
              <p className="text-[11px] text-[#747982]">
                Startup is taking longer than expected.
              </p>
              <div className="flex items-center justify-center gap-4 text-xs">
                <button
                  onClick={onBypassWorkspace}
                  className="text-xs text-[#ECEDEF] hover:underline flex items-center gap-1.5 cursor-pointer"
                >
                  <FolderX className="w-3.5 h-3.5 text-[#A4A8AF]" />
                  <span>Open Empty Workspace</span>
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="text-xs text-[#747982] hover:text-[#ECEDEF] flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Reload</span>
                </button>
              </div>
            </div>
          )}

          {/* Error Details (if an unhandled error happens) */}
          {errorDetails && (
            <div className="pt-2 space-y-3 text-center text-xs animate-in fade-in duration-150">
              <p className="text-[11px] text-rose-300 max-w-xs truncate mx-auto font-mono">
                {errorDetails.message}
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={startLoading}
                  className="text-xs text-[#ECEDEF] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Try Again</span>
                </button>
                <button
                  onClick={onBypassWorkspace}
                  className="text-xs text-[#747982] hover:text-[#ECEDEF] flex items-center gap-1 cursor-pointer"
                >
                  <FolderX className="w-3 h-3 text-[#747982]" />
                  <span>Safe Mode</span>
                </button>
                <button
                  onClick={handleCopyError}
                  className="text-xs text-[#747982] hover:text-[#ECEDEF] flex items-center gap-1 cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppLoadingScreen;
