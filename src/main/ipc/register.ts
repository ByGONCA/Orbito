import { app, powerSaveBlocker, ipcMain, BrowserWindow, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import net from 'net';
import {
  OpenDirectorySchema,
  CreateProjectSchema,
  ToggleProjectFavoriteSchema,
  ListFilesSchema,
  ReadFileSchema,
  SaveFileSchema,
  CreateFileSchema,
  CreateDirectorySchema,
  RenameItemSchema,
  DeleteItemSchema,
  MoveItemSchema,
  RevealInFileManagerSchema,
  GetFileSymbolsSchema,
  GetProjectGraphSchema,
  UpdateSettingsSchema,
  SaveAppLayoutSchema,
  SaveProjectWorkspaceStateSchema,
  GetProjectWorkspaceStateSchema,
  StoreSecretSchema,
  GetSecretSchema,
  SaveMemorySchema,
  DeleteMemorySchema,
  ListWorkflowsSchema,
  GetWorkflowSchema,
  SaveWorkflowSchema,
  DeleteWorkflowSchema,
  DuplicateWorkflowSchema,
  ExecuteWorkflowSchema,
  CancelWorkflowSchema,
  GetWorkflowExecutionSchema,
  ListWorkflowExecutionsSchema,
  GenerateWorkflowFromPromptSchema,
  ToggleExtensionSchema,
  InstallExtensionSchema,
  UninstallExtensionSchema,
  GetAnalyticsSummarySchema,
  GetProviderCostMetricsSchema,
  RecordAnalyticsEventSchema,
  ExportAnalyticsSchema,
  QueryAuditLogsSchema,
  ExportAuditLogsSchema,
  UpdateAirGapConfigSchema,
  RouteIntelligenceTaskSchema,
  AssemblePromptSchema,
  ComposeSkillsSchema,
  UpdateDiscordSettingsSchema,
  GetProjectGitRemoteSchema,
  ListProjectExecutionsSchema,
  GetExecutionFileChangesSchema,
  SyncManualChangesSchema,
  GetCodeReviewSchema,
  UpdateReviewDecisionSchema,
  MarkFileReviewStatusSchema,
  AddReviewCommentSchema,
  ListReviewCommentsSchema,
  ResolveReviewCommentSchema,
  RunAICodeReviewSchema,
  GetProjectGitDetailsSchema
} from '../../shared/ipc';
import { projectExecutionService } from '../services/project-execution.service';
import { codeReviewService } from '../services/code-review.service';
import { WorktreeManager } from '../agents/worktree-manager';
import { discordRpcService } from '../services/discord/discord-rpc.service';
import { detectProjectGitRemote } from '../services/git-remote-resolver';
import { IntelligenceRouter } from '../services/intelligence-router.service';
import { PromptAssemblyService } from '../prompt/prompt-assembly.service';
import { SkillCompositionService } from '../skills/skill-composition.service';
import { MultiTierCacheService } from '../services/cache.service';
import {
  DetectCLIsSchema,
  CheckCLIAuthSchema,
  ExecuteCLIPromptSchema,
  CancelCLISessionSchema,
  ListCLISessionsSchema,
  GetSessionMessagesSchema,
  TerminalCreateSchema,
  TerminalWriteSchema,
  TerminalResizeSchema,
  TerminalKillSchema,
  type CLIStreamEvent
} from '../../shared/cli';
import { ptyService } from '../terminal/pty-service';
import {
  StartIndexingSchema,
  CancelIndexingSchema,
  GetIndexStatsSchema,
  SearchContextSchema,
  AssembleContextSchema
} from '../../shared/context';
import {
  ToggleSkillSchema,
  ResolveSkillSchema,
  ExecuteSkillSchema,
  ImportCustomSkillSchema,
  DeleteCustomSkillSchema
} from '../../shared/skills';
import {
  StartOrchestrationSchema,
  CancelOrchestrationSchema,
  ResolveApprovalSchema,
  GetOrchestrationSchema,
  ListOrchestrationsSchema,
  RetryTaskSchema,
  GetWorktreeDiffSchema
} from '../../shared/agents';
import { workspaceService } from '../services/workspace.service';
import { databaseService } from '../db/database.service';
import { safeStorageService } from '../services/safe-storage.service';
import { securityService } from '../services/security.service';
import { cliManager } from '../cli/cli-manager';
import { executionEngine } from '../cli/execution-engine';
import { contextEngineService } from '../context/context-engine.service';
import { skillRegistry } from '../skills/skill-registry';
import { SkillResolver } from '../skills/skill-resolver';
import { CustomSkillsService } from '../skills/custom-skills.service';
import { skillExecutionEngine } from '../skills/skill-execution-engine';
import { agentOrchestrator } from '../agents/agent-orchestrator';
import { workflowEngine } from '../workflows/workflow-engine';
import { WORKFLOW_TEMPLATES } from '../workflows/workflow-templates';
import { WorkflowGenerator } from '../workflows/workflow-generator';
import { workflowTriggerManager } from '../workflows/workflow-trigger-manager';
import { extensionRegistry } from '../extensions/extension-registry';
import { analyticsService } from '../services/analytics.service';
import { auditService } from '../services/audit.service';
import { airGapManager } from '../services/air-gap.manager';
import { ollamaAdapter } from '../cli/adapters/ollama.adapter';
import { appLogger } from '../services/app-logger';
import type { SystemResourceMetrics, DetailedResourceMetrics } from '../../shared/types';

let keepAwakeBlockerId: number | null = null;

const COMMON_DEV_PORTS = [
  { port: 5173, service: 'Vite Dev Server' },
  { port: 5174, service: 'Vite Secondary' },
  { port: 3000, service: 'React / Next.js' },
  { port: 3001, service: 'Node Service' },
  { port: 8080, service: 'API Backend' },
  { port: 8000, service: 'Python / FastServer' },
  { port: 4200, service: 'Angular Dev' },
  { port: 11434, service: 'Ollama Daemon' },
  { port: 9000, service: 'Microservice' },
  { port: 5000, service: 'Flask / Python' }
];

async function checkPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(80);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
}

