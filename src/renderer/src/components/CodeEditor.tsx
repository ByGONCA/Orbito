import React, { useState, useEffect, useRef, useMemo, useTransition } from 'react';
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
  Eye,
  Layers,
  Cpu,
  Sparkles,
  Box,
  Package
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

export interface SuggestionItem {
  label: string;
  kind: 'function' | 'method' | 'variable' | 'class' | 'interface' | 'keyword' | 'property' | 'type' | 'module';
  detail?: string;
  documentation?: string;
  insertText?: string;
}

const JS_TS_KEYWORDS: SuggestionItem[] = [
  { label: 'const', kind: 'keyword', detail: 'keyword', documentation: 'Declares a block-scoped constant' },
  { label: 'let', kind: 'keyword', detail: 'keyword', documentation: 'Declares a block-scoped variable' },
  { label: 'function', kind: 'keyword', detail: 'keyword', documentation: 'Declares a function' },
  { label: 'return', kind: 'keyword', detail: 'keyword', documentation: 'Returns a value from a function' },
  { label: 'import', kind: 'keyword', detail: 'keyword', documentation: 'Imports bindings from a module' },
  { label: 'export', kind: 'keyword', detail: 'keyword', documentation: 'Exports bindings from a module' },
  { label: 'default', kind: 'keyword', detail: 'keyword', documentation: 'Specifies the default export' },
  { label: 'async', kind: 'keyword', detail: 'keyword', documentation: 'Declares an asynchronous function' },
  { label: 'await', kind: 'keyword', detail: 'keyword', documentation: 'Waits for a Promise to resolve' },
  { label: 'interface', kind: 'keyword', detail: 'keyword', documentation: 'Declares a TypeScript interface' },
  { label: 'type', kind: 'keyword', detail: 'keyword', documentation: 'Declares a TypeScript type alias' },
  { label: 'class', kind: 'keyword', detail: 'keyword', documentation: 'Declares a class' },
  { label: 'if', kind: 'keyword', detail: 'keyword', documentation: 'Conditionally executes statements' },
  { label: 'else', kind: 'keyword', detail: 'keyword', documentation: 'Executes if condition is false' },
  { label: 'for', kind: 'keyword', detail: 'keyword', documentation: 'Creates a loop' },
  { label: 'while', kind: 'keyword', detail: 'keyword', documentation: 'Executes while condition is true' },
  { label: 'try', kind: 'keyword', detail: 'keyword', documentation: 'Attempts to execute code that might throw' },
  { label: 'catch', kind: 'keyword', detail: 'keyword', documentation: 'Handles thrown errors' },
  { label: 'finally', kind: 'keyword', detail: 'keyword', documentation: 'Executes regardless of error' },
  { label: 'throw', kind: 'keyword', detail: 'keyword', documentation: 'Throws an exception' },
  { label: 'typeof', kind: 'keyword', detail: 'keyword', documentation: 'Returns the type of an operand' },
  { label: 'console.log', kind: 'function', detail: '(method) console.log(...data: any[]): void', documentation: 'Prints to standard output' },
  { label: 'console.error', kind: 'function', detail: '(method) console.error(...data: any[]): void', documentation: 'Prints error message to stderr' },
  { label: 'console.warn', kind: 'function', detail: '(method) console.warn(...data: any[]): void', documentation: 'Prints warning message to stderr' },
  { label: 'JSON.stringify', kind: 'function', detail: '(method) JSON.stringify(value, replacer?, space?): string', documentation: 'Converts value to JSON string' },
  { label: 'JSON.parse', kind: 'function', detail: '(method) JSON.parse(text: string): any', documentation: 'Parses JSON string' },
  { label: 'Promise', kind: 'class', detail: 'class Promise<T>', documentation: 'Represents the completion of an async operation' },
  { label: 'Array', kind: 'class', detail: 'interface Array<T>', documentation: 'JavaScript Array object' },
  { label: 'Record', kind: 'type', detail: 'type Record<K, T>', documentation: 'Constructs an object type with property keys K of type T' },
  { label: 'React', kind: 'module', detail: 'import React from "react"', documentation: 'React library root namespace' },
  { label: 'useState', kind: 'function', detail: 'function useState<S>(initialState): [S, Dispatch<SetStateAction<S>>]', documentation: 'React state hook' },
  { label: 'useEffect', kind: 'function', detail: 'function useEffect(effect, deps?): void', documentation: 'React side-effect hook' },
  { label: 'useMemo', kind: 'function', detail: 'function useMemo<T>(factory, deps): T', documentation: 'React memoization hook' },
  { label: 'useRef', kind: 'function', detail: 'function useRef<T>(initialValue): RefObject<T>', documentation: 'React mutable reference hook' },
  { label: 'useCallback', kind: 'function', detail: 'function useCallback<T>(callback, deps): T', documentation: 'React memoized callback hook' }
];

