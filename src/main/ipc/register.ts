import { ipcMain, BrowserWindow } from 'electron';
import {
  OpenDirectorySchema,
  ListFilesSchema,
  ReadFileSchema,
  UpdateSettingsSchema,
  StoreSecretSchema,
  GetSecretSchema,
  SaveMemorySchema,
  DeleteMemorySchema
} from '../../shared/ipc';
import {
  DetectCLIsSchema,
  CheckCLIAuthSchema,
  ExecuteCLIPromptSchema,
  CancelCLISessionSchema,
  ListCLISessionsSchema,
  GetSessionMessagesSchema,
  type CLIStreamEvent
} from '../../shared/cli';
import {
  StartIndexingSchema,
  CancelIndexingSchema,
  GetIndexStatsSchema,
  SearchContextSchema,
  AssembleContextSchema
} from '../../shared/context';
import { workspaceService } from '../services/workspace.service';
import { databaseService } from '../db/database.service';
import { safeStorageService } from '../services/safe-storage.service';
import { securityService } from '../services/security.service';
import { cliManager } from '../cli/cli-manager';
import { executionEngine } from '../cli/execution-engine';
import { contextEngineService } from '../context/context-engine.service';
import type { SystemResourceMetrics } from '../../shared/types';

export function registerIpcHandlers(): void {
  // Global stream event broadcast to all browser windows
  executionEngine.on('stream', (event: CLIStreamEvent) => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('cli:stream-event', event);
      }
    }
  });

  // Global Context Engine progress & status broadcasts
  contextEngineService.on('progress', (prog: any) => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('context:indexing-progress', prog);
      }
    }
  });

  contextEngineService.on('status', (status: any) => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('context:indexing-status', status);
      }
    }
  });
  // 1. Workspace & Files
  ipcMain.handle('workspace:openDirectory', async (_, args) => {
    const validated = OpenDirectorySchema.parse(args || {});
    return await workspaceService.openDirectoryDialog(validated.targetPath);
  });

  ipcMain.handle('workspace:listFiles', (_, args) => {
    const validated = ListFilesSchema.parse(args);
    return workspaceService.listFiles(validated.projectPath, validated.maxDepth);
  });

  ipcMain.handle('workspace:readFileContent', (_, args) => {
    const validated = ReadFileSchema.parse(args);
    return workspaceService.readFileContent(validated.filePath, validated.projectPath);
  });

  ipcMain.handle('workspace:getRecentProjects', () => {
    return databaseService.getRecentProjects();
  });

  // 2. Settings
  ipcMain.handle('settings:get', () => {
    return databaseService.getSettings();
  });

  ipcMain.handle('settings:update', (_, args) => {
    const validated = UpdateSettingsSchema.parse(args);
    return databaseService.updateSettings(validated);
  });

  // 3. Secrets (safeStorage)
  ipcMain.handle('secret:store', (_, args) => {
    const validated = StoreSecretSchema.parse(args);
    return safeStorageService.storeSecret(validated.key, validated.value);
  });

  ipcMain.handle('secret:get', (_, args) => {
    const validated = GetSecretSchema.parse(args);
    return safeStorageService.getSecret(validated.key);
  });

  // 4. Memories
  ipcMain.handle('memory:list', (_, tier) => {
    return databaseService.listMemories(tier);
  });

  ipcMain.handle('memory:save', (_, args) => {
    const validated = SaveMemorySchema.parse(args);
    return databaseService.saveMemory(validated);
  });

  ipcMain.handle('memory:delete', (_, args) => {
    const validated = DeleteMemorySchema.parse(args);
    return { success: databaseService.deleteMemory(validated.id) };
  });

  // 5. System Metrics
  ipcMain.handle('system:getMetrics', async (): Promise<SystemResourceMetrics> => {
    const memInfo = process.memoryUsage();
    return {
      mainProcessMemoryMb: Math.round(memInfo.rss / (1024 * 1024)),
      totalAppMemoryMb: Math.round(memInfo.heapUsed / (1024 * 1024)),
      cpuPercent: 0,
      uptimeSeconds: Math.round(process.uptime())
    };
  });

  // 6. CLI Engine (Phase 2)
  ipcMain.handle('cli:detect', async (_, args) => {
    const validated = DetectCLIsSchema.parse(args || {});
    return await cliManager.detectAll(validated.customPaths);
  });

  ipcMain.handle('cli:checkAuth', async (_, args) => {
    const validated = CheckCLIAuthSchema.parse(args);
    return await cliManager.checkAuth(validated.provider, validated.customPath);
  });

  ipcMain.handle('cli:executePrompt', async (_, args) => {
    const validated = ExecuteCLIPromptSchema.parse(args);
    const sessionId = `cli-sess-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    return await executionEngine.execute({
      sessionId,
      provider: validated.provider,
      prompt: validated.prompt,
      workingDirectory: validated.workingDirectory,
      projectId: validated.projectId,
      customPath: validated.customPath,
      timeoutSeconds: validated.timeoutSeconds,
      resumeSessionId: validated.resumeSessionId
    });
  });

  ipcMain.handle('cli:cancelSession', async (_, args) => {
    const validated = CancelCLISessionSchema.parse(args);
    const success = await executionEngine.cancel(validated.sessionId);
    return { success };
  });

  ipcMain.handle('cli:listSessions', (_, args) => {
    const validated = ListCLISessionsSchema.parse(args || {});
    return databaseService.listCLISessions(validated.projectId, validated.provider);
  });

  ipcMain.handle('cli:getSessionMessages', (_, args) => {
    const validated = GetSessionMessagesSchema.parse(args);
    return databaseService.getCLISessionMessages(validated.sessionId);
  });

  // 7. Context Engine (Phase 3)
  ipcMain.handle('context:startIndexing', async (_, args) => {
    const validated = StartIndexingSchema.parse(args);
    const canonical = securityService.assertWithinWorkspace(validated.projectPath, validated.projectPath);
    return await contextEngineService.startIndexing(canonical, validated.forceReindex);
  });

  ipcMain.handle('context:cancelIndexing', (_, args) => {
    CancelIndexingSchema.parse(args);
    contextEngineService.cancelIndexing();
    return { success: true };
  });

  ipcMain.handle('context:getIndexStats', (_, args) => {
    const validated = GetIndexStatsSchema.parse(args);
    return contextEngineService.getIndexStats(validated.projectPath);
  });

  ipcMain.handle('context:search', async (_, args) => {
    const validated = SearchContextSchema.parse(args);
    return await contextEngineService.search(validated.query, validated.limit);
  });

  ipcMain.handle('context:assemble', async (_, args) => {
    const validated = AssembleContextSchema.parse(args);
    const canonical = securityService.assertWithinWorkspace(validated.projectPath, validated.projectPath);
    return await contextEngineService.assembleContext({
      projectPath: canonical,
      taskDescription: validated.taskDescription,
      activeFilePath: validated.activeFilePath,
      maxTokens: validated.maxTokens,
      modelTarget: validated.modelTarget
    });
  });
}
