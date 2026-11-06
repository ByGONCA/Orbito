import { describe, it, expect, beforeEach } from 'vitest';
import { CreateProjectSchema, ToggleProjectFavoriteSchema, UpdateProjectSchema } from '../src/shared/ipc';
import { useWorkspaceStore } from '../src/renderer/src/stores/workspace.store';
import type { ProjectDescriptor, ProjectSettings } from '../src/shared/types';

describe('AI Workspace — Phase 2: Project Management & Project-Aware Workspace Tests', () => {
  beforeEach(() => {
    const store = useWorkspaceStore.getState();
    store.setProject(null);
    store.setRecentProjects([]);
    useWorkspaceStore.setState({ terminalSessions: [], activeTerminalId: null });
  });

  describe('1. Project Creation Schema & Scaffolding Validation', () => {
    it('validates correct project creation options', () => {
      const valid = CreateProjectSchema.parse({
        name: 'my-microservice',
        parentDirectory: 'C:\\Projects',
        template: 'node',
        initGit: true
      });
      expect(valid.name).toBe('my-microservice');
      expect(valid.template).toBe('node');
      expect(valid.initGit).toBe(true);
    });

    it('rejects empty project names', () => {
      expect(() => {
        CreateProjectSchema.parse({
          name: '',
          parentDirectory: 'C:\\Projects',
          template: 'react',
          initGit: false
        });
      }).toThrow();
    });

    it('rejects invalid project templates', () => {
      expect(() => {
        CreateProjectSchema.parse({
          name: 'invalid-tmpl',
          parentDirectory: 'C:\\Projects',
          template: 'ruby_on_rails' as any,
          initGit: true
        });
      }).toThrow();
    });

    it('supports all 4 official scaffolding templates: empty, node, react, python', () => {
      const templates = ['empty', 'node', 'react', 'python'] as const;
      for (const t of templates) {
        const parsed = CreateProjectSchema.parse({
          name: `project-${t}`,
          parentDirectory: '/root/projects',
          template: t,
          initGit: true
        });
        expect(parsed.template).toBe(t);
      }
    });
  });

  describe('2. Project Navigation, Switching & Favorites', () => {
    it('manages favorite projects and preserves recent project ordering', () => {
      const store = useWorkspaceStore.getState();

      const proj1: ProjectDescriptor = {
        id: 'proj-1',
        name: 'Web App',
        path: '/apps/web',
        lastOpenedAt: 1000,
        isGitRepo: true,
        permissionLevel: 'standard',
        isFavorite: false
      };

      const proj2: ProjectDescriptor = {
        id: 'proj-2',
        name: 'Core API',
        path: '/apps/api',
        lastOpenedAt: 2000,
        isGitRepo: true,
        permissionLevel: 'standard',
        isFavorite: true
      };

      store.setRecentProjects([proj2, proj1]);
      expect(useWorkspaceStore.getState().recentProjects.length).toBe(2);

      const favs = useWorkspaceStore.getState().recentProjects.filter((p) => p.isFavorite);
      expect(favs.length).toBe(1);
      expect(favs[0].id).toBe('proj-2');
    });

    it('validates toggle project favorite schema', () => {
      const valid = ToggleProjectFavoriteSchema.parse({
        projectId: 'proj-123',
        isFavorite: true
      });
      expect(valid.projectId).toBe('proj-123');
      expect(valid.isFavorite).toBe(true);
    });
  });

  describe('3. Project Settings & Precedence Hierarchy', () => {
    it('persists project settings and validates update schema', () => {
      const settings: ProjectSettings = {
        defaultProvider: 'claude',
        defaultModel: 'claude-3-7-sonnet',
        instructions: 'Use strict TypeScript and Tailwind',
        gitAutoFetch: true,
        envVars: {
          API_URL: 'https://api.example.com',
          NODE_ENV: 'development'
        }
      };

      const validated = UpdateProjectSchema.parse({
        projectId: 'proj-1',
        updates: {
          customName: 'Custom Web Suite',
          tag: 'FRONTEND',
          settings
        }
      });

      expect(validated.updates.customName).toBe('Custom Web Suite');
      expect(validated.updates.tag).toBe('FRONTEND');
      expect(validated.updates.settings?.defaultProvider).toBe('claude');
      expect(validated.updates.settings?.envVars?.API_URL).toBe('https://api.example.com');
    });

    it('applies project-specific default provider/model to active terminal when project switches', () => {
      const store = useWorkspaceStore.getState();

      const termId = store.createTerminalSession('powershell');
      store.setActiveTerminalId(termId);

      const projectWithConfig: ProjectDescriptor = {
        id: 'proj-ai-hub',
        name: 'AI Hub',
        path: '/repos/ai-hub',
        lastOpenedAt: Date.now(),
        isGitRepo: true,
        permissionLevel: 'standard',
        settings: {
          defaultProvider: 'gemini',
          defaultModel: 'gemini-2.5-pro'
        }
      };

      store.setProject(projectWithConfig);

      const activeTerm = useWorkspaceStore.getState().terminalSessions.find((t) => t.id === termId);
      expect(activeTerm?.provider).toBe('gemini');
      expect(activeTerm?.model).toBe('gemini-2.5-pro');
      expect(activeTerm?.workingDirectory).toBe('/repos/ai-hub');
    });
  });

  describe('4. Project Isolation & Workspace Continuity', () => {
    it('does not destroy other terminal sessions when switching projects', () => {
      const store = useWorkspaceStore.getState();

      const term1Id = store.createTerminalSession('powershell');
      const term2Id = store.createTerminalSession('claude');

      const projA: ProjectDescriptor = {
        id: 'proj-a',
        name: 'Project A',
        path: '/a',
        lastOpenedAt: 1,
        isGitRepo: true,
        permissionLevel: 'standard'
      };

      const projB: ProjectDescriptor = {
        id: 'proj-b',
        name: 'Project B',
        path: '/b',
        lastOpenedAt: 2,
        isGitRepo: true,
        permissionLevel: 'standard'
      };

      store.setProject(projA);
      store.setProject(projB);

      // Both terminal sessions are preserved intact
      expect(useWorkspaceStore.getState().terminalSessions.length).toBe(2);
      expect(useWorkspaceStore.getState().terminalSessions.some((t) => t.id === term1Id)).toBe(true);
      expect(useWorkspaceStore.getState().terminalSessions.some((t) => t.id === term2Id)).toBe(true);
    });
  });
});
