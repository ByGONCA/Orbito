import path from 'node:path';
import fs from 'node:fs';

export class SkillDiscovery {
  /**
   * Returns path to built-in skills directory.
   */
  public static getBuiltinSkillsDir(): string {
    // In dev: src/main/skills/builtin
    // In production: resources/builtin-skills or bundled path
    const localDir = path.join(__dirname, 'builtin');
    if (fs.existsSync(localDir)) return localDir;

    const srcDir = path.join(process.cwd(), 'src', 'main', 'skills', 'builtin');
    if (fs.existsSync(srcDir)) return srcDir;

    return localDir;
  }

  /**
   * Returns path to custom skills user directory.
   */
  public static getCustomSkillsDir(customBaseDir?: string): string {
    const base = customBaseDir || path.join(process.cwd(), '.ai-workspace-data');
    const customDir = path.join(base, 'custom-skills');
    if (!fs.existsSync(customDir)) {
      fs.mkdirSync(customDir, { recursive: true });
    }
    return customDir;
  }

  /**
   * Scans a directory for subdirectories containing manifest.json.
   */
  public static discoverSkillDirs(rootDir: string): string[] {
    if (!fs.existsSync(rootDir)) return [];

    const results: string[] = [];
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subDir = path.join(rootDir, entry.name);
        const manifestPath = path.join(subDir, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
          results.push(subDir);
        }
      }
    }

    return results;
  }
}
