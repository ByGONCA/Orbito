import { contextBridge, ipcRenderer } from 'electron';
import type { IElectronAPI } from '../shared/ipc';

const api: IElectronAPI = {
  openDirectoryDialog: (params) => ipcRenderer.invoke('workspace:openDirectory', params),
  createProject: (params) => ipcRenderer.invoke('workspace:createProject', params),
  selectDirectory: (title) => ipcRenderer.invoke('workspace:selectDirectory', title),
  verifyProjectPath: (projectPath) => ipcRenderer.invoke('workspace:verifyProjectPath', projectPath),
  listFiles: (params) => ipcRenderer.invoke('workspace:listFiles', params),
  readFileContent: (params) => ipcRenderer.invoke('workspace:readFileContent', params),
  saveFileContent: (params) => ipcRenderer.invoke('workspace:saveFileContent', params),
  createFile: (params) => ipcRenderer.invoke('workspace:createFile', params),
  createDirectory: (params) => ipcRenderer.invoke('workspace:createDirectory', params),
  renameItem: (params) => ipcRenderer.invoke('workspace:renameItem', params),
  deleteItem: (params) => ipcRenderer.invoke('workspace:deleteItem', params),
  moveItem: (params) => ipcRenderer.invoke('workspace:moveItem', params),
  getFileSymbols: (params) => ipcRenderer.invoke('workspace:getFileSymbols', params),
  getRecentProjects: () => ipcRenderer.invoke('workspace:getRecentProjects'),
  removeProject: (projectId) => ipcRenderer.invoke('workspace:removeProject', projectId),
  updateProject: (params) => ipcRenderer.invoke('workspace:updateProject', params),
  toggleProjectFavorite: (params) => ipcRenderer.invoke('workspace:toggleFavorite', params),
  getProjectSettings: (projectId) => ipcRenderer.invoke('workspace:getProjectSettings', projectId),
  saveProjectSettings: (params) => ipcRenderer.invoke('workspace:saveProjectSettings', params),
  openInExplorer: (projectPath) => ipcRenderer.invoke('workspace:openInExplorer', projectPath),
  revealInFileManager: (params) => ipcRenderer.invoke('workspace:revealInFileManager', params),
  createWorktree: (params) => ipcRenderer.invoke('workspace:createWorktree', params),
  removeWorktree: (params) => ipcRenderer.invoke('workspace:removeWorktree', params),
  getGitStatus: (projectPath) => ipcRenderer.invoke('workspace:getGitStatus', projectPath),
  getProjectGraph: (params) => ipcRenderer.invoke('workspace:getProjectGraph', params),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (params) => ipcRenderer.invoke('settings:update', params),
  getAppLayout: () => ipcRenderer.invoke('workspace:getAppLayout'),
  saveAppLayout: (params) => ipcRenderer.invoke('workspace:saveAppLayout', params),
  getProjectWorkspaceState: (params) => ipcRenderer.invoke('workspace:getProjectWorkspaceState', params),
  saveProjectWorkspaceState: (params) => ipcRenderer.invoke('workspace:saveProjectWorkspaceState', params),

  storeSecret: (params) => ipcRenderer.invoke('secret:store', params),
  getSecret: (params) => ipcRenderer.invoke('secret:get', params),

  listMemories: (tier) => ipcRenderer.invoke('memory:list', tier),
  saveMemory: (params) => ipcRenderer.invoke('memory:save', params),
  deleteMemory: (params) => ipcRenderer.invoke('memory:delete', params),

  getSystemMetrics: () => ipcRenderer.invoke('system:getMetrics'),
  getDetailedResources: () => ipcRenderer.invoke('system:getDetailedResources'),
  toggleKeepAwake: (enable?: boolean) => ipcRenderer.invoke('system:toggleKeepAwake', enable),
  getKeepAwake: () => ipcRenderer.invoke('system:getKeepAwake'),
  cleanupWorkspaces: () => ipcRenderer.invoke('system:cleanupWorkspaces'),
  getActivePorts: () => ipcRenderer.invoke('system:getActivePorts'),
  getSystemLogs: () => ipcRenderer.invoke('system:getLogs'),
  onSystemLog: (callback) => {
    const handler = (_: any, log: any) => callback(log);
    ipcRenderer.on('system:log-event', handler);
    return () => {
      ipcRenderer.removeListener('system:log-event', handler);
    };
  },

  // CLI Engine (Phase 2)
  detectCLIs: (params) => ipcRenderer.invoke('cli:detect', params),
  checkCLIAuth: (params) => ipcRenderer.invoke('cli:checkAuth', params),
  executeCLIPrompt: (params) => ipcRenderer.invoke('cli:executePrompt', params),
  cancelCLISession: (params) => ipcRenderer.invoke('cli:cancelSession', params),
  listCLISessions: (params) => ipcRenderer.invoke('cli:listSessions', params),
  getSessionMessages: (params) => ipcRenderer.invoke('cli:getSessionMessages', params),
  onCLIStreamEvent: (callback) => {
    const handler = (_: any, event: any) => callback(event);
    ipcRenderer.on('cli:stream-event', handler);
    return () => {
      ipcRenderer.removeListener('cli:stream-event', handler);
    };
  },

  // Interactive Terminal Engine (PTY & xterm.js)
  terminalCreate: (params) => ipcRenderer.invoke('terminal:create', params),
  terminalWrite: (params) => {
    ipcRenderer.send('terminal:write-fast', params);
    return Promise.resolve();
  },
  terminalResize: (params) => ipcRenderer.invoke('terminal:resize', params),
  terminalKill: (params) => ipcRenderer.invoke('terminal:kill', params),
  onTerminalData: (callback) => {
    const handler = (_: any, evt: any) => callback(evt);
    ipcRenderer.on('terminal:data', handler);
    return () => {
      ipcRenderer.removeListener('terminal:data', handler);
    };
  },
  onTerminalExit: (callback) => {
    const handler = (_: any, evt: any) => callback(evt);
    ipcRenderer.on('terminal:exit', handler);
    return () => {
      ipcRenderer.removeListener('terminal:exit', handler);
    };
  },

  // Context Engine (Phase 3)
  startIndexing: (params) => ipcRenderer.invoke('context:startIndexing', params),
  cancelIndexing: (params) => ipcRenderer.invoke('context:cancelIndexing', params),
  getIndexStats: (params) => ipcRenderer.invoke('context:getIndexStats', params),
  searchContext: (params) => ipcRenderer.invoke('context:search', params),
  assembleContext: (params) => ipcRenderer.invoke('context:assemble', params),
  onIndexingProgress: (callback) => {
    const handler = (_: any, prog: any) => callback(prog);
    ipcRenderer.on('context:indexing-progress', handler);
    return () => {
      ipcRenderer.removeListener('context:indexing-progress', handler);
    };
  },
  onIndexingStatus: (callback) => {
    const handler = (_: any, status: any) => callback(status);
    ipcRenderer.on('context:indexing-status', handler);
    return () => {
      ipcRenderer.removeListener('context:indexing-status', handler);
    };
  },

  // Skills Engine (Phase 4)
  listSkills: () => ipcRenderer.invoke('skills:list'),
  getSkillDetails: (skillId) => ipcRenderer.invoke('skills:getDetails', skillId),
  toggleSkill: (params) => ipcRenderer.invoke('skills:toggle', params),
  resolveSkillForPrompt: (params) => ipcRenderer.invoke('skills:resolve', params),
  executeSkill: (params) => ipcRenderer.invoke('skills:execute', params),
  importCustomSkill: (params) => ipcRenderer.invoke('skills:importCustom', params),
  deleteCustomSkill: (params) => ipcRenderer.invoke('skills:deleteCustom', params),
  listSkillExecutions: (projectId) => ipcRenderer.invoke('skills:listExecutions', projectId),

  // Multi-Agent Orchestration (Phase 5)
  startOrchestration: (params) => ipcRenderer.invoke('orchestration:start', params),
  cancelOrchestration: (params) => ipcRenderer.invoke('orchestration:cancel', params),
  resolveApproval: (params) => ipcRenderer.invoke('orchestration:resolveApproval', params),
  getOrchestration: (params) => ipcRenderer.invoke('orchestration:get', params),
  listOrchestrations: (params) => ipcRenderer.invoke('orchestration:list', params),
  retryOrchestrationTask: (params) => ipcRenderer.invoke('orchestration:retryTask', params),
  getWorktreeDiff: (params) => ipcRenderer.invoke('orchestration:getWorktreeDiff', params),
  getPendingApprovals: (orchestrationId) => ipcRenderer.invoke('orchestration:getPendingApprovals', orchestrationId),
  onOrchestrationEvent: (callback) => {
    const handler = (_: any, event: any) => callback(event);
    ipcRenderer.on('agents:orchestration-event', handler);
    return () => {
      ipcRenderer.removeListener('agents:orchestration-event', handler);
    };
  },

  // Visual Automation & Workflows (Phase 6)
  listWorkflows: (params) => ipcRenderer.invoke('workflows:list', params),
  getWorkflow: (params) => ipcRenderer.invoke('workflows:get', params),
  saveWorkflow: (params) => ipcRenderer.invoke('workflows:save', params),
  deleteWorkflow: (params) => ipcRenderer.invoke('workflows:delete', params),
  duplicateWorkflow: (params) => ipcRenderer.invoke('workflows:duplicate', params),
  getWorkflowTemplates: () => ipcRenderer.invoke('workflows:getTemplates'),
  executeWorkflow: (params) => ipcRenderer.invoke('workflows:execute', params),
  cancelWorkflow: (params) => ipcRenderer.invoke('workflows:cancel', params),
  getWorkflowExecution: (params) => ipcRenderer.invoke('workflows:getExecution', params),
  listWorkflowExecutions: (params) => ipcRenderer.invoke('workflows:listExecutions', params),
  generateWorkflowFromPrompt: (params) => ipcRenderer.invoke('workflows:generateFromPrompt', params),
  onWorkflowEvent: (callback) => {
    const handler = (_: any, event: any) => callback(event);
    ipcRenderer.on('workflows:event', handler);
    return () => {
      ipcRenderer.removeListener('workflows:event', handler);
    };
  },

  // Custom Extension SDK (Phase 7)
  listExtensions: () => ipcRenderer.invoke('extensions:list'),
  toggleExtension: (params) => ipcRenderer.invoke('extensions:toggle', params),
  installExtension: (params) => ipcRenderer.invoke('extensions:install', params),
  uninstallExtension: (params) => ipcRenderer.invoke('extensions:uninstall', params),

  // Advanced Analytics & Telemetry (Phase 7)
  getAnalyticsSummary: (params) => ipcRenderer.invoke('analytics:getSummary', params),
  getProviderCostMetrics: () => ipcRenderer.invoke('analytics:getProviderCostMetrics'),
  recordAnalyticsEvent: (params) => ipcRenderer.invoke('analytics:recordEvent', params),
  exportAnalytics: (params) => ipcRenderer.invoke('analytics:export', params),

  // Enterprise Hardening & Audit Logging (Phase 7)
  queryAuditLogs: (params) => ipcRenderer.invoke('audit:queryLogs', params),
  exportAuditLogs: (params) => ipcRenderer.invoke('audit:export', params),

  // Local Model & Air-Gap Support (Phase 7)
  getAirGapConfig: () => ipcRenderer.invoke('airgap:getConfig'),
  updateAirGapConfig: (params) => ipcRenderer.invoke('airgap:updateConfig', params),
  listLocalModels: () => ipcRenderer.invoke('airgap:listLocalModels'),

  // Intelligence & Token Optimization (Phase 8)
  routeIntelligenceTask: (params) => ipcRenderer.invoke('intelligence:routeTask', params),
  assemblePrompt: (params) => ipcRenderer.invoke('intelligence:assemblePrompt', params),
  composeSkills: (params) => ipcRenderer.invoke('intelligence:composeSkills', params),
  getIntelligenceCacheStats: () => ipcRenderer.invoke('intelligence:getCacheStats'),
  clearIntelligenceCache: () => ipcRenderer.invoke('intelligence:clearCache'),

  // Discord Rich Presence
  getDiscordStatus: () => ipcRenderer.invoke('discord:getStatus'),
  updateDiscordSettings: (params) => ipcRenderer.invoke('discord:updateSettings', params),
  setDiscordActiveProject: (project) => ipcRenderer.invoke('discord:setActiveProject', project),
  getProjectGitRemote: (params) => ipcRenderer.invoke('discord:getProjectGitRemote', params),
  onDiscordStatusChange: (callback) => {
    const handler = (_: any, status: any) => callback(status);
    ipcRenderer.on('discord:status-changed', handler);
    return () => {
      ipcRenderer.removeListener('discord:status-changed', handler);
    };
  },

  // Window Controls (Frameless Titlebar)
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isWindowMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  openDetachedTabWindow: (params: { tab: any; x?: number; y?: number }) =>
    ipcRenderer.invoke('window:openDetachedTab', params),
  onWindowStateChange: (callback) => {
    const handler = (_: any, state: any) => callback(state);
    ipcRenderer.on('window:state-changed', handler);
    return () => {
      ipcRenderer.removeListener('window:state-changed', handler);
    };
  },

  // Project Explorer: Changes & Code Review
  listProjectExecutions: (params) => ipcRenderer.invoke('project:listExecutions', params),
  getExecutionFileChanges: (params) => ipcRenderer.invoke('project:getExecutionFileChanges', params),
  syncManualChanges: (params) => ipcRenderer.invoke('project:syncManualChanges', params),
  getCodeReview: (params) => ipcRenderer.invoke('review:getCodeReview', params),
  updateReviewDecision: (params) => ipcRenderer.invoke('review:updateDecision', params),
  markFileReviewStatus: (params) => ipcRenderer.invoke('review:markFileStatus', params),
  addReviewComment: (params) => ipcRenderer.invoke('review:addComment', params),
  listReviewComments: (params) => ipcRenderer.invoke('review:listComments', params),
  resolveReviewComment: (params) => ipcRenderer.invoke('review:resolveComment', params),
  runAICodeReview: (params) => ipcRenderer.invoke('review:runAICodeReview', params),
  getProjectGitDetails: (params) => ipcRenderer.invoke('project:getGitDetails', params)
};

contextBridge.exposeInMainWorld('api', api);
