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

  installNetworkSandbox(permissions, airGapEnabled) {
    const allowExternal = permissions && permissions.network && permissions.network.allowExternal === true && !airGapEnabled;
    const allowedHosts = (permissions && permissions.network && permissions.network.allowedHosts) || [];

    const checkHostAllowed = (targetHost, port) => {
      if (!allowExternal) {
        const msg = airGapEnabled
          ? 'Network access is strictly forbidden by active Air-Gap isolation mode.'
          : 'Network access has not been granted by extension permissions.';
        const err = new Error(msg);
        err.code = 'ERR_ACCESS_DENIED';
        throw err;
      }

      const hostStr = String(targetHost || '').toLowerCase();

      // Block local loopback and sensitive cloud metadata
      const blockedAddresses = ['localhost', '127.0.0.1', '::1', '0.0.0.0', '169.254.169.254'];
      if (blockedAddresses.includes(hostStr) || blockedAddresses.some((b) => hostStr.startsWith(b))) {
        const err = new Error(`Access to local/private network target "${hostStr}" is blocked by Extension Host security policy.`);
        err.code = 'ERR_ACCESS_DENIED';
        throw err;
      }

      // Block private RFC1918 subnets
      if (
        /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostStr) ||
        /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostStr) ||
        /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostStr)
      ) {
        const err = new Error(`Access to private network address "${hostStr}" is blocked by Extension Host security policy.`);
        err.code = 'ERR_ACCESS_DENIED';
        throw err;
      }

      // Check manifest allowedHosts whitelist if specified
      if (allowedHosts.length > 0) {
        const matched = allowedHosts.some((h) => {
          const lowerH = h.toLowerCase();
          return hostStr === lowerH || hostStr.endsWith('.' + lowerH);
        });
        if (!matched) {
          const err = new Error(`Target host "${hostStr}" is not in the extension manifest allowedHosts list.`);
          err.code = 'ERR_ACCESS_DENIED';
          throw err;
        }
      }
    };

    try {
      const net = require('node:net');
      const originalConnect = net.Socket.prototype.connect;
      net.Socket.prototype.connect = function (...args) {
        let host = 'localhost';
        let port = 0;
        if (typeof args[0] === 'object' && args[0] !== null) {
          host = args[0].host || 'localhost';
          port = args[0].port || 0;
        } else if (typeof args[0] === 'number') {
          port = args[0];
          if (typeof args[1] === 'string') host = args[1];
        }
        checkHostAllowed(host, port);
        return originalConnect.apply(this, args);
      };

      const dgram = require('node:dgram');
      const originalSend = dgram.Socket.prototype.send;
      dgram.Socket.prototype.send = function (...args) {
        const address = typeof args[args.length - 2] === 'string' ? args[args.length - 2] : '0.0.0.0';
        checkHostAllowed(address, 0);
        return originalSend.apply(this, args);
      };

      if (typeof globalThis.fetch === 'function') {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = function (resource, init) {
          try {
            const urlStr =
              typeof resource === 'string'
                ? resource
                : resource instanceof URL
                ? resource.toString()
                : resource.url;
            const parsed = new URL(urlStr);
            checkHostAllowed(parsed.hostname, Number(parsed.port) || (parsed.protocol === 'https:' ? 443 : 80));
          } catch (e) {
            return Promise.reject(e);
          }
          return originalFetch.call(this, resource, init);
        };
      }

      if (typeof globalThis.WebSocket === 'function') {
        const OriginalWebSocket = globalThis.WebSocket;
        globalThis.WebSocket = function (url, protocols) {
          const parsed = new URL(url);
          checkHostAllowed(parsed.hostname, Number(parsed.port) || 80);
          return new OriginalWebSocket(url, protocols);
        };
      }

      Object.freeze(net.Socket.prototype);
      Object.freeze(dgram.Socket.prototype);
    } catch {
      // Ignore hooking errors if already initialized
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

    // Enforce RPC message size limit (5MB maximum)
    const MAX_RPC_MESSAGE_BYTES = 5 * 1024 * 1024;
    try {
      const payloadLen = payload ? JSON.stringify(payload).length : 0;
      if (payloadLen > MAX_RPC_MESSAGE_BYTES) {
        this.send({
          id: id || 'error',
          type: 'ERROR',
          extensionId: extensionId || this.currentExtensionId,
          error: `RPC payload exceeds 5MB limit (${payloadLen} bytes)`
        });
        return;
      }
    } catch {
      // Ignore stringify error
    }

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
        const { entryPath, installPath, permissions, workspacePath, airGapEnabled } = payload;
        const storagePath = path.join(installPath, '.storage');

        // Apply strict network sandbox policy before loading any extension code
        this.installNetworkSandbox(permissions || {}, airGapEnabled === true);

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
