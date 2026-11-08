import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FileCode,
  X,
  Save,
  Search,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  Folder,
  Check,
  Code2,
  FileText,
  Copy,
  Undo,
  Redo,
  Share2,
  BookOpen,
  Eye
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspace.store';
import { Devicon } from '../utils/devicon-svgs';
import { ShareCodeModal } from './ShareCodeModal';
import { MarkdownPreview } from './editor/MarkdownPreview';

interface LineToken {
  text: string;
  className: string;
}

interface HighlightedLine {
  indentUnits: number;
  tokens: LineToken[];
}

// Fast regex tokenizer for code syntax highlighting with VS Code Dark+ Modern theme
function highlightCode(code: string, language: string): HighlightedLine[] {
  const lines = code.split('\n');

  // VS Code Dark+ Syntax Patterns
  const controlKeywords =
    /\b(import|export|from|return|if|else|switch|case|default|break|continue|for|while|do|try|catch|finally|throw|async|await|yield)\b/;
  const declarationKeywords =
    /\b(const|let|var|function|class|interface|type|enum|extends|implements|new|typeof|instanceof|void|as|in|is|keyof|readonly|static|public|private|protected|abstract|declare|namespace|def|lambda|elif|pass|raise|with)\b/;
  const constants = /\b(true|false|null|undefined|this|super|NaN|Infinity)\b/;
  const types =
    /\b(string|number|boolean|any|unknown|never|void|Promise|Record|Array|Set|Map|Object|Function|Int|Float|React|FC|JSX|HTMLDivElement|HTMLElement|Node|Element|[A-Z][a-zA-Z0-9_$]*)\b/;
  const numbers = /\b(0x[0-9a-fA-F]+|\d+(\.\d+)?)\b/;
  const functions = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)(?=\s*\()/;

  let bracketDepth = 0;

  return lines.map((line) => {
    if (!line) {
      return { indentUnits: 0, tokens: [{ text: ' ', className: '' }] };
    }

    // Calculate leading indentation units (every 2 spaces or 1 tab = 1 guide unit)
    const leadingMatch = line.match(/^(\s+)/);
    const leadingSpaces = leadingMatch ? leadingMatch[1].replace(/\t/g, '  ').length : 0;
    const indentUnits = Math.floor(leadingSpaces / 2);
    const remainder = leadingSpaces % 2;
    const content = (remainder > 0 ? ' ' : '') + line.trimStart();

    // Full line comment
    if (content.startsWith('//') || content.startsWith('#')) {
      return {
        indentUnits,
        tokens: [{ text: content, className: 'hl-comment' }]
      };
    }

    const tokens: LineToken[] = [];
    const chunkRegex =
      /(["'`].*?["'`]|\/\/.*$|#.*$|\b[a-zA-Z_$][a-zA-Z0-9_$]*\b|\d+(\.\d+)?|[{}()[\]]|[-+*/=><!&|%?:;,.]|[^\s\w])/g;
    let match;
    let lastIndex = 0;

    while ((match = chunkRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        tokens.push({ text: content.substring(lastIndex, match.index), className: '' });
      }

      const token = match[0];
      let cls = '';

      if (token.startsWith('"') || token.startsWith("'") || token.startsWith('`')) {
        cls = 'hl-string';
      } else if (token.startsWith('//') || token.startsWith('#')) {
        cls = 'hl-comment';
      } else if (controlKeywords.test(token)) {
        cls = 'hl-control';
      } else if (declarationKeywords.test(token)) {
        cls = 'hl-keyword';
      } else if (constants.test(token)) {
        cls = 'hl-constant';
      } else if (types.test(token)) {
        cls = 'hl-type';
      } else if (numbers.test(token)) {
        cls = 'hl-number';
      } else if (functions.test(token)) {
        cls = 'hl-function';
      } else if ('{[('.includes(token)) {
        bracketDepth++;
        cls = `hl-bracket-${((bracketDepth - 1) % 3) + 1}`;
      } else if ('}])'.includes(token)) {
        cls = `hl-bracket-${(Math.max(0, bracketDepth - 1) % 3) + 1}`;
        bracketDepth = Math.max(0, bracketDepth - 1);
      } else if ('+-*/=><!&|%?:'.includes(token)) {
        cls = 'hl-operator';
      } else if (';,.'.includes(token)) {
        cls = 'hl-punctuation';
      } else if (token.length > 0 && /^[a-zA-Z_$]/.test(token)) {
        cls = 'hl-variable';
      }

      tokens.push({ text: token, className: cls });
      lastIndex = chunkRegex.lastIndex;
    }

    if (lastIndex < content.length) {
      tokens.push({ text: content.substring(lastIndex), className: '' });
    }

    return {
      indentUnits,
      tokens: tokens.length > 0 ? tokens : [{ text: content, className: '' }]
    };
  });
}

interface CodeEditorProps {
  filePath?: string;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ filePath }) => {
  const {
    project,
    activeFilePath: storeActiveFilePath,
    activeFileContent: storeActiveFileContent,
    openTabs,
    setActiveFile,
    updateActiveFileContent,
    saveActiveFile,
    closeTab,
    targetEditorLine,
    setTargetEditorLine
  } = useWorkspaceStore();

  const currentFilePath = filePath || storeActiveFilePath;

  const [isSearching, setIsSearching] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [isEditingDirectly, setIsEditingDirectly] = useState(false);
  const [markdownViewMode, setMarkdownViewMode] = useState<'code' | 'preview'>('preview');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Determine active tab
  const activeTab = openTabs.find(
    (t) => t.filePath === currentFilePath || t.id === `file:${currentFilePath}`
  );

  // Ensure active tab / file is properly registered if filePath prop is provided
  useEffect(() => {
    if (filePath && filePath !== storeActiveFilePath && !storeActiveFilePath) {
      useWorkspaceStore.getState().openFileTab(filePath, activeTab?.content || '');
    }
  }, [filePath, storeActiveFilePath, activeTab]);
  const content =
    (currentFilePath === storeActiveFilePath ? storeActiveFileContent : null) ??
    activeTab?.content ??
    '';
  const lines = useMemo(() => content.split('\n'), [content]);

  // Language detection from extension
  const ext = (currentFilePath || '').split('.').pop()?.toLowerCase() || '';
  const isMarkdown = ext === 'md' || ext === 'mdx';

  const language =
    ['ts', 'tsx'].includes(ext)
      ? 'TypeScript'
      : ['js', 'jsx'].includes(ext)
      ? 'JavaScript'
      : ext === 'py'
      ? 'Python'
      : ext === 'rs'
      ? 'Rust'
      : ext === 'go'
      ? 'Go'
      : ext === 'json'
      ? 'JSON'
      : isMarkdown
      ? 'Markdown'
      : ext === 'css'
      ? 'CSS'
      : ext === 'scss'
      ? 'SCSS'
      : ext === 'html'
      ? 'HTML'
      : ext === 'c'
      ? 'C'
      : ext === 'cpp'
      ? 'C++'
      : ext === 'cs'
      ? 'C#'
      : ext === 'java'
      ? 'Java'
      : ext === 'php'
      ? 'PHP'
      : ext === 'rb'
      ? 'Ruby'
      : ext === 'swift'
      ? 'Swift'
      : ext === 'kt'
      ? 'Kotlin'
      : ext === 'dart'
      ? 'Dart'
      : ext === 'vue'
      ? 'Vue'
      : ext === 'svelte'
      ? 'Svelte'
      : ext === 'sql'
      ? 'SQL'
      : ext === 'sh' || ext === 'bash' || ext === 'zsh'
      ? 'Shell'
      : ext.toUpperCase() || 'Plain Text';

  const deviconName = useMemo(() => {
    switch (ext) {
      case 'tsx':
      case 'jsx':
        return 'react';
      case 'ts':
        return 'typescript';
      case 'js':
      case 'mjs':
      case 'cjs':
        return 'javascript';
      case 'py':
        return 'python';
      case 'rs':
        return 'rust';
      case 'go':
        return 'go';
      case 'c':
        return 'c';
      case 'cpp':
      case 'cc':
      case 'cxx':
        return 'cplusplus';
      case 'cs':
        return 'csharp';
      case 'java':
        return 'java';
      case 'php':
        return 'php';
      case 'rb':
        return 'ruby';
      case 'swift':
        return 'swift';
      case 'kt':
      case 'kts':
        return 'kotlin';
      case 'dart':
        return 'dart';
      case 'vue':
        return 'vuejs';
      case 'svelte':
        return 'svelte';
      case 'html':
      case 'htm':
        return 'html5';
      case 'css':
        return 'css3';
      case 'scss':
      case 'sass':
        return 'sass';
      case 'md':
      case 'mdx':
        return 'markdown';
      case 'sql':
        return 'postgresql';
      case 'json':
        return 'json';
      case 'yml':
      case 'yaml':
        return 'yaml';
      case 'graphql':
      case 'gql':
        return 'graphql';
      case 'sh':
      case 'bash':
      case 'zsh':
        return 'bash';
      case 'zig':
        return 'zig';
      case 'lua':
        return 'lua';
      case 'sqlite':
        return 'sqlite';
      default:
        return '';
    }
  }, [ext]);

  // Jump to target line when clicked from Outline
  useEffect(() => {
    if (targetEditorLine && scrollContainerRef.current) {
      const lineElement = document.getElementById(`editor-line-${targetEditorLine}`);
      if (lineElement) {
        lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setCursorPos({ line: targetEditorLine, col: 1 });
      setTargetEditorLine(null);
    }
  }, [targetEditorLine, setTargetEditorLine]);

  // Keyboard shortcut listener (Ctrl+S, Ctrl+F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveActiveFile();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearching((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveActiveFile]);

  // Tokenized highlighted lines with indentation data
  const highlightedLines = useMemo(() => {
    return highlightCode(content, language);
  }, [content, language]);

  // Find matches
  const searchMatches = useMemo(() => {
    if (!searchQuery || !content) return [];
    const matches: Array<{ line: number; ch: number }> = [];
    const q = searchQuery.toLowerCase();
    lines.forEach((line, lIdx) => {
      let idx = line.toLowerCase().indexOf(q);
      while (idx !== -1) {
        matches.push({ line: lIdx + 1, ch: idx });
        idx = line.toLowerCase().indexOf(q, idx + 1);
      }
    });
    return matches;
  }, [searchQuery, content, lines]);

  const handleNextMatch = () => {
    if (searchMatches.length === 0) return;
    const next = (currentMatchIndex + 1) % searchMatches.length;
    setCurrentMatchIndex(next);
    const target = searchMatches[next];
    const el = document.getElementById(`editor-line-${target.line}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handlePrevMatch = () => {
    if (searchMatches.length === 0) return;
    const prev = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIndex(prev);
    const target = searchMatches[prev];
    const el = document.getElementById(`editor-line-${target.line}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleReplace = () => {
    if (!searchQuery || searchMatches.length === 0) return;
    const match = searchMatches[currentMatchIndex];
    if (!match) return;
    const lineText = lines[match.line - 1];
    const replaced =
      lineText.substring(0, match.ch) +
      replaceQuery +
      lineText.substring(match.ch + searchQuery.length);
    const newLines = [...lines];
    newLines[match.line - 1] = replaced;
    updateActiveFileContent(newLines.join('\n'));
  };

  const handleReplaceAll = () => {
    if (!searchQuery) return;
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const replaced = content.replace(new RegExp(escaped, 'g'), replaceQuery);
    updateActiveFileContent(replaced);
  };

  // Breadcrumbs parsing
  const breadcrumbs = useMemo(() => {
    if (!currentFilePath || !project) return [];
    const normFile = currentFilePath.replace(/\\/g, '/');
    const normProj = project.path.replace(/\\/g, '/').replace(/\/$/, '');
    const rel = normFile.toLowerCase().startsWith(normProj.toLowerCase())
      ? normFile.slice(normProj.length).replace(/^\//, '')
      : normFile;
    const parts = rel.split('/').filter(Boolean);
    return [project.name, ...parts];
  }, [currentFilePath, project]);

  if (!currentFilePath) {
    return (
      <div className="h-full flex items-center justify-center text-foreground-muted text-xs select-none p-6 text-center">
        <div>
          <Code2 className="w-8 h-8 mx-auto text-foreground-muted mb-2" />
          <p className="font-medium text-foreground">No file open in editor</p>
          <p className="text-[11px] mt-1 text-foreground-secondary">
            Select a file from the Project Explorer to start editing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-transparent select-none overflow-hidden font-sans">
      {/* Breadcrumbs Bar & View Toggles */}
      <div className="h-8 border-b border-border bg-surface/30 backdrop-blur-glass px-3 flex items-center justify-between text-[11px] font-mono text-foreground-secondary flex-shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto truncate">
          {breadcrumbs.map((segment, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <ChevronRight className="w-3 h-3 text-foreground-muted flex-shrink-0" />}
              <span
                className={`truncate ${
                  idx === breadcrumbs.length - 1
                    ? 'text-foreground font-medium'
                    : 'hover:text-foreground cursor-pointer'
                }`}
              >
                {segment}
              </span>
            </React.Fragment>
          ))}
        </div>

        {/* Action icons & Markdown View Mode Switcher */}
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          {/* Notion Markdown Mode Toggle (Icon-only) */}
          {isMarkdown && (
            <div className="flex items-center rounded-md bg-white/[0.04] p-0.5 border border-white/[0.08]">
              <button
                onClick={() => setMarkdownViewMode('code')}
                className={`p-1 rounded transition-colors flex items-center justify-center cursor-pointer ${
                  markdownViewMode === 'code'
                    ? 'bg-white/[0.12] text-white shadow-xs'
                    : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                }`}
                title="Code view (Raw Markdown)"
                aria-label="Code view"
              >
                <Code2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setMarkdownViewMode('preview')}
                className={`p-1 rounded transition-colors flex items-center justify-center cursor-pointer ${
                  markdownViewMode === 'preview'
                    ? 'bg-white/[0.12] text-white shadow-xs'
                    : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                }`}
                title="Notion view (Rich document)"
                aria-label="Notion view"
              >
                <BookOpen className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {activeTab?.isDirty && (
            <button
              onClick={saveActiveFile}
              className="p-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors cursor-pointer"
              title="Save changes (Ctrl+S)"
              aria-label="Save changes"
            >
              <Save className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => setIsSearching(!isSearching)}
            className={`p-1 rounded text-foreground-muted hover:text-foreground transition-colors ${
              isSearching ? 'bg-surface-elevated text-foreground' : ''
            }`}
            title="Find & Replace (Ctrl+F)"
          >
            <Search className="w-3 h-3" />
          </button>

          <button
            onClick={() => setIsShareModalOpen(true)}
            className="p-1 rounded text-foreground-muted hover:text-foreground hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="Share Code Snippet (Raycast Card with Devicon Logo)"
          >
            <Share2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Find & Replace Drawer */}
      {isSearching && (
        <div className="p-2 border-b border-border bg-surface flex flex-wrap items-center gap-2 text-xs font-mono">
          <div className="flex items-center gap-1 bg-background border border-border rounded px-2 py-1">
            <Search className="w-3 h-3 text-foreground-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find..."
              className="bg-transparent border-none text-foreground text-xs focus:outline-none w-36"
              autoFocus
            />
            <span className="text-[10px] text-foreground-muted pl-1">
              {searchMatches.length > 0
                ? `${currentMatchIndex + 1}/${searchMatches.length}`
                : 'No results'}
            </span>
            <button
              onClick={handlePrevMatch}
              className="p-0.5 hover:text-foreground text-foreground-muted"
            >
              <ArrowUp className="w-3 h-3" />
            </button>
            <button
              onClick={handleNextMatch}
              className="p-0.5 hover:text-foreground text-foreground-muted"
            >
              <ArrowDown className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-center gap-1 bg-background border border-border rounded px-2 py-1">
            <input
              type="text"
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              placeholder="Replace with..."
              className="bg-transparent border-none text-foreground text-xs focus:outline-none w-36"
            />
            <button
              onClick={handleReplace}
              className="px-1.5 py-0.5 text-[10px] bg-surface-elevated hover:bg-surface-hover text-foreground rounded border border-border"
            >
              Replace
            </button>
            <button
              onClick={handleReplaceAll}
              className="px-1.5 py-0.5 text-[10px] bg-surface-elevated hover:bg-surface-hover text-foreground rounded border border-border"
            >
              All
            </button>
          </div>

          <button
            onClick={() => setIsSearching(false)}
            className="p-1 hover:text-foreground text-foreground-muted ml-auto"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Canvas: Notion Preview or Code Canvas */}
      {isMarkdown && markdownViewMode === 'preview' ? (
        <div className="flex-1 overflow-hidden min-h-0">
          <MarkdownPreview content={content} filePath={currentFilePath} />
        </div>
      ) : (
        <div className="flex-1 relative overflow-hidden flex bg-transparent font-mono text-xs">
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-auto p-2 select-text leading-relaxed font-mono"
          >
            <div className="flex min-w-full">
              {/* Line numbers gutter */}
              <div className="w-12 flex-shrink-0 select-none text-right pr-4 text-foreground-muted/40 font-mono text-[11px] leading-relaxed">
                {lines.map((_, idx) => (
                  <div
                    key={idx}
                    id={`editor-line-${idx + 1}`}
                    onClick={() => setCursorPos({ line: idx + 1, col: 1 })}
                    className={`cursor-pointer hover:text-foreground-secondary ${
                      cursorPos.line === idx + 1 ? 'text-foreground font-bold' : ''
                    }`}
                  >
                    {idx + 1}
                  </div>
                ))}
              </div>

              {/* Syntax highlighted code with VS Code vertical indentation guides */}
              <div
                className="flex-1 overflow-x-auto min-w-0 cursor-text min-h-[400px]"
                onClick={() => {
                  if (!isEditingDirectly) setIsEditingDirectly(true);
                }}
              >
                {isEditingDirectly ? (
                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => updateActiveFileContent(e.target.value, currentFilePath)}
                    onBlur={() => setIsEditingDirectly(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Tab') {
                        e.preventDefault();
                        const textarea = e.currentTarget;
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const val = textarea.value;
                        const updated = val.substring(0, start) + '  ' + val.substring(end);
                        updateActiveFileContent(updated, currentFilePath);
                        setTimeout(() => {
                          textarea.selectionStart = textarea.selectionEnd = start + 2;
                        }, 0);
                      }
                    }}
                    className="w-full h-full min-h-[500px] bg-transparent text-foreground font-mono text-xs leading-relaxed resize-none border-none outline-none whitespace-pre"
                    autoFocus
                  />
                ) : (
                  <div
                    className="w-full cursor-text space-y-0.5"
                    title="Click to edit file directly"
                  >
                    {highlightedLines.map((lineData, lIdx) => (
                      <div
                        key={lIdx}
                        className={`flex items-center leading-relaxed whitespace-pre hover:bg-white/[0.02] px-1 rounded transition-colors group/line ${
                          cursorPos.line === lIdx + 1 ? 'bg-white/[0.04]' : ''
                        }`}
                      >
                        {/* Indentation guide lines */}
                        {Array.from({ length: lineData.indentUnits }).map((_, gIdx) => (
                          <span
                            key={gIdx}
                            className={`inline-block w-4 h-4 flex-shrink-0 border-l select-none pointer-events-none ${
                              cursorPos.line === lIdx + 1
                                ? 'border-white/20'
                                : 'border-white/[0.08]'
                            }`}
                          />
                        ))}

                        {/* Tokens */}
                        <div className="flex-1">
                          {lineData.tokens.map((token, tIdx) => (
                            <span key={tIdx} className={token.className}>
                              {token.text}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Editor Status Footer */}
      <div className="h-6 border-t border-border bg-surface px-3 flex items-center justify-between text-[10px] font-mono text-foreground-secondary select-none flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                activeTab?.isDirty ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
            />
            <span>{activeTab?.isDirty ? 'Modified' : 'Saved'}</span>
          </span>
          <span>
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
          <span>{lines.length} lines</span>
        </div>

        <div className="flex items-center gap-3">
          <span>UTF-8</span>
          <span>Spaces: 2</span>
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            {deviconName && <Devicon name={deviconName} className="w-3.5 h-3.5 flex-shrink-0" />}
            <span>{language}</span>
          </span>
        </div>
      </div>

      {/* Share Code Modal with Devicon Language Logo */}
      <ShareCodeModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        fileName={
          currentFilePath ? currentFilePath.split(/[/\\]/).pop() || 'snippet' : 'snippet'
        }
        code={content}
        language={language}
      />
    </div>
  );
};

export default CodeEditor;
