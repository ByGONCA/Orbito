import path from 'node:path';
import fs from 'node:fs';

export interface ScannedFileInfo {
  absolutePath: string;
  relativePath: string;
  size: number;
  mtimeMs: number;
}

export interface FileScannerOptions {
  maxFileSize?: number; // bytes, default 2MB
  customIgnores?: string[];
}

export class FileScanner {
  private readonly defaultIgnoredDirs = new Set([
    'node_modules',
    '.git',
    '.vscode',
    '.idea',
    'dist',
    'out',
    'build',
    'coverage',
    '.next',
    '.turbo',
    '.vite',
    '.ai-workspace-data'
  ]);

  private readonly binaryExtensions = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svgz',
    '.mp4', '.mov', '.avi', '.mp3', '.wav', '.ogg',
    '.zip', '.tar', '.gz', '.7z', '.rar',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.exe', '.dll', '.so', '.dylib', '.node',
    '.sqlite', '.sqlite3', '.db',
    '.wasm', '.class', '.pyc', '.bin'
  ]);

  public async scan(rootDir: string, options?: FileScannerOptions): Promise<ScannedFileInfo[]> {
    const maxFileSize = options?.maxFileSize || 2 * 1024 * 1024; // 2 MB
    const gitignorePatterns = this.loadGitignore(rootDir);
    const results: ScannedFileInfo[] = [];

    const traverse = (currentDir: string): void => {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

        // Check if directory should be skipped
        if (entry.isDirectory()) {
          if (this.defaultIgnoredDirs.has(entry.name) || entry.name.startsWith('.test-') || this.matchesPatterns(relPath, gitignorePatterns)) {
            continue;
          }
          traverse(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (this.binaryExtensions.has(ext)) {
            continue;
          }

          if (this.matchesPatterns(relPath, gitignorePatterns)) {
            continue;
          }

          try {
            const stat = fs.statSync(fullPath);
            if (stat.size > maxFileSize || stat.size === 0) {
              continue;
            }

            // Quick binary byte probe for files without extension
            if (!ext && this.isBinaryFile(fullPath)) {
              continue;
            }

            results.push({
              absolutePath: fullPath,
              relativePath: relPath,
              size: stat.size,
              mtimeMs: stat.mtimeMs
            });
          } catch {
            // Ignore unreadable files
          }
        }
      }
    };

    traverse(rootDir);
    return results;
  }

  private loadGitignore(rootDir: string): string[] {
    const gitignorePath = path.join(rootDir, '.gitignore');
    if (!fs.existsSync(gitignorePath)) return [];

    try {
      const content = fs.readFileSync(gitignorePath, 'utf8');
      return content
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'));
    } catch {
      return [];
    }
  }

  private matchesPatterns(relPath: string, patterns: string[]): boolean {
    const normalized = relPath.replace(/\\/g, '/');
    for (const pattern of patterns) {
      const cleanPat = pattern.replace(/^\//, '').replace(/\/$/, '');
      if (cleanPat && (normalized === cleanPat || normalized.startsWith(cleanPat + '/') || normalized.endsWith('/' + cleanPat))) {
        return true;
      }
    }
    return false;
  }

  private isBinaryFile(filePath: string): boolean {
    try {
      const buffer = Buffer.alloc(512);
      const fd = fs.openSync(filePath, 'r');
      const bytesRead = fs.readSync(fd, buffer, 0, 512, 0);
      fs.closeSync(fd);

      for (let i = 0; i < bytesRead; i++) {
        if (buffer[i] === 0) return true; // Null byte indicates binary
      }
      return false;
    } catch {
      return false;
    }
  }
}

export const fileScanner = new FileScanner();
