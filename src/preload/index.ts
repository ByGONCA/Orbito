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
  }
};

contextBridge.exposeInMainWorld('api', api);
