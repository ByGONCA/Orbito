import { describe, it, expect } from 'vitest';
import {
  ListProjectExecutionsSchema,
  GetExecutionFileChangesSchema,
  SyncManualChangesSchema,
  GetCodeReviewSchema,
  UpdateReviewDecisionSchema,
  MarkFileReviewStatusSchema,
  AddReviewCommentSchema,
  ResolveReviewCommentSchema,
  RunAICodeReviewSchema,
  GetProjectGitDetailsSchema
} from '../src/shared/ipc';
import { useWorkspaceStore } from '../src/renderer/src/stores/workspace.store';

describe('Project Explorer: Files, Changes & Review Tests', () => {
  describe('IPC Schemas Validation', () => {
    it('validates ListProjectExecutionsSchema', () => {
      expect(() => ListProjectExecutionsSchema.parse({ projectId: 'proj-123' })).not.toThrow();
      expect(() => ListProjectExecutionsSchema.parse({ projectId: '' })).toThrow();
    });

    it('validates GetExecutionFileChangesSchema', () => {
      expect(() => GetExecutionFileChangesSchema.parse({ executionId: 'exec-456' })).not.toThrow();
      expect(() => GetExecutionFileChangesSchema.parse({ executionId: '' })).toThrow();
    });

    it('validates UpdateReviewDecisionSchema and status enum', () => {
      expect(() =>
        UpdateReviewDecisionSchema.parse({
          reviewId: 'rev-1',
          status: 'approved',
          summary: 'Looks good'
        })
      ).not.toThrow();

      expect(() =>
        UpdateReviewDecisionSchema.parse({
          reviewId: 'rev-1',
          status: 'changes_requested',
          summary: 'Needs fix'
        })
      ).not.toThrow();

      expect(() =>
        UpdateReviewDecisionSchema.parse({
          reviewId: 'rev-1',
          status: 'invalid_status' as any
        })
      ).toThrow();
    });

    it('validates AddReviewCommentSchema', () => {
      expect(() =>
        AddReviewCommentSchema.parse({
          reviewId: 'rev-1',
          projectId: 'p-1',
          filePath: 'src/index.ts',
          lineNumber: 42,
          content: 'Consider refactoring this.',
          author: 'Alice'
        })
      ).not.toThrow();

      expect(() =>
        AddReviewCommentSchema.parse({
          reviewId: 'rev-1',
          projectId: 'p-1',
          filePath: 'src/index.ts',
          content: ''
        })
      ).toThrow();
    });

    it('validates ResolveReviewCommentSchema', () => {
      expect(() =>
        ResolveReviewCommentSchema.parse({
          commentId: 'c-1',
          resolved: true
        })
      ).not.toThrow();
    });

    it('validates RunAICodeReviewSchema', () => {
      expect(() =>
        RunAICodeReviewSchema.parse({
          reviewId: 'rev-1',
          projectPath: '/path/to/project',
          diff: 'diff --git a/file b/file\n+const x = 1;',
          changedFiles: ['file']
        })
      ).not.toThrow();
    });
  });

  describe('Workspace Store Explorer State & Actions', () => {
    it('defaults explorerActiveTab to files and allows tab switching', () => {
      const store = useWorkspaceStore.getState();
      expect(store.explorerActiveTab).toBe('files');

      store.setExplorerActiveTab('changes');
      expect(useWorkspaceStore.getState().explorerActiveTab).toBe('changes');
      expect(useWorkspaceStore.getState().rightPanelTab).toBe('changes');

      store.setExplorerActiveTab('review');
      expect(useWorkspaceStore.getState().explorerActiveTab).toBe('review');
      expect(useWorkspaceStore.getState().rightPanelTab).toBe('review');

      store.setExplorerActiveTab('files');
      expect(useWorkspaceStore.getState().explorerActiveTab).toBe('files');
      expect(useWorkspaceStore.getState().rightPanelTab).toBe('files');
    });

    it('manages selectedDiffFile and diffViewMode cleanly', () => {
      const store = useWorkspaceStore.getState();
      expect(store.selectedDiffFile).toBeNull();
      expect(store.diffViewMode).toBe('unified');

      store.setSelectedDiffFile('src/components/explorer/DiffViewer.tsx');
      expect(useWorkspaceStore.getState().selectedDiffFile).toBe('src/components/explorer/DiffViewer.tsx');

      store.setDiffViewMode('side-by-side');
      expect(useWorkspaceStore.getState().diffViewMode).toBe('side-by-side');

      store.setSelectedDiffFile(null);
      expect(useWorkspaceStore.getState().selectedDiffFile).toBeNull();
    });

    it('manages changesFilter state cleanly', () => {
      const store = useWorkspaceStore.getState();
      expect(store.changesFilter).toBe('all');

      store.setChangesFilter('ai');
      expect(useWorkspaceStore.getState().changesFilter).toBe('ai');

      store.setChangesFilter('manual');
      expect(useWorkspaceStore.getState().changesFilter).toBe('manual');

      store.setChangesFilter('all');
      expect(useWorkspaceStore.getState().changesFilter).toBe('all');
    });

    it('handles folder expansion, collapsing, and collapseAllDirs correctly', () => {
      const store = useWorkspaceStore.getState();
      store.collapseAllDirs();
      expect(useWorkspaceStore.getState().expandedDirs.size).toBe(0);

      store.toggleDirExpanded('src/components');
      expect(useWorkspaceStore.getState().expandedDirs.has('src/components')).toBe(true);

      store.toggleDirExpanded('src/components');
      expect(useWorkspaceStore.getState().expandedDirs.has('src/components')).toBe(false);

      store.toggleDirExpanded('src/components');
      store.toggleDirExpanded('src/utils');
      expect(useWorkspaceStore.getState().expandedDirs.size).toBeGreaterThanOrEqual(2);

      store.collapseAllDirs();
      expect(useWorkspaceStore.getState().expandedDirs.size).toBe(0);
    });
  });
});
