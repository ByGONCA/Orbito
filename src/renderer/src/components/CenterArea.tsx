import React from 'react';
import { useWorkspaceStore } from '../stores/workspace.store';
import { ProjectsWorkspace } from './ProjectsWorkspace';
import { AgentsWorkspace } from './AgentsWorkspace';
import { TasksWorkspace } from './TasksWorkspace';
import { FlowBuilderWorkspace } from './FlowBuilder/FlowBuilderWorkspace';
import { ContextInspector } from './ContextInspector';
import { SkillsManager } from './SkillsManager';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { ExtensionsManager } from './ExtensionsManager';
import { ProvidersPanel } from './ProvidersPanel';
import { CodeEditor } from './CodeEditor';
import { TerminalWorkspace } from './TerminalWorkspace';
import { IntelligenceGraphWorkspace } from './IntelligenceGraph/IntelligenceGraphWorkspace';
import { EmbeddedBrowser } from './EmbeddedBrowser';

export const CenterArea: React.FC = () => {
  const { activeTabId, openTabs, activeSection } = useWorkspaceStore();
  const activeTab = openTabs.find((t) => t.id === activeTabId);

  // 1. If an open workspace tab is active, render the corresponding content
  if (activeTab) {
    switch (activeTab.type) {
      case 'file':
        return <CodeEditor />;
      case 'terminal':
      case 'project':
        return <TerminalWorkspace />;
      case 'browser':
        return <EmbeddedBrowser url={activeTab.url} tabId={activeTab.id} />;
      case 'flow':
        return <FlowBuilderWorkspace />;
      case 'graph':
        return <IntelligenceGraphWorkspace />;
    }
  }

  // 2. Otherwise render the active section selected from navigation
  switch (activeSection) {
    case 'graph':
      return <IntelligenceGraphWorkspace />;
    case 'tasks':
      return <TasksWorkspace />;
    case 'flows':
      return <FlowBuilderWorkspace />;
    case 'terminal':
    case 'projects':
      return <TerminalWorkspace />;
    case 'editor':
      return <CodeEditor />;
    case 'agents':
      return <AgentsWorkspace />;
    case 'context':
      return <ContextInspector />;
    case 'skills':
      return <SkillsManager />;
    case 'analytics':
      return <AnalyticsDashboard />;
    case 'extensions':
      return <ExtensionsManager />;
    case 'providers':
      return <ProvidersPanel />;
    default:
      return <TerminalWorkspace />;
  }
};

export default CenterArea;
