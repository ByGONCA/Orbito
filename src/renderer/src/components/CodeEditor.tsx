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
  Share2
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspace.store';
import { Devicon } from '../utils/devicon-svgs';
import { ShareCodeModal } from './ShareCodeModal';

// Fast regex tokenizer for code syntax highlighting
function highlightCode(code: string, language: string): Array<Array<{ text: string; className: string }>> {
  const lines = code.split('\n');

  // Regex patterns
  const keywords = /\b(const|let|var|function|return|import|export|from|default|class|extends|interface|type|enum|if|else|switch|case|break|continue|for|while|do|try|catch|finally|throw|async|await|new|this|super|typeof|instanceof|void|yield|null|undefined|true|false|def|class|lambda|in|is|and|or|not|elif|pass|raise|with|as)\b/g;
  const types = /\b(string|number|boolean|any|unknown|never|void|Promise|Record|Array|Set|Map|Object|Function|Int|Float|str|dict|list|tuple|bool|T|K|V)\b/g;
  const numbers = /\b(0x[0-9a-fA-F]+|\d+(\.\d+)?)\b/g;
  const strings = /(["'`])(?:(?=(\\?))\2.)*?\1/g;
  const comments = /(\/\/.*$|#.*$|\/\*[\s\S]*?\*\/)/gm;
  const functions = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)(?=\s*\()/g;

  return lines.map((line) => {
    if (!line) return [{ text: ' ', className: '' }];

    // Simple line comment check
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('#')) {
      return [{ text: line, className: 'hl-comment' }];
    }

    // Tokenize by spaces and symbols, preserving punctuation
    const tokens: Array<{ text: string; className: string }> = [];
    let remaining = line;

    // Pattern matching chunks
    const chunkRegex = /(["'`].*?["'`]|\/\/.*$|#.*$|\b[a-zA-Z_$][a-zA-Z0-9_$]*\b|\d+|[^\s\w])/g;
    let match;
    let lastIndex = 0;

    while ((match = chunkRegex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        tokens.push({ text: line.substring(lastIndex, match.index), className: '' });
      }

      const token = match[0];
      let cls = '';

      if (token.startsWith('"') || token.startsWith("'") || token.startsWith('`')) {
        cls = 'hl-string';
      } else if (token.startsWith('//') || token.startsWith('#')) {
        cls = 'hl-comment';
      } else if (token.match(keywords)) {
        cls = 'hl-keyword';
      } else if (token.match(types)) {
        cls = 'hl-type';
      } else if (token.match(numbers)) {
        cls = 'hl-number';
      } else if (token.match(functions)) {
        cls = 'hl-function';
      } else if ('{}[]();,.'.includes(token)) {
        cls = 'hl-punctuation';
      } else if ('+-*/=><!&|%?:'.includes(token)) {
        cls = 'hl-operator';
      }

      tokens.push({ text: token, className: cls });
      lastIndex = chunkRegex.lastIndex;
    }

    if (lastIndex < line.length) {
      tokens.push({ text: line.substring(lastIndex), className: '' });
    }

    return tokens.length > 0 ? tokens : [{ text: line, className: '' }];
  });
}

export const CodeEditor: React.FC = () => {
  const {
    project,
    activeFilePath,
    activeFileContent,
    openTabs,
    setActiveFile,
    updateActiveFileContent,
    saveActiveFile,
    closeTab,
    targetEditorLine,
    setTargetEditorLine
  } = useWorkspaceStore();

  const [isSearching, setIsSearching] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [isEditingDirectly, setIsEditingDirectly] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Determine active tab
  const activeTab = openTabs.find((t) => t.filePath === activeFilePath || t.id === `file:${activeFilePath}`);
  const content = activeFileContent ?? activeTab?.content ?? '';
  const lines = useMemo(() => content.split('\n'), [content]);

  // Language detection from extension
  const ext = (activeFilePath || '').split('.').pop()?.toLowerCase() || '';
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
      : ext === 'md'
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

  // Tokenized highlighted lines
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
    if (!activeFilePath || !project) return [];
    const rel = activeFilePath.replace(project.path, '').replace(/^[/\\]/, '');
    const parts = rel.split(/[/\\]/);
    return [project.name, ...parts];
  }, [activeFilePath, project]);

  if (!activeFilePath) {
    return (
      <div className="h-full flex items-center justify-center text-foreground-muted text-xs select-none p-6 text-center">
        <div>
          <Code2 className="w-8 h-8 mx-auto text-foreground-muted mb-2" />
          <p className="font-medium text-foreground">No file open in editor</p>
          <p className="text-[11px] mt-1 text-foreground-secondary">
            Select a file from the Project Explorer on the right to start editing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-transparent select-none overflow-hidden">
      {/* Breadcrumbs Bar (Positioned below the workspace tabs) */}
      <div className="h-7 border-b border-border bg-surface/30 backdrop-blur-glass px-3 flex items-center justify-between text-[11px] font-mono text-foreground-secondary">
        <div className="flex items-center gap-1 overflow-x-auto truncate">
          {breadcrumbs.map((segment, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <ChevronRight className="w-3 h-3 text-foreground-muted flex-shrink-0" />}
              <span
                className={`truncate ${
                  idx === breadcrumbs.length - 1 ? 'text-foreground font-medium' : 'hover:text-foreground cursor-pointer'
                }`}
              >
                {segment}
              </span>
            </React.Fragment>
          ))}
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {activeTab?.isDirty && (
            <button
              onClick={saveActiveFile}
              className="flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30 transition-colors"
              title="Save changes (Ctrl+S)"
            >
              <Save className="w-3 h-3" />
              <span>Save (Ctrl+S)</span>
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

      {/* 3. Find & Replace Drawer */}
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
              {searchMatches.length > 0 ? `${currentMatchIndex + 1}/${searchMatches.length}` : 'No results'}
            </span>
            <button onClick={handlePrevMatch} className="p-0.5 hover:text-foreground text-foreground-muted">
              <ArrowUp className="w-3 h-3" />
            </button>
            <button onClick={handleNextMatch} className="p-0.5 hover:text-foreground text-foreground-muted">
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

          <button onClick={() => setIsSearching(false)} className="p-1 hover:text-foreground text-foreground-muted ml-auto">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 4. Main Code Canvas & Line Numbers */}
      <div className="flex-1 relative overflow-hidden flex bg-transparent font-mono text-xs">
        {/* Real-time editable textarea toggle */}
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

            {/* Syntax highlighted code */}
            <div className="flex-1 overflow-x-auto min-w-0">
              {isEditingDirectly ? (
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => updateActiveFileContent(e.target.value)}
                  onBlur={() => setIsEditingDirectly(false)}
                  className="w-full h-full min-h-[500px] bg-transparent text-foreground font-mono text-xs leading-relaxed resize-none border-none outline-none whitespace-pre"
                  autoFocus
                />
              ) : (
                <div
                  onClick={() => setIsEditingDirectly(true)}
                  className="w-full cursor-text"
                  title="Click to edit file directly"
                >
                  {highlightedLines.map((tokens, lIdx) => (
                    <div
                      key={lIdx}
                      className={`whitespace-pre leading-relaxed hover:bg-surface-elevated/40 px-1 rounded ${
                        cursorPos.line === lIdx + 1 ? 'bg-surface-elevated/60' : ''
                      }`}
                    >
                      {tokens.map((token, tIdx) => (
                        <span key={tIdx} className={token.className}>
                          {token.text}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Editor Status Footer */}
      <div className="h-6 border-t border-border bg-surface px-3 flex items-center justify-between text-[10px] font-mono text-foreground-secondary select-none">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${activeTab?.isDirty ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            <span>{activeTab?.isDirty ? 'Modified' : 'Saved'}</span>
          </span>
          <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
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

      {/* 6. Share Code Modal with Devicon Language Logo */}
      <ShareCodeModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        fileName={activeFilePath ? activeFilePath.split(/[/\\]/).pop() || 'snippet' : 'snippet'}
        code={content}
        language={language}
      />
    </div>
  );
};