export function registerIpcHandlers(): void {
  // Global PTY interactive terminal data & exit broadcasts
  ptyService.on('data', (evt) => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('terminal:data', evt);
      }
    }
  });

  ptyService.on('exit', (evt) => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('terminal:exit', evt);
      }
    }
  });

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

  // Track active agent count for Discord Rich Presence
  agentOrchestrator.on('event', () => {
    try {
      const activeTasks = agentOrchestrator.getActiveRunningTasksCount();
      discordRpcService.setAgentCount(activeTasks);
    } catch {}
  });

  // 1. Workspace & Files
  ipcMain.handle('workspace:openDirectory', async (_, args) => {
    const validated = OpenDirectorySchema.parse(args || {});
    const descriptor = await workspaceService.openDirectoryDialog(validated.targetPath);
    if (descriptor) {
      discordRpcService.setActiveProject(descriptor);
    }
    return descriptor;
  });

  ipcMain.handle('workspace:createProject', async (_, args) => {
    const validated = CreateProjectSchema.parse(args);
    const descriptor = await workspaceService.createProject(validated);
    if (descriptor) {
      discordRpcService.setActiveProject(descriptor);
    }
    return descriptor;
  });

  ipcMain.handle('workspace:selectDirectory', async (_, title?: string) => {
    return await workspaceService.selectDirectoryDialog(title);
  });

  ipcMain.handle('workspace:verifyProjectPath', (_, projectPath: string) => {
    return workspaceService.verifyProjectPath(projectPath);
  });

  ipcMain.handle('workspace:listFiles', (_, args) => {
    const validated = ListFilesSchema.parse(args);
    return workspaceService.listFiles(validated.projectPath, validated.maxDepth);
  });

  ipcMain.handle('workspace:readFileContent', (_, args) => {
    const validated = ReadFileSchema.parse(args);
    return workspaceService.readFileContent(validated.filePath, validated.projectPath);
  });

  ipcMain.handle('workspace:saveFileContent', (_, args) => {
    const validated = SaveFileSchema.parse(args);
    return workspaceService.saveFileContent(validated.filePath, validated.projectPath, validated.content);
  });

  ipcMain.handle('workspace:createFile', (_, args) => {
    const validated = CreateFileSchema.parse(args);
    return workspaceService.createFile(validated.filePath, validated.projectPath, validated.content);
  });

  ipcMain.handle('workspace:createDirectory', (_, args) => {
    const validated = CreateDirectorySchema.parse(args);
    return workspaceService.createDirectory(validated.directoryPath, validated.projectPath);
  });

  ipcMain.handle('workspace:renameItem', (_, args) => {
    const validated = RenameItemSchema.parse(args);
    return workspaceService.renameItem(validated.oldPath, validated.newName, validated.projectPath);
  });

  ipcMain.handle('workspace:deleteItem', (_, args) => {
    const validated = DeleteItemSchema.parse(args);
    return workspaceService.deleteItem(validated.targetPath, validated.projectPath);
  });

  ipcMain.handle('workspace:moveItem', (_, args) => {
    const validated = MoveItemSchema.parse(args);
    return workspaceService.moveItem(validated.sourcePath, validated.destinationDir, validated.projectPath);
  });

  ipcMain.handle('workspace:getFileSymbols', async (_, args) => {
    const validated = GetFileSymbolsSchema.parse(args);
    return await workspaceService.getFileSymbols(validated.filePath, validated.projectPath);
  });

  ipcMain.handle('workspace:getRecentProjects', () => {
    let recents = databaseService.getRecentProjects();
    if (recents.length === 0) {
      try {
        const cwd = process.cwd();
        const projectName = path.basename(cwd) || 'Orc';
        const isGit = fs.existsSync(path.join(cwd, '.git'));
        const defaultProj = {
          id: `proj-${Buffer.from(cwd).toString('base64url').substring(0, 16)}`,
          name: projectName,
          path: cwd,
          lastOpenedAt: Date.now(),
          isGitRepo: isGit,
          permissionLevel: 'full' as const
        };
        databaseService.recordProjectOpen(defaultProj);
        recents = [defaultProj];
      } catch {
        // Fallback to empty if cwd read fails
      }
    }
    return recents;
  });

  ipcMain.handle('workspace:removeProject', (_, projectId: string) => {
    databaseService.removeProject(projectId);
    return true;
  });

  ipcMain.handle('workspace:updateProject', (_, { projectId, updates }: { projectId: string; updates: any }) => {
    const updated = databaseService.updateProject(projectId, updates);
    const settings = databaseService.getSettings();
    if (settings.currentProjectId === projectId) {
      discordRpcService.setActiveProject(updated);
    }
    return updated;
  });

  ipcMain.handle('workspace:toggleFavorite', (_, { projectId, isFavorite }: { projectId: string; isFavorite?: boolean }) => {
    return databaseService.toggleProjectFavorite(projectId, isFavorite);
  });

  ipcMain.handle('workspace:getProjectSettings', (_, projectId: string) => {
    return databaseService.getProjectSettings(projectId);
  });

  ipcMain.handle('workspace:saveProjectSettings', (_, { projectId, settings }: { projectId: string; settings: any }) => {
    const success = databaseService.saveProjectSettings(projectId, settings);
    const project = databaseService.getProject(projectId);
    const wsSettings = databaseService.getSettings();
    if (project && wsSettings.currentProjectId === projectId) {
      discordRpcService.setActiveProject(project);
    }
    return success;
  });

  ipcMain.handle('workspace:openInExplorer', async (_, projectPath: string) => {
    return await shell.openPath(projectPath);
  });

  ipcMain.handle('workspace:revealInFileManager', async (_, args) => {
    const validated = RevealInFileManagerSchema.parse(args);
    shell.showItemInFolder(validated.filePath);
    return true;
  });

  ipcMain.handle('workspace:createWorktree', async (_, { projectPath, branchName }: { projectPath: string; branchName: string }) => {
    return await workspaceService.createWorktree(projectPath, branchName);
  });

  ipcMain.handle('workspace:removeWorktree', async (_, { projectPath, worktreePath, branchName }: { projectPath: string; worktreePath: string; branchName?: string }) => {
    return await workspaceService.removeWorktree(projectPath, worktreePath, branchName);
  });

  ipcMain.handle('workspace:getGitStatus', async (_, projectPath: string) => {
    return await workspaceService.getGitStatus(projectPath);
  });

  ipcMain.handle('workspace:getProjectGraph', async (_, args) => {
    const validated = GetProjectGraphSchema.parse(args);
    return await workspaceService.getProjectGraph(validated.projectPath);
  });

  // 2. Settings
  ipcMain.handle('settings:get', () => {
    return databaseService.getSettings();
  });

  ipcMain.handle('settings:update', (_, args) => {
    const validated = UpdateSettingsSchema.parse(args);
    const updated = databaseService.updateSettings(validated);
    if (validated.currentProjectId) {
      const p = databaseService.getProject(validated.currentProjectId);
      discordRpcService.setActiveProject(p || null);
    }
    if (validated.discordRpcEnabled !== undefined) {
      discordRpcService.setEnabled(validated.discordRpcEnabled);
    }
    if (validated.discordClientId !== undefined) {
      discordRpcService.setClientId(validated.discordClientId);
    }
    return updated;
  });

  // Discord Rich Presence Endpoints
  ipcMain.handle('discord:getStatus', () => {
    return discordRpcService.getStatus();
  });

  ipcMain.handle('discord:setActiveProject', async (_, project) => {
    await discordRpcService.setActiveProject(project || null);
    return true;
  });

  ipcMain.handle('discord:updateSettings', async (_, args) => {
    const validated = UpdateDiscordSettingsSchema.parse(args || {});
    if (validated.enabled !== undefined) {
      await discordRpcService.setEnabled(validated.enabled);
    }
    if (validated.clientId !== undefined) {
      await discordRpcService.setClientId(validated.clientId);
    }
    return discordRpcService.getStatus();
  });

  ipcMain.handle('discord:getProjectGitRemote', async (_, args) => {
    const validated = GetProjectGitRemoteSchema.parse(args);
    return await detectProjectGitRemote(validated.projectPath);
  });

  ipcMain.handle('workspace:getAppLayout', () => {
    return workspaceService.getAppLayout();
  });

  ipcMain.handle('workspace:saveAppLayout', (_, args) => {
    const validated = SaveAppLayoutSchema.parse(args);
    return workspaceService.saveAppLayout(validated.layout);
  });

  ipcMain.handle('workspace:getProjectWorkspaceState', (_, args) => {
    const validated = GetProjectWorkspaceStateSchema.parse(args);
    return workspaceService.getProjectWorkspaceState(validated.projectId);
  });

  ipcMain.handle('workspace:saveProjectWorkspaceState', (_, args) => {
    const validated = SaveProjectWorkspaceStateSchema.parse(args);
    return workspaceService.saveProjectWorkspaceState(validated.projectId, validated.state);
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

  // 5. System Metrics & Logs
  ipcMain.handle('system:getMetrics', async (): Promise<SystemResourceMetrics> => {
    let wsMb = 0;
    let privMb = 0;
    let cpuPct = 0;
    try {
      const appMetrics = app.getAppMetrics();
      for (const m of appMetrics) {
        wsMb += Math.round((m.memory.workingSetSize || 0) / 1024);
        privMb += Math.round((m.memory.privateBytes || 0) / 1024);
        cpuPct += m.cpu.percentCPUUsage || 0;
      }
    } catch {
      // fallback
    }
    const memInfo = process.memoryUsage();
    return {
      mainProcessMemoryMb: Math.round(memInfo.rss / (1024 * 1024)),
      totalAppMemoryMb: wsMb > 0 ? wsMb : Math.round(memInfo.heapUsed / (1024 * 1024)),
      workingSetMemoryMb: wsMb,
      privateMemoryMb: privMb,
      cpuPercent: Math.round(cpuPct * 10) / 10,
      uptimeSeconds: Math.round(process.uptime())
    };
  });

  ipcMain.handle('system:getDetailedResources', async (): Promise<DetailedResourceMetrics> => {
    let wsMb = 0;
    let privMb = 0;
    let cpuPct = 0;
    const processList: Array<{ pid: number; type: string; cpuPercent: number; memoryMb: number }> = [];
    try {
      const appMetrics = app.getAppMetrics();
      for (const m of appMetrics) {
        const mem = Math.round((m.memory.workingSetSize || 0) / 1024);
        wsMb += mem;
        privMb += Math.round((m.memory.privateBytes || 0) / 1024);
        cpuPct += m.cpu.percentCPUUsage || 0;
        processList.push({
          pid: m.pid,
          type: m.type,
          cpuPercent: Math.round((m.cpu.percentCPUUsage || 0) * 10) / 10,
          memoryMb: mem
        });
      }
    } catch {
      // fallback
    }

    const activePorts: Array<{ port: number; service?: string }> = [];
    const portChecks = COMMON_DEV_PORTS.map(async (entry) => {
      const isOpen = await checkPortOpen(entry.port);
      if (isOpen) {
        activePorts.push(entry);
      }
    });
    await Promise.all(portChecks);

    const isKeepAwake = keepAwakeBlockerId !== null && powerSaveBlocker.isStarted(keepAwakeBlockerId);

    return {
      cpuPercent: Math.round(cpuPct * 10) / 10,
      workingSetMemoryMb: wsMb,
      privateMemoryMb: privMb,
      uptimeSeconds: Math.round(process.uptime()),
      keepAwakeActive: isKeepAwake,
      processes: processList,
      activePorts: activePorts.sort((a, b) => a.port - b.port)
    };
  });

  ipcMain.handle('system:toggleKeepAwake', (_, enable?: boolean) => {
    if (enable === undefined) {
      if (keepAwakeBlockerId !== null && powerSaveBlocker.isStarted(keepAwakeBlockerId)) {
        powerSaveBlocker.stop(keepAwakeBlockerId);
        keepAwakeBlockerId = null;
        return { enabled: false };
      } else {
        keepAwakeBlockerId = powerSaveBlocker.start('prevent-app-suspension');
        return { enabled: true };
      }
    } else if (enable) {
      if (keepAwakeBlockerId === null || !powerSaveBlocker.isStarted(keepAwakeBlockerId)) {
        keepAwakeBlockerId = powerSaveBlocker.start('prevent-app-suspension');
      }
      return { enabled: true };
    } else {
      if (keepAwakeBlockerId !== null && powerSaveBlocker.isStarted(keepAwakeBlockerId)) {
        powerSaveBlocker.stop(keepAwakeBlockerId);
        keepAwakeBlockerId = null;
      }
      return { enabled: false };
    }
  });

  ipcMain.handle('system:getKeepAwake', () => {
    const isStarted = keepAwakeBlockerId !== null && powerSaveBlocker.isStarted(keepAwakeBlockerId);
    return { enabled: isStarted };
  });

  ipcMain.handle('system:cleanupWorkspaces', async () => {
    try {
      const beforeMem = process.memoryUsage().heapUsed;
      MultiTierCacheService.clearAll();
      if ((global as any).gc) {
        (global as any).gc();
      }
      const afterMem = process.memoryUsage().heapUsed;
      const freedBytes = Math.max(0, beforeMem - afterMem);
      const freedMb = Number((freedBytes / (1024 * 1024)).toFixed(1));
      return { success: true, freedMb };
    } catch {
      return { success: false, freedMb: 0 };
    }
  });

  ipcMain.handle('system:getActivePorts', async () => {
    const activePorts: Array<{ port: number; service?: string }> = [];
    const portChecks = COMMON_DEV_PORTS.map(async (entry) => {
      const isOpen = await checkPortOpen(entry.port);
      if (isOpen) {
        activePorts.push(entry);
      }
    });
    await Promise.all(portChecks);
    return activePorts.sort((a, b) => a.port - b.port);
  });

  ipcMain.handle('system:getLogs', () => {
    return appLogger.getRecentLogs();
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

  // Interactive Terminal Engine (PTY)
  ipcMain.handle('terminal:create', async (_, args) => {
    const validated = TerminalCreateSchema.parse(args);
    return await ptyService.createSession(validated);
  });

  // Fast-path one-way IPC for instant keystrokes without promise/schema overhead
  ipcMain.on('terminal:write-fast', (_, args) => {
    if (args && typeof args.terminalId === 'string' && typeof args.data === 'string') {
      ptyService.write(args.terminalId, args.data);
    }
  });

  ipcMain.handle('terminal:write', (_, args) => {
    const validated = TerminalWriteSchema.parse(args);
    ptyService.write(validated.terminalId, validated.data);
    return { success: true };
  });

  ipcMain.handle('terminal:resize', (_, args) => {
    const validated = TerminalResizeSchema.parse(args);
    ptyService.resize(validated.terminalId, validated.cols, validated.rows);
    return { success: true };
  });

  ipcMain.handle('terminal:kill', (_, args) => {
    const validated = TerminalKillSchema.parse(args);
    const success = ptyService.kill(validated.terminalId);
    return { success };
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

  // 8. Skills Engine (Phase 4)
  ipcMain.handle('skills:list', () => {
    return skillRegistry.listSkills();
  });

  ipcMain.handle('skills:getDetails', (_, skillId: string) => {
    return skillRegistry.getSkillDetails(skillId);
  });

  ipcMain.handle('skills:toggle', (_, args) => {
    const validated = ToggleSkillSchema.parse(args);
    const success = skillRegistry.toggleSkill(validated.skillId, validated.enabled);
    return { success };
  });

  ipcMain.handle('skills:resolve', (_, args) => {
    const validated = ResolveSkillSchema.parse(args);
    return SkillResolver.resolve(validated.prompt, validated.provider);
  });

  ipcMain.handle('skills:execute', async (_, args) => {
    const validated = ExecuteSkillSchema.parse(args);
    const canonical = securityService.assertWithinWorkspace(validated.projectPath, validated.projectPath);
    return await skillExecutionEngine.execute({
      skillId: validated.skillId,
      prompt: validated.prompt,
      projectId: validated.projectId,
      projectPath: canonical,
      provider: validated.provider,
      model: validated.model
    });
  });

  ipcMain.handle('skills:importCustom', (_, args) => {
    const validated = ImportCustomSkillSchema.parse(args);
    return CustomSkillsService.importFromFolder(validated.sourceDirectory);
  });

  ipcMain.handle('skills:deleteCustom', (_, args) => {
    const validated = DeleteCustomSkillSchema.parse(args);
    const success = skillRegistry.removeCustomSkill(validated.skillId);
    return { success };
  });

  ipcMain.handle('skills:listExecutions', (_, projectId?: string) => {
    return databaseService.listSkillExecutions(projectId);
  });

  // 9. Multi-Agent Orchestration (Phase 5)
  ipcMain.handle('orchestration:start', async (_, args) => {
    const validated = StartOrchestrationSchema.parse(args);
    const canonical = securityService.assertWithinWorkspace(validated.projectPath, validated.projectPath);
    return await agentOrchestrator.startOrchestration({
      projectId: validated.projectId,
      projectPath: canonical,
      userGoal: validated.userGoal,
      mode: validated.mode,
      provider: validated.provider,
      model: validated.model
    });
  });

  ipcMain.handle('orchestration:cancel', async (_, args) => {
    const validated = CancelOrchestrationSchema.parse(args);
    const success = await agentOrchestrator.cancelOrchestration(validated.orchestrationId);
    return { success };
  });

  ipcMain.handle('orchestration:resolveApproval', async (_, args) => {
    const validated = ResolveApprovalSchema.parse(args);
    const success = await agentOrchestrator.resolveApproval(
      validated.approvalId,
      validated.decision,
      validated.rejectionReason
    );
    return { success };
  });

  ipcMain.handle('orchestration:get', (_, args) => {
    const validated = GetOrchestrationSchema.parse(args);
    return agentOrchestrator.getOrchestration(validated.orchestrationId);
  });

  ipcMain.handle('orchestration:list', (_, args) => {
    const validated = ListOrchestrationsSchema.parse(args || {});
    return agentOrchestrator.listOrchestrations(validated.projectId);
  });

  ipcMain.handle('orchestration:retryTask', async (_, args) => {
    const validated = RetryTaskSchema.parse(args);
    const success = await agentOrchestrator.retryTask(validated.orchestrationId, validated.taskId);
    return { success };
  });

  ipcMain.handle('orchestration:getWorktreeDiff', async (_, args) => {
    const validated = GetWorktreeDiffSchema.parse(args);
    return await agentOrchestrator.getWorktreeDiff(validated.taskId);
  });

  ipcMain.handle('orchestration:getPendingApprovals', (_, orchestrationId?: string) => {
    return databaseService.getPendingApprovals(orchestrationId);
  });

  // ==========================================
  // Phase 6: Visual Automation & Workflows Handlers
  // ==========================================

  ipcMain.handle('workflows:list', (_, args) => {
    const validated = ListWorkflowsSchema.parse(args || {});
    return databaseService.listWorkflows(validated.projectId || 'default');
  });

  ipcMain.handle('workflows:get', (_, args) => {
    const validated = GetWorkflowSchema.parse(args);
    return databaseService.getWorkflow(validated.id);
  });

  ipcMain.handle('workflows:save', (_, args) => {
    const validated = SaveWorkflowSchema.parse(args);
    databaseService.upsertWorkflow(validated.workflow);
    return { success: true };
  });

  ipcMain.handle('workflows:delete', (_, args) => {
    const validated = DeleteWorkflowSchema.parse(args);
    const success = databaseService.deleteWorkflow(validated.id);
    return { success };
  });

  ipcMain.handle('workflows:duplicate', (_, args) => {
    const validated = DuplicateWorkflowSchema.parse(args);
    return databaseService.duplicateWorkflow(validated.id);
  });

  ipcMain.handle('workflows:getTemplates', () => {
    return WORKFLOW_TEMPLATES;
  });

  ipcMain.handle('workflows:execute', async (_, args) => {
    const validated = ExecuteWorkflowSchema.parse(args);
    const workflow = databaseService.getWorkflow(validated.workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: "${validated.workflowId}"`);
    }
    return await workflowEngine.executeWorkflow(
      workflow,
      validated.initialInputs || {},
      validated.projectPath
    );
  });

  ipcMain.handle('workflows:cancel', async (_, args) => {
    const validated = CancelWorkflowSchema.parse(args);
    const success = await workflowEngine.cancelWorkflow(validated.executionId);
    return { success };
  });

  ipcMain.handle('workflows:getExecution', (_, args) => {
    const validated = GetWorkflowExecutionSchema.parse(args);
    return databaseService.getWorkflowExecution(validated.id);
  });

  ipcMain.handle('workflows:listExecutions', (_, args) => {
    const validated = ListWorkflowExecutionsSchema.parse(args);
    return databaseService.listWorkflowExecutions(validated.workflowId);
  });

  ipcMain.handle('workflows:generateFromPrompt', async (_, args) => {
    const validated = GenerateWorkflowFromPromptSchema.parse(args);
    return await WorkflowGenerator.generateFromPrompt(validated);
  });

  // ==========================================
  // Phase 7: Custom Extensions
  // ==========================================

  ipcMain.handle('extensions:list', async () => {
    await extensionRegistry.initialize();
    return extensionRegistry.listExtensions();
  });

  ipcMain.handle('extensions:toggle', async (_, args) => {
    const validated = ToggleExtensionSchema.parse(args);
    const success = await extensionRegistry.toggleExtension(validated.extensionId, validated.enabled);
    return { success };
  });

  ipcMain.handle('extensions:install', async (_, args) => {
    const validated = InstallExtensionSchema.parse(args);
    return await extensionRegistry.installFromDirectory(validated.directoryPath);
  });

  ipcMain.handle('extensions:uninstall', async (_, args) => {
    const validated = UninstallExtensionSchema.parse(args);
    const success = await extensionRegistry.uninstallExtension(validated.extensionId);
    return { success };
  });

  // ==========================================
  // Phase 7: Advanced Analytics & Cost Tracking
  // ==========================================

  ipcMain.handle('analytics:getSummary', (_, args) => {
    const validated = GetAnalyticsSummarySchema.parse(args);
    return analyticsService.getSummary(validated);
  });

  ipcMain.handle('analytics:getProviderCostMetrics', () => {
    return analyticsService.getProviderCostMetrics();
  });

  ipcMain.handle('analytics:recordEvent', (_, args) => {
    const validated = RecordAnalyticsEventSchema.parse(args);
    return analyticsService.recordEvent(validated);
  });

  ipcMain.handle('analytics:export', (_, args) => {
    const validated = ExportAnalyticsSchema.parse(args);
    return analyticsService.exportData(validated.format);
  });

  // ==========================================
  // Phase 7: Enterprise Audit Logging
  // ==========================================

  ipcMain.handle('audit:queryLogs', (_, args) => {
    const validated = QueryAuditLogsSchema.parse(args);
    return auditService.query(validated);
  });

  ipcMain.handle('audit:export', (_, args) => {
    const validated = ExportAuditLogsSchema.parse(args);
    return auditService.export(validated.format);
  });

  // ==========================================
  // Phase 7: Air-Gap & Local Model Support
  // ==========================================

  ipcMain.handle('airgap:getConfig', () => {
    return airGapManager.getConfig();
  });

  ipcMain.handle('airgap:updateConfig', (_, args) => {
    const validated = UpdateAirGapConfigSchema.parse(args);
    return airGapManager.updateConfig(validated);
  });

  ipcMain.handle('airgap:listLocalModels', async () => {
    const isRunning = await ollamaAdapter.pingDaemon();
    const models = isRunning ? await ollamaAdapter.listLocalModels() : [];
    return { models, isRunning };
  });

  // ==========================================
  // Phase 8: Intelligence & Optimization Engine
  // ==========================================

  ipcMain.handle('intelligence:routeTask', (_, args) => {
    const validated = RouteIntelligenceTaskSchema.parse(args);
    return IntelligenceRouter.routeTask(validated);
  });

  ipcMain.handle('intelligence:assemblePrompt', (_, args) => {
    const validated = AssemblePromptSchema.parse(args);
    return PromptAssemblyService.assemblePrompt(validated);
  });

  ipcMain.handle('intelligence:composeSkills', (_, args) => {
    const validated = ComposeSkillsSchema.parse(args);
    return SkillCompositionService.composeSkills(validated.skillIds, validated.level, validated.maxTokens);
  });

  ipcMain.handle('intelligence:getCacheStats', () => {
    return MultiTierCacheService.getAggregatedStats();
  });

  ipcMain.handle('intelligence:clearCache', () => {
    MultiTierCacheService.clearAll();
    return { success: true };
  });

  // Window Controls (Frameless Titlebar)
  ipcMain.handle('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.minimize();
  });

  ipcMain.handle('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;
    if (win.isMaximized()) {
      win.unmaximize();
      return false;
    } else {
      win.maximize();
      return true;
    }
  });

  ipcMain.handle('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.close();
  });

  ipcMain.handle('window:isMaximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win?.isMaximized() ?? false;
  });

  ipcMain.handle('window:openDetachedTab', async (_, params: { tab: any; project?: any; x?: number; y?: number }) => {
    const isDev = !app.isPackaged || Boolean(process.env.ELECTRON_RENDERER_URL);
    const icoPath = path.join(__dirname, '../../resources/icon.ico');
    const pngPath = path.join(__dirname, '../../resources/Orbit.png');
    const iconPath = process.platform === 'win32' && fs.existsSync(icoPath) ? icoPath : pngPath;

    const detachedWin = new BrowserWindow({
      width: 1100,
      height: 720,
      x: params.x ? Math.max(0, Math.round(params.x - 200)) : undefined,
      y: params.y ? Math.max(0, Math.round(params.y - 40)) : undefined,
      minWidth: 540,
      minHeight: 360,
      frame: false,
      titleBarStyle: 'hidden',
      autoHideMenuBar: true,
      title: `${params.tab?.title || 'Tab'} — Orbito`,
      icon: fs.existsSync(iconPath) ? iconPath : undefined,
      backgroundColor: '#101113',
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        devTools: isDev
      }
    });

    const payload = {
      ...params.tab,
      project: params.project || null
    };

    const serializedTab = encodeURIComponent(JSON.stringify(payload));
    if (process.env.ELECTRON_RENDERER_URL) {
      detachedWin.loadURL(`${process.env.ELECTRON_RENDERER_URL}?detachedTab=${serializedTab}`);
    } else {
      detachedWin.loadFile(path.join(__dirname, '../renderer/index.html'), {
        query: { detachedTab: serializedTab }
      });
    }

    detachedWin.once('ready-to-show', () => {
      detachedWin.show();
      detachedWin.focus();
    });

    return { success: true };
  });

  // ==========================================
  // Project Explorer: Changes & Code Review Handlers
  // ==========================================

  ipcMain.handle('project:listExecutions', async (_, args) => {
    const validated = ListProjectExecutionsSchema.parse(args);
    return databaseService.listProjectExecutions(validated.projectId);
  });

  ipcMain.handle('project:getExecutionFileChanges', async (_, args) => {
    const validated = GetExecutionFileChangesSchema.parse(args);
    return databaseService.getExecutionFileChanges(validated.executionId);
  });

  ipcMain.handle('project:syncManualChanges', async (_, args) => {
    const validated = SyncManualChangesSchema.parse(args);
    const canonical = securityService.assertWithinWorkspace(validated.projectPath, validated.projectPath);
    return await projectExecutionService.syncManualWorkspaceChanges(validated.projectId, canonical);
  });

  ipcMain.handle('review:getCodeReview', async (_, args) => {
    const validated = GetCodeReviewSchema.parse(args);
    return await codeReviewService.getOrCreateReview(validated.projectId, validated.executionId);
  });

  ipcMain.handle('review:updateDecision', async (_, args) => {
    const validated = UpdateReviewDecisionSchema.parse(args);
    return await codeReviewService.updateReviewDecision({
      reviewId: validated.reviewId,
      status: validated.status as any,
      reviewer: validated.reviewer,
      summary: validated.summary
    });
  });

  ipcMain.handle('review:markFileStatus', async (_, args) => {
    const validated = MarkFileReviewStatusSchema.parse(args);
    return await codeReviewService.markFileStatus({
      reviewId: validated.reviewId,
      filePath: validated.filePath,
      status: validated.status as any
    });
  });

  ipcMain.handle('review:addComment', async (_, args) => {
    const validated = AddReviewCommentSchema.parse(args);
    return await codeReviewService.addComment({
      reviewId: validated.reviewId,
      projectId: validated.projectId,
      filePath: validated.filePath,
      lineNumber: validated.lineNumber,
      diffHunk: validated.diffHunk,
      content: validated.content,
      author: validated.author,
      parentCommentId: validated.parentCommentId
    });
  });

  ipcMain.handle('review:listComments', async (_, args) => {
    const validated = ListReviewCommentsSchema.parse(args);
    return codeReviewService.listComments(validated.reviewId);
  });

  ipcMain.handle('review:resolveComment', async (_, args) => {
    const validated = ResolveReviewCommentSchema.parse(args);
    const success = codeReviewService.resolveComment(validated.commentId, validated.resolved);
    return { success };
  });

  ipcMain.handle('review:runAICodeReview', async (_, args) => {
    const validated = RunAICodeReviewSchema.parse(args);
    const canonical = securityService.assertWithinWorkspace(validated.projectPath, validated.projectPath);
    return await codeReviewService.runAIReview({
      reviewId: validated.reviewId,
      projectPath: canonical,
      diff: validated.diff,
      changedFiles: validated.changedFiles
    });
  });

  ipcMain.handle('project:getGitDetails', async (_, args) => {
    const validated = GetProjectGitDetailsSchema.parse(args);
    const canonical = securityService.assertWithinWorkspace(validated.projectPath, validated.projectPath);
    const isGit = await WorktreeManager.isGitRepo(canonical);
    if (!isGit) {
      return {
        isGitRepo: false,
        branch: '',
        hasUncommittedChanges: false,
        stagedFiles: [],
        uncommittedFiles: []
      };
    }

    const status = await workspaceService.getGitStatus(canonical);
    const remote = await detectProjectGitRemote(canonical);
    return {
      isGitRepo: true,
      branch: status.branch,
      commitHash: status.worktrees[0]?.head || undefined,
      remoteUrl: remote?.rawUrl,
      gitProvider: remote?.provider,
      githubOwner: remote?.owner,
      githubRepo: remote?.repo,
      githubBrowserUrl: remote?.browserUrl,
      hasUncommittedChanges: !status.isClean,
      stagedFiles: [],
      uncommittedFiles: status.changedFiles.map((f) => f.path)
    };
  });
}
