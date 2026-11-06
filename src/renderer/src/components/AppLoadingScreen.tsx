import React, { useState, useEffect, useRef } from 'react';
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  ShieldAlert,
  FolderX,
  Minus,
  Square,
  X,
  Layers
} from 'lucide-react';

export interface AppLoadingScreenProps {
  onComplete: () => void;
  onBypassWorkspace: () => void;
  restoreWorkspace: (
    onProgress: (percent: number, msg: string, detail: string, stepId: string) => void
  ) => Promise<void>;
}

interface InitStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
}

export const AppLoadingScreen: React.FC<AppLoadingScreenProps> = ({
  onComplete,
  onBypassWorkspace,
  restoreWorkspace
}) => {
  const [progress, setProgress] = useState(10);
  const [statusMessage, setStatusMessage] = useState('A inicializar o motor central...');
  const [statusDetail, setStatusDetail] = useState('A verificar subsistema Electron e IPC');
  const [isStalled, setIsStalled] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [errorDetails, setErrorDetails] = useState<{
    message: string;
    stack?: string;
    step?: string;
  } | null>(null);

  const [steps, setSteps] = useState<InitStep[]>([
    { id: 'ipc', label: 'Motor de Execução e IPC', status: 'running' },
    { id: 'db', label: 'Persistência SQLite e Definições', status: 'pending' },
    { id: 'skills', label: 'Ferramentas e Extensões', status: 'pending' },
    { id: 'workspace', label: 'Espaço de Trabalho e Grafo de Código', status: 'pending' }
  ]);

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
        const activeStep = steps.find((s) => s.status === 'running')?.label || 'Inicialização';
        setSteps((prev) =>
          prev.map((s) => (s.status === 'running' ? { ...s, status: 'error' } : s))
        );
        setErrorDetails({
          message: event.message || 'Erro inesperado durante o arranque.',
          stack: event.error?.stack,
          step: activeStep
        });
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!completedRef.current) {
        const activeStep = steps.find((s) => s.status === 'running')?.label || 'Inicialização';
        setSteps((prev) =>
          prev.map((s) => (s.status === 'running' ? { ...s, status: 'error' } : s))
        );
        setErrorDetails({
          message: event.reason?.message || String(event.reason),
          stack: event.reason?.stack,
          step: activeStep
        });
      }
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [steps]);

  // Main stepped initialization workflow
  const startLoading = async () => {
    setErrorDetails(null);
    setIsStalled(false);
    setProgress(10);
    completedRef.current = false;

    // Reset steps
    setSteps([
      { id: 'ipc', label: 'Motor de Execução e IPC', status: 'running' },
      { id: 'db', label: 'Persistência SQLite e Definições', status: 'pending' },
      { id: 'skills', label: 'Ferramentas e Extensões', status: 'pending' },
      { id: 'workspace', label: 'Espaço de Trabalho e Grafo de Código', status: 'pending' }
    ]);

    try {
      await restoreWorkspace((percent, msg, detail, stepId) => {
        setProgress(percent);
        setStatusMessage(msg);
        setStatusDetail(detail);

        setSteps((prev) =>
          prev.map((s) => {
            if (s.id === stepId) {
              return { ...s, status: 'running' };
            }
            // Mark previous steps as done
            const stepOrder = ['ipc', 'db', 'skills', 'workspace'];
            const currentIndex = stepOrder.indexOf(stepId);
            const thisIndex = stepOrder.indexOf(s.id);
            if (thisIndex < currentIndex) {
              return { ...s, status: 'done' };
            }
            return s;
          })
        );
      });

      // Mark all completed
      setSteps((prev) => prev.map((s) => ({ ...s, status: 'done' })));
      setProgress(100);
      setStatusMessage('Ambiente pronto.');
      setStatusDetail('A inicializar interface de trabalho...');

      completedRef.current = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      // Graceful completion handoff
      setTimeout(() => {
        onComplete();
      }, 400);
    } catch (err: any) {
      console.error('[AppLoadingScreen] Startup error:', err);
      const activeStep = steps.find((s) => s.status === 'running')?.label || 'Inicialização';
      setSteps((prev) =>
        prev.map((s) => (s.status === 'running' ? { ...s, status: 'error' } : s))
      );
      setErrorDetails({
        message: err?.message || 'Erro inesperado durante o arranque da aplicação.',
        stack: err?.stack,
        step: activeStep
      });
    }
  };

  useEffect(() => {
    startLoading();
  }, []);

  const handleCopyError = async () => {
    if (!errorDetails) return;
    const info = `AI Workspace Startup Failure Diagnostics\nTimestamp: ${new Date().toISOString()}\nStep: ${errorDetails.step}\nMessage: ${errorDetails.message}\nStack: ${errorDetails.stack || 'N/A'}`;
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
    <div className="fixed inset-0 z-50 flex flex-col bg-[#101113] text-[#ECEDEF] select-none font-sans overflow-hidden">
      {/* 1. Frameless Window Top Bar with Drag Region and Window Controls */}
      <div
        className="h-10 w-full flex items-center justify-between px-3 border-b border-white/[0.06] bg-[#141619]/60 backdrop-blur-md flex-shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2 text-xs font-medium text-[#A4A8AF]">
          <div className="w-4 h-4 rounded bg-white/[0.06] border border-white/[0.1] flex items-center justify-center">
            <Layers className="w-2.5 h-2.5 text-[#ECEDEF]" />
          </div>
          <span className="text-[#ECEDEF] tracking-tight">AI Workspace</span>
          <span className="text-[10px] text-[#747982] border-l border-white/[0.08] pl-2 ml-1">
            Arranque do Sistema
          </span>
        </div>

        {/* Window Controls */}
        <div
          className="flex items-center gap-0.5"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={handleMinimize}
            className="w-8 h-7 flex items-center justify-center rounded-sm text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.08] transition-colors cursor-pointer"
            title="Minimizar"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleMaximize}
            className="w-8 h-7 flex items-center justify-center rounded-sm text-[#A4A8AF] hover:text-[#ECEDEF] hover:bg-white/[0.08] transition-colors cursor-pointer"
            title={isMaximized ? 'Restaurar' : 'Maximizar'}
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            onClick={handleClose}
            className="w-8 h-7 flex items-center justify-center rounded-sm text-[#A4A8AF] hover:text-white hover:bg-[#E81123] transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Main Centered Splash / Loading Container */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        {/* Soft neutral ambient glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(800px 500px at 50% 40%, rgba(255, 255, 255, 0.02) 0%, transparent 70%)'
          }}
        />

        <div className="w-[380px] max-w-full relative z-10 space-y-6">
          {/* Logo & Header (clean, unboxed) */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center flex-shrink-0">
              <Layers className="w-6 h-6 text-[#ECEDEF]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#ECEDEF] tracking-tight">AI Workspace</h2>
              <p className="text-xs text-[#747982] mt-0.5">Ambiente de Desenvolvimento de Agentes Locais</p>
            </div>
          </div>

          {/* Progress Bar & Status Text (unboxed, clean typography) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#ECEDEF]">{statusMessage}</span>
              <span className="font-mono text-[#747982] text-xs">{progress}%</span>
            </div>

            {/* Flat, borderless minimal progress bar */}
            <div className="w-full h-0.5 bg-white/[0.08] rounded-full overflow-hidden relative">
              <div
                className={`h-full rounded-full transition-all duration-300 ease-out ${
                  errorDetails ? 'bg-[#ef4444]' : 'bg-[#ECEDEF]'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>

            <p className="text-[11px] text-[#747982] truncate">{statusDetail}</p>
          </div>

          {/* Initialization Stages Checklist (borderless) */}
          <div className="space-y-2 pt-1">
            {steps.map((step) => (
              <div key={step.id} className="flex items-center justify-between text-xs py-0.5">
                <span
                  className={
                    step.status === 'done'
                      ? 'text-[#747982]'
                      : step.status === 'running'
                      ? 'text-[#ECEDEF] font-medium'
                      : step.status === 'error'
                      ? 'text-[#ef4444] font-medium'
                      : 'text-[#747982]/60'
                  }
                >
                  {step.label}
                </span>

                <div className="flex items-center">
                  {step.status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-[#ECEDEF]" />}
                  {step.status === 'running' && (
                    <Loader2 className="w-3.5 h-3.5 text-[#ECEDEF] animate-spin" />
                  )}
                  {step.status === 'error' && (
                    <AlertTriangle className="w-3.5 h-3.5 text-[#ef4444]" />
                  )}
                  {step.status === 'pending' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white/[0.15]" />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 3. STALL / FREEZE WARNING (if startup exceeds threshold) */}
          {isStalled && !errorDetails && (
            <div className="pt-2 space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-300">O arranque está a demorar mais do que o esperado</p>
                  <p className="text-[#747982] text-[11px] mt-0.5">
                    Um serviço local ou um projeto anterior pode estar a responder lentamente.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={onBypassWorkspace}
                  className="text-xs text-[#ECEDEF] hover:underline flex items-center gap-1.5 cursor-pointer"
                >
                  <FolderX className="w-3.5 h-3.5 text-[#A4A8AF]" />
                  <span>Abrir Espaço Vazio</span>
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="text-xs text-[#747982] hover:text-[#ECEDEF] flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Recarregar</span>
                </button>
              </div>
            </div>
          )}

          {/* 4. ERROR DETAILS (if an error occurs) */}
          {errorDetails && (
            <div className="pt-2 space-y-2.5 text-left text-xs">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-[#ef4444] flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#f87171]">Falha na Inicialização da Aplicação</p>
                  <p className="text-[11px] text-[#747982] mt-0.5">
                    Ocorreu um erro no passo: <span className="font-mono text-[#fca5a5]">{errorDetails.step}</span>
                  </p>
                </div>
              </div>

              {/* Monospace Error Details */}
              <div className="p-2 text-[11px] font-mono text-[#fca5a5] max-h-32 overflow-y-auto leading-relaxed select-text bg-white/[0.02] rounded">
                <p className="font-semibold">{errorDetails.message}</p>
                {errorDetails.stack && (
                  <pre className="text-[10px] text-[#747982] mt-1.5 pt-1.5 border-t border-white/[0.04] whitespace-pre-wrap">
                    {errorDetails.stack}
                  </pre>
                )}
              </div>

              {/* Action Links/Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  onClick={startLoading}
                  className="text-xs text-[#ECEDEF] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Tentar Novamente</span>
                </button>

                <button
                  onClick={onBypassWorkspace}
                  className="text-xs text-[#747982] hover:text-[#ECEDEF] flex items-center gap-1 cursor-pointer"
                >
                  <FolderX className="w-3 h-3 text-[#747982]" />
                  <span>Modo Seguro</span>
                </button>

                <button
                  onClick={handleCopyError}
                  className="text-xs text-[#747982] hover:text-[#ECEDEF] flex items-center gap-1 cursor-pointer ml-auto"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copiado' : 'Copiar'}</span>
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
