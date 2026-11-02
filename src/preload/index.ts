import { contextBridge, ipcRenderer } from 'electron';
import type { IElectronAPI } from '../shared/ipc';

const api: IElectronAPI = {
  openDirectoryDialog: (params) => ipcRenderer.invoke('workspace:openDirectory', params),
  listFiles: (params) => ipcRenderer.invoke('workspace:listFiles', params),
  readFileContent: (params) => ipcRenderer.invoke('workspace:readFileContent', params),
  getRecentProjects: () => ipcRenderer.invoke('workspace:getRecentProjects'),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (params) => ipcRenderer.invoke('settings:update', params),

  storeSecret: (params) => ipcRenderer.invoke('secret:store', params),
  getSecret: (params) => ipcRenderer.invoke('secret:get', params),

  listMemories: (tier) => ipcRenderer.invoke('memory:list', tier),
  saveMemory: (params) => ipcRenderer.invoke('memory:save', params),
  deleteMemory: (params) => ipcRenderer.invoke('memory:delete', params),

  getSystemMetrics: () => ipcRenderer.invoke('system:getMetrics'),

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
  clearIntelligenceCache: () => ipcRenderer.invoke('intelligence:clearCache')
};

contextBridge.exposeInMainWorld('api', api);
