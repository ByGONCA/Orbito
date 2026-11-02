import path from 'node:path';
import fs from 'node:fs';
import Parser from 'web-tree-sitter';
import type { FileSymbol, SymbolKind, CodeChunk } from '../../../shared/context';

export interface ParseResult {
  language: string;
  symbols: FileSymbol[];
  chunks: CodeChunk[];
}

export class ASTParserService {
  private isInitialized = false;
  private languages: Map<string, Parser.Language> = new Map();
  private wasmsDir: string = '';

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    await Parser.init();

    // Resolve tree-sitter-wasms directory
    try {
      const pkgPath = require.resolve('tree-sitter-wasms/package.json');
      this.wasmsDir = path.join(path.dirname(pkgPath), 'out');
    } catch {
      // Fallback relative path
      this.wasmsDir = path.join(process.cwd(), 'node_modules', 'tree-sitter-wasms', 'out');
    }

    this.isInitialized = true;
  }

  public detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.ts':
        return 'typescript';
      case '.tsx':
        return 'tsx';
      case '.js':
      case '.mjs':
      case '.cjs':
        return 'javascript';
      case '.jsx':
        return 'jsx';
      case '.py':
        return 'python';
      case '.html':
      case '.htm':
        return 'html';
      case '.css':
      case '.scss':
        return 'css';
      case '.json':
        return 'json';
      case '.md':
      case '.markdown':
        return 'markdown';
      case '.sh':
      case '.bash':
        return 'bash';
      case '.rs':
        return 'rust';
      case '.go':
        return 'go';
      case '.sql':
        return 'sql';
      case '.yaml':
      case '.yml':
        return 'yaml';
      default:
        return 'plaintext';
    }
  }

  private async getLanguageParser(language: string): Promise<Parser.Language | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.languages.has(language)) {
      return this.languages.get(language)!;
    }

    let wasmFileName = '';
    switch (language) {
      case 'typescript':
        wasmFileName = 'tree-sitter-typescript.wasm';
        break;
      case 'tsx':
        wasmFileName = 'tree-sitter-tsx.wasm';
        break;
      case 'javascript':
      case 'jsx':
        wasmFileName = 'tree-sitter-javascript.wasm';
        break;
      case 'python':
        wasmFileName = 'tree-sitter-python.wasm';
        break;
      case 'html':
        wasmFileName = 'tree-sitter-html.wasm';
        break;
      case 'css':
        wasmFileName = 'tree-sitter-css.wasm';
        break;
      case 'json':
        wasmFileName = 'tree-sitter-json.wasm';
        break;
      case 'bash':
        wasmFileName = 'tree-sitter-bash.wasm';
        break;
      case 'rust':
        wasmFileName = 'tree-sitter-rust.wasm';
        break;
      case 'go':
        wasmFileName = 'tree-sitter-go.wasm';
        break;
      default:
        return null;
    }

    const wasmPath = path.join(this.wasmsDir, wasmFileName);
    if (!fs.existsSync(wasmPath)) {
      return null;
    }

    try {
      const lang = await Parser.Language.load(wasmPath);
      this.languages.set(language, lang);
      return lang;
    } catch (err) {
      console.warn(`[ASTParserService] Failed to load WASM grammar for ${language}:`, err);
      return null;
    }
  }

  public async parseFile(filePath: string, content: string): Promise<ParseResult> {
    const language = this.detectLanguage(filePath);
    const langParser = await this.getLanguageParser(language);

    if (!langParser) {
      // Line-based fallback parser for Markdown, JSON, and unsupported files
      return this.fallbackParse(filePath, content, language);
    }

    try {
      const parser = new Parser();
      parser.setLanguage(langParser);
      const tree = parser.parse(content);

      const symbols: FileSymbol[] = [];
      const lines = content.split(/\r?\n/);

      this.extractSymbolsFromNode(tree.rootNode, filePath, symbols, lines);

      // Create structured chunks
      const chunks = this.createChunksFromSymbolsAndLines(filePath, content, lines, symbols, language);

      return {
        language,
        symbols,
        chunks
      };
    } catch (err) {
      console.warn(`[ASTParserService] Tree-sitter failed for ${filePath}, using fallback:`, err);
      return this.fallbackParse(filePath, content, language);
    }
  }

  private extractSymbolsFromNode(
    node: Parser.SyntaxNode,
    filePath: string,
    symbols: FileSymbol[],
    lines: string[],
    containerName?: string
  ): void {
    const startRow = node.startPosition.row + 1;
    const endRow = node.endPosition.row + 1;
    let currentContainer = containerName;

    switch (node.type) {
      case 'function_declaration':
      case 'function_definition':
      case 'method_definition': {
        const nameNode = node.childForFieldName('name') || node.children.find((c) => c.type === 'identifier');
        const name = nameNode ? nameNode.text : 'anonymous';
        const signature = lines[node.startPosition.row]?.trim() || '';
        symbols.push({
          id: `sym-${filePath}-${name}-${startRow}`,
          filePath,
          name,
          kind: containerName ? 'method' : 'function',
          line: startRow,
          endLine: endRow,
          containerName,
          signature
        });
        break;
      }

      case 'class_declaration':
      case 'class_definition': {
        const nameNode = node.childForFieldName('name') || node.children.find((c) => c.type === 'identifier');
        const name = nameNode ? nameNode.text : 'AnonymousClass';
        symbols.push({
          id: `sym-${filePath}-${name}-${startRow}`,
          filePath,
          name,
          kind: 'class',
          line: startRow,
          endLine: endRow,
          containerName,
          signature: lines[node.startPosition.row]?.trim()
        });
        currentContainer = name;
        break;
      }

      case 'interface_declaration': {
        const nameNode = node.childForFieldName('name') || node.children.find((c) => c.type === 'type_identifier');
        const name = nameNode ? nameNode.text : 'AnonymousInterface';
        symbols.push({
          id: `sym-${filePath}-${name}-${startRow}`,
          filePath,
          name,
          kind: 'interface',
          line: startRow,
          endLine: endRow,
          signature: lines[node.startPosition.row]?.trim()
        });
        currentContainer = name;
        break;
      }

      case 'type_alias_declaration': {
        const nameNode = node.childForFieldName('name') || node.children.find((c) => c.type === 'type_identifier');
        const name = nameNode ? nameNode.text : 'AnonymousType';
        symbols.push({
          id: `sym-${filePath}-${name}-${startRow}`,
          filePath,
          name,
          kind: 'type',
          line: startRow,
          endLine: endRow,
          signature: lines[node.startPosition.row]?.trim()
        });
        break;
      }

      case 'import_statement':
      case 'import_from_statement':
      case 'import_declaration': {
        const signature = lines[node.startPosition.row]?.trim() || node.text.substring(0, 80);
        symbols.push({
          id: `sym-${filePath}-import-${startRow}`,
          filePath,
          name: signature,
          kind: 'import',
          line: startRow,
          endLine: endRow,
          signature
        });
        break;
      }

      case 'export_statement': {
        const signature = lines[node.startPosition.row]?.trim() || '';
        symbols.push({
          id: `sym-${filePath}-export-${startRow}`,
          filePath,
          name: signature,
          kind: 'export',
          line: startRow,
          endLine: endRow,
          signature
        });
        break;
      }
    }

    // Recurse children
    for (const child of node.children) {
      this.extractSymbolsFromNode(child, filePath, symbols, lines, currentContainer);
    }
  }

  private createChunksFromSymbolsAndLines(
    filePath: string,
    content: string,
    lines: string[],
    symbols: FileSymbol[],
    language: string
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const chunkSize = 40; // Max lines per chunk
    const overlap = 10;
    let chunkSeq = 0;

    // 1. If symbols exist, create focused symbol chunks for major units
    for (const sym of symbols) {
      if (['function', 'class', 'method', 'interface', 'type'].includes(sym.kind)) {
        const start = Math.max(1, sym.line);
        const end = Math.min(lines.length, sym.endLine || sym.line + 20);
        const chunkText = lines.slice(start - 1, end).join('\n');

        if (chunkText.trim().length > 0) {
          chunks.push({
            id: `chk-${filePath}-${start}-${end}-${++chunkSeq}`,
            filePath,
            startLine: start,
            endLine: end,
            content: chunkText,
            symbolName: sym.name,
            language
          });
        }
      }
    }

    // 2. Also ensure sliding window chunks cover the full file for non-symbol text (imports, logic)
    for (let i = 0; i < lines.length; i += chunkSize - overlap) {
      const start = i + 1;
      const end = Math.min(lines.length, i + chunkSize);
      const chunkText = lines.slice(start - 1, end).join('\n');

      // Check if already covered by an identical symbol chunk
      const existing = chunks.find((c) => Math.abs(c.startLine - start) < 5 && Math.abs(c.endLine - end) < 5);
      if (!existing && chunkText.trim().length > 0) {
        chunks.push({
          id: `chk-${filePath}-${start}-${end}-${++chunkSeq}`,
          filePath,
          startLine: start,
          endLine: end,
          content: chunkText,
          language
        });
      }

      if (end >= lines.length) break;
    }

    return chunks;
  }

  private fallbackParse(filePath: string, content: string, language: string): ParseResult {
    const lines = content.split(/\r?\n/);
    const symbols: FileSymbol[] = [];
    const chunks: CodeChunk[] = [];
    let chunkSeq = 0;

    // For Markdown: extract headers as symbols
    if (language === 'markdown') {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('#')) {
          const headerName = line.replace(/^#+\s*/, '').trim();
          symbols.push({
            id: `sym-${filePath}-${i + 1}`,
            filePath,
            name: headerName,
            kind: 'interface', // Treat headers as section interfaces
            line: i + 1,
            endLine: i + 1,
            signature: line
          });
        }
      }
    }

    // Window chunking
    const chunkSize = 50;
    const overlap = 10;
    for (let i = 0; i < lines.length; i += chunkSize - overlap) {
      const start = i + 1;
      const end = Math.min(lines.length, i + chunkSize);
      const chunkText = lines.slice(start - 1, end).join('\n');

      if (chunkText.trim().length > 0) {
        chunks.push({
          id: `chk-${filePath}-${start}-${end}-${++chunkSeq}`,
          filePath,
          startLine: start,
          endLine: end,
          content: chunkText,
          language
        });
      }

      if (end >= lines.length) break;
    }

    return {
      language,
      symbols,
      chunks
    };
  }
}

export const astParserService = new ASTParserService();
