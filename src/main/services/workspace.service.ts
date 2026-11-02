import fs from 'node:fs';
import path from 'node:path';
import { dialog, BrowserWindow } from 'electron';
import type { ProjectDescriptor, FileNode } from '../../shared/types';
import { securityService } from './security.service';
import { databaseService } from '../db/database.service';

const DEFAULT_IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.turbo',
  'out',
  'coverage',
  '.ai-workspace-data'
]);

export class WorkspaceService {
  /**
   * Prompts user with native OS folder picker dialog and registers the project.
   */
  public async openDirectoryDialog(targetPath?: string): Promise<ProjectDescriptor | null> {
    let selectedPath = targetPath;

    if (!selectedPath) {
      const win = BrowserWindow.getFocusedWindow();
      const result = await dialog.showOpenDialog(win || undefined as any, {
        title: 'Select Project Directory',
        properties: ['openDirectory', 'createDirectory']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }
      selectedPath = result.filePaths[0];
    }

    if (!fs.existsSync(selectedPath)) {
      throw new Error(`Directory does not exist: ${selectedPath}`);
    }

    const canonicalPath = fs.realpathSync(selectedPath);
    const projectName = path.basename(canonicalPath);
    const isGitRepo = fs.existsSync(path.join(canonicalPath, '.git'));
    let activeBranch: string | undefined;

    if (isGitRepo) {
      try {
        const headFile = path.join(canonicalPath, '.git', 'HEAD');
        if (fs.existsSync(headFile)) {
          const headContent = fs.readFileSync(headFile, 'utf8').trim();
          if (headContent.startsWith('ref: refs/heads/')) {
            activeBranch = headContent.replace('ref: refs/heads/', '');
          }
        }
      } catch (err) {
        // Silently skip git head parse errors
      }
    }

    const descriptor: ProjectDescriptor = {
      id: `proj-${Buffer.from(canonicalPath).toString('base64url').substring(0, 16)}`,
      name: projectName,
      path: canonicalPath,
      lastOpenedAt: Date.now(),
      isGitRepo,
      activeBranch,
      permissionLevel: 'standard'
    };

    databaseService.recordProjectOpen(descriptor);
    databaseService.updateSettings({ currentProjectId: descriptor.id });

    return descriptor;
  }

  /**
   * Recursively reads directory contents up to a maximum depth, respecting exclusions.
   */
  public listFiles(projectPath: string, maxDepth = 6): FileNode[] {
    const canonicalRoot = securityService.assertWithinWorkspace(projectPath, projectPath);
    return this.readDirRecursive(canonicalRoot, canonicalRoot, 1, maxDepth);
  }

  private readDirRecursive(currentDir: string, rootDir: string, currentDepth: number, maxDepth: number): FileNode[] {
    if (currentDepth > maxDepth) return [];

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (err) {
      return [];
    }

    const nodes: FileNode[] = [];

    // Sort: directories first, then alphabetical
    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of entries) {
      if (DEFAULT_IGNORED_DIRS.has(entry.name)) {
        continue;
      }

      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(rootDir, fullPath);

      if (entry.isDirectory()) {
        const children = this.readDirRecursive(fullPath, rootDir, currentDepth + 1, maxDepth);
        nodes.push({
          id: `dir-${Buffer.from(relativePath).toString('base64url')}`,
          name: entry.name,
          path: fullPath,
          relativePath,
          isDirectory: true,
          children
        });
      } else if (entry.isFile()) {
        let size: number | undefined;
        let modifiedAt: number | undefined;
        try {
          const stat = fs.statSync(fullPath);
          size = stat.size;
          modifiedAt = stat.mtimeMs;
        } catch {
          // Skip stat error
        }

        nodes.push({
          id: `file-${Buffer.from(relativePath).toString('base64url')}`,
          name: entry.name,
          path: fullPath,
          relativePath,
          isDirectory: false,
          size,
          modifiedAt
        });
      }
    }

    return nodes;
  }

  /**
   * Reads raw file content safely within the workspace boundary.
   */
  public readFileContent(filePath: string, projectPath: string): string {
    const canonicalPath = securityService.assertWithinWorkspace(filePath, projectPath);
    securityService.assertFileOperationPermitted('read', 'standard');

    // Cap single file read at 5 MB to prevent renderer crashes
    const stat = fs.statSync(canonicalPath);
    if (stat.size > 5 * 1024 * 1024) {
      throw new Error(`File exceeds maximum preview size of 5 MB: ${filePath}`);
    }

    return fs.readFileSync(canonicalPath, 'utf8');
  }
}

export const workspaceService = new WorkspaceService();
