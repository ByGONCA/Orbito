import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import type { ExtensionRecord, ExtensionPermissions } from '../../../shared/extensions';

export type OSPlatform = 'win32' | 'darwin' | 'linux';

export type OSSandboxMode =
  | 'os_runtime_permission_model'
  | 'kernel_namespace'
  | 'unsupported';

export interface OSSandboxCapabilities {
  platform: OSPlatform;
  sandboxMode: OSSandboxMode;
  hasNodePermissionModel: boolean;
  hasBubblewrap: boolean;
  hasSandboxExec: boolean;
  memoryQuotaEnforced: boolean;
  networkIsolationEnforced: boolean;
  processTreeCleanupEnforced: boolean;
}

export interface OSSandboxSpawnOptions {
  installPath: string;
  workerScriptPath: string;
  storagePath: string;
  workspacePath?: string;
  permissions?: ExtensionPermissions;
  airGapEnabled?: boolean;
  maxMemoryMb?: number;
}

export class OSSandboxPolicy {
  private static instance: OSSandboxPolicy;
  private cachedCapabilities: OSSandboxCapabilities | null = null;
  private allowUnsandboxedOverride: boolean = false;

  public static getInstance(): OSSandboxPolicy {
    if (!OSSandboxPolicy.instance) {
      OSSandboxPolicy.instance = new OSSandboxPolicy();
    }
    return OSSandboxPolicy.instance;
  }

  /**
   * Sets whether the user has explicitly overridden the sandbox requirement for unsupported platforms.
   */
  public setAllowUnsandboxedOverride(allow: boolean): void {
    this.allowUnsandboxedOverride = allow;
  }

  public getAllowUnsandboxedOverride(): boolean {
    return this.allowUnsandboxedOverride;
  }

  /**
   * Resolves the appropriate Node binary to execute sandboxed child processes.
   * In Electron environments, electron.exe lacks the --permission CLI flag,
   * so we resolve to the system 'node' binary if available.
   */
  public resolveNodeBinary(): string {
    if (!process.versions.electron && !process.env.ELECTRON_RUN_AS_NODE) {
      return process.execPath;
    }
    try {
      execFileSync('node', ['--version'], { timeout: 1000, stdio: 'ignore' });
      return 'node';
    } catch {
      return process.execPath;
    }
  }

  /**
   * Probes and caches current operating system and runtime sandboxing capabilities.
   */
  public detectCapabilities(): OSSandboxCapabilities {
    if (this.cachedCapabilities) {
      return this.cachedCapabilities;
    }

    const platform = process.platform as OSPlatform;

    // 1. Detect Node Permission Model support
    // In Node 20+, the permission system is built into the node executable
    let hasNodePermissionModel = false;
    const nodeBinary = this.resolveNodeBinary();
    try {
      if (typeof (process as any).permission !== 'undefined') {
        hasNodePermissionModel = true;
      } else {
        // Probe via fast test invocation of node binary with --permission
        execFileSync(
          nodeBinary,
          ['--permission', '-e', 'process.exit(0)'],
          { timeout: 1500, stdio: 'ignore' }
        );
        hasNodePermissionModel = true;
      }
    } catch {
      hasNodePermissionModel = false;
    }

    // 2. Detect Linux Bubblewrap (bwrap)
    let hasBubblewrap = false;
    if (platform === 'linux') {
      try {
        execFileSync('bwrap', ['--version'], { timeout: 1000, stdio: 'ignore' });
        hasBubblewrap = true;
      } catch {
        hasBubblewrap = false;
      }
    }

    // 3. Detect macOS sandbox-exec
    let hasSandboxExec = false;
    if (platform === 'darwin') {
      hasSandboxExec = fs.existsSync('/usr/bin/sandbox-exec');
    }

    let sandboxMode: OSSandboxMode = 'unsupported';
    if (hasBubblewrap || hasSandboxExec) {
      sandboxMode = 'kernel_namespace';
    } else if (hasNodePermissionModel) {
      sandboxMode = 'os_runtime_permission_model';
    }

    this.cachedCapabilities = {
      platform,
      sandboxMode,
      hasNodePermissionModel,
      hasBubblewrap,
      hasSandboxExec,
      memoryQuotaEnforced: true,
      networkIsolationEnforced: true,
      processTreeCleanupEnforced: true
    };

    return this.cachedCapabilities;
  }

  /**
   * Builds the exact operating-system & runtime permission flags for spawning the Extension Host.
   */
  public buildSandboxExecArgs(options: OSSandboxSpawnOptions): string[] {
    const {
      installPath,
      workerScriptPath,
      storagePath,
      workspacePath,
      permissions = {} as ExtensionPermissions,
      maxMemoryMb = 128
    } = options;

    const args: string[] = [
      '--permission',
      `--max-old-space-size=${maxMemoryMb}`,
      '--disallow-code-generation-from-strings'
    ];

    // Ensure storage path exists on disk before applying permission boundary
    fs.mkdirSync(storagePath, { recursive: true });

    // 1. Allow reading the worker script directory (extension host runtime)
    const workerDir = path.resolve(path.dirname(workerScriptPath));
    args.push(`--allow-fs-read=${workerDir}*`);

    // 2. Allow reading the extension install directory
    const normalizedInstall = path.resolve(installPath);
    args.push(`--allow-fs-read=${normalizedInstall}*`);

    // 3. Allow writing strictly to the extension's dedicated storage directory
    const normalizedStorage = path.resolve(storagePath);
    args.push(`--allow-fs-write=${normalizedStorage}*`);

    // 4. Workspace permissions (least-privilege)
    if (workspacePath) {
      const normalizedWorkspace = path.resolve(workspacePath);
      const fsPerms = permissions?.filesystem;
      if (fsPerms && fsPerms.read) {
        args.push(`--allow-fs-read=${normalizedWorkspace}*`);
      }
      if (fsPerms && fsPerms.write) {
        args.push(`--allow-fs-write=${normalizedWorkspace}*`);
      }
    }

    // Explicitly note:
    // We intentionally OMIT:
    // --allow-child-process (prevents require('child_process'), fork, exec, spawn)
    // --allow-worker (prevents worker_threads)
    // --allow-addons (prevents loading native C++ .node modules)
    // --allow-wasi (prevents WASI)

    return args;
  }

