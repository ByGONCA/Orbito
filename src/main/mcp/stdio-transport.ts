import { spawn, ChildProcess } from 'node:child_process';
import { SecretRedactor } from './security/secret-redactor';

export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface StdioTransportOptions {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  onLog?: (line: string, isError: boolean) => void;
  onExit?: (code: number | null, signal: NodeJS.Signals | null) => void;
}

export class StdioTransport {
  private child: ChildProcess | null = null;
  private pendingRequests: Map<string | number, {
    resolve: (res: any) => void;
    reject: (err: any) => void;
    timer: NodeJS.Timeout;
  }> = new Map();
  private stdoutBuffer = '';
  private nextRequestId = 1;
  private isClosing = false;

  constructor(private options: StdioTransportOptions) {}

  public async start(): Promise<void> {
    if (this.child) return;
    this.isClosing = false;

    // Merge system environment with decrypted secrets and ensure PATH is intact
    const childEnv = {
      ...process.env,
      ...this.options.env
    };

    const isWindows = process.platform === 'win32';
    // Use shell on Windows if command needs path resolution (e.g. npx.cmd)
    const shell = isWindows;

    this.child = spawn(this.options.command, this.options.args || [], {
      env: childEnv,
      cwd: this.options.cwd || process.cwd(),
      shell,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.child.stdout?.setEncoding('utf8');
    this.child.stderr?.setEncoding('utf8');

    this.child.stdout?.on('data', (chunk: string) => {
      this.handleStdout(chunk);
    });

    this.child.stderr?.on('data', (chunk: string) => {
      const redacted = SecretRedactor.redactText(chunk);
      this.options.onLog?.(redacted, true);
    });

    this.child.on('exit', (code, signal) => {
      this.cleanup();
      if (!this.isClosing) {
        this.options.onExit?.(code, signal);
      }
    });

    this.child.on('error', (err) => {
      const redacted = SecretRedactor.redactText(err.message);
      this.options.onLog?.(`Process spawn error: ${redacted}`, true);
      this.cleanup();
    });
  }

  private handleStdout(chunk: string): void {
    this.stdoutBuffer += chunk;
    const lines = this.stdoutBuffer.split('\n');
    // The last element is either an incomplete line or empty string
    this.stdoutBuffer = lines.pop() || '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      try {
        const msg = JSON.parse(line) as JSONRPCResponse;
        if (msg.id !== undefined && this.pendingRequests.has(msg.id)) {
          const req = this.pendingRequests.get(msg.id)!;
          clearTimeout(req.timer);
          this.pendingRequests.delete(msg.id);

          if (msg.error) {
            req.reject(new Error(msg.error.message || `JSON-RPC error code ${msg.error.code}`));
          } else {
            req.resolve(msg.result);
          }
        }
      } catch {
        // Line might be plain server log emitted on stdout
        this.options.onLog?.(SecretRedactor.redactText(line), false);
      }
    }
  }

  public async sendRequest<T = any>(method: string, params?: any, timeoutMs = 30000): Promise<T> {
    if (!this.child || !this.child.stdin || this.child.killed) {
      throw new Error(`Stdio transport is not running for command "${this.options.command}".`);
    }

    const id = this.nextRequestId++;
    const payload: JSONRPCRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`MCP request timeout (${method}) after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer });

      try {
        const json = JSON.stringify(payload) + '\n';
        this.child!.stdin!.write(json, 'utf8');
      } catch (err: any) {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        reject(err);
      }
    });
  }

  public sendNotification(method: string, params?: any): void {
    if (!this.child || !this.child.stdin || this.child.killed) return;
    const payload = {
      jsonrpc: '2.0',
      method,
      params
    };
    try {
      this.child.stdin.write(JSON.stringify(payload) + '\n', 'utf8');
    } catch {}
  }

  public async stop(): Promise<void> {
    this.isClosing = true;
    if (!this.child || this.child.killed) {
      this.cleanup();
      return;
    }

    return new Promise<void>((resolve) => {
      const killTimer = setTimeout(() => {
        try {
          if (this.child && !this.child.killed) {
            this.child.kill('SIGKILL');
          }
        } catch {}
        this.cleanup();
        resolve();
      }, 2000);

      this.child!.once('exit', () => {
        clearTimeout(killTimer);
        this.cleanup();
        resolve();
      });

      try {
        this.child!.kill('SIGTERM');
      } catch {
        clearTimeout(killTimer);
        this.cleanup();
        resolve();
      }
    });
  }

  private cleanup(): void {
    for (const [id, req] of this.pendingRequests.entries()) {
      clearTimeout(req.timer);
      req.reject(new Error('Process exited before response was received.'));
    }
    this.pendingRequests.clear();
    this.child = null;
    this.stdoutBuffer = '';
  }

  public isRunning(): boolean {
    return Boolean(this.child && !this.child.killed);
  }
}
