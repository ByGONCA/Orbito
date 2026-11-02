/**
 * Extension Host Worker — Isolated Process Boundary
 * 
 * This module runs in a separate Node.js child process isolated from the main Electron process.
 * It loads and executes extension code without access to main process objects, electron APIs,
 * or raw privileged system access.
 * 
 * All capability requests (filesystem, storage, notifications, workflow nodes, skills)
 * are routed through strict, validated RPC channels back to the trusted Main process.
 */

import path from 'node:path';
import type {
  ExtensionContext,
  IExtensionModule,
  ExtensionHostRpcMessage,
  ExtensionPermissions
} from '../../shared/extensions';

class ExtensionHostWorker {
  private activeModule: IExtensionModule | null = null;
  private currentExtensionId: string = '';
  private pendingCapabilityRequests = new Map<
    string,
    { resolve: (val: any) => void; reject: (err: Error) => void }
  >();

  constructor() {
    this.initMessageListener();
  }

  private initMessageListener(): void {
    process.on('message', async (message: ExtensionHostRpcMessage) => {
      try {
        await this.handleMessage(message);
      } catch (err: any) {
        this.send({
          id: message?.id || 'error',
          type: 'ERROR',
          extensionId: this.currentExtensionId,
          error: err.message || String(err)
        });
      }
    });

    process.on('uncaughtException', (err: Error) => {
      this.send({
        id: 'uncaught_exception',
        type: 'ERROR',
        extensionId: this.currentExtensionId,
        error: `Uncaught exception in extension worker: ${err.message}`
      });
    });

    process.on('unhandledRejection', (reason: any) => {
      this.send({
        id: 'unhandled_rejection',
        type: 'ERROR',
        extensionId: this.currentExtensionId,
        error: `Unhandled rejection in extension worker: ${reason?.message || String(reason)}`
      });
    });
  }

  private send(message: ExtensionHostRpcMessage): void {
    if (process.send) {
      process.send(message);
    }
  }

