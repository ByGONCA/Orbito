import { describe, it, expect, beforeAll } from 'vitest';
import { astParserService } from '../src/main/context/parser/ast-parser.service';

describe('ASTParserService (Tree-sitter & Multi-Language Structural Intelligence)', () => {
  beforeAll(async () => {
    await astParserService.initialize();
  });

  it('detects languages based on file extensions', () => {
    expect(astParserService.detectLanguage('src/app.ts')).toBe('typescript');
    expect(astParserService.detectLanguage('src/component.tsx')).toBe('tsx');
    expect(astParserService.detectLanguage('scripts/deploy.py')).toBe('python');
    expect(astParserService.detectLanguage('styles/main.css')).toBe('css');
    expect(astParserService.detectLanguage('public/index.html')).toBe('html');
    expect(astParserService.detectLanguage('config.json')).toBe('json');
    expect(astParserService.detectLanguage('README.md')).toBe('markdown');
    expect(astParserService.detectLanguage('unknown.xyz')).toBe('plaintext');
  });

  it('parses TypeScript files and extracts classes, interfaces, methods and types', async () => {
    const code = `
      import { EventEmitter } from 'node:events';

      export interface UserAccount {
        id: string;
        username: string;
      }

      export type AccountStatus = 'active' | 'suspended';

      export class UserService extends EventEmitter {
        private users: Map<string, UserAccount> = new Map();

        public findUser(id: string): UserAccount | undefined {
          return this.users.get(id);
        }
      }
    `;

    const result = await astParserService.parseFile('src/user.service.ts', code);
    expect(result.language).toBe('typescript');

    const symbolNames = result.symbols.map((s) => s.name);
    expect(symbolNames).toContain('UserAccount');
    expect(symbolNames).toContain('AccountStatus');
    expect(symbolNames).toContain('UserService');
    expect(symbolNames).toContain('findUser');

    const interfaceSym = result.symbols.find((s) => s.name === 'UserAccount');
    expect(interfaceSym?.kind).toBe('interface');

    const classSym = result.symbols.find((s) => s.name === 'UserService');
    expect(classSym?.kind).toBe('class');

    const methodSym = result.symbols.find((s) => s.name === 'findUser');
    expect(methodSym?.kind).toBe('method');
    expect(methodSym?.containerName).toBe('UserService');

    // Chunks should include symbol-based chunk
    expect(result.chunks.length).toBeGreaterThan(0);
    const userMethodChunk = result.chunks.find((c) => c.symbolName === 'findUser');
    expect(userMethodChunk).toBeDefined();
    expect(userMethodChunk?.content).toContain('public findUser');
  });

  it('parses Python files and extracts functions and classes', async () => {
    const pyCode = `
import math

class VectorCalculator:
    def calculate_distance(self, p1, p2):
        return math.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)

def standalone_helper():
    pass
`;

    const result = await astParserService.parseFile('src/calc.py', pyCode);
    expect(result.language).toBe('python');

    const names = result.symbols.map((s) => s.name);
    expect(names).toContain('VectorCalculator');
    expect(names).toContain('calculate_distance');
    expect(names).toContain('standalone_helper');

    const classSym = result.symbols.find((s) => s.name === 'VectorCalculator');
    expect(classSym?.kind).toBe('class');
  });

  it('parses Markdown headers as section symbols', async () => {
    const md = `
# Project Overview
Welcome to the AI Workspace documentation.

## Architecture Guidelines
Follow local-first principles.

### Security
Ensure safe execution.
`;

    const result = await astParserService.parseFile('docs/README.md', md);
    expect(result.language).toBe('markdown');

    const names = result.symbols.map((s) => s.name);
    expect(names).toContain('Project Overview');
    expect(names).toContain('Architecture Guidelines');
    expect(names).toContain('Security');
  });
});
