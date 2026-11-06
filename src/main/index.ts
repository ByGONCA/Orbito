// Disable Electron development security warnings in dev mode (for Vite HMR/eval)
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

import { app, BrowserWindow, shell, session } from 'electron';
import path from 'node:path';
import { databaseService } from './db/database.service';
import { registerIpcHandlers } from './ipc/register';
import { skillRegistry } from './skills/skill-registry';
import { agentOrchestrator } from './agents/agent-orchestrator';
import { extensionRegistry } from './extensions/extension-registry';
import { airGapManager } from './services/air-gap.manager';
import { appLogger } from './services/app-logger';

let mainWindow: BrowserWindow | null = null;

// Global process error handlers for developer diagnostics
process.on('uncaughtException', (error) => {
  appLogger.error('MainProcess', 'Uncaught exception in Main Process', error);
});

process.on('unhandledRejection', (reason) => {
  appLogger.error('MainProcess', 'Unhandled promise rejection in Main Process', reason);
});

function createWindow(): BrowserWindow {
  const isDev = !app.isPackaged || Boolean(process.env.ELECTRON_RENDERER_URL);

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    title: `AI Workspace${isDev ? ' [DEV]' : ''}`,
    backgroundColor: '#101113',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      devTools: isDev
    }
  });

  win.on('maximize', () => {
    win.webContents.send('window:state-changed', { isMaximized: true });
  });

  win.on('unmaximize', () => {
    win.webContents.send('window:state-changed', { isMaximized: false });
  });

  win.once('ready-to-show', () => {
    if (!win.isDestroyed() && !win.isVisible()) {
      win.show();
      appLogger.info('Window', 'Main desktop window ready and visible');
    }
    if (isDev && (process.env.DEBUG_DEVTOOLS === '1' || process.env.ELECTRON_DEVTOOLS === 'true')) {
      win.webContents.openDevTools({ mode: 'detach' });
    }
  });

  // Guarantee window visibility if ready-to-show is delayed
  setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) {
      win.show();
      appLogger.info('Window', 'Main window shown via timeout fallback');
    }
  }, 4000);

  // Pipe renderer console errors to main terminal for diagnostics
  win.webContents.on('console-message', (_, level, message, line, sourceId) => {
    // Suppress internal Electron development security notices
    if (message.includes('Electron Security Warning')) return;

    if (level === 2) {
      appLogger.warn('RendererConsole', `${message} (${sourceId}:${line})`);
    } else if (level >= 3) {
      appLogger.error('RendererConsole', `${message} (${sourceId}:${line})`);
    }
  });

  // Developer shortcuts: F12 / Ctrl+Shift+I to toggle DevTools, F5 / Ctrl+R to reload
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;

    const isToggleDevTools =
      input.key === 'F12' ||
      (input.control && input.shift && input.key.toLowerCase() === 'i') ||
      (input.meta && input.alt && input.key.toLowerCase() === 'i');

    if (isToggleDevTools) {
      win.webContents.toggleDevTools();
      event.preventDefault();
      return;
    }

    if (isDev) {
      const isReload =
        input.key === 'F5' ||
        (input.control && input.key.toLowerCase() === 'r') ||
        (input.meta && input.key.toLowerCase() === 'r');

      if (isReload) {
        appLogger.info('Window', 'Reloading renderer window...');
        win.webContents.reload();
        event.preventDefault();
      }
    }
  });

  // Guard external navigation and restrict protocols strictly to http/https
  win.webContents.setWindowOpenHandler((details) => {
    try {
      const parsed = new URL(details.url);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        shell.openExternal(details.url);
      }
    } catch {
      // Ignore invalid or disallowed protocols
    }
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) {
      event.preventDefault();
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
          shell.openExternal(url);
        }
      } catch {
        // Disallow
      }
    }
  });

  // Diagnostics on render process failures
  win.webContents.on('did-fail-load', (_, errorCode, errorDescription, validatedURL) => {
    if (errorCode !== -3) { // Ignore ERR_ABORTED
      appLogger.error('Window', `Failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
    }
  });

  win.webContents.on('render-process-gone', (_, details) => {
    appLogger.error('Window', `Renderer process gone: reason=${details.reason}, exitCode=${details.exitCode}`);
  });

  // HMR or production file load
  if (process.env.ELECTRON_RENDERER_URL) {
    appLogger.info('Window', `Connecting to dev renderer URL: ${process.env.ELECTRON_RENDERER_URL}`);
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    const indexPath = path.join(__dirname, '../renderer/index.html');
    appLogger.info('Window', `Loading production bundle from: ${indexPath}`);
    win.loadFile(indexPath);
  }

  return win;
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    const isDev = !app.isPackaged || Boolean(process.env.ELECTRON_RENDERER_URL);
    appLogger.info('Main', `========================================================`);
    appLogger.info('Main', `AI Workspace v0.1.0 starting [Mode: ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'}]`);
    appLogger.info('Main', `Node ${process.version} | Electron ${process.versions.electron} | ${process.platform} (${process.arch})`);
    appLogger.info('Main', `========================================================`);

    try {
      // 1. Initialize Dual SQLite databases & services
      const appDataPath = path.join(app.getPath('userData'), 'data');
      appLogger.info('Database', `Initializing Dual SQLite persistence at ${appDataPath}`);
      databaseService.initialize();
      databaseService.recoverWorkflowExecutionsOnStartup();
      databaseService.recoverCLISessionsOnStartup();
      skillRegistry.initialize();
      agentOrchestrator.initialize();
      extensionRegistry.initialize();
      appLogger.info('Main', 'Core services initialized successfully');
    } catch (err: any) {
      appLogger.error('Main', `Critical startup error: ${err.message}`, err);
    }

    // 2. Set Content Security Policy (CSP)
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const csp = isDev
        ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' http: ws: data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' http:; style-src 'self' 'unsafe-inline' http:; img-src 'self' data: https: http: blob:; font-src 'self' data:; connect-src 'self' ws: http: https:;"
        : "default-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self';";

      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [csp]
        }
      });
    });

    // 3. Air-Gap webRequest interceptor (cancels outbound network requests if Air-Gap is enabled)
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      if (airGapManager.isAirGapEnabled()) {
        try {
          const parsed = new URL(details.url);
          const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
          const isLocal =
            hostname === '127.0.0.1' ||
            hostname === 'localhost' ||
            hostname === '::1' ||
            hostname.startsWith('127.');
          if (!isLocal && parsed.protocol !== 'file:' && parsed.protocol !== 'devtools:') {
            appLogger.warn('AirGap', `Blocked outbound renderer request to: ${details.url}`);
            callback({ cancel: true });
            return;
          }
        } catch {
          // Ignore unparseable internal URLs
        }
      }
      callback({ cancel: false });
    });

    // 4. Register IPC handlers
    registerIpcHandlers();

    // 5. Create Window
    mainWindow = createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow();
      }
    });
  });

  app.on('before-quit', () => {
    appLogger.info('Main', 'Application shutting down, closing database handles...');
    databaseService.close();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