  private requestCapability(capability: string, args: Record<string, any>): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = `cap_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      this.pendingCapabilityRequests.set(id, { resolve, reject });

      // Safety timeout on capability responses (10 seconds)
      const timer = setTimeout(() => {
        if (this.pendingCapabilityRequests.has(id)) {
          this.pendingCapabilityRequests.delete(id);
          reject(new Error(`Capability request "${capability}" timed out after 10000ms.`));
        }
      }, 10000);

      this.send({
        id,
        type: 'CAPABILITY_REQUEST',
        extensionId: this.currentExtensionId,
        payload: {
          capability,
          args
        }
      });

      // Clear timer on resolution
      const originalResolve = resolve;
      const originalReject = reject;
      this.pendingCapabilityRequests.set(id, {
        resolve: (val) => {
          clearTimeout(timer);
          originalResolve(val);
        },
        reject: (err) => {
          clearTimeout(timer);
          originalReject(err);
        }
      });
    });
  }

  private createExtensionContext(
    extensionId: string,
    storagePath: string,
    permissions: ExtensionPermissions,
    workspacePath?: string
  ): ExtensionContext {
    const log = (msg: string, level: 'info' | 'warn' | 'error' = 'info') => {
      this.send({
        id: `log_${Date.now()}`,
        type: 'LOG',
        extensionId,
        payload: { message: msg, level }
      });
    };

    return {
      extensionId,
      storagePath,
      permissions,
      workspacePath,
      log,

      // Capability namespaces
      workspace: {
        readFile: (relativePath: string) =>
          this.requestCapability('workspace.readFile', { relativePath }),
        listFiles: (relativePath?: string) =>
          this.requestCapability('workspace.listFiles', { relativePath }),
        writeFile: (relativePath: string, content: string) =>
          this.requestCapability('workspace.writeFile', { relativePath, content })
      },

      storage: {
        get: (key: string) => this.requestCapability('storage.get', { key }),
        set: (key: string, value: any) => this.requestCapability('storage.set', { key, value }),
        delete: (key: string) => this.requestCapability('storage.delete', { key })
      },

      workflow: {
        registerNode: (node: any) => this.requestCapability('workflow.registerNode', { node })
      },

      skills: {
        register: (skill: any) => this.requestCapability('skills.register', { skill })
      },

      notifications: {
        show: (message: string, type: 'info' | 'warning' | 'error' = 'info') =>
          this.requestCapability('notifications.show', { message, type })
      },

      // Legacy convenience shorthands (forwarding to capability handlers)
      registerNode: (node: any) => {
        this.requestCapability('workflow.registerNode', { node }).catch((err) => {
          log(`Failed to register node: ${err.message}`, 'error');
        });
      },

      registerSkill: (skill: any) => {
        this.requestCapability('skills.register', { skill }).catch((err) => {
          log(`Failed to register skill: ${err.message}`, 'error');
        });
      }
    };
  }

  private async handleMessage(message: ExtensionHostRpcMessage): Promise<void> {
    const { id, type, payload, extensionId } = message;

    switch (type) {
      case 'PING': {
        this.send({ id, type: 'PONG', extensionId });
        break;
      }

      case 'CAPABILITY_RESPONSE': {
        const pending = this.pendingCapabilityRequests.get(id);
        if (pending) {
          this.pendingCapabilityRequests.delete(id);
          if (message.error) {
            pending.reject(new Error(message.error));
          } else {
            pending.resolve(payload);
          }
        }
        break;
      }

      case 'ACTIVATE': {
        this.currentExtensionId = extensionId;
        const { entryPath, installPath, permissions, workspacePath } = payload;
        const storagePath = path.join(installPath, '.storage');

        const context = this.createExtensionContext(
          extensionId,
          storagePath,
          permissions || {},
          workspacePath
        );

        try {
          // Dynamic load of the extension entry module inside this isolated child process
          let loadedModule: any;
          try {
            // Support both CommonJS require and ES module dynamic import
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            loadedModule = require(entryPath);
          } catch {
            const fileUrl = path.isAbsolute(entryPath)
              ? `file://${entryPath.replace(/\\/g, '/')}`
              : entryPath;
            loadedModule = await import(fileUrl);
          }

          const mod: IExtensionModule = loadedModule?.default || loadedModule;
          this.activeModule = mod;

          if (typeof mod?.activate === 'function') {
            await Promise.resolve(mod.activate(context));
          }

          this.send({
            id,
            type: 'ACTIVATE_RESULT',
            extensionId,
            payload: { success: true }
          });
        } catch (err: any) {
          this.send({
            id,
            type: 'ACTIVATE_RESULT',
            extensionId,
            error: err.message || String(err)
          });
        }
        break;
      }

      case 'DEACTIVATE': {
        try {
          if (this.activeModule && typeof this.activeModule.deactivate === 'function') {
            await Promise.resolve(this.activeModule.deactivate());
          }
          this.activeModule = null;
          this.send({
            id,
            type: 'DEACTIVATE_RESULT',
            extensionId,
            payload: { success: true }
          });
        } catch (err: any) {
          this.send({
            id,
            type: 'DEACTIVATE_RESULT',
            extensionId,
            error: err.message || String(err)
          });
        }
        break;
      }

      case 'EXECUTE_NODE': {
        const { nodeType, inputs, config } = payload;
        try {
          if (!this.activeModule?.executeNode) {
            throw new Error(`Extension "${extensionId}" does not provide an executeNode handler.`);
          }
          const result = await this.activeModule.executeNode(nodeType, inputs, config);
          this.send({
            id,
            type: 'EXECUTE_NODE_RESULT',
            extensionId,
            payload: result || {}
          });
        } catch (err: any) {
          this.send({
            id,
            type: 'EXECUTE_NODE_RESULT',
            extensionId,
            error: err.message || String(err)
          });
        }
        break;
      }

      default:
        console.warn(`[ExtensionHostWorker] Unhandled message type: ${type}`);
    }
  }
}

// Instantiate worker
new ExtensionHostWorker();