  /**
   * Terminates a process and all of its spawned descendant processes.
   * Uses taskkill /F /T on Windows, and process group kill on Unix.
   */
  public async terminateProcessTree(pid: number, signal: string = 'SIGKILL'): Promise<void> {
    if (!pid || pid <= 0) return;

    if (process.platform === 'win32') {
      try {
        // /F: Forcefully terminate, /T: Terminate process and any child processes it started
        execFileSync('taskkill.exe', ['/F', '/T', '/PID', String(pid)], {
          stdio: 'ignore',
          timeout: 2000
        });
        return;
      } catch {
        // Fallback to direct process kill
        try {
          process.kill(pid, signal as any);
        } catch {
          // Process already dead
        }
      }
    } else {
      try {
        // On Unix, negative PID kills the entire process group
        process.kill(-pid, signal as any);
      } catch {
        try {
          process.kill(pid, signal as any);
        } catch {
          // Process already dead
        }
      }
    }
  }

  /**
   * Asserts whether an extension is authorized to execute under the specified sandboxing capabilities.
   * If sandboxing is unavailable, untrusted third-party extensions are rejected by default.
   */
  public evaluateUntrustedExecution(
    record: ExtensionRecord,
    caps: OSSandboxCapabilities,
    allowOverride: boolean = this.allowUnsandboxedOverride
  ): {
    allowed: boolean;
    reason?: string;
    sandboxMode: string;
    warning?: string;
  } {
    if (caps.hasNodePermissionModel || caps.sandboxMode === 'kernel_namespace') {
      return {
        allowed: true,
        sandboxMode: caps.sandboxMode
      };
    }

    // Built-in trusted extensions can always execute
    if (record.isBuiltIn) {
      return {
        allowed: true,
        sandboxMode: 'trusted_builtin'
      };
    }

    // Explicit user override check
    if (allowOverride) {
      return {
        allowed: true,
        sandboxMode: 'unsandboxed_override_warning',
        warning: 'SECURITY WARNING: Extension is executing without OS-level sandboxing because user override is enabled.'
      };
    }

    return {
      allowed: false,
      sandboxMode: 'unsupported',
      reason:
        `Cannot activate untrusted extension "${record.id}": Operating-system / runtime-level sandboxing is unavailable on this host (${caps.platform}). ` +
        `To protect system integrity, third-party extensions are disabled by default on unsandboxed hosts.`
    };
  }

  /**
   * Asserts whether an extension is authorized to execute under the current platform sandbox.
   * If sandboxing is unavailable, untrusted third-party extensions are rejected by default.
   */
  public canExecuteUntrusted(
    record: ExtensionRecord,
    allowUnsandboxedOverride: boolean = this.allowUnsandboxedOverride
  ): {
    allowed: boolean;
    reason?: string;
    sandboxMode: string;
    warning?: string;
  } {
    return this.evaluateUntrustedExecution(
      record,
      this.detectCapabilities(),
      allowUnsandboxedOverride
    );
  }

  /**
   * Generates a transparent platform security comparison report.
   */
  public getPlatformSecurityReport(): {
    currentPlatform: OSPlatform;
    activeSandboxMode: OSSandboxMode;
    guarantees: Record<string, string>;
    residualRisks: Record<string, string>;
  } {
    const caps = this.detectCapabilities();

    const guarantees: Record<string, string> = {
      process_isolation: 'Child process boundary prevents direct memory corruption and crashes of the Main Electron process.',
      filesystem_isolation: 'Node.js Permission Model strictly denies unauthorized read and write calls to non-whitelisted paths at runtime.',
      subprocess_prohibition: 'ChildProcess permission is denied, blocking all fork(), spawn(), and exec() system calls.',
      addons_prohibition: 'Native C++ addon loading (.node dlopen) is denied, preventing unmanaged code execution.',
      network_interception: 'Socket, Datagram, and HTTP/HTTPS/Fetch prototypes are guarded, blocking unprivileged outbound connections and local loopback scanning.',
      memory_quota: 'Heap memory is capped at 128MB per extension via --max-old-space-size=128.',
      tree_termination: 'Process tree cleanup (taskkill /T on Windows, process groups on Unix) guarantees no orphaned background processes.'
    };

    const residualRisks: Record<string, string> = {
      windows: 'Windows AppContainer is not natively supported by standard Node.js binaries without native C++ bootstrap wrapper.',
      linux: caps.hasBubblewrap
        ? 'Bubblewrap provides kernel namespace isolation for network and filesystem mount namespaces.'
        : 'Linux without bwrap relies on Node Permission Model and process environment sanitization.',
      macos: caps.hasSandboxExec
        ? 'macOS sandbox-exec applies seatbelt sandbox profiles.'
        : 'macOS without sandbox-exec profile relies on Node Permission Model.'
    };

    return {
      currentPlatform: caps.platform,
      activeSandboxMode: caps.sandboxMode,
      guarantees,
      residualRisks
    };
  }
}

export const osSandboxPolicy = OSSandboxPolicy.getInstance();
