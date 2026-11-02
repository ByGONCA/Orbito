import fs from 'node:fs';
import path from 'node:path';
import { fork, type ChildProcess } from 'node:child_process';
import type {
  ExtensionRecord,
  ExtensionHostRpcMessage,
  ExtensionHostRpcType
} from '../../shared/extensions';
import { registerCustomNode, unregisterCustomNode } from '../../shared/node-registry';
import { skillRegistry } from '../skills/skill-registry';
import { auditService } from '../services/audit.service';
import { airGapManager } from '../services/air-gap.manager';
import { osSandboxPolicy } from './sandbox/os-sandbox-policy';

interface ExtensionHostInstance {
  extensionId: string;
  record: ExtensionRecord;
  process: ChildProcess;
  status: 'starting' | 'active' | 'stopping' | 'crashed';
  workspacePath?: string;
  pendingRpc: Map<string, { resolve: (val: any) => void; reject: (err: Error) => void }>;
  lastPingAt: number;
}

export class ExtensionHostManager {
  private static instance: ExtensionHostManager;
  private hosts = new Map<string, ExtensionHostInstance>();
  private workerScriptPath: string;
  public static readonly MAX_CONCURRENT_HOSTS = 5;

  public constructor() {
    // Resolve extension-host.worker.cjs
    this.workerScriptPath = path.resolve(__dirname, 'extension-host.worker.cjs');
    if (!fs.existsSync(this.workerScriptPath)) {
      // Fallback for development / alternate source tree layouts
      this.workerScriptPath = path.resolve(
        process.cwd(),
        'src',
        'main',
        'extensions',
        'extension-host.worker.cjs'
      );
    }
  }

  public static getInstance(): ExtensionHostManager {
    if (!ExtensionHostManager.instance) {
      ExtensionHostManager.instance = new ExtensionHostManager();
    }
    return ExtensionHostManager.instance;
  }

  /**
   * Constructs an aggressively sanitized environment for the child process.
   * Strips all secrets, tokens, credentials, and sensitive application variables.
   */
  public buildSanitizedEnv(extensionId: string, installPath: string): NodeJS.ProcessEnv {
    const rawEnv = process.env;
    const sanitized: NodeJS.ProcessEnv = {};

    // Explicitly allow only benign platform environment variables
    const allowedKeys = [
      'PATH',
      'Path',
      'SYSTEMROOT',
      'SystemRoot',
      'SYSTEMDRIVE',
      'SystemDrive',
      'TEMP',
      'TMP',
      'USERPROFILE',
      'HOME',
      'HOMEPATH',
      'HOMEDRIVE',
      'NODE_ENV',
      'LANG',
      'LC_ALL'
    ];

    for (const key of allowedKeys) {
      if (rawEnv[key] !== undefined) {
        sanitized[key] = rawEnv[key];
      }
    }

    // Strip anything resembling an API key, token, secret or credential
    for (const key of Object.keys(sanitized)) {
      if (/(KEY|TOKEN|SECRET|PASSWORD|AUTH|CREDENTIAL|PRIVATE|DATABASE|URL|COOKIE)/i.test(key)) {
        delete sanitized[key];
      }
    }

    sanitized.AI_WORKSPACE_EXTENSION_ISOLATED = 'true';
    sanitized.AI_WORKSPACE_EXTENSION_ID = extensionId;
    sanitized.AI_WORKSPACE_EXTENSION_PATH = installPath;

    // Apply Air-Gap network restrictions (proxy drop and host isolation)
    return airGapManager.getChildProcessEnv(sanitized);
  }

