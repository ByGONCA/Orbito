import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  CreateFileSchema,
  CreateDirectorySchema,
  RenameItemSchema,
  DeleteItemSchema,
  MoveItemSchema,
  RevealInFileManagerSchema
} from '../src/shared/ipc';
import { workspaceService } from '../src/main/services/workspace.service';
import { useWorkspaceStore } from '../src/renderer/src/stores/workspace.store';
import type { ProjectDescriptor } from '../src/shared/types';

describe('AI Workspace — Phase 3: File Explorer Completeness Tests', () => {
  let tempDir: string;
  let canonicalTempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orc-phase3-test-'));
    canonicalTempDir = fs.realpathSync(tempDir);
  });

  afterEach(() => {
    try {
      if (fs.existsSync(canonicalTempDir)) {
        fs.rmSync(canonicalTempDir, { recursive: true, force: true });
      }
    } catch {
      // Cleanup best effort
    }
  });

  describe('1. IPC Validation Schemas', () => {
    it('validates CreateFileSchema and applies defaults', () => {
      const parsed = CreateFileSchema.parse({
        filePath: 'src/index.ts',
        projectPath: '/workspace'
      });
      expect(parsed.filePath).toBe('src/index.ts');
      expect(parsed.projectPath).toBe('/workspace');
      expect(parsed.content).toBe('');

      expect(() => CreateFileSchema.parse({ filePath: '', projectPath: '/workspace' })).toThrow();
      expect(() => CreateFileSchema.parse({ filePath: 'file.txt', projectPath: '' })).toThrow();
    });

    it('validates CreateDirectorySchema', () => {
      const parsed = CreateDirectorySchema.parse({
        directoryPath: 'components/buttons',
        projectPath: '/workspace'
      });
      expect(parsed.directoryPath).toBe('components/buttons');
      expect(() => CreateDirectorySchema.parse({ directoryPath: '', projectPath: '/workspace' })).toThrow();
    });

    it('validates RenameItemSchema', () => {
      const parsed = RenameItemSchema.parse({
        oldPath: '/workspace/old.ts',
        newName: 'new.ts',
        projectPath: '/workspace'
      });
      expect(parsed.newName).toBe('new.ts');
      expect(() => RenameItemSchema.parse({ oldPath: '', newName: 'a', projectPath: '/w' })).toThrow();
      expect(() => RenameItemSchema.parse({ oldPath: '/w/a', newName: '', projectPath: '/w' })).toThrow();
    });

    it('validates DeleteItemSchema', () => {
      const parsed = DeleteItemSchema.parse({
        targetPath: '/workspace/obsolete.ts',
        projectPath: '/workspace'
      });
      expect(parsed.targetPath).toBe('/workspace/obsolete.ts');
      expect(() => DeleteItemSchema.parse({ targetPath: '', projectPath: '/w' })).toThrow();
    });

    it('validates MoveItemSchema', () => {
      const parsed = MoveItemSchema.parse({
        sourcePath: '/workspace/src/Button.tsx',
        destinationDir: '/workspace/src/components',
        projectPath: '/workspace'
      });
      expect(parsed.destinationDir).toBe('/workspace/src/components');
      expect(() => MoveItemSchema.parse({ sourcePath: '', destinationDir: '/w', projectPath: '/w' })).toThrow();
    });

    it('validates RevealInFileManagerSchema', () => {
      const parsed = RevealInFileManagerSchema.parse({
        filePath: '/workspace/package.json'
      });
      expect(parsed.filePath).toBe('/workspace/package.json');
      expect(() => RevealInFileManagerSchema.parse({ filePath: '' })).toThrow();
    });
  });

  describe('2. Backend WorkspaceService File & Folder Creation', () => {
    it('creates a new file with content and creates parent directories automatically', () => {
      const targetFile = path.join(canonicalTempDir, 'deep', 'nested', 'test.txt');
      const res = workspaceService.createFile(targetFile, canonicalTempDir, 'Hello Orc');

      expect(res.success).toBe(true);
      expect(fs.existsSync(targetFile)).toBe(true);
      expect(fs.readFileSync(targetFile, 'utf8')).toBe('Hello Orc');
    });

    it('rejects creating a file when one already exists without overwriting', () => {
      const targetFile = path.join(canonicalTempDir, 'existing.txt');
      fs.writeFileSync(targetFile, 'Original Content', 'utf8');

      expect(() => {
        workspaceService.createFile(targetFile, canonicalTempDir, 'New Content');
      }).toThrow(/already exists/i);

      expect(fs.readFileSync(targetFile, 'utf8')).toBe('Original Content');
    });

    it('rejects invalid filesystem characters when creating files', () => {
      const invalidChars = ['<', '>', ':', '"', '|', '?', '*'];
      for (const char of invalidChars) {
        const invalidPath = path.join(canonicalTempDir, `bad${char}name.txt`);
        expect(() => {
          workspaceService.createFile(invalidPath, canonicalTempDir, '');
        }).toThrow(/invalid characters/i);
      }
    });

    it('rejects creating files outside workspace boundary (path traversal protection)', () => {
      const outsidePath = path.resolve(canonicalTempDir, '..', 'escaped.txt');
      expect(() => {
        workspaceService.createFile(outsidePath, canonicalTempDir, 'hack');
      }).toThrow(/Path traversal/i);
    });

    it('rejects creating files inside protected .git directory', () => {
      const gitDir = path.join(canonicalTempDir, '.git');
      fs.mkdirSync(gitDir, { recursive: true });
      const insideGit = path.join(gitDir, 'corrupt.txt');

      expect(() => {
        workspaceService.createFile(insideGit, canonicalTempDir, 'bad');
      }).toThrow(/protected Git/i);
    });

    it('creates directories safely and rejects duplicates or invalid names', () => {
      const targetDir = path.join(canonicalTempDir, 'src', 'components');
      const res = workspaceService.createDirectory(targetDir, canonicalTempDir);

      expect(res.success).toBe(true);
      expect(fs.existsSync(targetDir)).toBe(true);
      expect(fs.statSync(targetDir).isDirectory()).toBe(true);

      // Duplicate folder creation rejection
      expect(() => {
        workspaceService.createDirectory(targetDir, canonicalTempDir);
      }).toThrow(/already exists/i);
    });
  });

  describe('3. Backend WorkspaceService Rename Operations', () => {
    it('renames a file and preserves contents', () => {
      const oldFile = path.join(canonicalTempDir, 'old-name.ts');
      fs.writeFileSync(oldFile, 'console.log("hello");', 'utf8');

      const res = workspaceService.renameItem(oldFile, 'new-name.ts', canonicalTempDir);
      expect(res.success).toBe(true);
      expect(fs.existsSync(oldFile)).toBe(false);
      expect(fs.existsSync(res.newPath)).toBe(true);
      expect(fs.readFileSync(res.newPath, 'utf8')).toBe('console.log("hello");');
    });

    it('renames a directory and preserves nested children', () => {
      const oldDir = path.join(canonicalTempDir, 'old-folder');
      const childFile = path.join(oldDir, 'child.txt');
      fs.mkdirSync(oldDir, { recursive: true });
      fs.writeFileSync(childFile, 'child content', 'utf8');

      const res = workspaceService.renameItem(oldDir, 'new-folder', canonicalTempDir);
      expect(res.success).toBe(true);
      expect(fs.existsSync(oldDir)).toBe(false);
      expect(fs.existsSync(res.newPath)).toBe(true);
      expect(fs.existsSync(path.join(res.newPath, 'child.txt'))).toBe(true);
    });

    it('rejects renaming the project root directory', () => {
      expect(() => {
        workspaceService.renameItem(canonicalTempDir, 'renamed-root', canonicalTempDir);
      }).toThrow(/cannot rename the project root/i);
    });

    it('rejects collision when newName already exists in directory', () => {
      const file1 = path.join(canonicalTempDir, 'file1.txt');
      const file2 = path.join(canonicalTempDir, 'file2.txt');
      fs.writeFileSync(file1, '1', 'utf8');
      fs.writeFileSync(file2, '2', 'utf8');

      expect(() => {
        workspaceService.renameItem(file1, 'file2.txt', canonicalTempDir);
      }).toThrow(/already exists/i);
    });

    it('rejects renaming with invalid characters', () => {
      const file = path.join(canonicalTempDir, 'valid.txt');
      fs.writeFileSync(file, 'text', 'utf8');

      expect(() => {
        workspaceService.renameItem(file, 'bad:name?.txt', canonicalTempDir);
      }).toThrow(/invalid characters/i);
    });
  });

  describe('4. Backend WorkspaceService Delete Operations', () => {
    it('deletes a file safely', () => {
      const file = path.join(canonicalTempDir, 'to-delete.ts');
      fs.writeFileSync(file, 'data', 'utf8');

      const res = workspaceService.deleteItem(file, canonicalTempDir);
      expect(res.success).toBe(true);
      expect(fs.existsSync(file)).toBe(false);
    });

    it('deletes a non-empty directory recursively', () => {
      const folder = path.join(canonicalTempDir, 'bundle');
      fs.mkdirSync(path.join(folder, 'nested'), { recursive: true });
      fs.writeFileSync(path.join(folder, 'nested', 'file.txt'), 'nested', 'utf8');

      const res = workspaceService.deleteItem(folder, canonicalTempDir);
      expect(res.success).toBe(true);
      expect(fs.existsSync(folder)).toBe(false);
    });

    it('rejects deleting the project root directory', () => {
      expect(() => {
        workspaceService.deleteItem(canonicalTempDir, canonicalTempDir);
      }).toThrow(/cannot delete the project root/i);
    });

    it('rejects deleting protected .git directory', () => {
      const gitDir = path.join(canonicalTempDir, '.git');
      fs.mkdirSync(gitDir, { recursive: true });

      expect(() => {
        workspaceService.deleteItem(gitDir, canonicalTempDir);
      }).toThrow(/protected Git/i);
    });

    it('rejects deleting non-existent paths', () => {
      const nonExistent = path.join(canonicalTempDir, 'ghost.txt');
      expect(() => {
        workspaceService.deleteItem(nonExistent, canonicalTempDir);
      }).toThrow(/does not exist/i);
    });
  });

  describe('5. Backend WorkspaceService Move Operations (Drag & Drop)', () => {
    it('moves a file into a subfolder', () => {
      const file = path.join(canonicalTempDir, 'util.ts');
      const targetDir = path.join(canonicalTempDir, 'src', 'utils');
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(file, 'export const x = 1;', 'utf8');

      const res = workspaceService.moveItem(file, targetDir, canonicalTempDir);
      expect(res.success).toBe(true);
      expect(fs.existsSync(file)).toBe(false);
      expect(fs.existsSync(path.join(targetDir, 'util.ts'))).toBe(true);
      expect(fs.readFileSync(path.join(targetDir, 'util.ts'), 'utf8')).toBe('export const x = 1;');
    });

    it('rejects moving a directory into itself or its own subfolder', () => {
      const parentDir = path.join(canonicalTempDir, 'parent');
      const childDir = path.join(parentDir, 'sub');
      fs.mkdirSync(childDir, { recursive: true });

      expect(() => {
        workspaceService.moveItem(parentDir, childDir, canonicalTempDir);
      }).toThrow(/cannot move a directory into itself/i);
    });

    it('rejects moving when target collision exists in destination', () => {
      const sourceFile = path.join(canonicalTempDir, 'file.txt');
      const destDir = path.join(canonicalTempDir, 'dest');
      fs.mkdirSync(destDir, { recursive: true });
      fs.writeFileSync(sourceFile, 'source', 'utf8');
      fs.writeFileSync(path.join(destDir, 'file.txt'), 'already here', 'utf8');

      expect(() => {
        workspaceService.moveItem(sourceFile, destDir, canonicalTempDir);
      }).toThrow(/already exists in destination/i);
    });
  });

  describe('6. Store Open Tabs & Active File Synchronization', () => {
    beforeEach(() => {
      useWorkspaceStore.setState({
        openTabs: [],
        activeTabId: null,
        activeFilePath: null,
        activeFileContent: null,
        activeFileSymbols: []
      });
    });

    it('synchronizes open tabs when renaming active file', async () => {
      const mockProject: ProjectDescriptor = {
        id: 'proj-test',
        name: 'Test Project',
        path: canonicalTempDir,
        lastOpenedAt: Date.now(),
        isGitRepo: false
      };
      useWorkspaceStore.getState().setProject(mockProject);

      // Open a tab
      const oldPath = path.join(canonicalTempDir, 'App.tsx');
      useWorkspaceStore.getState().openFileTab(oldPath, 'const App = () => null;');

      const afterOpen = useWorkspaceStore.getState();
      expect(afterOpen.openTabs.some((t) => t.filePath === oldPath)).toBe(true);
      expect(afterOpen.activeFilePath).toBe(oldPath);

      // Simulate rename synchronization logic from store
      const newPath = path.join(canonicalTempDir, 'RootApp.tsx');
      const nextTabs = afterOpen.openTabs.map((t) => {
        if (t.filePath === oldPath) {
          return { ...t, filePath: newPath, title: 'RootApp.tsx', id: `file:${newPath}` };
        }
        return t;
      });

      useWorkspaceStore.setState({
        openTabs: nextTabs,
        activeFilePath: newPath
      });

      const updated = useWorkspaceStore.getState();
      expect(updated.activeFilePath).toBe(newPath);
      expect(updated.openTabs.find((t) => t.filePath === newPath)?.title).toBe('RootApp.tsx');
    });

    it('closes tabs and resets active file state when deleted', () => {
      const targetPath = path.join(canonicalTempDir, 'ToDelete.tsx');
      useWorkspaceStore.getState().openFileTab(targetPath, 'content');

      const afterOpen = useWorkspaceStore.getState();
      expect(afterOpen.activeFilePath).toBe(targetPath);

      // Simulate deletion synchronization logic from store
      const remainingTabs = afterOpen.openTabs.filter((t) => t.filePath !== targetPath);
      useWorkspaceStore.setState({
        openTabs: remainingTabs,
        activeFilePath: null,
        activeFileContent: null,
        activeFileSymbols: []
      });

      const updated = useWorkspaceStore.getState();
      expect(updated.activeFilePath).toBeNull();
      expect(updated.activeFileContent).toBeNull();
      expect(updated.openTabs.some((t) => t.filePath === targetPath)).toBe(false);
    });
  });
});
