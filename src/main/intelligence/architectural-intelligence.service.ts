import fs from 'node:fs';
import path from 'node:path';
import type {
  ArchitecturalOverview,
  ProjectModule
} from '../../shared/project-intelligence';

export class ArchitecturalIntelligenceService {
  public async analyzeArchitecture(
    projectPath: string,
    isMonorepo = false
  ): Promise<ArchitecturalOverview> {
    const entryPoints = this.findEntryPoints(projectPath);
    const modules = this.discoverModules(projectPath);

    // Build dependency graph between modules
    this.mapModuleDependencies(projectPath, modules);

    // Detect circular dependencies between modules
    const circularDependencies = this.detectCircularDependencies(modules);

    // Identify critical execution paths
    const criticalPaths = this.identifyCriticalPaths(entryPoints, modules);

    // Determine high-level style
    let style: ArchitecturalOverview['style'] = 'layered';
    if (isMonorepo) {
      style = 'monorepo';
    } else if (modules.some((m) => m.type === 'ui') && modules.some((m) => m.type === 'service')) {
      style = 'modular-monolith';
    } else if (modules.length > 5) {
      style = 'modular-monolith';
    }

    const summary = this.generateSummary(style, modules, entryPoints, circularDependencies);

    return {
      style,
      entryPoints,
      modules,
      circularDependencies,
      criticalPaths,
      summary
    };
  }

