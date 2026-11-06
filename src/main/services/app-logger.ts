import { BrowserWindow } from 'electron';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  component: string;
  level: LogLevel;
  message: string;
}

const SENSITIVE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi,
  /(?:api[_-]?key|secret|token|password|auth|credential|private[_-]?key)\s*[:=]\s*["']?([A-Za-z0-9._\-/+~]{8,})["']?/gi,
  /sk-[a-zA-Z0-9_-]{16,}/gi,
  /ghp_[a-zA-Z0-9]{36}/gi,
  /xox[baprs]-[a-zA-Z0-9-]+/gi
];

export class AppLogger {
  private static instance: AppLogger;
  private readonly buffer: SystemLogEntry[] = [];
  private readonly maxBufferSize = 250;

  private constructor() {}

  public static getInstance(): AppLogger {
    if (!AppLogger.instance) {
      AppLogger.instance = new AppLogger();
    }
    return AppLogger.instance;
  }

  public sanitize(text: string): string {
    if (!text || typeof text !== 'string') return String(text || '');
    let sanitized = text;
    for (const pattern of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, (match, p1) => {
        if (p1 && match.includes(p1)) {
          return match.replace(p1, '***REDACTED***');
        }
        return match.startsWith('Bearer ') ? 'Bearer ***REDACTED***' : '***REDACTED***';
      });
    }
    return sanitized;
  }

  public log(level: LogLevel, component: string, message: string, extra?: unknown): void {
    const timestamp = new Date().toLocaleTimeString();
    const cleanMessage = this.sanitize(message);
    const id = `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const entry: SystemLogEntry = {
      id,
      timestamp,
      component,
      level,
      message: `[${component}] ${cleanMessage}`
    };

    // Maintain in-memory ring buffer
    this.buffer.push(entry);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }

    // Format console output
    const consolePrefix = `[${timestamp}] [${level.toUpperCase().padEnd(5)}] [${component}]`;
    if (level === 'error') {
      if (extra instanceof Error) {
        console.error(consolePrefix, cleanMessage, '\n', this.sanitize(extra.stack || ''));
      } else if (extra) {
        console.error(consolePrefix, cleanMessage, extra);
      } else {
        console.error(consolePrefix, cleanMessage);
      }
    } else if (level === 'warn') {
      console.warn(consolePrefix, cleanMessage, extra || '');
    } else if (level === 'debug') {
      if (process.env.DEBUG || process.env.NODE_ENV !== 'production') {
        console.debug(consolePrefix, cleanMessage, extra || '');
      }
    } else {
      console.log(consolePrefix, cleanMessage);
    }

    // Broadcast to open Electron windows
    try {
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send('system:log-event', {
            id: entry.id,
            timestamp: entry.timestamp,
            message: entry.message,
            level: entry.level === 'debug' ? 'info' : entry.level
          });
        }
      }
    } catch {
      // Ignore IPC broadcast failures during early initialization or teardown
    }
  }

  public info(component: string, message: string): void {
    this.log('info', component, message);
  }

  public warn(component: string, message: string, extra?: unknown): void {
    this.log('warn', component, message, extra);
  }

  public error(component: string, message: string, error?: unknown): void {
    this.log('error', component, message, error);
  }

  public debug(component: string, message: string, extra?: unknown): void {
    this.log('debug', component, message, extra);
  }

  public getRecentLogs(): SystemLogEntry[] {
    return [...this.buffer];
  }

  public clearBuffer(): void {
    this.buffer.length = 0;
  }
}

export const appLogger = AppLogger.getInstance();