const MEMBER_SUGGESTIONS: SuggestionItem[] = [
  { label: 'length', kind: 'property', detail: '(property) length: number', documentation: 'Returns length of string or array' },
  { label: 'map', kind: 'method', detail: '(method) Array<T>.map<U>(callback): U[]', documentation: 'Calls a defined callback on each element and returns an array of results' },
  { label: 'filter', kind: 'method', detail: '(method) Array<T>.filter(predicate): T[]', documentation: 'Returns elements of array that meet condition' },
  { label: 'reduce', kind: 'method', detail: '(method) Array<T>.reduce(callback, initialValue?): any', documentation: 'Calls callback on all elements, accumulating a single result' },
  { label: 'forEach', kind: 'method', detail: '(method) Array<T>.forEach(callback): void', documentation: 'Performs action for each element' },
  { label: 'find', kind: 'method', detail: '(method) Array<T>.find(predicate): T | undefined', documentation: 'Returns value of first element satisfying condition' },
  { label: 'findIndex', kind: 'method', detail: '(method) Array<T>.findIndex(predicate): number', documentation: 'Returns index of first element satisfying condition' },
  { label: 'includes', kind: 'method', detail: '(method) includes(searchElement): boolean', documentation: 'Determines whether array or string includes element' },
  { label: 'indexOf', kind: 'method', detail: '(method) indexOf(searchElement): number', documentation: 'Returns index of first occurrence' },
  { label: 'slice', kind: 'method', detail: '(method) slice(start?, end?): any', documentation: 'Returns a section of an array or string' },
  { label: 'splice', kind: 'method', detail: '(method) Array<T>.splice(start, deleteCount, ...items): T[]', documentation: 'Removes and/or inserts elements' },
  { label: 'push', kind: 'method', detail: '(method) Array<T>.push(...items: T[]): number', documentation: 'Appends elements to the end of an array' },
  { label: 'pop', kind: 'method', detail: '(method) Array<T>.pop(): T | undefined', documentation: 'Removes last element and returns it' },
  { label: 'split', kind: 'method', detail: '(method) String.split(separator, limit?): string[]', documentation: 'Splits string into substrings using specified separator' },
  { label: 'join', kind: 'method', detail: '(method) Array<T>.join(separator?): string', documentation: 'Joins all elements of an array into a string' },
  { label: 'toLowerCase', kind: 'method', detail: '(method) String.toLowerCase(): string', documentation: 'Converts string to lowercase' },
  { label: 'toUpperCase', kind: 'method', detail: '(method) String.toUpperCase(): string', documentation: 'Converts string to uppercase' },
  { label: 'trim', kind: 'method', detail: '(method) String.trim(): string', documentation: 'Removes leading and trailing whitespace' },
  { label: 'startsWith', kind: 'method', detail: '(method) String.startsWith(searchString): boolean', documentation: 'Checks if string begins with characters' },
  { label: 'endsWith', kind: 'method', detail: '(method) String.endsWith(searchString): boolean', documentation: 'Checks if string ends with characters' },
  { label: 'replace', kind: 'method', detail: '(method) String.replace(searchValue, replaceValue): string', documentation: 'Replaces matches with replacement string' },
  { label: 'replaceAll', kind: 'method', detail: '(method) String.replaceAll(searchValue, replaceValue): string', documentation: 'Replaces all occurrences with replacement' },
  { label: 'then', kind: 'method', detail: '(method) Promise<T>.then(onfulfilled?, onrejected?): Promise', documentation: 'Attaches callbacks for resolution/rejection of Promise' },
  { label: 'catch', kind: 'method', detail: '(method) Promise<T>.catch(onrejected?): Promise', documentation: 'Attaches callback for rejection of Promise' },
  { label: 'toString', kind: 'method', detail: '(method) Object.toString(): string', documentation: 'Returns string representation' }
];

