import { ipcMain, BrowserWindow } from 'electron';
import {
  OpenDirectorySchema,
  ListFilesSchema,
  ReadFileSchema,
  UpdateSettingsSchema,
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
  GenerateWorkflowFromPromptSchema
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
}
