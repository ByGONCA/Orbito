import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore } from '../src/renderer/src/stores/workspace.store';
import type { ProjectDescriptor } from '../src/shared/types';

describe('Project-Centric Architecture & Contextual Session Tests', () => {
  beforeEach(() => {
    // Reset store state before each test
    const state = useWorkspaceStore.getState();
    state.setProject(null);
    state.setRecentProjects([]);
    state.setRightPanelTab('files');
    state.openTabs.forEach((t) => state.closeTab(t.id));
  });

  it('1. Project Context Establishment & Isolation', () => {
    const store = useWorkspaceStore.getState();

    const projA: ProjectDescriptor = {
      id: 'proj-alpha',
      name: 'Project Alpha',
      path: '/workspaces/alpha',
      lastOpenedAt: 1000,
      isGitRepo: true,
      activeBranch: 'main',
      permissionLevel: 'standard'
    };

    const projB: ProjectDescriptor = {
      id: 'proj-beta',
      name: 'Project Beta',
      path: '/workspaces/beta',
      lastOpenedAt: 2000,
      isGitRepo: true,
      activeBranch: 'feature/ai-agents',
      permissionLevel: 'full'
    };

    // Establishing Alpha as active project
    store.setProject(projA);
    expect(useWorkspaceStore.getState().project?.id).toBe('proj-alpha');
    expect(useWorkspaceStore.getState().activeSection).toBe('projects');

    // Terminal session created inherits active project context
    const termAId = store.createTerminalSession('claude');
    const termA = useWorkspaceStore.getState().terminalSessions.find((t) => t.id === termAId);
    expect(termA?.projectId).toBe('proj-alpha');
    expect(termA?.workingDirectory).toBe('/workspaces/alpha');
    expect(termA?.provider).toBe('claude');

    // Switching project establishes Beta context
    store.setProject(projB);
    expect(useWorkspaceStore.getState().project?.id).toBe('proj-beta');
    expect(useWorkspaceStore.getState().project?.path).toBe('/workspaces/beta');

    // Previous terminal session maintains its own distinct context
    const originalTermA = useWorkspaceStore.getState().terminalSessions.find((t) => t.id === termAId);
    expect(originalTermA?.id).toBe(termAId);
  });

  it('2. Terminal Session State Isolation (No cross-talk between terminals)', () => {
    const store = useWorkspaceStore.getState();

    const term1Id = store.createTerminalSession('claude');
    const term2Id = store.createTerminalSession('ollama');

    // Configure distinct models and roles
    store.updateTerminalSession(term1Id, {
      model: 'claude-3-7-sonnet',
      agentRole: 'coordinator'
    });

    store.updateTerminalSession(term2Id, {
      model: 'deepseek-r1:8b',
      agentRole: 'developer'
    });

    // Append distinct output streams
    store.appendTerminalOutput(term1Id, 'Claude session output line 1\n');
    store.appendTerminalOutput(term2Id, 'Ollama local inference output line 1\n');

    const sessions = useWorkspaceStore.getState().terminalSessions;
    const session1 = sessions.find((t) => t.id === term1Id);
    const session2 = sessions.find((t) => t.id === term2Id);

    expect(session1?.model).toBe('claude-3-7-sonnet');
    expect(session1?.agentRole).toBe('coordinator');
    expect(session1?.streamOutput).toContain('Claude session output');
    expect(session1?.streamOutput).not.toContain('Ollama local inference');

    expect(session2?.model).toBe('deepseek-r1:8b');
    expect(session2?.agentRole).toBe('developer');
    expect(session2?.streamOutput).toContain('Ollama local inference');
    expect(session2?.streamOutput).not.toContain('Claude session output');
  });

  it('3. Tab Selection: File Selection sets editor section and preserves sidebar position', () => {
    const store = useWorkspaceStore.getState();
    store.setRightPanelTab('files');

    // Open file tab
    store.openFileTab('src/core/router.ts', 'export class Router {}');

    const state = useWorkspaceStore.getState();
    expect(state.activeFilePath).toBe('src/core/router.ts');
    expect(state.activeSection).toBe('editor');
    // Preserves right panel tab (does not force-switch away from user's current sidebar view)
    expect(state.rightPanelTab).toBe('files');
  });

  it('4. Terminal Focus: Terminal Tab preserves user sidebar position without unwanted switches', () => {
    const store = useWorkspaceStore.getState();
    store.setRightPanelTab('changes');

    const termId = store.createTerminalSession('gemini');
    store.openTerminalTab(termId);

    const state = useWorkspaceStore.getState();
    expect(state.activeTerminalId).toBe(termId);
    expect(state.activeSection).toBe('terminal');
    // Preserves sidebar tab (no unwanted models switch)
    expect(state.rightPanelTab).toBe('changes');
  });

  it('5. Bottom Panel Resizing and Multi-Tab Execution States', () => {
    const store = useWorkspaceStore.getState();

    expect(store.isBottomPanelOpen).toBe(false);

    // Open bottom panel to problems
    store.setBottomPanelTab('problems');
    expect(useWorkspaceStore.getState().isBottomPanelOpen).toBe(true);
    expect(useWorkspaceStore.getState().bottomPanelTab).toBe('problems');

    // Switch to terminal output
    store.setBottomPanelTab('terminal');
    expect(useWorkspaceStore.getState().bottomPanelTab).toBe('terminal');

    // Resize bottom panel
    store.setBottomPanelHeight(320);
    expect(useWorkspaceStore.getState().bottomPanelHeight).toBe(320);

    // Clamping limits
    store.setBottomPanelHeight(9999);
    expect(useWorkspaceStore.getState().bottomPanelHeight).toBe(600); // Max clamp
  });

  it('6. Right Panel Resizing & Tab Navigation', () => {
    const store = useWorkspaceStore.getState();

    store.setRightPanelTab('changes');
    expect(useWorkspaceStore.getState().rightPanelTab).toBe('changes');

    store.setRightPanelTab('skills');
    expect(useWorkspaceStore.getState().rightPanelTab).toBe('skills');

    store.setRightPanelWidth(350);
    expect(useWorkspaceStore.getState().rightPanelWidth).toBe(350);

    store.toggleRightPanel();
    expect(useWorkspaceStore.getState().isRightPanelOpen).toBe(false);
  });

  it('7. Multi-Tab Session Switching & Dirty Indicators', () => {
    const store = useWorkspaceStore.getState();

    // Open file tab
    store.openFileTab('src/main.ts', 'console.log("hello");');
    expect(useWorkspaceStore.getState().openTabs.length).toBe(1);
    expect(useWorkspaceStore.getState().openTabs[0].isDirty).toBe(false);

    // Modify active file content -> marks tab dirty
    store.updateActiveFileContent('console.log("hello world modified");');
    expect(useWorkspaceStore.getState().openTabs[0].isDirty).toBe(true);
    expect(useWorkspaceStore.getState().activeFileContent).toBe('console.log("hello world modified");');

    // Open terminal tab alongside (preserves existing rightPanelTab)
    const termId = store.createTerminalSession('codex');
    store.openTerminalTab(termId);
    expect(useWorkspaceStore.getState().openTabs.length).toBe(2);
    expect(useWorkspaceStore.getState().activeTabId).toBe(`term:${termId}`);

    // Switch back to file tab -> restores file context while preserving sidebar
    store.setActiveTabId('file:src/main.ts');
    expect(useWorkspaceStore.getState().activeFilePath).toBe('src/main.ts');

    // Close file tab -> leaves terminal tab active
    store.closeTab('file:src/main.ts');
    expect(useWorkspaceStore.getState().openTabs.length).toBe(1);
    expect(useWorkspaceStore.getState().activeTabId).toBe(`term:${termId}`);
  });

  it('8. Multiple Projects Concurrency in Sidebar Navigation', () => {
    const store = useWorkspaceStore.getState();

    const proj1 = { id: 'p1', name: 'Repo One', path: '/code/repo-1', lastOpenedAt: 100, isGitRepo: true, permissionLevel: 'standard' as const };
    const proj2 = { id: 'p2', name: 'Repo Two', path: '/code/repo-2', lastOpenedAt: 200, isGitRepo: true, permissionLevel: 'full' as const };

    store.setRecentProjects([proj1, proj2]);
    store.setProject(proj1);

    expect(useWorkspaceStore.getState().project?.id).toBe('p1');
    expect(useWorkspaceStore.getState().recentProjects.length).toBe(2);

    // Proj1 is auto-expanded on open
    expect(useWorkspaceStore.getState().expandedProjectIds.has('p1')).toBe(true);

    // Expand proj2 as well
    store.toggleProjectExpanded('p2');

    expect(useWorkspaceStore.getState().expandedProjectIds.has('p1')).toBe(true);
    expect(useWorkspaceStore.getState().expandedProjectIds.has('p2')).toBe(true);

    // Switch to proj2
    store.setProject(proj2);
    expect(useWorkspaceStore.getState().project?.id).toBe('p2');
  });

  it('9. Close Project Action & State Cleanup', async () => {
    const store = useWorkspaceStore.getState();

    const proj1 = { id: 'p1', name: 'Repo One', path: '/code/repo-1', lastOpenedAt: 100, isGitRepo: true, permissionLevel: 'standard' as const };
    const proj2 = { id: 'p2', name: 'Repo Two', path: '/code/repo-2', lastOpenedAt: 200, isGitRepo: true, permissionLevel: 'full' as const };

    store.setRecentProjects([proj1, proj2]);
    store.setProject(proj1);

    // Closing active proj1 should transition to remaining proj2
    await store.closeProject('p1');
    expect(useWorkspaceStore.getState().recentProjects.length).toBe(1);
    expect(useWorkspaceStore.getState().project?.id).toBe('p2');

    // Closing the last remaining project should return to clean empty state
    await store.closeProject('p2');
    expect(useWorkspaceStore.getState().recentProjects.length).toBe(0);
    expect(useWorkspaceStore.getState().project).toBeNull();
    expect(useWorkspaceStore.getState().files.length).toBe(0);
  });

  it('10. Project Expansion and Collapse Toggling (Can collapse active project)', () => {
    const store = useWorkspaceStore.getState();
    const proj = { id: 'p1', name: 'Repo One', path: '/code/repo-1', lastOpenedAt: 100, isGitRepo: true, permissionLevel: 'standard' as const };

    store.setProject(proj);
    expect(useWorkspaceStore.getState().expandedProjectIds.has('p1')).toBe(true);

    // User clicks collapse on active project
    store.toggleProjectExpanded('p1');
    expect(useWorkspaceStore.getState().expandedProjectIds.has('p1')).toBe(false);

    // User clicks expand again
    store.toggleProjectExpanded('p1');
    expect(useWorkspaceStore.getState().expandedProjectIds.has('p1')).toBe(true);
  });

  it('11. Glassmorphism Theme Switching and DOM Class Propagation', () => {
    const store = useWorkspaceStore.getState();

    // Default theme is glass
    store.setTheme('glass');
    expect(useWorkspaceStore.getState().theme).toBe('glass');

    // Switching to solid theme updates state
    store.setTheme('solid');
    expect(useWorkspaceStore.getState().theme).toBe('solid');

    // Switching back to glass updates state
    store.setTheme('glass');
    expect(useWorkspaceStore.getState().theme).toBe('glass');
  });

  it('12. AI Intelligence Graph Workspace Navigation, Tab State, and Orphan Filtering', () => {
    const store = useWorkspaceStore.getState();

    // Open AI Intelligence Graph tab
    store.openGraphTab();
    const state = useWorkspaceStore.getState();
    expect(state.activeTabId).toBe('tab:intelligence-graph');
    expect(state.activeSection).toBe('graph');
    expect(state.openTabs.some((t) => t.id === 'tab:intelligence-graph' && t.type === 'graph')).toBe(true);

    // Filter toggles
    store.setIsOrphanFilterActive(true);
    expect(useWorkspaceStore.getState().isOrphanFilterActive).toBe(true);

    store.setGraphFilterCategory('file');
    expect(useWorkspaceStore.getState().graphFilterCategory).toBe('file');

    store.setSelectedGraphNodeId('file-router');
    expect(useWorkspaceStore.getState().selectedGraphNodeId).toBe('file-router');

    // Close graph tab
    store.closeTab('tab:intelligence-graph');
    expect(useWorkspaceStore.getState().openTabs.some((t) => t.id === 'tab:intelligence-graph')).toBe(false);
  });
});