  private findEntryPoints(
    projectPath: string
  ): Array<{ path: string; type: string; description: string }> {
    const entryPoints: Array<{ path: string; type: string; description: string }> = [];

    // 1. package.json entrypoints
    const pkgPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.main) {
          entryPoints.push({
            path: pkg.main,
            type: 'main-entry',
            description: 'Main application entry point declared in package.json'
          });
        }
        if (pkg.bin) {
          if (typeof pkg.bin === 'string') {
            entryPoints.push({
              path: pkg.bin,
              type: 'cli-binary',
              description: 'CLI executable binary'
            });
          } else if (typeof pkg.bin === 'object') {
            for (const [cmd, binPath] of Object.entries(pkg.bin)) {
              entryPoints.push({
                path: binPath as string,
                type: 'cli-binary',
                description: `CLI command executable: ${cmd}`
              });
            }
          }
        }
      } catch {}
    }

    // 2. Common source entrypoints
    const candidates = [
      { rel: 'src/main/index.ts', type: 'electron-main', desc: 'Electron main process entry point' },
      { rel: 'src/preload/index.ts', type: 'electron-preload', desc: 'Electron preload script' },
      { rel: 'src/renderer/index.html', type: 'electron-renderer', desc: 'Electron renderer web root' },
      { rel: 'src/index.tsx', type: 'web-root', desc: 'React web application root' },
      { rel: 'src/index.ts', type: 'module-root', desc: 'Main source export root' },
      { rel: 'src/App.tsx', type: 'react-app', desc: 'React main App component' },
      { rel: 'index.html', type: 'web-root', desc: 'Static HTML application root' },
      { rel: 'main.py', type: 'python-main', desc: 'Python entry point' },
      { rel: 'app.py', type: 'python-app', desc: 'Python application script' },
      { rel: 'src/main.rs', type: 'rust-main', desc: 'Rust binary root' },
      { rel: 'src/lib.rs', type: 'rust-lib', desc: 'Rust library root' },
      { rel: 'main.go', type: 'go-main', desc: 'Go main application' }
    ];

    for (const c of candidates) {
      if (fs.existsSync(path.join(projectPath, c.rel))) {
        // avoid duplicate path
        if (!entryPoints.some((e) => e.path === c.rel)) {
          entryPoints.push({
            path: c.rel,
            type: c.type,
            description: c.desc
          });
        }
      }
    }

    return entryPoints;
  }

  private discoverModules(projectPath: string): ProjectModule[] {
    const modules: ProjectModule[] = [];

    // Scan top-level dirs in src/ or root
    const inspectRoots = ['src', 'lib', 'packages', 'services', 'app'];
    const candidates: Array<{ fullPath: string; relPath: string }> = [];

    for (const r of inspectRoots) {
      const full = path.join(projectPath, r);
      if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
        try {
          const subs = fs.readdirSync(full, { withFileTypes: true });
          for (const s of subs) {
            if (s.isDirectory() && !s.name.startsWith('.')) {
              candidates.push({
                fullPath: path.join(full, s.name),
                relPath: path.join(r, s.name)
              });
            }
          }
        } catch {}
      }
    }

    // If src exists with no subdirectories or top-level project
    if (candidates.length === 0) {
      try {
        const topDirs = fs.readdirSync(projectPath, { withFileTypes: true });
        for (const t of topDirs) {
          if (
            t.isDirectory() &&
            !t.name.startsWith('.') &&
            !['node_modules', 'dist', 'out', 'tests', 'docs', 'bin'].includes(t.name)
          ) {
            candidates.push({
              fullPath: path.join(projectPath, t.name),
              relPath: t.name
            });
          }
        }
      } catch {}
    }

    for (const c of candidates) {
      const fileCount = this.countFiles(c.fullPath);
      if (fileCount > 0) {
        const type = this.classifyModuleType(c.relPath);
        const name = path.basename(c.relPath);
        const responsibility = this.deriveResponsibility(name, type);

        modules.push({
          id: c.relPath.replace(/\\/g, '/'),
          name,
          path: c.fullPath,
          relativePath: c.relPath.replace(/\\/g, '/'),
          type,
          responsibility,
          fileCount,
          dependencies: [],
          dependedOnBy: []
        });
      }
    }

    return modules;
  }

  private countFiles(dir: string, depth = 0): number {
    if (depth > 5) return 0;
    let count = 0;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const ent of entries) {
        if (ent.isDirectory() && !ent.name.startsWith('.') && ent.name !== 'node_modules') {
          count += this.countFiles(path.join(dir, ent.name), depth + 1);
        } else if (ent.isFile()) {
          count++;
        }
      }
    } catch {}
    return count;
  }

  private classifyModuleType(relPath: string): ProjectModule['type'] {
    const norm = relPath.toLowerCase().replace(/\\/g, '/');
    if (norm.includes('renderer') || norm.includes('components') || norm.includes('views') || norm.includes('ui')) {
      return 'ui';
    }
    if (norm.includes('db') || norm.includes('database') || norm.includes('models') || norm.includes('data')) {
      return 'data-access';
    }
    if (norm.includes('services') || norm.includes('server') || norm.includes('engine') || norm.includes('agents')) {
      return 'service';
    }
    if (norm.includes('ipc') || norm.includes('preload') || norm.includes('routes') || norm.includes('api')) {
      return 'ipc';
    }
    if (norm.includes('types') || norm.includes('schemas') || norm.includes('shared')) {
      return 'types';
    }
    if (norm.includes('test') || norm.includes('mocks') || norm.includes('fixtures')) {
      return 'tests';
    }
    if (norm.includes('utils') || norm.includes('helpers')) {
      return 'utility';
    }
    if (norm.includes('config') || norm.includes('settings')) {
      return 'config';
    }
    return 'general';
  }

  private deriveResponsibility(name: string, type: ProjectModule['type']): string {
    switch (type) {
      case 'ui':
        return `Frontend user interface components, views and visual presentation.`;
      case 'data-access':
        return `Persistence layer, database connections, schemas and entity queries.`;
      case 'service':
        return `Core business domain services, logic orchestration and state management.`;
      case 'ipc':
        return `Inter-process communication, API endpoints and security boundary bridges.`;
      case 'types':
        return `Shared contract types, domain interfaces and runtime validation schemas.`;
      case 'tests':
        return `Automated test suites, mocks and verification fixtures.`;
      case 'utility':
        return `Re-usable helper utilities, formatters and common tools.`;
      default:
        return `Module ${name} supporting application functionality.`;
    }
  }

  private mapModuleDependencies(projectPath: string, modules: ProjectModule[]): void {
    const moduleMap = new Map<string, ProjectModule>();
    for (const m of modules) {
      moduleMap.set(m.relativePath, m);
    }

    const importRegex = /(?:import|require)\s*(?:(?:\* as \w+|\{[^}]+\}|\w+)\s*from\s*)?['"]([^'"]+)['"]/g;

    for (const mod of modules) {
      const importedModules = new Set<string>();

      // Sample up to 30 files per module for speed
      const files = this.listModuleFiles(mod.path, 30);
      for (const file of files) {
        try {
          const content = fs.readFileSync(file, 'utf8');
          let match;
          while ((match = importRegex.exec(content)) !== null) {
            const importSpec = match[1];
            if (importSpec.startsWith('.')) {
              // Resolve relative path
              const resolved = path.resolve(path.dirname(file), importSpec);
              const rel = path.relative(projectPath, resolved).replace(/\\/g, '/');

              for (const other of modules) {
                if (other.id !== mod.id && rel.startsWith(other.relativePath)) {
                  importedModules.add(other.id);
                }
              }
            }
          }
        } catch {}
      }

      mod.dependencies = Array.from(importedModules);
    }

    // Populate dependedOnBy
    for (const mod of modules) {
      for (const depId of mod.dependencies) {
        const target = moduleMap.get(depId);
        if (target && !target.dependedOnBy.includes(mod.id)) {
          target.dependedOnBy.push(mod.id);
        }
      }
    }
  }

  private listModuleFiles(dir: string, limit: number): string[] {
    const list: string[] = [];
    const walk = (d: string) => {
      if (list.length >= limit) return;
      try {
        const entries = fs.readdirSync(d, { withFileTypes: true });
        for (const ent of entries) {
          if (list.length >= limit) break;
          const full = path.join(d, ent.name);
          if (ent.isDirectory() && !ent.name.startsWith('.')) {
            walk(full);
          } else if (ent.isFile() && /\.(ts|tsx|js|jsx)$/.test(ent.name)) {
            list.push(full);
          }
        }
      } catch {}
    };
    walk(dir);
    return list;
  }

  private detectCircularDependencies(modules: ProjectModule[]): Array<{ cycle: string[] }> {
    const cycles: Array<{ cycle: string[] }> = [];
    const visited = new Set<string>();
    const stack = new Set<string>();
    const pathList: string[] = [];

    const dfs = (currId: string) => {
      visited.add(currId);
      stack.add(currId);
      pathList.push(currId);

      const mod = modules.find((m) => m.id === currId);
      if (mod) {
        for (const dep of mod.dependencies) {
          if (!visited.has(dep)) {
            dfs(dep);
          } else if (stack.has(dep)) {
            // Found cycle
            const cycleStart = pathList.indexOf(dep);
            if (cycleStart !== -1) {
              const detectedCycle = [...pathList.slice(cycleStart), dep];
              cycles.push({ cycle: detectedCycle });
            }
          }
        }
      }

      stack.delete(currId);
      pathList.pop();
    };

    for (const m of modules) {
      if (!visited.has(m.id)) {
        dfs(m.id);
      }
    }

    return cycles;
  }

  private identifyCriticalPaths(
    entryPoints: Array<{ path: string }>,
    modules: ProjectModule[]
  ): string[] {
    const critical: string[] = [];
    for (const ep of entryPoints) {
      const matchMod = modules.find((m) => ep.path.replace(/\\/g, '/').startsWith(m.relativePath));
      if (matchMod) {
        const pathStr = `${ep.path} -> [${matchMod.name}] -> ${matchMod.dependencies.join(' -> ') || 'end'}`;
        critical.push(pathStr);
      }
    }
    return critical;
  }

  private generateSummary(
    style: ArchitecturalOverview['style'],
    modules: ProjectModule[],
    entryPoints: Array<{ path: string; type: string }>,
    circular: Array<{ cycle: string[] }>
  ): string {
    const parts: string[] = [];
    parts.push(`The project follows a **${style}** architecture comprising ${modules.length} main module(s).`);

    if (entryPoints.length > 0) {
      parts.push(`Primary entry points: ${entryPoints.map((e) => `\`${e.path}\``).join(', ')}.`);
    }

    const services = modules.filter((m) => m.type === 'service');
    if (services.length > 0) {
      parts.push(`Core service layer is located in: ${services.map((s) => `\`${s.name}\``).join(', ')}.`);
    }

    if (circular.length > 0) {
      parts.push(`⚠️ Detected ${circular.length} circular dependency cycle(s) between modules.`);
    } else {
      parts.push(`Clean modular boundaries detected with zero circular dependencies.`);
    }

    return parts.join(' ');
  }
}

export const architecturalIntelligenceService = new ArchitecturalIntelligenceService();