  /**
   * Spawns an isolated Extension Host child process for an extension and activates it.
   */
  public async activateInHost(
    record: ExtensionRecord,
    workspacePath?: string,
    timeoutMs: number = 8000
  ): Promise<void> {
    const { id, manifest, installPath } = record;

    // Terminate existing host if already running
    if (this.hosts.has(id)) {
      await this.terminateHost(id);
    }

    if (!manifest.main) {
      // Declarative-only extension, no script to run in host
      return;
    }

    // Check concurrency limit
    if (this.hosts.size >= ExtensionHostManager.MAX_CONCURRENT_HOSTS && !this.hosts.has(id)) {
      const err = `Maximum concurrent extension host limit reached (${ExtensionHostManager.MAX_CONCURRENT_HOSTS}). Please deactivate unused extensions.`;
      auditService.logSecurityViolation(id, 'extension_concurrency_limit', err);
      throw new Error(err);
    }

    // Check platform sandboxing capability and graceful degradation
    const sandboxCheck = osSandboxPolicy.canExecuteUntrusted(record);
    if (!sandboxCheck.allowed) {
      auditService.logSecurityViolation(
        id,
        'extension_sandbox_unsupported',
        sandboxCheck.reason || 'OS sandboxing unsupported'
      );
      throw new Error(sandboxCheck.reason);
    }

    if (sandboxCheck.warning) {
      auditService.log({
        eventType: 'extension_security_warning',
        severity: 'warning',
        actor: id,
        action: 'unsandboxed_override',
        details: { warning: sandboxCheck.warning }
      });
    }

    record.sandboxMode = sandboxCheck.sandboxMode;

    const entryPath = path.resolve(installPath, manifest.main);
    const normalizedEntry = path.normalize(entryPath);
    const normalizedInstall = path.normalize(installPath);

    // Path traversal containment check on entry point
    if (!normalizedEntry.startsWith(normalizedInstall + path.sep) && normalizedEntry !== normalizedInstall) {
      const err = `Extension entry script '${manifest.main}' attempts path traversal outside extension directory.`;
      auditService.logSecurityViolation(record.id, 'extension_traversal_blocked', err, entryPath);
      throw new Error(err);
    }

    if (!fs.existsSync(entryPath)) {
      throw new Error(`Extension entry point not found: ${entryPath}`);
    }

    const env = this.buildSanitizedEnv(id, installPath);
    const storagePath = path.join(installPath, '.storage');

    // Build OS/runtime sandboxing arguments (Node Permission Model + memory cap)
    const execArgv = osSandboxPolicy.buildSandboxExecArgs({
      installPath,
      workerScriptPath: this.workerScriptPath,
      storagePath,
      workspacePath,
      permissions: manifest.permissions,
      airGapEnabled: airGapManager.isAirGapEnabled(),
      maxMemoryMb: 128
    });

    // Spawn child process with OS/runtime permission boundaries
    const child = fork(this.workerScriptPath, [], {
      env,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      execArgv
    });

    const instance: ExtensionHostInstance = {
      extensionId: id,
      record,
      process: child,
      status: 'starting',
      workspacePath,
      pendingRpc: new Map(),
      lastPingAt: Date.now()
    };

    this.hosts.set(id, instance);

    this.wireProcessEvents(instance);

    // Dispatch ACTIVATE RPC with timeout
    try {
      await this.sendRpc(
        instance,
        'ACTIVATE',
        {
          entryPath,
          installPath,
          permissions: manifest.permissions || {},
          workspacePath,
          airGapEnabled: airGapManager.isAirGapEnabled()
        },
        timeoutMs
      );
      instance.status = 'active';
    } catch (err: any) {
      instance.status = 'crashed';
      await this.terminateHost(id, true);
      throw new Error(`Failed to activate extension "${id}" in host process: ${err.message}`);
    }
  }

  /**
   * Wires IPC message passing, crash detection, and capability handling for a host process.
   */
  private wireProcessEvents(instance: ExtensionHostInstance): void {
    const { process: child, extensionId, record } = instance;

    child.on('message', async (message: ExtensionHostRpcMessage) => {
      try {
        await this.handleHostMessage(instance, message);
      } catch (err: any) {
        console.error(`[ExtensionHostManager] Error handling message from ${extensionId}:`, err);
      }
    });

    child.on('error', (err: Error) => {
      console.error(`[ExtensionHostManager] Host process error for ${extensionId}:`, err);
      instance.status = 'crashed';
      auditService.logSecurityViolation(
        extensionId,
        'extension_host_process_error',
        `Extension host process emitted error: ${err.message}`
      );
    });

    child.on('exit', (code: number | null, signal: string | null) => {
      const wasStopping = instance.status === 'stopping';
      instance.status = wasStopping ? 'stopping' : 'crashed';

      // Reject all pending RPC calls
      for (const [id, rpc] of instance.pendingRpc.entries()) {
        rpc.reject(new Error(`Extension host process exited unexpectedly (code: ${code}, signal: ${signal})`));
        instance.pendingRpc.delete(id);
      }

      if (!wasStopping) {
        auditService.logSecurityViolation(
          extensionId,
          'extension_host_crashed',
          `Extension host process exited unexpectedly with code ${code} and signal ${signal}`
        );
        record.status = 'error';
        record.errorMessage = `Host process crashed (exit code: ${code})`;
      }

      this.hosts.delete(extensionId);
    });
  }