const PYTHON_KEYWORDS: SuggestionItem[] = [
  { label: 'def', kind: 'keyword', detail: 'keyword', documentation: 'Defines a function' },
  { label: 'class', kind: 'keyword', detail: 'keyword', documentation: 'Defines a class' },
  { label: 'import', kind: 'keyword', detail: 'keyword', documentation: 'Imports a module' },
  { label: 'from', kind: 'keyword', detail: 'keyword', documentation: 'Imports specific members from a module' },
  { label: 'return', kind: 'keyword', detail: 'keyword', documentation: 'Returns a value from a function' },
  { label: 'if', kind: 'keyword', detail: 'keyword', documentation: 'Conditional check' },
  { label: 'elif', kind: 'keyword', detail: 'keyword', documentation: 'Else-if condition' },
  { label: 'else', kind: 'keyword', detail: 'keyword', documentation: 'Else block' },
  { label: 'for', kind: 'keyword', detail: 'keyword', documentation: 'For loop' },
  { label: 'while', kind: 'keyword', detail: 'keyword', documentation: 'While loop' },
  { label: 'try', kind: 'keyword', detail: 'keyword', documentation: 'Exception handling block' },
  { label: 'except', kind: 'keyword', detail: 'keyword', documentation: 'Catches exceptions' },
  { label: 'finally', kind: 'keyword', detail: 'keyword', documentation: 'Always executes cleanup' },
  { label: 'print', kind: 'function', detail: 'print(*values, sep=" ", end="\\n")', documentation: 'Prints to stdout' },
  { label: 'len', kind: 'function', detail: 'len(obj) -> int', documentation: 'Returns length of an object' },
  { label: 'range', kind: 'function', detail: 'range(stop) or range(start, stop[, step])', documentation: 'Generates sequence of numbers' }
];

