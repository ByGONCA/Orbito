import { ipcMain } from 'electron';
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
import { workspaceService } from '../services/workspace.service';
import { databaseService } from '../db/database.service';
import { safeStorageService } from '../services/safe-storage.service';
import type { SystemResourceMetrics } from '../../shared/types';

export function registerIpcHandlers(): void {
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
}
