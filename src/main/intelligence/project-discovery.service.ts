import fs from 'node:fs';
import path from 'node:path';
import type {
  TechStackInfo,
  LanguageStat,
  MonorepoInfo,
  MonorepoPackage,
  ProjectKnowledgeEntry
} from '../../shared/project-intelligence';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.github',
  'dist',
  'out',
  'build',
  'target',
  'venv',
  '.venv',
  '__pycache__',
  '.ai-workspace-data',
  '.idea',
  '.vscode',
  'coverage',
  '.next',
  '.cache'
]);

const EXTENSION_TO_LANG: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript (React)',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript (React)',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.py': 'Python',
  '.rs': 'Rust',
  '.go': 'Go',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.cpp': 'C++',
  '.cc': 'C++',
  '.c': 'C',
  '.h': 'C/C++ Header',
  '.hpp': 'C++ Header',
  '.cs': 'C#',
  '.php': 'PHP',
  '.rb': 'Ruby',
  '.swift': 'Swift',
  '.html': 'HTML',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.sql': 'SQL',
  '.json': 'JSON',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.md': 'Markdown'
};

export class ProjectDiscoveryService {
  public async discover(projectPath: string, projectId: string): Promise<{
    techStack: TechStackInfo;
    monorepo: MonorepoInfo;
    knowledgeEntries: ProjectKnowledgeEntry[];
  }> {
    if (!fs.existsSync(projectPath)) {
      throw new Error(`Project directory not found: ${projectPath}`);
    }

    const rawManifestsFound: string[] = [];
    const languageCounts: Record<string, number> = {};
    let totalCodeFiles = 0;

    const frameworks = new Set<string>();
    const libraries = new Set<string>();
    const packageManagers = new Set<string>();
    const buildSystems = new Set<string>();
    const testFrameworks = new Set<string>();
    const databaseEngines = new Set<string>();
    const apiStyles = new Set<string>();
    const styling = new Set<string>();
    const ciWorkflows: string[] = [];

    // 1. Scan directory structure for files and languages (bounded depth & limits for speed)
    this.scanFiles(projectPath, (filePath, fileName) => {
      const ext = path.extname(fileName).toLowerCase();
      if (EXTENSION_TO_LANG[ext]) {
        const lang = EXTENSION_TO_LANG[ext];
        languageCounts[lang] = (languageCounts[lang] || 0) + 1;
        totalCodeFiles++;
      }
    });

    // 2. Discover package managers, dependencies & frameworks via manifests
    this.inspectNodeEcosystem(projectPath, {
      rawManifestsFound,
      frameworks,
      libraries,
      packageManagers,
      buildSystems,
      testFrameworks,
      databaseEngines,
      apiStyles,
      styling
    });

    this.inspectPythonEcosystem(projectPath, {
      rawManifestsFound,
      frameworks,
      libraries,
      packageManagers,
      testFrameworks,
      databaseEngines
    });

    this.inspectRustEcosystem(projectPath, {
      rawManifestsFound,
      frameworks,
      packageManagers,
      buildSystems,
      testFrameworks,
      databaseEngines
    });

    this.inspectGoEcosystem(projectPath, {
      rawManifestsFound,
      frameworks,
      packageManagers,
      testFrameworks,
      databaseEngines
    });

    // 3. Inspect Docker, CI & Infrastructure
    const dockerSupport =
      fs.existsSync(path.join(projectPath, 'Dockerfile')) ||
      fs.existsSync(path.join(projectPath, 'docker-compose.yml')) ||
      fs.existsSync(path.join(projectPath, 'compose.yaml'));

    const workflowsDir = path.join(projectPath, '.github', 'workflows');
    if (fs.existsSync(workflowsDir)) {
      try {
        const files = fs.readdirSync(workflowsDir);
        for (const f of files) {
          if (f.endsWith('.yml') || f.endsWith('.yaml')) {
            ciWorkflows.push(f);
          }
        }
      } catch {}
    }

    // 4. Discover Monorepo Structure
    const monorepo = this.detectMonorepo(projectPath);

    // 5. Calculate Language Distributions
    const languages: LanguageStat[] = Object.entries(languageCounts)
      .map(([name, fileCount]) => ({
        name,
        fileCount,
        percentage: totalCodeFiles > 0 ? Math.round((fileCount / totalCodeFiles) * 100) : 0
      }))
      .sort((a, b) => b.fileCount - a.fileCount);

    const techStack: TechStackInfo = {
      languages,
      frameworks: Array.from(frameworks).sort(),
      libraries: Array.from(libraries).sort(),
      packageManagers: Array.from(packageManagers).sort(),
      buildSystems: Array.from(buildSystems).sort(),
      testFrameworks: Array.from(testFrameworks).sort(),
      databaseEngines: Array.from(databaseEngines).sort(),
      apiStyles: Array.from(apiStyles).sort(),
      styling: Array.from(styling).sort(),
      dockerSupport,
      ciWorkflows,
      rawManifestsFound
    };

    // 6. Generate Direct Observed Knowledge Entries
    const knowledgeEntries = this.generateKnowledgeEntries(projectId, projectPath, techStack, monorepo);

    return {
      techStack,
      monorepo,
      knowledgeEntries
    };
  }