function extractLocalSymbols(text: string): SuggestionItem[] {
  const symbols: SuggestionItem[] = [];
  const seen = new Set<string>();

  // Function matches
  const fnMatches = text.matchAll(/(?:function|def)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s*)?\(/g);
  for (const m of fnMatches) {
    const name = m[1] || m[2];
    if (name && !seen.has(name)) {
      seen.add(name);
      symbols.push({ label: name, kind: 'function', detail: `function ${name}()`, documentation: 'Local function in file' });
    }
  }

  // Variable matches
  const varMatches = text.matchAll(/(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g);
  for (const m of varMatches) {
    const name = m[1];
    if (name && !seen.has(name)) {
      seen.add(name);
      symbols.push({ label: name, kind: 'variable', detail: `local ${name}`, documentation: 'Local variable in file' });
    }
  }

  // Type & Class matches
  const typeMatches = text.matchAll(/(?:class|interface|type)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g);
  for (const m of typeMatches) {
    const name = m[1];
    if (name && !seen.has(name)) {
      seen.add(name);
      symbols.push({ label: name, kind: 'interface', detail: `type ${name}`, documentation: 'Local type or class in file' });
    }
  }

  return symbols;
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

    // Leading indentation calculation
    const leadingMatch = line.match(/^(\s+)/);
    const leadingWhitespace = leadingMatch ? leadingMatch[1].replace(/\t/g, '  ') : '';
    const indentUnits = Math.floor(leadingWhitespace.length / 2);
    const remainder = leadingWhitespace.length % 2;
    const content = line.slice(leadingMatch ? leadingMatch[1].length : 0);

    const tokens: LineToken[] = [];

    // Indentation guide tokens (each unit is 2 spaces with a left guide line)
    for (let i = 0; i < indentUnits; i++) {
      tokens.push({ text: '  ', className: 'indent-guide-unit' });
    }
    if (remainder > 0) {
      tokens.push({ text: ' '.repeat(remainder), className: '' });
    }

    // Full line comment
    if (content.startsWith('//') || content.startsWith('#')) {
      tokens.push({ text: content, className: 'hl-comment' });
      return { indentUnits, tokens };
    }

    const chunkRegex =
      /(["'`].*?["'`]|\/\/.*$|#.*$|\b[a-zA-Z_$][a-zA-Z0-9_$]*\b|\d+(\.\d+)?|[{}()[\]]|[-+*/=><!&|%?:;,.]|[^\s\w]|\s+)/g;
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
      tokens: tokens.length > 0 ? tokens : [{ text: content || ' ', className: '' }]
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
  const [markdownViewMode, setMarkdownViewMode] = useState<'code' | 'preview'>('preview');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightLayerRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

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

  // Local buffer for instant, 0-latency typing and deleting
  const [localContent, setLocalContent] = useState(content);
  const localContentRef = useRef(content);
  localContentRef.current = localContent;
  const pendingSyncRef = useRef<NodeJS.Timeout | null>(null);

  // Sync local buffer when switching active file or tab, and flush pending changes on unmount/switch
  useEffect(() => {
    setLocalContent(content);
    localContentRef.current = content;
    return () => {
      if (pendingSyncRef.current) {
        clearTimeout(pendingSyncRef.current);
        pendingSyncRef.current = null;
        updateActiveFileContent(localContentRef.current, currentFilePath || undefined);
      }
    };
  }, [currentFilePath, content]);

  // Flush pending changes on window close or beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      flushSync();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      flushSync();
    };
  }, []);

  const flushSync = () => {
    if (pendingSyncRef.current) {
      clearTimeout(pendingSyncRef.current);
      pendingSyncRef.current = null;
    }
    updateActiveFileContent(localContentRef.current, currentFilePath || undefined);
  };

  const handleContentChange = (newVal: string) => {
    setLocalContent(newVal);
    localContentRef.current = newVal;

    if (pendingSyncRef.current) clearTimeout(pendingSyncRef.current);
    pendingSyncRef.current = setTimeout(() => {
      updateActiveFileContent(newVal, currentFilePath || undefined);
    }, 300);

    if (textareaRef.current) {
      triggerIntelliSense(newVal, textareaRef.current.selectionStart);
    }
  };

  const lines = useMemo(() => localContent.split('\n'), [localContent]);

  // IntelliSense autocompletion state
  const [intellisenseOpen, setIntellisenseOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState(0);
  const [suggestionCoords, setSuggestionCoords] = useState({ top: 30, left: 50 });

  const triggerIntelliSense = (text: string, cursorIndex: number) => {
    if (!text || cursorIndex <= 0) {
      setIntellisenseOpen(false);
      return;
    }

    const textBefore = text.slice(0, cursorIndex);
    const lastLine = textBefore.split('\n').pop() || '';

    const dotMatch = lastLine.match(/\.([a-zA-Z_$][a-zA-Z0-9_$]*)?$/);
    const wordMatch = lastLine.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)$/);

    let items: SuggestionItem[] = [];

    if (dotMatch) {
      const prefix = (dotMatch[1] || '').toLowerCase();
      items = MEMBER_SUGGESTIONS.filter((s) => s.label.toLowerCase().startsWith(prefix));
    } else if (wordMatch && wordMatch[1].length >= 1) {
      const prefix = wordMatch[1].toLowerCase();
      const baseList = language === 'Python' ? PYTHON_KEYWORDS : JS_TS_KEYWORDS;
      const localSymbols = extractLocalSymbols(text);
      const combined = [...baseList, ...localSymbols];

      const seen = new Set<string>();
      items = combined.filter((s) => {
        if (!s.label.toLowerCase().startsWith(prefix)) return false;
        if (seen.has(s.label)) return false;
        seen.add(s.label);
        return true;
      });
    }

    if (items.length > 0) {
      setSuggestions(items.slice(0, 15));
      setSelectedSuggestionIdx(0);

      const lineNum = textBefore.split('\n').length;
      const colNum = lastLine.length;
      const topPos = Math.max(26, lineNum * 22 + 4);
      const leftPos = Math.max(48, 44 + colNum * 7.4);
      setSuggestionCoords({ top: topPos, left: leftPos });
      setIntellisenseOpen(true);
    } else {
      setIntellisenseOpen(false);
    }
  };

  const handleAcceptSuggestion = (item: SuggestionItem) => {
    if (!textareaRef.current) return;
    const ta = textareaRef.current;
    const cursor = ta.selectionStart;
    const val = ta.value;

    const textBefore = val.slice(0, cursor);
    const wordMatch = textBefore.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)$/);
    const dotMatch = textBefore.match(/\.([a-zA-Z_$][a-zA-Z0-9_$]*)?$/);

    let replaceStart = cursor;
    if (dotMatch && dotMatch[1]) {
      replaceStart = cursor - dotMatch[1].length;
    } else if (wordMatch) {
      replaceStart = cursor - wordMatch[1].length;
    }

    const insertText = item.insertText || item.label;
    const updated = val.slice(0, replaceStart) + insertText + val.slice(cursor);
    handleContentChange(updated);
    setIntellisenseOpen(false);

    setTimeout(() => {
      ta.focus();
      const newCursor = replaceStart + insertText.length;
      ta.selectionStart = ta.selectionEnd = newCursor;
      updateCursorFromTextarea(ta);
    }, 0);
  };

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

  const updateCursorFromTextarea = (ta: HTMLTextAreaElement) => {
    const textBefore = ta.value.substring(0, ta.selectionStart);
    const linesBefore = textBefore.split('\n');
    const line = linesBefore.length;
    const col = linesBefore[linesBefore.length - 1].length + 1;
    setCursorPos({ line, col });
  };

  const handleLineClick = (lineNum: number) => {
    if (!textareaRef.current) return;
    const lineIdx = lineNum - 1;
    const charIndex = lines.slice(0, lineIdx).join('\n').length + (lineIdx > 0 ? 1 : 0);
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(charIndex, charIndex);
    setCursorPos({ line: lineNum, col: 1 });
  };

  // Jump to target line when clicked from Outline
  useEffect(() => {
    if (targetEditorLine && textareaRef.current) {
      const lineIdx = targetEditorLine - 1;
      const targetTop = lineIdx * 22;
      textareaRef.current.scrollTo({ top: Math.max(0, targetTop - 100), behavior: 'smooth' });
      const charIndex = lines.slice(0, lineIdx).join('\n').length + (lineIdx > 0 ? 1 : 0);
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(charIndex, charIndex);
      setCursorPos({ line: targetEditorLine, col: 1 });
      setTargetEditorLine(null);
    }
  }, [targetEditorLine, setTargetEditorLine, lines]);

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

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // IntelliSense keyboard navigation
    if (intellisenseOpen && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIdx((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleAcceptSuggestion(suggestions[selectedSuggestionIdx]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setIntellisenseOpen(false);
        return;
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      flushSync();
      saveActiveFile();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      setIsSearching(true);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      if (e.shiftKey) {
        // Outdent
        const lineStart = val.lastIndexOf('\n', start - 1) + 1;
        if (val.substring(lineStart, lineStart + 2) === '  ') {
          const updated = val.substring(0, lineStart) + val.substring(lineStart + 2);
          handleContentChange(updated);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, start - 2);
            updateCursorFromTextarea(textarea);
          }, 0);
        } else if (val[lineStart] === ' ') {
          const updated = val.substring(0, lineStart) + val.substring(lineStart + 1);
          handleContentChange(updated);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, start - 1);
            updateCursorFromTextarea(textarea);
          }, 0);
        }
      } else {
        // Indent 2 spaces
        const updated = val.substring(0, start) + '  ' + val.substring(end);
        handleContentChange(updated);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
          updateCursorFromTextarea(textarea);
        }, 0);
      }
    }
  };

  // Tokenized highlighted lines with indentation data (computed from localContent)
  const highlightedLines = useMemo(() => {
    return highlightCode(localContent, language);
  }, [localContent, language]);

  // Find matches
  const searchMatches = useMemo(() => {
    if (!searchQuery || !localContent) return [];
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
  }, [searchQuery, localContent, lines]);

  const handleNextMatch = () => {
    if (searchMatches.length === 0) return;
    const next = (currentMatchIndex + 1) % searchMatches.length;
    setCurrentMatchIndex(next);
    const target = searchMatches[next];
    if (textareaRef.current) {
      const top = (target.line - 1) * 22;
      textareaRef.current.scrollTo({ top: Math.max(0, top - 100), behavior: 'smooth' });
      const lineIdx = target.line - 1;
      const charIndex = lines.slice(0, lineIdx).join('\n').length + (lineIdx > 0 ? 1 : 0) + target.ch;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(charIndex, charIndex + searchQuery.length);
      setCursorPos({ line: target.line, col: target.ch + 1 });
    }
  };

  const handlePrevMatch = () => {
    if (searchMatches.length === 0) return;
    const prev = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIndex(prev);
    const target = searchMatches[prev];
    if (textareaRef.current) {
      const top = (target.line - 1) * 22;
      textareaRef.current.scrollTo({ top: Math.max(0, top - 100), behavior: 'smooth' });
      const lineIdx = target.line - 1;
      const charIndex = lines.slice(0, lineIdx).join('\n').length + (lineIdx > 0 ? 1 : 0) + target.ch;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(charIndex, charIndex + searchQuery.length);
      setCursorPos({ line: target.line, col: target.ch + 1 });
    }
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
    <div className="flex flex-col h-full bg-transparent select-none overflow-hidden font-sans glass-workspace-surface">
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
        <div className="flex-1 relative overflow-hidden flex bg-transparent font-mono text-xs select-text">
          {/* Line numbers gutter: subtle grey, zero border, compact padding */}
          <div
            ref={gutterRef}
            className="w-10 flex-shrink-0 overflow-hidden select-none text-right pr-2 text-zinc-500/70 font-mono text-xs leading-[22px] py-2 z-20 pointer-events-none"
          >
            {lines.map((_, idx) => (
              <div
                key={idx}
                id={`editor-line-${idx + 1}`}
                onClick={() => handleLineClick(idx + 1)}
                className={`h-[22px] cursor-pointer hover:text-zinc-400 pointer-events-auto transition-colors ${
                  cursorPos.line === idx + 1 ? 'text-zinc-300 font-medium' : ''
                }`}
              >
                {idx + 1}
              </div>
            ))}
          </div>

          {/* Dual-layer Synchronized Canvas */}
          <div className="relative flex-1 h-full min-w-0 overflow-hidden">
            {/* Background Layer: Real-time Syntax Highlighted Tokens + Indentation Guides */}
            <div
              ref={highlightLayerRef}
              className="absolute inset-0 overflow-hidden font-mono text-xs leading-[22px] px-3 py-2 whitespace-pre pointer-events-none select-none"
              aria-hidden="true"
            >
              {highlightedLines.map((lineData, lIdx) => (
                <div
                  key={lIdx}
                  className={`h-[22px] ${
                    cursorPos.line === lIdx + 1 ? 'bg-white/[0.035] -mx-3 px-3' : ''
                  }`}
                >
                  {lineData.tokens.map((token, tIdx) => (
                    <span key={tIdx} className={token.className}>
                      {token.text}
                    </span>
                  ))}
                </div>
              ))}
            </div>

            {/* Foreground Layer: Interactive Textarea with transparent text, visible caret & selection */}
            <textarea
              ref={textareaRef}
              value={localContent}
              onChange={(e) => handleContentChange(e.target.value)}
              onBlur={flushSync}
              onScroll={(e) => {
                const top = e.currentTarget.scrollTop;
                const left = e.currentTarget.scrollLeft;
                if (highlightLayerRef.current) {
                  highlightLayerRef.current.scrollTop = top;
                  highlightLayerRef.current.scrollLeft = left;
                }
                if (gutterRef.current) {
                  gutterRef.current.scrollTop = top;
                }
              }}
              onSelect={(e) => {
                updateCursorFromTextarea(e.currentTarget);
                triggerIntelliSense(e.currentTarget.value, e.currentTarget.selectionStart);
              }}
              onKeyUp={(e) => updateCursorFromTextarea(e.currentTarget)}
              onClick={(e) => {
                updateCursorFromTextarea(e.currentTarget);
                setIntellisenseOpen(false);
              }}
              onKeyDown={handleEditorKeyDown}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              className="absolute inset-0 w-full h-full overflow-auto font-mono text-xs leading-[22px] px-3 py-2 whitespace-pre bg-transparent text-transparent caret-white selection:bg-blue-500/35 resize-none border-none outline-none z-10"
            />

            {/* IntelliSense Suggestion Popup */}
            {intellisenseOpen && suggestions.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: `${Math.min(suggestionCoords.top, 380)}px`,
                  left: `${Math.min(suggestionCoords.left, 450)}px`
                }}
                className="w-72 max-h-56 bg-[#16171A] border border-white/[0.14] rounded-xl shadow-2xl overflow-hidden flex flex-col z-30 text-xs text-[#ECEDEF] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-75 select-none font-sans"
              >
                <div className="overflow-y-auto max-h-44 py-1 divide-y divide-white/[0.04]">
                  {suggestions.map((item, idx) => (
                    <div
                      key={idx}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleAcceptSuggestion(item);
                      }}
                      className={`flex items-center justify-between px-2.5 py-1.5 cursor-pointer transition-colors ${
                        idx === selectedSuggestionIdx
                          ? 'bg-blue-600/30 text-white font-medium border-l-2 border-blue-400'
                          : 'hover:bg-white/[0.06] text-neutral-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {item.kind === 'function' || item.kind === 'method' ? (
                          <Code2 className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                        ) : item.kind === 'variable' || item.kind === 'property' ? (
                          <Layers className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                        ) : item.kind === 'class' || item.kind === 'interface' || item.kind === 'type' ? (
                          <Cpu className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        ) : item.kind === 'module' ? (
                          <Package className="w-3.5 h-3.5 text-amber-300 flex-shrink-0" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        )}
                        <span className="truncate font-mono text-[11px]">{item.label}</span>
                      </div>
                      <span className="text-[10px] text-neutral-500 font-mono flex-shrink-0 ml-1">
                        {item.detail || item.kind}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Selected item documentation footer */}
                {suggestions[selectedSuggestionIdx]?.documentation && (
                  <div className="p-2 bg-black/40 border-t border-white/[0.08] text-[10px] text-neutral-400 leading-snug">
                    <span className="text-white font-mono block mb-0.5 truncate">
                      {suggestions[selectedSuggestionIdx].detail || suggestions[selectedSuggestionIdx].label}
                    </span>
                    <p className="line-clamp-2">{suggestions[selectedSuggestionIdx].documentation}</p>
                  </div>
                )}
              </div>
            )}
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