  /**
   * Routes incoming messages from an Extension Host worker process.
   */
  private async handleHostMessage(
    instance: ExtensionHostInstance,
    message: ExtensionHostRpcMessage
  ): Promise<void> {
    const { id, type, payload, error, extensionId } = message;

    // Handle responses to outgoing RPCs
    if (
      type === 'ACTIVATE_RESULT' ||
      type === 'DEACTIVATE_RESULT' ||
      type === 'EXECUTE_NODE_RESULT' ||
      type === 'PONG'
    ) {
      const pending = instance.pendingRpc.get(id);
      if (pending) {
        instance.pendingRpc.delete(id);
        if (error) {
          pending.reject(new Error(error));
        } else {
          pending.resolve(payload);
        }
      }
      return;
    }

    if (type === 'LOG') {
      auditService.log({
        eventType: 'extension_log',
        severity: payload.level === 'error' ? 'error' : payload.level === 'warn' ? 'warning' : 'info',
        actor: extensionId,
        action: 'runtime_log',
        details: { message: payload.message }
      });
      return;
    }

    if (type === 'CAPABILITY_REQUEST') {
      await this.handleCapabilityRequest(instance, id, payload?.capability, payload?.args);
      return;
    }

    if (type === 'ERROR') {
      auditService.logSecurityViolation(
        extensionId,
        'extension_runtime_error',
        `Extension worker reported error: ${error || 'Unknown error'}`
      );
    }
  }

