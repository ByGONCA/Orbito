import React from 'react';
import { useWorkspaceStore } from '../stores/workspace.store';
import { ProjectsWorkspace } from './ProjectsWorkspace';
import { AgentsWorkspace } from './AgentsWorkspace';
import { TasksWorkspace } from './TasksWorkspace';
import { FlowBuilderWorkspace } from './FlowBuilder/FlowBuilderWorkspace';
import { ContextInspector } from './ContextInspector';
import { SkillsManager } from './SkillsManager';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { PluginsWorkspace } from './plugins/PluginsWorkspace';
import { ProvidersPanel } from './ProvidersPanel';
import { CodeEditor } from './CodeEditor';
import { TerminalWorkspace } from './TerminalWorkspace';
import { IntelligenceGraphWorkspace } from './IntelligenceGraph/IntelligenceGraphWorkspace';
import { EmbeddedBrowser } from './EmbeddedBrowser';
import { ProjectSettingsPage } from './ProjectSettingsPage';

export const CenterArea: React.FC = () => {
  const { activeTabId, openTabs, activeSection } = useWorkspaceStore();
  const activeTab = openTabs.find((t) => t.id === activeTabId);

  // 1. If a dedicated sidebar section is explicitly selected, prioritize it
  if (activeSection === 'tasks') {
    return <TasksWorkspace />;
  }
  if (activeSection === 'flows') {
    return <FlowBuilderWorkspace />;
  }
  if (activeSection === 'graph') {
    return <IntelligenceGraphWorkspace />;
  }
  if (activeSection === 'agents') {
    return <AgentsWorkspace />;
  }
  if (activeSection === 'context') {
    return <ContextInspector />;
  }
  if (activeSection === 'skills') {
    return <SkillsManager />;
  }
  if (activeSection === 'analytics') {
    return <AnalyticsDashboard />;
  }
  if (activeSection === 'extensions' || activeTab?.type === 'plugins') {
    return <PluginsWorkspace />;
  }
  if (activeSection === 'providers') {
    return <ProvidersPanel />;
  }

  // 2. Specific standalone tab types
  if (activeTab?.type === 'flow') {
    return <FlowBuilderWorkspace />;
  }
  if (activeTab?.type === 'graph') {
    return <IntelligenceGraphWorkspace />;
  }
  if (activeTab?.type === 'project-settings') {
    return <ProjectSettingsPage projectId={activeTab.projectId} />;
  }

  // 3. Main Workspace: Unified tab bar with terminals, code editor, browser, and split view
  return <TerminalWorkspace />;
};

export default CenterArea;
