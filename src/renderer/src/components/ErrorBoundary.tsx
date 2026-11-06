import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Copy, Check, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('[React ErrorBoundary]', error, errorInfo);
  }

  private handleCopy = async (): Promise<void> => {
    const { error, errorInfo } = this.state;
    const diagnostics = [
      `AI Workspace UI Crash Diagnostics`,
      `Time: ${new Date().toISOString()}`,
      `Error: ${error?.name}: ${error?.message}`,
      `Stack: ${error?.stack || 'N/A'}`,
      `Component Stack: ${errorInfo?.componentStack || 'N/A'}`
    ].join('\n\n');

    try {
      await navigator.clipboard.writeText(diagnostics);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      // Ignore clipboard write failure
    }
  };

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      const { error, errorInfo, copied } = this.state;
      const title = this.props.fallbackTitle || 'An unexpected interface error occurred';

      return (
        <div className="flex flex-col items-center justify-center h-full w-full p-6 bg-background text-foreground select-text font-sans">
          <div className="max-w-xl w-full glass-card bg-surface/85 backdrop-blur-glass border border-border rounded-2xl p-6 shadow-dropdown space-y-4 text-left animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-error/15 border border-error/30 flex items-center justify-center flex-shrink-0 text-error shadow-subtle">
                <AlertTriangle className="w-5 h-5 text-error" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground tracking-tight">{title}</h3>
                <p className="text-xs text-foreground-secondary mt-0.5">
                  The interface safely intercepted a component error.
                </p>
              </div>
            </div>

            {/* Error Message & Stack Box */}
            <div className="bg-background border border-border rounded-xl p-3.5 space-y-2 font-mono text-xs overflow-auto max-h-48 shadow-subtle">
              <p className="font-semibold text-error break-all leading-relaxed">
                {error?.message || 'Unknown error'}
              </p>
              {error?.stack && (
                <pre className="text-[10px] text-foreground-muted whitespace-pre-wrap leading-relaxed mt-1.5 pt-1.5 border-t border-border/40">
                  {error.stack}
                </pre>
              )}
            </div>

            {/* Component Stack Details */}
            {errorInfo?.componentStack && (
              <details className="text-[11px] text-foreground-muted cursor-pointer group">
                <summary className="font-medium text-foreground-secondary hover:text-foreground transition-colors select-none">
                  View Component Stack
                </summary>
                <pre className="p-3 mt-2 bg-background border border-border rounded-xl font-mono text-[10px] whitespace-pre-wrap max-h-36 overflow-auto text-foreground-muted leading-relaxed">
                  {errorInfo.componentStack}
                </pre>
              </details>
            )}

            {/* Action Buttons Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-accent text-background hover:bg-accent-hover shadow-subtle active:scale-[0.98] transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reload App</span>
                </button>

                <button
                  type="button"
                  onClick={this.handleReset}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-surface-elevated text-foreground hover:bg-surface-hover border border-border shadow-subtle active:scale-[0.98] transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-accent" />
                  <span>Try Recovering</span>
                </button>
              </div>

              <button
                type="button"
                onClick={this.handleCopy}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-elevated transition-colors cursor-pointer"
                title="Copy error details to clipboard"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