  /**
   * Authorizes and executes capability requests from the untrusted extension host.
   */
  private async handleCapabilityRequest(
    instance: ExtensionHostInstance,
    requestId: string,
    capability: string,
    args: any = {}
  ): Promise<void> {
    const { extensionId, record, workspacePath, process: child } = instance;
    const permissions = record.manifest.permissions || {};

    const sendResponse = (payload?: any, error?: string) => {
      if (child.connected) {
        child.send({
          id: requestId,
          type: 'CAPABILITY_RESPONSE',
          extensionId,
          payload,
          error
        });
      }
    };

    try {
      switch (capability) {
        // --- Workspace File Read ---
        case 'workspace.readFile': {
          if (!permissions.filesystem?.read) {
            throw new Error(`Extension "${extensionId}" has not been granted filesystem.read permission.`);
          }
          if (!workspacePath) {
            throw new Error(`No active workspace directory bound to extension "${extensionId}".`);
          }

          const relativePath = String(args.relativePath || '');
          const resolved = path.resolve(workspacePath, relativePath);
          const normalizedWorkspace = path.normalize(workspacePath);

          // Path traversal containment check
          if (!resolved.startsWith(normalizedWorkspace + path.sep) && resolved !== normalizedWorkspace) {
            const violation = `Security Violation: Path traversal escape attempt blocked: "${relativePath}"`;
            auditService.logSecurityViolation(extensionId, 'path_traversal_blocked', violation, resolved);
            throw new Error(violation);
          }

          if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
            throw new Error(`File not found: "${relativePath}"`);
          }

          const content = fs.readFileSync(resolved, 'utf8');
          sendResponse({ content });
          break;
        }

        // --- Workspace List Files ---
        case 'workspace.listFiles': {
          if (!permissions.filesystem?.read) {
            throw new Error(`Extension "${extensionId}" has not been granted filesystem.read permission.`);
          }
          if (!workspacePath) {
            throw new Error(`No active workspace directory bound to extension "${extensionId}".`);
          }

          const subDir = args.relativePath ? path.resolve(workspacePath, String(args.relativePath)) : workspacePath;
          const normalizedWorkspace = path.normalize(workspacePath);

          if (!subDir.startsWith(normalizedWorkspace + path.sep) && subDir !== normalizedWorkspace) {
            const violation = `Security Violation: Path traversal escape attempt blocked: "${args.relativePath}"`;
            auditService.logSecurityViolation(extensionId, 'path_traversal_blocked', violation, subDir);
            throw new Error(violation);
          }

          if (!fs.existsSync(subDir)) {
            sendResponse({ files: [] });
            break;
          }

          const files = fs.readdirSync(subDir);
          sendResponse({ files });
          break;
        }

        // --- Workspace File Write ---
        case 'workspace.writeFile': {
          if (!permissions.filesystem?.write) {
            throw new Error(`Extension "${extensionId}" has not been granted filesystem.write permission.`);
          }
          if (!workspacePath) {
            throw new Error(`No active workspace directory bound to extension "${extensionId}".`);
          }

          const relativePath = String(args.relativePath || '');
          const resolved = path.resolve(workspacePath, relativePath);
          const normalizedWorkspace = path.normalize(workspacePath);

          if (!resolved.startsWith(normalizedWorkspace + path.sep) && resolved !== normalizedWorkspace) {
            const violation = `Security Violation: Path traversal write attempt blocked: "${relativePath}"`;
            auditService.logSecurityViolation(extensionId, 'path_traversal_blocked', violation, resolved);
            throw new Error(violation);
          }

          const content = String(args.content || '');
          fs.mkdirSync(path.dirname(resolved), { recursive: true });
          fs.writeFileSync(resolved, content, 'utf8');

          auditService.log({
            eventType: 'extension_workspace_write',
            severity: 'info',
            actor: extensionId,
            action: 'write_file',
            target: relativePath,
            details: { bytesWritten: Buffer.byteLength(content) }
          });

          sendResponse({ success: true, bytesWritten: Buffer.byteLength(content) });
          break;
        }

        // --- Extension-Isolated Storage ---
        case 'storage.get': {
          const storageDir = path.join(record.installPath, '.storage');
          const key = String(args.key || '').replace(/[^a-zA-Z0-9_-]/g, '_');
          const filePath = path.join(storageDir, `${key}.json`);

          if (!fs.existsSync(filePath)) {
            sendResponse(null);
            break;
          }

          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          sendResponse(data);
          break;
        }

        case 'storage.set': {
          const storageDir = path.join(record.installPath, '.storage');
          fs.mkdirSync(storageDir, { recursive: true });

          const key = String(args.key || '').replace(/[^a-zA-Z0-9_-]/g, '_');
          const filePath = path.join(storageDir, `${key}.json`);

          fs.writeFileSync(filePath, JSON.stringify(args.value ?? null, null, 2), 'utf8');
          sendResponse({ success: true });
          break;
        }

        case 'storage.delete': {
          const storageDir = path.join(record.installPath, '.storage');
          const key = String(args.key || '').replace(/[^a-zA-Z0-9_-]/g, '_');
          const filePath = path.join(storageDir, `${key}.json`);

          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          sendResponse({ success: true });
          break;
        }

        // --- Workflow Node Registration ---
        case 'workflow.registerNode': {
          const node = args.node;
          if (!node || !node.type || !node.name) {
            throw new Error(`Invalid node definition schema supplied by "${extensionId}".`);
          }

          // Enforce node permissions do not exceed extension permissions
          if (node.data?.requiredPermissions?.terminal?.execute && !permissions.shell) {
            const violation = `Extension "${extensionId}" attempted to register a node requiring terminal execution without shell permission.`;
            auditService.logSecurityViolation(extensionId, 'node_permission_escalation', violation);
            throw new Error(violation);
          }

          registerCustomNode(node);
          sendResponse({ success: true });
          break;
        }

        // --- Skill Registration ---
        case 'skills.register': {
          const s = args.skill;
          if (!s || !s.id || !s.name) {
            throw new Error(`Invalid skill manifest schema supplied by "${extensionId}".`);
          }

          if (s.requiredPermissions?.terminal?.execute && !permissions.shell) {
            const violation = `Extension "${extensionId}" attempted to register a skill with terminal execution without shell permission.`;
            auditService.logSecurityViolation(extensionId, 'skill_permission_escalation', violation);
            throw new Error(violation);
          }

          skillRegistry.registerLoadedSkill({
            id: s.id,
            name: s.name,
            description: s.description || '',
            version: s.version || record.version,
            author: s.author || record.author,
            category: s.category || 'analysis',
            tags: s.tags || ['extension', extensionId],
            supportedProviders: s.supportedProviders || ['claude', 'codex', 'gemini'],
            isBuiltIn: false,
            enabled: true,
            manifestPath: path.join(record.installPath, 'extension.json'),
            instructionsPath: path.join(record.installPath, 'README.md'),
            permissions: s.requiredPermissions || {
              filesystem: { read: true, write: false },
              terminal: { execute: false },
              network: { allowed: false }
            },
            contextRequirements: s.contextRequirements || { indexingNeeded: false, maxContextTokens: 16000 },
            checksum: record.checksum
          });

          sendResponse({ success: true });
          break;
        }

        // --- Notifications ---
        case 'notifications.show': {
          const messageText = String(args.message || '').slice(0, 500);
          auditService.log({
            eventType: 'extension_notification',
            severity: args.type === 'error' ? 'error' : args.type === 'warning' ? 'warning' : 'info',
            actor: extensionId,
            action: 'notification',
            details: { message: messageText }
          });
          sendResponse({ success: true });
          break;
        }

        default:
          throw new Error(`Unknown capability requested: "${capability}"`);
      }
    } catch (err: any) {
      sendResponse(undefined, err.message || String(err));
    }
  }

  /**
   * Dispatches an RPC command to an isolated host with deterministic timeout.
   */
  private sendRpc(
    instance: ExtensionHostInstance,
    type: ExtensionHostRpcType,
    payload?: any,
    timeoutMs: number = 8000
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = `rpc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      const timer = setTimeout(() => {
        if (instance.pendingRpc.has(id)) {
          instance.pendingRpc.delete(id);
          reject(new Error(`RPC "${type}" for extension "${instance.extensionId}" timed out after ${timeoutMs}ms.`));
        }
      }, timeoutMs);

      instance.pendingRpc.set(id, {
        resolve: (val) => {
          clearTimeout(timer);
          resolve(val);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        }
      });

      if (!instance.process.connected) {
        clearTimeout(timer);
        instance.pendingRpc.delete(id);
        reject(new Error(`Extension host process for "${instance.extensionId}" is disconnected.`));
        return;
      }

      instance.process.send({
        id,
        type,
        extensionId: instance.extensionId,
        payload
      });
    });
  }

  /**
   * Executes a custom workflow node inside the extension host process.
   */
  public async executeCustomNode(
    extensionId: string,
    nodeType: string,
    inputs: Record<string, any>,
    config?: Record<string, any>,
    timeoutMs: number = 10000
  ): Promise<Record<string, any>> {
    const host = this.hosts.get(extensionId);
    if (!host || host.status !== 'active') {
      throw new Error(`Extension host for "${extensionId}" is not active (status: ${host?.status || 'none'}).`);
    }

    return await this.sendRpc(
      host,
      'EXECUTE_NODE',
      { nodeType, inputs, config },
      timeoutMs
    );
  }

  /**
   * Pings the host process to verify health and responsiveness.
   */
  public async pingHost(extensionId: string): Promise<boolean> {
    const host = this.hosts.get(extensionId);
    if (!host || !host.process.connected) return false;

    try {
      await this.sendRpc(host, 'PING', {}, 3000);
      host.lastPingAt = Date.now();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Terminates an extension host process gracefully, falling back to force kill if needed.
   */
  public async terminateHost(extensionId: string, force: boolean = false): Promise<void> {
    const host = this.hosts.get(extensionId);
    if (!host) return;

    host.status = 'stopping';

    if (!force && host.process.connected) {
      try {
        await this.sendRpc(host, 'DEACTIVATE', {}, 2000);
      } catch {
        // Fall through to process kill
      }
    }

    try {
      if (host.process.pid && !host.process.killed) {
        await osSandboxPolicy.terminateProcessTree(host.process.pid);
      }
    } catch {
      try {
        host.process.kill('SIGKILL');
      } catch {
        // Ignore kill errors
      }
    }

    this.hosts.delete(extensionId);
  }

  /**
   * Shuts down all active extension host processes.
   */
  public async terminateAll(): Promise<void> {
    const ids = Array.from(this.hosts.keys());
    for (const id of ids) {
      await this.terminateHost(id, true);
    }
  }

  public isHostActive(extensionId: string): boolean {
    const host = this.hosts.get(extensionId);
    return host !== undefined && host.status === 'active';
  }
}

export const extensionHostManager = ExtensionHostManager.getInstance();
