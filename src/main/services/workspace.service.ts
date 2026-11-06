import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dialog, BrowserWindow } from 'electron';
import type {
  ProjectDescriptor,
  FileNode,
  ProjectGraphData,
  ProjectGraphNode,
  ProjectGraphEdge,
  CreateProjectOptions,
  AppLayoutConfig,
  ProjectWorkspaceState,
  PersistedWorkspaceTab,
  PersistedTerminalSession
} from '../../shared/types';
import { securityService } from './security.service';
import { databaseService } from '../db/database.service';
import { astParserService } from '../context/parser/ast-parser.service';
import { WorktreeManager } from '../agents/worktree-manager';
import { skillRegistry } from '../skills/skill-registry';

const execFileAsync = promisify(execFile);

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
   * Prompts user with native folder picker to select a directory path without opening it as project.
   */
  public async selectDirectoryDialog(title = 'Select Destination Folder'): Promise<string | null> {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win || (undefined as any), {
      title,
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  }

  /**
   * Checks whether a project path exists on the local filesystem.
   */
  public verifyProjectPath(projectPath: string): boolean {
    try {
      return fs.existsSync(projectPath);
    } catch {
      return false;
    }
  }

  /**
   * Creates and initializes a new project with scaffolding templates and optional Git repository.
   */
  public async createProject(options: CreateProjectOptions): Promise<ProjectDescriptor> {
    const trimmedName = options.name?.trim();
    if (!trimmedName) {
      throw new Error('Project name cannot be empty.');
    }

    // Windows & POSIX safe filename check
    if (/[<>:"/\\|?*]/.test(trimmedName)) {
      throw new Error('Project name contains invalid characters (<>:"/\\|?*).');
    }

    if (!options.parentDirectory || !fs.existsSync(options.parentDirectory)) {
      throw new Error(`Destination directory does not exist: ${options.parentDirectory}`);
    }

    const targetPath = path.join(options.parentDirectory, trimmedName);

    if (fs.existsSync(targetPath)) {
      const contents = fs.readdirSync(targetPath);
      if (contents.length > 0) {
        throw new Error(`Directory "${trimmedName}" already exists in the selected destination and is not empty.`);
      }
    } else {
      fs.mkdirSync(targetPath, { recursive: true });
    }

    // Scaffolding based on selected template
    const slug = trimmedName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');

    switch (options.template) {
      case 'node': {
        const pkgJson = {
          name: slug,
          version: '1.0.0',
          description: `${trimmedName} created with AI Workspace`,
          main: 'src/index.js',
          type: 'module',
          scripts: {
            start: 'node src/index.js',
            test: 'node --test'
          }
        };
        fs.writeFileSync(path.join(targetPath, 'package.json'), JSON.stringify(pkgJson, null, 2), 'utf8');
        fs.mkdirSync(path.join(targetPath, 'src'), { recursive: true });
        fs.writeFileSync(
          path.join(targetPath, 'src', 'index.js'),
          `// ${trimmedName} — Entry Point\nconsole.log('Hello from ${trimmedName}!');\n`,
          'utf8'
        );
        fs.writeFileSync(
          path.join(targetPath, '.gitignore'),
          `node_modules/\n.env\n.DS_Store\nThumbs.db\n`,
          'utf8'
        );
        fs.writeFileSync(
          path.join(targetPath, 'README.md'),
          `# ${trimmedName}\n\nNode.js application created with AI Workspace.\n\n## Getting Started\n\`\`\`bash\nnpm start\n\`\`\`\n`,
          'utf8'
        );
        break;
      }

      case 'react': {
        const pkgJson = {
          name: slug,
          private: true,
          version: '0.1.0',
          type: 'module',
          scripts: {
            dev: 'vite',
            build: 'tsc && vite build',
            preview: 'vite preview'
          },
          dependencies: {
            react: '^18.3.1',
            'react-dom': '^18.3.1',
            'lucide-react': '^0.344.0'
          },
          devDependencies: {
            '@types/react': '^18.3.3',
            '@types/react-dom': '^18.3.0',
            '@vitejs/plugin-react': '^4.3.1',
            typescript: '^5.5.3',
            vite: '^5.4.1'
          }
        };
        fs.writeFileSync(path.join(targetPath, 'package.json'), JSON.stringify(pkgJson, null, 2), 'utf8');

        const viteConfig = `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()]\n});\n`;
        fs.writeFileSync(path.join(targetPath, 'vite.config.ts'), viteConfig, 'utf8');

        const indexHtml = `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${trimmedName}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n`;
        fs.writeFileSync(path.join(targetPath, 'index.html'), indexHtml, 'utf8');

        fs.mkdirSync(path.join(targetPath, 'src'), { recursive: true });

        const mainTsx = `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n`;
        fs.writeFileSync(path.join(targetPath, 'src', 'main.tsx'), mainTsx, 'utf8');

        const appTsx = `import React from 'react';\n\nexport default function App() {\n  return (\n    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '3rem', textAlign: 'center' }}>\n      <h1>Welcome to ${trimmedName}</h1>\n      <p>Scaffolded with React, Vite & TypeScript in AI Workspace.</p>\n    </div>\n  );\n}\n`;
        fs.writeFileSync(path.join(targetPath, 'src', 'App.tsx'), appTsx, 'utf8');

        const tsconfig = {
          compilerOptions: {
            target: 'ES2020',
            useDefineForClassFields: true,
            lib: ['ES2020', 'DOM', 'DOM.Iterable'],
            module: 'ESNext',
            skipLibCheck: true,
            moduleResolution: 'bundler',
            allowImportingTsExtensions: true,
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: 'react-jsx',
            strict: true
          },
          include: ['src']
        };
        fs.writeFileSync(path.join(targetPath, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2), 'utf8');
        fs.writeFileSync(
          path.join(targetPath, '.gitignore'),
          `node_modules/\ndist/\n.env\n.DS_Store\n`,
          'utf8'
        );
        fs.writeFileSync(
          path.join(targetPath, 'README.md'),
          `# ${trimmedName}\n\nReact + Vite + TypeScript application created with AI Workspace.\n\n## Getting Started\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`,
          'utf8'
        );
        break;
      }

      case 'python': {
        const mainPy = `def main():\n    print("Hello from ${trimmedName}!")\n\nif __name__ == "__main__":\n    main()\n`;
        fs.writeFileSync(path.join(targetPath, 'main.py'), mainPy, 'utf8');
        fs.writeFileSync(
          path.join(targetPath, 'requirements.txt'),
          `# Dependencies for ${trimmedName}\n`,
          'utf8'
        );
        fs.writeFileSync(
          path.join(targetPath, '.gitignore'),
          `__pycache__/\n*.pyc\nvenv/\n.env\n.DS_Store\n`,
          'utf8'
        );
        fs.writeFileSync(
          path.join(targetPath, 'README.md'),
          `# ${trimmedName}\n\nPython project created with AI Workspace.\n\n## Getting Started\n\`\`\`bash\npython main.py\n\`\`\`\n`,
          'utf8'
        );
        break;
      }

      case 'empty':
      default: {
        fs.writeFileSync(
          path.join(targetPath, '.gitignore'),
          `node_modules/\n.env\n.DS_Store\nThumbs.db\n`,
          'utf8'
        );
        fs.writeFileSync(
          path.join(targetPath, 'README.md'),
          `# ${trimmedName}\n\nProject created with AI Workspace.\n`,
          'utf8'
        );
        break;
      }
    }

    // Git initialization
    let isGitRepo = false;
    if (options.initGit) {
      try {
        await execFileAsync('git', ['init'], { cwd: targetPath });
        isGitRepo = true;
      } catch (gitErr) {
        console.warn(`[WorkspaceService] Git init warning for ${targetPath}:`, gitErr);
      }
    }

    const canonicalPath = fs.realpathSync(targetPath);
    const descriptor: ProjectDescriptor = {
      id: `proj-${Buffer.from(canonicalPath).toString('base64url').substring(0, 16)}`,
      name: trimmedName,
      path: canonicalPath,
      lastOpenedAt: Date.now(),
      isGitRepo,
      activeBranch: isGitRepo ? 'main' : undefined,
      permissionLevel: 'standard',
      customIcon:
        options.template === 'react'
          ? 'react'
          : options.template === 'python'
          ? 'python'
          : options.template === 'node'
          ? 'code'
          : 'folder-git',
      tag: options.template !== 'empty' ? options.template.toUpperCase() : undefined
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

  /**
   * Safely writes modified file content within the workspace boundary using an atomic temp-file-and-rename pattern.
   */
  public saveFileContent(filePath: string, projectPath: string, content: string): boolean {
    const canonicalPath = securityService.assertWithinWorkspace(filePath, projectPath);
    securityService.assertFileOperationPermitted('write', 'standard');

    const parentDir = path.dirname(canonicalPath);
    const tempFile = path.join(parentDir, `.tmp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);

    try {
      // Write to sibling temporary file
      fs.writeFileSync(tempFile, content, { encoding: 'utf8', flag: 'wx' });
      securityService.assertWithinWorkspace(tempFile, projectPath);

      // Atomic rename
      fs.renameSync(tempFile, canonicalPath);

      // Re-verify canonical destination path remains within workspace
      const finalCanonical = fs.realpathSync(canonicalPath);
      securityService.assertWithinWorkspace(finalCanonical, projectPath);
      return true;
    } catch (err) {
      if (fs.existsSync(tempFile)) {
        try {
          fs.unlinkSync(tempFile);
        } catch {}
      }
      throw err;
    }
  }

  /**
   * Creates a new file safely within the workspace boundary without overwriting existing files.
   * Employs exclusive flag ('wx') to prevent TOCTOU race conditions.
   */
  public createFile(filePath: string, projectPath: string, content = ''): { success: boolean; path: string } {
    const baseName = path.basename(filePath).trim();
    if (!baseName) {
      throw new Error('Filename cannot be empty.');
    }
    if (/[<>:"/\\|?*]/.test(baseName)) {
      throw new Error('Filename contains invalid characters (<>:"/\\|?*).');
    }

    const canonicalPath = securityService.assertWithinWorkspace(filePath, projectPath);
    securityService.assertFileOperationPermitted('write', 'standard');

    const canonicalRoot = fs.realpathSync(projectPath);
    const relToRoot = path.relative(canonicalRoot, canonicalPath).replace(/\\/g, '/');
    if (relToRoot.startsWith('.git/') || relToRoot === '.git') {
      throw new Error('Cannot create files inside the protected Git repository directory.');
    }

    const parentDir = path.dirname(canonicalPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Atomic exclusive creation ('wx') prevents TOCTOU overwrites
    try {
      fs.writeFileSync(canonicalPath, content || '', { encoding: 'utf8', flag: 'wx' });
    } catch (err: any) {
      if (err.code === 'EEXIST') {
        throw new Error(`A file or directory already exists at: ${baseName}`);
      }
      throw err;
    }

    // Re-verify canonical target remains strictly inside authorized boundary
    const finalCanonical = fs.realpathSync(canonicalPath);
    securityService.assertWithinWorkspace(finalCanonical, projectPath);

    return { success: true, path: finalCanonical };
  }

  /**
   * Creates a new directory safely within the workspace boundary.
   */
  public createDirectory(directoryPath: string, projectPath: string): { success: boolean; path: string } {
    const baseName = path.basename(directoryPath).trim();
    if (!baseName) {
      throw new Error('Folder name cannot be empty.');
    }
    if (/[<>:"/\\|?*]/.test(baseName)) {
      throw new Error('Folder name contains invalid characters (<>:"/\\|?*).');
    }

    const canonicalPath = securityService.assertWithinWorkspace(directoryPath, projectPath);
    securityService.assertFileOperationPermitted('write', 'standard');

    const canonicalRoot = fs.realpathSync(projectPath);
    const relToRoot = path.relative(canonicalRoot, canonicalPath).replace(/\\/g, '/');
    if (relToRoot.startsWith('.git/') || relToRoot === '.git') {
      throw new Error('Cannot create directories inside the protected Git repository directory.');
    }

    if (fs.existsSync(canonicalPath)) {
      throw new Error(`A folder or file already exists at: ${baseName}`);
    }

    fs.mkdirSync(canonicalPath, { recursive: true });
    const finalCanonical = fs.realpathSync(canonicalPath);
    securityService.assertWithinWorkspace(finalCanonical, projectPath);

    return { success: true, path: finalCanonical };
  }

  /**
   * Safely renames an existing file or directory within its current parent directory.
   */
  public renameItem(oldPath: string, newName: string, projectPath: string): { success: boolean; oldPath: string; newPath: string } {
    const trimmedNewName = newName.trim();
    if (!trimmedNewName) {
      throw new Error('New name cannot be empty.');
    }
    if (/[<>:"/\\|?*]/.test(trimmedNewName)) {
      throw new Error('New name contains invalid characters (<>:"/\\|?*).');
    }

    const canonicalOld = securityService.assertWithinWorkspace(oldPath, projectPath);
    securityService.assertFileOperationPermitted('write', 'standard');

    const canonicalRoot = fs.realpathSync(projectPath);
    if (canonicalOld.toLowerCase() === canonicalRoot.toLowerCase()) {
      throw new Error('Cannot rename the project root directory.');
    }

    const relToRoot = path.relative(canonicalRoot, canonicalOld).replace(/\\/g, '/');
    if (relToRoot === '.git' || relToRoot.startsWith('.git/')) {
      throw new Error('Cannot rename protected Git repository items.');
    }

    if (!fs.existsSync(canonicalOld)) {
      throw new Error('Target item does not exist on disk.');
    }

    const parentDir = path.dirname(canonicalOld);
    const targetPath = path.join(parentDir, trimmedNewName);
    const canonicalNew = securityService.assertWithinWorkspace(targetPath, projectPath);

    if (fs.existsSync(canonicalNew) && canonicalOld.toLowerCase() !== canonicalNew.toLowerCase()) {
      throw new Error(`An item named "${trimmedNewName}" already exists in this folder.`);
    }

    fs.renameSync(canonicalOld, canonicalNew);
    const finalCanonical = fs.realpathSync(canonicalNew);
    securityService.assertWithinWorkspace(finalCanonical, projectPath);

    return { success: true, oldPath: canonicalOld, newPath: finalCanonical };
  }

  /**
   * Safely deletes a file or directory within the workspace boundary with protected path checks.
   */
  public deleteItem(targetPath: string, projectPath: string): { success: boolean; path: string } {
    const canonicalTarget = securityService.assertWithinWorkspace(targetPath, projectPath);
    securityService.assertFileOperationPermitted('write', 'standard');

    const canonicalRoot = fs.realpathSync(projectPath);
    if (canonicalTarget.toLowerCase() === canonicalRoot.toLowerCase()) {
      throw new Error('Cannot delete the project root directory.');
    }

    const relToRoot = path.relative(canonicalRoot, canonicalTarget).replace(/\\/g, '/');
    if (relToRoot === '.git' || relToRoot.startsWith('.git/')) {
      throw new Error('Cannot delete protected Git repository items.');
    }

    if (!fs.existsSync(canonicalTarget)) {
      throw new Error('Target item does not exist on disk.');
    }

    const stat = fs.statSync(canonicalTarget);
    if (stat.isDirectory()) {
      fs.rmSync(canonicalTarget, { recursive: true, force: true });
    } else {
      fs.unlinkSync(canonicalTarget);
    }

    return { success: true, path: canonicalTarget };
  }

  /**
   * Safely moves a file or directory to a target directory within the workspace root.
   */
  public moveItem(sourcePath: string, destinationDir: string, projectPath: string): { success: boolean; oldPath: string; newPath: string } {
    const canonicalSource = securityService.assertWithinWorkspace(sourcePath, projectPath);
    const canonicalDestDir = securityService.assertWithinWorkspace(destinationDir, projectPath);
    securityService.assertFileOperationPermitted('write', 'standard');

    const canonicalRoot = fs.realpathSync(projectPath);
    if (canonicalSource.toLowerCase() === canonicalRoot.toLowerCase()) {
      throw new Error('Cannot move the project root directory.');
    }

    const relSource = path.relative(canonicalRoot, canonicalSource).replace(/\\/g, '/');
    if (relSource === '.git' || relSource.startsWith('.git/')) {
      throw new Error('Cannot move protected Git repository items.');
    }

    if (!fs.existsSync(canonicalSource)) {
      throw new Error('Source item does not exist on disk.');
    }

    if (!fs.existsSync(canonicalDestDir)) {
      throw new Error('Destination folder does not exist.');
    }

    const destStat = fs.statSync(canonicalDestDir);
    if (!destStat.isDirectory()) {
      throw new Error('Destination must be a directory.');
    }

    const normSource = path.normalize(canonicalSource).toLowerCase();
    const normDest = path.normalize(canonicalDestDir).toLowerCase();
    if (normDest === normSource || normDest.startsWith(normSource + path.sep)) {
      throw new Error('Cannot move a directory into itself or one of its subdirectories.');
    }

    const targetFilePath = path.join(canonicalDestDir, path.basename(canonicalSource));
    const canonicalTarget = securityService.assertWithinWorkspace(targetFilePath, projectPath);

    if (fs.existsSync(canonicalTarget) && canonicalSource.toLowerCase() !== canonicalTarget.toLowerCase()) {
      throw new Error(`An item named "${path.basename(canonicalSource)}" already exists in destination folder.`);
    }

    fs.renameSync(canonicalSource, canonicalTarget);
    const finalCanonical = fs.realpathSync(canonicalTarget);
    securityService.assertWithinWorkspace(finalCanonical, projectPath);

    return { success: true, oldPath: canonicalSource, newPath: finalCanonical };
  }

  /**
   * Retrieves AST symbols (functions, classes, methods, imports) for outline navigation.
   */
  public async getFileSymbols(filePath: string, projectPath: string): Promise<any[]> {
    const canonicalPath = securityService.assertWithinWorkspace(filePath, projectPath);
    securityService.assertFileOperationPermitted('read', 'standard');
    const relativePath = path.relative(projectPath, canonicalPath).replace(/\\/g, '/');

    // Check if indexed in SQLite database first
    const dbSymbols = databaseService.getSymbolsForFile(relativePath);
    if (dbSymbols && dbSymbols.length > 0) {
      return dbSymbols;
    }

    // On-demand tree-sitter AST parsing fallback
    try {
      const content = fs.readFileSync(canonicalPath, 'utf8');
      const res = await astParserService.parseFile(relativePath, content);
      return res.symbols;
    } catch {
      return [];
    }
  }

  /**
   * Retrieves git repository status, active branch, modified files, and unified diff.
   */
  public async getGitStatus(projectPath: string): Promise<{
    isGitRepo: boolean;
    branch: string;
    isClean: boolean;
    changedFiles: Array<{ path: string; status: string }>;
    diff: string;
    worktrees: Array<{ path: string; head: string; branch: string; isMain: boolean }>;
  }> {
    const isGit = await WorktreeManager.isGitRepo(projectPath);
    if (!isGit) {
      return { isGitRepo: false, branch: '', isClean: true, changedFiles: [], diff: '', worktrees: [] };
    }
    const changedWithStatus = await WorktreeManager.getChangedFilesWithStatus(projectPath);
    const diff = await WorktreeManager.getDiff(projectPath);
    const worktrees = await WorktreeManager.listWorktrees(projectPath);
    let branch = 'main';
    try {
      const headFile = path.join(projectPath, '.git', 'HEAD');
      if (fs.existsSync(headFile)) {
        const headContent = fs.readFileSync(headFile, 'utf8').trim();
        if (headContent.startsWith('ref: refs/heads/')) {
          branch = headContent.replace('ref: refs/heads/', '');
        }
      }
    } catch {
      // ignore
    }
    return {
      isGitRepo: true,
      branch,
      isClean: changedWithStatus.length === 0,
      changedFiles: changedWithStatus,
      diff,
      worktrees
    };
  }

  /**
   * Creates a new Git worktree under the project.
   */
  public async createWorktree(projectPath: string, branchName: string): Promise<any> {
    return await WorktreeManager.createWorktree(projectPath, branchName);
  }

  /**
   * Removes an existing Git worktree.
   */
  public async removeWorktree(projectPath: string, worktreePath: string, branchName?: string): Promise<boolean> {
    return await WorktreeManager.removeWorktree(projectPath, worktreePath, branchName, true);
  }

  /**
   * Builds the comprehensive Project Intelligence Graph:
   * Real project files, AST/Graphify dependency edges, Agent roles,
   * active tasks, context sources, and identified orphaned files.
   */
  public async getProjectGraph(projectPath: string): Promise<ProjectGraphData> {
    const fileNodes = this.listFiles(projectPath, 6);
    const flatFiles: FileNode[] = [];
    const traverse = (items: FileNode[]) => {
      for (const item of items) {
        if (!item.isDirectory) {
          const base = item.name.toLowerCase();
          const normPath = item.path.replace(/\\/g, '/').toLowerCase();
          const isNoise =
            base.startsWith('.') ||
            base.includes('.tmp') ||
            /^[a-f0-9]{20,}\./.test(base) ||
            base.endsWith('.map') ||
            base.endsWith('.sig') ||
            normPath.includes('/graphify-out/') ||
            normPath.includes('/.agents/') ||
            normPath.includes('/.git/');
          if (!isNoise) {
            flatFiles.push(item);
          }
        }
        if (item.children) traverse(item.children);
      }
    };
    traverse(fileNodes);

    const nodesMap = new Map<string, ProjectGraphNode>();
    const edgesList: ProjectGraphEdge[] = [];
    const edgeSet = new Set<string>();

    const addEdge = (src: string, tgt: string, relation: string, isActive = false) => {
      if (src === tgt) return;
      const key = `${src}->${tgt}:${relation}`;
      if (edgeSet.has(key)) return;
      edgeSet.add(key);
      edgesList.push({
        id: `e-${edgesList.length + 1}`,
        source: src,
        target: tgt,
        relation,
        isActive
      });
    };

    // 1. Initialize file nodes
    for (const f of flatFiles) {
      const relPath = f.relativePath.replace(/\\/g, '/');
      const ext = path.extname(f.name).toLowerCase();
      let subType = 'code';
      if (['.json', '.yml', '.yaml', '.toml', '.env'].includes(ext)) subType = 'config';
      else if (['.md', '.txt', '.doc'].includes(ext)) subType = 'document';
      else if (['.css', '.scss', '.svg', '.png', '.jpg', '.ico'].includes(ext)) subType = 'asset';

      nodesMap.set(relPath, {
        id: relPath,
        label: f.name,
        category: 'file',
        subType,
        path: f.path,
        size: f.size || 0,
        degree: 0,
        inDegree: 0,
        outDegree: 0,
        isOrphan: true
      });
    }

    // 2. Discover file dependencies
    // A. Check if graphify-out/graph.json exists
    const graphifyPath = path.join(projectPath, 'graphify-out', 'graph.json');
    const altGraphifyPath = path.join(process.cwd(), 'graphify-out', 'graph.json');
    const targetGraphPath = fs.existsSync(graphifyPath)
      ? graphifyPath
      : fs.existsSync(altGraphifyPath)
      ? altGraphifyPath
      : null;

    if (targetGraphPath) {
      try {
        const raw = fs.readFileSync(targetGraphPath, 'utf8');
        const gData = JSON.parse(raw);
        if (gData && Array.isArray(gData.links)) {
          // Build node ID to file mapping
          const gNodeToFile = new Map<string, string>();
          if (Array.isArray(gData.nodes)) {
            for (const gn of gData.nodes) {
              if (gn.id && gn.source_file) {
                gNodeToFile.set(gn.id, gn.source_file.replace(/\\/g, '/'));
              }
            }
          }
          for (const l of gData.links) {
            const srcFile = (l.source_file || gNodeToFile.get(l.source))?.replace(/\\/g, '/');
            const tgtFile = gNodeToFile.get(l.target)?.replace(/\\/g, '/');
            if (srcFile && tgtFile && srcFile !== tgtFile && nodesMap.has(srcFile) && nodesMap.has(tgtFile)) {
              addEdge(srcFile, tgtFile, l.relation || 'references');
            }
          }
        }
      } catch (err) {
        console.warn('[WorkspaceService] Error reading graphify graph.json:', err);
      }
    }

    // B. Fast AST/Regex Import Scanner (supplements or fallback)
    const importRegex = /(?:import\s+(?:[\w*\s{},]*\s+from\s+)?['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g;
    for (const f of flatFiles) {
      const ext = path.extname(f.name).toLowerCase();
      if (!['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py'].includes(ext)) continue;
      const relPath = f.relativePath.replace(/\\/g, '/');
      try {
        const content = fs.readFileSync(f.path, 'utf8');
        let match: RegExpExecArray | null;
        while ((match = importRegex.exec(content)) !== null) {
          const rawImport = match[1] || match[2];
          if (!rawImport || !rawImport.startsWith('.')) continue; // local imports only
          const dir = path.dirname(f.relativePath);
          const resolvedRel = path.normalize(path.join(dir, rawImport)).replace(/\\/g, '/');

          const candidates = [
            resolvedRel,
            `${resolvedRel}.ts`,
            `${resolvedRel}.tsx`,
            `${resolvedRel}.js`,
            `${resolvedRel}.jsx`,
            `${resolvedRel}/index.ts`,
            `${resolvedRel}/index.tsx`,
            `${resolvedRel}/index.js`
          ];
          for (const cand of candidates) {
            if (nodesMap.has(cand)) {
              addEdge(relPath, cand, 'imports');
              break;
            }
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    // 3. Compute inDegree, outDegree and Orphan status for all files
    for (const e of edgesList) {
      const src = nodesMap.get(e.source);
      const tgt = nodesMap.get(e.target);
      if (src) {
        src.outDegree++;
        src.degree++;
        src.isOrphan = false;
      }
      if (tgt) {
        tgt.inDegree++;
        tgt.degree++;
        tgt.isOrphan = false;
      }
    }

    // Evaluate orphan reasons for unreferenced files
    for (const node of nodesMap.values()) {
      if (node.isOrphan) {
        const basename = path.basename(node.id).toLowerCase();
        const ext = path.extname(node.id).toLowerCase();
        if (['main.ts', 'main.tsx', 'index.ts', 'index.tsx', 'app.tsx', 'index.html'].includes(basename)) {
          node.orphanReason = 'Root Application Entry Point';
        } else if (basename.includes('.config.') || ['.json', '.env', '.yaml', '.yml', '.toml'].includes(ext)) {
          node.orphanReason = 'Project / Tooling Configuration';
        } else if (['.css', '.scss', '.svg', '.png', '.ico'].includes(ext)) {
          node.orphanReason = 'Static Asset / Global Stylesheet';
        } else if (basename.includes('.test.') || basename.includes('.spec.')) {
          node.orphanReason = 'Test Suite Specification';
        } else if (basename.endsWith('.d.ts')) {
          node.orphanReason = 'TypeScript Type Definitions';
        } else {
          node.orphanReason = 'Standalone module / unreferenced code';
        }
      }
    }

    // 4. Add Real Agent Nodes from active/recent project orchestrations
    const project = databaseService.getProjectByPath(projectPath);
    if (project) {
      const orchestrations = databaseService.listOrchestrations(project.id, 5);
      const seenAgents = new Set<string>();
      for (const orch of orchestrations) {
        if (Array.isArray(orch.tasks)) {
          for (const task of orch.tasks) {
            const role = task.role || 'developer';
            const agentKey = `agent:${role}`;
            if (!seenAgents.has(agentKey)) {
              seenAgents.add(agentKey);
              nodesMap.set(agentKey, {
                id: agentKey,
                label: role.charAt(0).toUpperCase() + role.slice(1),
                category: 'agent',
                subType: role,
                status: task.status === 'running' ? 'active' : 'idle',
                degree: 0,
                inDegree: 0,
                outDegree: 0,
                isOrphan: false,
                metadata: {
                  provider: task.assignedProvider,
                  model: task.assignedModel,
                  orchestrationId: orch.id
                }
              });
            }
          }
        }
      }
    }

    // 5. Add Real Enabled Skill Nodes from SkillRegistry
    const enabledSkills = skillRegistry.listSkills().filter((s) => s.enabled);
    for (const sk of enabledSkills) {
      const skillNodeId = `skill:${sk.id}`;
      nodesMap.set(skillNodeId, {
        id: skillNodeId,
        label: sk.name,
        category: 'skill',
        degree: 0,
        inDegree: 0,
        outDegree: 0,
        isOrphan: false,
        metadata: {
          description: sk.description,
          category: sk.category,
          version: sk.version
        }
      });
    }

    // Calculate final stats
    const allNodes = Array.from(nodesMap.values());
    const fileOnlyNodes = allNodes.filter((n) => n.category === 'file');
    const agentNodes = allNodes.filter((n) => n.category === 'agent');
    const skillNodes = allNodes.filter((n) => n.category === 'skill');
    const connectedFiles = fileOnlyNodes.filter((n) => !n.isOrphan).length;
    const orphanedFiles = fileOnlyNodes.filter((n) => n.isOrphan).length;

    return {
      nodes: allNodes,
      edges: edgesList,
      stats: {
        totalFiles: fileOnlyNodes.length,
        connectedFiles,
        orphanedFiles,
        totalAgents: agentNodes.length,
        totalTasks: 0,
        totalSkills: skillNodes.length,
        totalEdges: edgesList.length
      }
    };
  }

  /**
   * Retrieves application layout and navigation preferences.
   */
  public getAppLayout(): AppLayoutConfig {
    return databaseService.getAppLayout();
  }

  /**
   * Updates application layout preferences.
   */
  public saveAppLayout(layout: Partial<AppLayoutConfig>): boolean {
    databaseService.updateAppLayout(layout);
    return true;
  }

  /**
   * Loads persisted workspace state for a project, verifying that file paths still exist on disk,
   * pruning deleted/moved files, and marking terminated shell processes cleanly.
   */
  public getProjectWorkspaceState(projectId: string): ProjectWorkspaceState | null {
    const raw = databaseService.getProjectWorkspaceState(projectId);
    if (!raw) return null;

    // 1. Sanitize openTabs: remove any file tab that no longer exists on disk
    const validTabs: PersistedWorkspaceTab[] = [];
    for (const tab of raw.openTabs) {
      if (tab.type === 'file' && tab.filePath) {
        if (fs.existsSync(tab.filePath)) {
          validTabs.push(tab);
        }
      } else {
        validTabs.push(tab);
      }
    }

    // 2. Sanitize activeFilePath: if it no longer exists on disk, reset it
    let activeFilePath = raw.activeFilePath;
    if (activeFilePath && !fs.existsSync(activeFilePath)) {
      const firstValidFileTab = validTabs.find((t) => t.type === 'file');
      activeFilePath = firstValidFileTab?.filePath || null;
    }

    // 3. Sanitize activeTabId: if the active tab was pruned, select first remaining tab
    let activeTabId = raw.activeTabId;
    if (activeTabId && !validTabs.some((t) => t.id === activeTabId)) {
      activeTabId = validTabs[0]?.id || null;
    }

    // 4. Sanitize terminalSessions: mark any running session as idle/interrupted
    // because OS processes do not survive an application restart
    const sanitizedTerminals: PersistedTerminalSession[] = raw.terminalSessions.map((term) => {
      let status = term.status;
      let output = term.streamOutput || '';
      if (status === 'running') {
        status = 'idle';
        if (!output.includes('[Session restored:')) {
          output += '\n\x1b[33m[Session restored: Process was terminated when application closed. Ready for new command]\x1b[0m\n';
        }
      }
      return {
        ...term,
        status,
        streamOutput: output
      };
    });

    return {
      ...raw,
      openTabs: validTabs,
      activeFilePath,
      activeTabId,
      terminalSessions: sanitizedTerminals
    };
  }

  /**
   * Persists project-isolated workspace state (open tabs, active tab, expanded dirs, terminal metadata).
   */
  public saveProjectWorkspaceState(projectId: string, state: Partial<ProjectWorkspaceState>): boolean {
    databaseService.saveProjectWorkspaceState(projectId, state);
    return true;
  }
}

export const workspaceService = new WorkspaceService();
