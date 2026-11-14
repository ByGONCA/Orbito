import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export type FixtureProfileType =
  | 'small'
  | 'medium'
  | 'large'
  | 'pathological-circular'
  | 'pathological-complexity'
  | 'pathological-security'
  | 'pathological-negative';

export interface GeneratedFixture {
  rootDir: string;
  profile: FixtureProfileType;
  fileCount: number;
  cleanup: () => void;
}

export class ProjectFixtureGenerator {
  /**
   * Generates a deterministic synthetic repository on the local filesystem in an isolated temp directory.
   */
  public static generateFixture(profile: FixtureProfileType): GeneratedFixture {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), `orbito-fix-${profile}-`));
    let fileCount = 0;

    const writeFile = (relPath: string, content: string) => {
      const fullPath = path.join(rootDir, relPath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf-8');
      fileCount++;
    };

    // Common git mock
    writeFile('.git/HEAD', 'ref: refs/heads/master\n');
    writeFile(
      '.gitignore',
      'node_modules\ndist\nout\n.ai-workspace-data\n' +
        (profile === 'pathological-security' ? '' : '.env\n*.pem\n')
    );

    switch (profile) {
      case 'small': {
        writeFile(
          'package.json',
          JSON.stringify(
            {
              name: 'synthetic-small-app',
              version: '1.0.0',
              main: 'dist/index.js',
              scripts: { test: 'vitest run' },
              dependencies: { express: '^4.18.2' },
              devDependencies: { vitest: '^1.0.0', typescript: '^5.0.0' }
            },
            null,
            2
          )
        );
        writeFile('tsconfig.json', JSON.stringify({ compilerOptions: { target: 'ES2022' } }));
        writeFile('src/index.ts', "import { greet } from './utils';\nconsole.log(greet('Orbito'));\n");
        writeFile('src/utils.ts', 'export function greet(name: string): string { return `Hello ${name}`; }\n');
        writeFile('tests/index.test.ts', "import { greet } from '../src/utils';\n// smoke test\n");
        break;
      }

      case 'medium': {
        writeFile(
          'package.json',
          JSON.stringify(
            {
              name: 'synthetic-medium-app',
              version: '1.0.0',
              main: 'out/main/index.js',
              dependencies: { electron: '^28.0.0', 'better-sqlite3': '^9.0.0', react: '^18.2.0' },
              devDependencies: { vitest: '^1.0.0', vite: '^5.0.0' }
            },
            null,
            2
          )
        );
        writeFile('src/main/index.ts', "import { DatabaseService } from './db';\nexport const db = new DatabaseService();\n");
        writeFile('src/main/db.ts', 'export class DatabaseService { query() { return []; } }\n');
        writeFile('src/preload/index.ts', "export const api = { ping: () => 'pong' };\n");
        writeFile('src/renderer/App.tsx', "import React from 'react';\nexport const App = () => <div>Orbito App</div>;\n");

        for (let i = 1; i <= 15; i++) {
          writeFile(`src/services/service-${i}.ts`, `export const service${i} = () => 'srv ${i}';\n`);
        }
        break;
      }

      case 'large': {
        writeFile(
          'package.json',
          JSON.stringify(
            {
              name: 'synthetic-monorepo',
              private: true,
              workspaces: ['packages/*']
            },
            null,
            2
          )
        );

        const packages = ['core', 'ui', 'network', 'analytics', 'storage', 'auth'];
        for (const pkg of packages) {
          writeFile(
            `packages/${pkg}/package.json`,
            JSON.stringify({ name: `@synthetic/${pkg}`, version: '1.0.0', main: 'index.ts' }, null, 2)
          );
          writeFile(`packages/${pkg}/index.ts`, `export const ${pkg}Module = { name: '${pkg}' };\n`);

          for (let f = 1; f <= 8; f++) {
            writeFile(`packages/${pkg}/src/feature-${f}.ts`, `export const feat_${pkg}_${f} = () => ${f};\n`);
          }
        }
        break;
      }

      case 'pathological-circular': {
        writeFile(
          'package.json',
          JSON.stringify({ name: 'pathological-circ', version: '1.0.0', main: 'src/module-a/index.ts' }, null, 2)
        );
        // Cycle: a -> b -> c -> a
        writeFile('src/module-a/index.ts', "import '../module-b/index';\nexport const moduleA = () => 1;\n");
        writeFile('src/module-b/index.ts', "import '../module-c/index';\nexport const moduleB = () => 2;\n");
        writeFile('src/module-c/index.ts', "import '../module-a/index';\nexport const moduleC = () => 3;\n");
        break;
      }

      case 'pathological-complexity': {
        writeFile(
          'package.json',
          JSON.stringify({ name: 'pathological-comp', version: '1.0.0', main: 'src/giant-module/index.ts' }, null, 2)
        );
        writeFile('src/giant-module/index.ts', "export * from './part-1';\n");
        // Create 75 files in a single module
        for (let i = 1; i <= 75; i++) {
          writeFile(`src/giant-module/part-${i}.ts`, `export const part${i} = () => ${i};\n`);
        }
        break;
      }

      case 'pathological-security': {
        writeFile(
          'package.json',
          JSON.stringify(
            {
              name: 'pathological-sec',
              version: '1.0.0',
              dependencies: {
                'insecure-remote-pkg': 'http://insecure-cdn.org/archive.tgz',
                'plaintext-git-dep': 'git://github.com/synthetic/repo.git'
              }
            },
            null,
            2
          )
        );
        // Unignored .env with credential pattern
        writeFile('.env', 'OPENAI_API_KEY=sk-synthetic-key-999888777666555444333222111\nAPI_SECRET=supersecretpassword123\n');
        writeFile('credentials.json', '{\n  "client_secret": "synthetic-secret-xyz-12345"\n}\n');
        writeFile('src/index.ts', 'export const name = "pathological-security";\n');
        break;
      }

      case 'pathological-negative': {
        // CLEAN PROJECT: contains generated files, vendor code, and test fixtures that must NOT trigger false positives
        writeFile(
          'package.json',
          JSON.stringify(
            {
              name: 'clean-negative-test-app',
              version: '1.0.0',
              dependencies: { react: '^18.2.0', typescript: '^5.0.0' },
              devDependencies: { vitest: '^1.0.0' }
            },
            null,
            2
          )
        );
        writeFile('src/index.ts', "export const ok = true;\n");
        writeFile('src/clean-service.ts', "export class CleanService { run() { return true; } }\n");
        writeFile('tests/clean.test.ts', "import { ok } from '../src';\n// smoke test\n");
        // Vendored code and test fixture containing harmless words resembling keywords
        writeFile('vendor/third-party.min.js', '/* vendored minified bundle */ function x(){ return 1; }\n');
        writeFile('tests/fixtures/mock-credentials.json', '{\n  "note": "harmless fixture for parser testing only"\n}\n');
        writeFile('dist/bundle.js', '// generated build output\n');
        break;
      }
    }

    return {
      rootDir,
      profile,
      fileCount,
      cleanup: () => {
        try {
          fs.rmSync(rootDir, { recursive: true, force: true });
        } catch {}
      }
    };
  }

  public static cleanupFixture(rootDir: string): void {
    try {
      fs.rmSync(rootDir, { recursive: true, force: true });
    } catch {}
  }
}

export const syntheticFixtureGenerator = ProjectFixtureGenerator;