  private scanFiles(
    dir: string,
    onFile: (fullPath: string, fileName: string) => void,
    depth = 0
  ): void {
    if (depth > 8) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
            this.scanFiles(path.join(dir, entry.name), onFile, depth + 1);
          }
        } else if (entry.isFile()) {
          onFile(path.join(dir, entry.name), entry.name);
        }
      }
    } catch {}
  }

  private inspectNodeEcosystem(
    projectPath: string,
    collector: {
      rawManifestsFound: string[];
      frameworks: Set<string>;
      libraries: Set<string>;
      packageManagers: Set<string>;
      buildSystems: Set<string>;
      testFrameworks: Set<string>;
      databaseEngines: Set<string>;
      apiStyles: Set<string>;
      styling: Set<string>;
    }
  ): void {
    const pkgPath = path.join(projectPath, 'package.json');
    if (!fs.existsSync(pkgPath)) return;

    collector.rawManifestsFound.push('package.json');

    // Detect package managers via lockfiles
    if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'))) collector.packageManagers.add('pnpm');
    if (fs.existsSync(path.join(projectPath, 'package-lock.json'))) collector.packageManagers.add('npm');
    if (fs.existsSync(path.join(projectPath, 'yarn.lock'))) collector.packageManagers.add('yarn');
    if (fs.existsSync(path.join(projectPath, 'bun.lockb'))) collector.packageManagers.add('bun');

    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const allDeps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
        ...(pkg.peerDependencies || {})
      };

      // Frameworks & Runtimes
      if (allDeps['electron']) collector.frameworks.add('Electron');
      if (allDeps['react'] || allDeps['react-dom']) collector.frameworks.add('React');
      if (allDeps['vue']) collector.frameworks.add('Vue');
      if (allDeps['@angular/core']) collector.frameworks.add('Angular');
      if (allDeps['svelte']) collector.frameworks.add('Svelte');
      if (allDeps['next']) collector.frameworks.add('Next.js');
      if (allDeps['express']) collector.frameworks.add('Express');
      if (allDeps['fastify']) collector.frameworks.add('Fastify');
      if (allDeps['@nestjs/core']) collector.frameworks.add('NestJS');

      // Build systems
      if (allDeps['electron-vite']) collector.buildSystems.add('electron-vite');
      if (allDeps['vite']) collector.buildSystems.add('vite');
      if (allDeps['webpack']) collector.buildSystems.add('webpack');
      if (allDeps['esbuild']) collector.buildSystems.add('esbuild');
      if (allDeps['rollup']) collector.buildSystems.add('rollup');
      if (allDeps['typescript'] || fs.existsSync(path.join(projectPath, 'tsconfig.json'))) {
        collector.buildSystems.add('tsc');
      }

      // Testing frameworks
      if (allDeps['vitest']) collector.testFrameworks.add('Vitest');
      if (allDeps['jest']) collector.testFrameworks.add('Jest');
      if (allDeps['mocha']) collector.testFrameworks.add('Mocha');
      if (allDeps['@playwright/test']) collector.testFrameworks.add('Playwright');
      if (allDeps['cypress']) collector.testFrameworks.add('Cypress');

      // Database & ORMs
      if (allDeps['better-sqlite3'] || allDeps['sqlite3'] || allDeps['sqlite']) collector.databaseEngines.add('SQLite');
      if (allDeps['pg'] || allDeps['postgres']) collector.databaseEngines.add('PostgreSQL');
      if (allDeps['mysql'] || allDeps['mysql2']) collector.databaseEngines.add('MySQL');
      if (allDeps['mongodb'] || allDeps['mongoose']) collector.databaseEngines.add('MongoDB');
      if (allDeps['redis'] || allDeps['ioredis']) collector.databaseEngines.add('Redis');
      if (allDeps['drizzle-orm']) collector.databaseEngines.add('Drizzle ORM');
      if (allDeps['@prisma/client'] || allDeps['prisma']) collector.databaseEngines.add('Prisma ORM');
      if (allDeps['typeorm']) collector.databaseEngines.add('TypeORM');

      // API styles
      if (allDeps['electron'] || pkg.main) collector.apiStyles.add('Electron IPC');
      if (allDeps['@trpc/server']) collector.apiStyles.add('tRPC');
      if (allDeps['graphql'] || allDeps['@apollo/server']) collector.apiStyles.add('GraphQL');
      if (allDeps['@grpc/grpc-js']) collector.apiStyles.add('gRPC');
      if (allDeps['ws'] || allDeps['socket.io']) collector.apiStyles.add('WebSocket');
      if (allDeps['express'] || allDeps['fastify'] || allDeps['koa']) collector.apiStyles.add('REST');

      // Styling
      if (allDeps['tailwindcss']) collector.styling.add('Tailwind CSS');
      if (allDeps['styled-components']) collector.styling.add('Styled Components');
      if (allDeps['@emotion/react']) collector.styling.add('Emotion');
      if (allDeps['sass'] || allDeps['node-sass']) collector.styling.add('Sass/SCSS');

      // Key Libraries
      if (allDeps['zustand']) collector.libraries.add('Zustand');
      if (allDeps['@reduxjs/toolkit'] || allDeps['redux']) collector.libraries.add('Redux');
      if (allDeps['zod']) collector.libraries.add('Zod');
      if (allDeps['node-pty']) collector.libraries.add('node-pty');
      if (allDeps['lucide-react']) collector.libraries.add('lucide-react');
    } catch {}
  }

  private inspectPythonEcosystem(
    projectPath: string,
    collector: {
      rawManifestsFound: string[];
      frameworks: Set<string>;
      libraries: Set<string>;
      packageManagers: Set<string>;
      testFrameworks: Set<string>;
      databaseEngines: Set<string>;
    }
  ): void {
    const pyproject = path.join(projectPath, 'pyproject.toml');
    const requirements = path.join(projectPath, 'requirements.txt');
    const pipfile = path.join(projectPath, 'Pipfile');

    if (fs.existsSync(pyproject)) {
      collector.rawManifestsFound.push('pyproject.toml');
      collector.packageManagers.add('poetry/pip');
    }
    if (fs.existsSync(requirements)) {
      collector.rawManifestsFound.push('requirements.txt');
      collector.packageManagers.add('pip');
    }
    if (fs.existsSync(pipfile)) {
      collector.rawManifestsFound.push('Pipfile');
      collector.packageManagers.add('pipenv');
    }

    const checkText = (filePath: string) => {
      try {
        const content = fs.readFileSync(filePath, 'utf8').toLowerCase();
        if (content.includes('django')) collector.frameworks.add('Django');
        if (content.includes('fastapi')) collector.frameworks.add('FastAPI');
        if (content.includes('flask')) collector.frameworks.add('Flask');
        if (content.includes('pytest')) collector.testFrameworks.add('Pytest');
        if (content.includes('sqlalchemy')) collector.databaseEngines.add('SQLAlchemy');
        if (content.includes('psycopg2') || content.includes('asyncpg')) collector.databaseEngines.add('PostgreSQL');
        if (content.includes('torch') || content.includes('tensorflow')) collector.libraries.add('Machine Learning');
      } catch {}
    };

    if (fs.existsSync(requirements)) checkText(requirements);
    if (fs.existsSync(pyproject)) checkText(pyproject);
  }

  private inspectRustEcosystem(
    projectPath: string,
    collector: {
      rawManifestsFound: string[];
      frameworks: Set<string>;
      packageManagers: Set<string>;
      buildSystems: Set<string>;
      testFrameworks: Set<string>;
      databaseEngines: Set<string>;
    }
  ): void {
    const cargoToml = path.join(projectPath, 'Cargo.toml');
    if (!fs.existsSync(cargoToml)) return;

    collector.rawManifestsFound.push('Cargo.toml');
    collector.packageManagers.add('cargo');
    collector.buildSystems.add('cargo');
    collector.testFrameworks.add('cargo test');

    try {
      const content = fs.readFileSync(cargoToml, 'utf8');
      if (content.includes('actix-web')) collector.frameworks.add('Actix-web');
      if (content.includes('axum')) collector.frameworks.add('Axum');
      if (content.includes('rocket')) collector.frameworks.add('Rocket');
      if (content.includes('tokio')) collector.frameworks.add('Tokio');
      if (content.includes('sqlx') || content.includes('diesel')) collector.databaseEngines.add('SQLx / Diesel');
    } catch {}
  }

  private inspectGoEcosystem(
    projectPath: string,
    collector: {
      rawManifestsFound: string[];
      frameworks: Set<string>;
      packageManagers: Set<string>;
      testFrameworks: Set<string>;
      databaseEngines: Set<string>;
    }
  ): void {
    const goMod = path.join(projectPath, 'go.mod');
    if (!fs.existsSync(goMod)) return;

    collector.rawManifestsFound.push('go.mod');
    collector.packageManagers.add('go modules');
    collector.testFrameworks.add('go test');

    try {
      const content = fs.readFileSync(goMod, 'utf8');
      if (content.includes('github.com/gin-gonic/gin')) collector.frameworks.add('Gin');
      if (content.includes('github.com/gofiber/fiber')) collector.frameworks.add('Fiber');
      if (content.includes('github.com/labstack/echo')) collector.frameworks.add('Echo');
      if (content.includes('gorm.io/gorm')) collector.databaseEngines.add('GORM');
    } catch {}
  }

  private detectMonorepo(projectPath: string): MonorepoInfo {
    // 1. Check pnpm workspace
    if (fs.existsSync(path.join(projectPath, 'pnpm-workspace.yaml'))) {
      const packages = this.findMonorepoPackages(projectPath);
      return { isMonorepo: true, type: 'pnpm', packages };
    }

    // 2. Check Lerna
    if (fs.existsSync(path.join(projectPath, 'lerna.json'))) {
      const packages = this.findMonorepoPackages(projectPath);
      return { isMonorepo: true, type: 'lerna', packages };
    }

    // 3. Check Turborepo
    if (fs.existsSync(path.join(projectPath, 'turbo.json'))) {
      const packages = this.findMonorepoPackages(projectPath);
      return { isMonorepo: true, type: 'turborepo', packages };
    }

    // 4. Check Nx
    if (fs.existsSync(path.join(projectPath, 'nx.json'))) {
      const packages = this.findMonorepoPackages(projectPath);
      return { isMonorepo: true, type: 'nx', packages };
    }

    // 5. Check Cargo Workspace
    const cargoToml = path.join(projectPath, 'Cargo.toml');
    if (fs.existsSync(cargoToml)) {
      try {
        const text = fs.readFileSync(cargoToml, 'utf8');
        if (text.includes('[workspace]')) {
          const packages = this.findMonorepoPackages(projectPath);
          return { isMonorepo: true, type: 'cargo', packages };
        }
      } catch {}
    }

    // 6. Check npm/yarn workspaces in root package.json
    const pkgPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.workspaces && Array.isArray(pkg.workspaces) && pkg.workspaces.length > 0) {
          const packages = this.findMonorepoPackages(projectPath);
          return { isMonorepo: true, type: 'nested', packages };
        }
      } catch {}
    }

    // 7. Check if packages/ or apps/ directory contains multiple manifests
    const nested = this.findMonorepoPackages(projectPath);
    if (nested.length > 1) {
      return { isMonorepo: true, type: 'nested', packages: nested };
    }

    return { isMonorepo: false, type: 'none', packages: [] };
  }

  private findMonorepoPackages(projectPath: string): MonorepoPackage[] {
    const packages: MonorepoPackage[] = [];
    const searchDirs = ['packages', 'apps', 'services', 'libs', 'modules', 'crates'];

    for (const subDir of searchDirs) {
      const targetDir = path.join(projectPath, subDir);
      if (fs.existsSync(targetDir) && fs.statSync(targetDir).isDirectory()) {
        try {
          const entries = fs.readdirSync(targetDir, { withFileTypes: true });
          for (const ent of entries) {
            if (ent.isDirectory()) {
              const pkgDir = path.join(targetDir, ent.name);
              const pkgJson = path.join(pkgDir, 'package.json');
              const cargoToml = path.join(pkgDir, 'Cargo.toml');

              if (fs.existsSync(pkgJson)) {
                try {
                  const data = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
                  packages.push({
                    name: data.name || ent.name,
                    path: pkgDir,
                    relativePath: path.relative(projectPath, pkgDir),
                    type: subDir.slice(0, -1),
                    entryPoint: data.main
                  });
                } catch {
                  packages.push({
                    name: ent.name,
                    path: pkgDir,
                    relativePath: path.relative(projectPath, pkgDir),
                    type: subDir.slice(0, -1)
                  });
                }
              } else if (fs.existsSync(cargoToml)) {
                packages.push({
                  name: ent.name,
                  path: pkgDir,
                  relativePath: path.relative(projectPath, pkgDir),
                  type: 'crate'
                });
              }
            }
          }
        } catch {}
      }
    }
    return packages;
  }

  private generateKnowledgeEntries(
    projectId: string,
    projectPath: string,
    techStack: TechStackInfo,
    monorepo: MonorepoInfo
  ): ProjectKnowledgeEntry[] {
    const entries: ProjectKnowledgeEntry[] = [];
    const now = Date.now();

    // 1. Language Stack Fact
    if (techStack.languages.length > 0) {
      const topLangs = techStack.languages.slice(0, 3).map((l) => `${l.name} (${l.percentage}%)`).join(', ');
      entries.push({
        id: `${projectId}-tech-languages`,
        projectId,
        category: 'tech_stack',
        key: 'primary_languages',
        title: 'Primary Programming Languages',
        content: `Project is built primarily with ${topLangs}.`,
        confidence: 1.0,
        source: 'observed',
        isConfirmed: true,
        metadata: { languages: techStack.languages },
        createdAt: now,
        updatedAt: now
      });
    }

    // 2. Frameworks & Build Stack
    if (techStack.frameworks.length > 0) {
      entries.push({
        id: `${projectId}-tech-frameworks`,
        projectId,
        category: 'tech_stack',
        key: 'frameworks',
        title: 'Application Frameworks',
        content: `Utilizes frameworks: ${techStack.frameworks.join(', ')}.`,
        confidence: 1.0,
        source: 'observed',
        isConfirmed: true,
        metadata: { frameworks: techStack.frameworks },
        createdAt: now,
        updatedAt: now
      });
    }

    // 3. Monorepo Status Fact
    if (monorepo.isMonorepo) {
      entries.push({
        id: `${projectId}-arch-monorepo`,
        projectId,
        category: 'architecture',
        key: 'monorepo_layout',
        title: `Monorepo Workspace (${monorepo.type})`,
        content: `Repository is configured as a ${monorepo.type} monorepo containing ${monorepo.packages.length} package(s): ${monorepo.packages.map((p) => p.name).join(', ')}.`,
        confidence: 1.0,
        source: 'observed',
        isConfirmed: true,
        metadata: { packages: monorepo.packages },
        createdAt: now,
        updatedAt: now
      });
    }

    return entries;
  }
}

export const projectDiscoveryService = new ProjectDiscoveryService();
