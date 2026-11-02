/**
 * Extension Host Worker — Isolated Process Boundary (CommonJS)
 * 
 * Runs in a separate child process isolated from the Electron main process.
 * Extensions execute only inside this process. All capability requests
 * (filesystem, storage, notifications, workflow nodes, skills) are routed
 * through strict, validated RPC channels back to the trusted Main process.
 */

const path = require('node:path');

class ExtensionHostWorker {
  constructor() {
    this.activeModule = null;
    this.currentExtensionId = '';
    this.pendingCapabilityRequests = new Map();
    this.initMessageListener();
  }

  initMessageListener() {
    process.on('message', async (message) => {
      try {
        await this.handleMessage(message);
      } catch (err) {
        this.send({
          id: message && message.id ? message.id : 'error',
          type: 'ERROR',
          extensionId: this.currentExtensionId,
          error: err.message || String(err)
        });
      }
    });

    process.on('uncaughtException', (err) => {
      this.send({
        id: 'uncaught_exception',
        type: 'ERROR',
        extensionId: this.currentExtensionId,
        error: `Uncaught exception in extension worker: ${err.message}`
      });
    });

    process.on('unhandledRejection', (reason) => {
      this.send({
        id: 'unhandled_rejection',
        type: 'ERROR',
        extensionId: this.currentExtensionId,
        error: `Unhandled rejection in extension worker: ${reason && reason.message ? reason.message : String(reason)}`
      });
    });
  }

  send(message) {
    if (typeof process.send === 'function') {
      process.send(message);
    }
  }

  requestCapability(capability, args) {
    return new Promise((resolve, reject) => {
      const id = `cap_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const timer = setTimeout(() => {
        if (this.pendingCapabilityRequests.has(id)) {
          this.pendingCapabilityRequests.delete(id);
          reject(new Error(`Capability request "${capability}" timed out after 10000ms.`));
        }
      }, 10000);

      this.pendingCapabilityRequests.set(id, {
        resolve: (val) => {
          clearTimeout(timer);
          resolve(val);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        }
      });

      this.send({
        id,
        type: 'CAPABILITY_REQUEST',
        extensionId: this.currentExtensionId,
        payload: {
          capability,
          args
        }
      });
    });
  }

  createExtensionContext(extensionId, storagePath, permissions, workspacePath) {
    const log = (msg, level = 'info') => {
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
        readFile: (relativePath) =>
          this.requestCapability('workspace.readFile', { relativePath }),
        listFiles: (relativePath) =>
          this.requestCapability('workspace.listFiles', { relativePath }),
        writeFile: (relativePath, content) =>
          this.requestCapability('workspace.writeFile', { relativePath, content })
      },

      storage: {
        get: (key) => this.requestCapability('storage.get', { key }),
        set: (key, value) => this.requestCapability('storage.set', { key, value }),
        delete: (key) => this.requestCapability('storage.delete', { key })
      },

      workflow: {
        registerNode: (node) => this.requestCapability('workflow.registerNode', { node })
      },

      skills: {
        register: (skill) => this.requestCapability('skills.register', { skill })
      },

      notifications: {
        show: (message, type = 'info') =>
          this.requestCapability('notifications.show', { message, type })
      },

      // Legacy / convenience shorthands
      registerNode: (node) => {
        this.requestCapability('workflow.registerNode', { node }).catch((err) => {
          log(`Failed to register node: ${err.message}`, 'error');
        });
      },

      registerSkill: (skill) => {
        this.requestCapability('skills.register', { skill }).catch((err) => {
          log(`Failed to register skill: ${err.message}`, 'error');
        });
      }
    };
  }

  async handleMessage(message) {
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
          let loadedModule;
          try {
            // Clear require cache for clean activation
            delete require.cache[require.resolve(entryPath)];
            loadedModule = require(entryPath);
          } catch {
            const fileUrl = path.isAbsolute(entryPath)
              ? `file://${entryPath.replace(/\\/g, '/')}`
              : entryPath;
            loadedModule = await import(fileUrl);
          }

          const mod = (loadedModule && loadedModule.default) ? loadedModule.default : loadedModule;
          this.activeModule = mod;

          if (mod && typeof mod.activate === 'function') {
            await Promise.resolve(mod.activate(context));
          }

          this.send({
            id,
            type: 'ACTIVATE_RESULT',
            extensionId,
            payload: { success: true }
          });
        } catch (err) {
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
        } catch (err) {
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
          if (!this.activeModule || typeof this.activeModule.executeNode !== 'function') {
            throw new Error(`Extension "${extensionId}" does not provide an executeNode handler.`);
          }
          const result = await Promise.resolve(this.activeModule.executeNode(nodeType, inputs, config));
          this.send({
            id,
            type: 'EXECUTE_NODE_RESULT',
            extensionId,
            payload: result || {}
          });
        } catch (err) {
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

new ExtensionHostWorker();
