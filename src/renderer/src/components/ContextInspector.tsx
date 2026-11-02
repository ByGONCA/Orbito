import React, { useEffect, useState } from 'react';
import {
  BrainCircuit,
  Search,
  Database,
  FileCode2,
  Cpu,
  Layers,
  Sparkles,
  RefreshCw,
  XCircle,
  CheckCircle2,
  Clock,
  Eye,
  Sliders,
  AlertCircle
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspace.store';
import type { SearchResult, ContextAssemblyResult } from '../../../shared/context';

export const ContextInspector: React.FC = () => {
  const { project, indexStats, setIndexStats, uiMode, setUiMode, activeFilePath, addLog } = useWorkspaceStore();

  const [isStartingIndex, setIsStartingIndex] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Context Assembly Tester State
  const [taskPrompt, setTaskPrompt] = useState('Analyze authentication logic and database schema');
  const [modelTarget, setModelTarget] = useState<'claude' | 'codex' | 'gemini'>('claude');
  const [tokenBudget, setTokenBudget] = useState(8000);
  const [isAssembling, setIsAssembling] = useState(false);
  const [assemblyResult, setAssemblyResult] = useState<ContextAssemblyResult | null>(null);

  // Load initial stats
  const refreshStats = async () => {
    if (!project?.path) return;
    try {
      const stats = await window.api.getIndexStats({ projectPath: project.path });
      setIndexStats(stats);
    } catch (err: any) {
      console.warn('Failed to fetch index stats:', err.message);
    }
  };

  useEffect(() => {
    refreshStats();

    // Listen to indexing progress & status events
    const unsubProgress = window.api.onIndexingProgress((prog) => {
      setIndexStats({
        ...(indexStats || {
          totalFiles: 0,
          totalSymbols: 0,
          totalChunks: 0,
          indexedLanguages: {},
          lastIndexedAt: Date.now(),
          isIndexing: true,
          isWatching: false
        }),
        isIndexing: true,
        indexingProgress: prog
      });
    });

    const unsubStatus = window.api.onIndexingStatus((status) => {
      refreshStats();
    });

    return () => {
      unsubProgress();
      unsubStatus();
    };
  }, [project?.path]);

  const handleStartIndexing = async (forceReindex = false) => {
    if (!project?.path) return;
    setIsStartingIndex(true);
    addLog(`Starting ${forceReindex ? 'full' : 'incremental'} project indexing...`, 'info');
    try {
      const stats = await window.api.startIndexing({ projectPath: project.path, forceReindex });
      setIndexStats(stats);
      addLog(`Indexing complete: ${stats.totalFiles} files, ${stats.totalSymbols} symbols.`, 'info');
    } catch (err: any) {
      addLog(`Indexing failed: ${err.message}`, 'error');
    } finally {
      setIsStartingIndex(false);
    }
  };

  const handleCancelIndexing = async () => {
    if (!project?.path) return;
    try {
      await window.api.cancelIndexing({ projectPath: project.path });
      addLog('Indexing cancellation requested.', 'warn');
    } catch (err: any) {
      addLog(`Cancel indexing error: ${err.message}`, 'error');
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project?.path || !searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await window.api.searchContext({
        projectPath: project.path,
        query: searchQuery,
        limit: 15
      });
      setSearchResults(results);
    } catch (err: any) {
      addLog(`Search error: ${err.message}`, 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAssemble = async () => {
    if (!project?.path || !taskPrompt.trim()) return;

    setIsAssembling(true);
    addLog(`Assembling context for: "${taskPrompt.substring(0, 40)}..."`, 'info');
    try {
      const res = await window.api.assembleContext({
        projectPath: project.path,
        taskDescription: taskPrompt,
        activeFilePath: activeFilePath || undefined,
        maxTokens: tokenBudget,
        modelTarget
      });
      setAssemblyResult(res);
      addLog(
        `Context assembled: ${res.fragments.length} fragments, ${res.actualTokens} actual tokens (Budget: ${res.tokenBudget}).`,
        'info'
      );
    } catch (err: any) {
      addLog(`Context assembly failed: ${err.message}`, 'error');
    } finally {
      setIsAssembling(false);
    }
  };

  const isAdv = uiMode === 'advanced';

  return (
    <div className="flex flex-col h-full bg-background p-6 overflow-auto select-none space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-primary" />
            <span>Context Intelligence Inspector</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Phase 3: Tree-sitter Code Intelligence, Incremental SQLite Indexing & Context Assembly.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Simple vs Advanced Toggle */}
          <div className="flex items-center bg-secondary border border-border rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setUiMode('simple')}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                !isAdv ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Simple
            </button>
            <button
              onClick={() => setUiMode('advanced')}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                isAdv ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Advanced
            </button>
          </div>

          {/* Action buttons */}
          {indexStats?.isIndexing ? (
            <button
              onClick={handleCancelIndexing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-500 text-xs font-medium hover:bg-red-500/20"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Cancel Indexing</span>
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => handleStartIndexing(false)}
                disabled={isStartingIndex || !project}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isStartingIndex ? 'animate-spin' : ''}`} />
                <span>Incremental Index</span>
              </button>
              {isAdv && (
                <button
                  onClick={() => handleStartIndexing(true)}
                  disabled={isStartingIndex || !project}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/40 bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Full Reindex</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar (when indexing) */}
      {indexStats?.isIndexing && indexStats.indexingProgress && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />
              <span>Indexing project files...</span>
            </span>
            <span className="font-mono text-muted-foreground">
              {indexStats.indexingProgress.current} / {indexStats.indexingProgress.total} (
              {Math.round((indexStats.indexingProgress.current / (indexStats.indexingProgress.total || 1)) * 100)}%)
            </span>
          </div>
          <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-150"
              style={{
                width: `${(indexStats.indexingProgress.current / (indexStats.indexingProgress.total || 1)) * 100}%`
              }}
            />
          </div>
          <p className="text-[11px] font-mono text-muted-foreground truncate">
            {indexStats.indexingProgress.currentFile}
          </p>
        </div>
      )}

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 space-y-1">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <FileCode2 className="w-3.5 h-3.5 text-blue-500" />
            <span>Indexed Files</span>
          </span>
          <p className="text-xl font-bold font-mono text-foreground">{indexStats?.totalFiles || 0}</p>
          <span className="text-[10px] text-muted-foreground">Incremental hashing</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-1">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-emerald-500" />
            <span>AST Symbols</span>
          </span>
          <p className="text-xl font-bold font-mono text-foreground">{indexStats?.totalSymbols || 0}</p>
          <span className="text-[10px] text-muted-foreground">Tree-sitter extracted</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-1">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-amber-500" />
            <span>FTS5 Chunks</span>
          </span>
          <p className="text-xl font-bold font-mono text-foreground">{indexStats?.totalChunks || 0}</p>
          <span className="text-[10px] text-muted-foreground">BM25 searchable</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-1">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-purple-500" />
            <span>Status</span>
          </span>
          <div className="flex items-center gap-1.5 pt-0.5">
            {indexStats?.isIndexing ? (
              <span className="text-xs font-semibold text-amber-500 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" /> Indexing
              </span>
            ) : indexStats?.isWatching ? (
              <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Watching
              </span>
            ) : (
              <span className="text-xs font-semibold text-muted-foreground">Idle</span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {indexStats?.lastIndexedAt
              ? `Last updated: ${new Date(indexStats.lastIndexedAt).toLocaleTimeString()}`
              : 'Never indexed'}
          </span>
        </div>
      </div>

      {/* Languages Breakdown */}
      {indexStats?.indexedLanguages && Object.keys(indexStats.indexedLanguages).length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <h3 className="text-xs font-semibold text-foreground">Detected Code Languages</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(indexStats.indexedLanguages).map(([lang, count]) => (
              <span
                key={lang}
                className="text-[11px] font-mono px-2 py-0.5 rounded-md border border-border bg-secondary text-foreground flex items-center gap-1.5"
              >
                <span className="font-medium capitalize">{lang}:</span>
                <span className="text-primary font-bold">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Section: Hybrid Search Tester */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Search className="w-4 h-4 text-primary" />
            <span>Hybrid Search Console (FTS5 + Symbols + Paths)</span>
          </h3>
          <span className="text-[10px] text-muted-foreground">BM25 content & AST symbol ranking</span>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search functions, classes, keywords (e.g. login, DatabaseService, execute)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-background border border-border rounded-lg text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="px-4 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-xs font-medium disabled:opacity-50 transition-colors"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {/* Search Results Table */}
        {searchResults.length > 0 && (
          <div className="border border-border/80 rounded-lg overflow-hidden divide-y divide-border/60">
            {searchResults.map((res, i) => (
              <div key={i} className="p-3 bg-card/60 hover:bg-secondary/40 space-y-1 text-xs">
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="text-primary font-semibold truncate max-w-[70%]">
                    {res.filePath}#L{res.startLine}-L{res.endLine}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] capitalize">
                      {res.matchType}
                    </span>
                    {isAdv && (
                      <span className="text-muted-foreground text-[10px]">Score: {res.score.toFixed(2)}</span>
                    )}
                  </div>
                </div>
                {res.symbolName && (
                  <p className="text-[11px] text-emerald-500 font-mono">Symbol: {res.symbolName}</p>
                )}
                <pre className="text-[11px] font-mono text-foreground/80 bg-background/80 p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-24">
                  {res.content.trim()}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section: Context Assembly Engine & Token Optimizer */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Context Assembly Engine & Token Optimization
            </h3>
          </div>
          <span className="text-[10px] text-muted-foreground">
            Model-aware budgeting, Live Disk Reads & Deduplication
          </span>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 space-y-1">
            <label className="text-xs text-muted-foreground">Task / User Query</label>
            <input
              type="text"
              value={taskPrompt}
              onChange={(e) => setTaskPrompt(e.target.value)}
              className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Target Model</label>
              <select
                value={modelTarget}
                onChange={(e: any) => setModelTarget(e.target.value)}
                className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs font-mono text-foreground focus:outline-none"
              >
                <option value="claude">Claude (200k)</option>
                <option value="codex">Codex (128k)</option>
                <option value="gemini">Gemini (1M)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Budget: {tokenBudget}</label>
              <input
                type="range"
                min="1000"
                max="32000"
                step="1000"
                value={tokenBudget}
                onChange={(e) => setTokenBudget(Number(e.target.value))}
                className="w-full mt-2"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleAssemble}
          disabled={isAssembling || !taskPrompt.trim() || !project}
          className="w-full py-2 bg-primary text-primary-foreground font-medium rounded-lg text-xs hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Sparkles className={`w-3.5 h-3.5 ${isAssembling ? 'animate-spin' : ''}`} />
          <span>{isAssembling ? 'Assembling Relevant Context...' : 'Assemble Context for AI Agent'}</span>
        </button>

        {/* Assembly Results & Token Meter */}
        {assemblyResult && (
          <div className="space-y-3 pt-2 border-t border-border/80">
            {/* Token Budget Meter */}
            <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-primary" />
                  <span>Context Token Meter (cl100k_base BPE)</span>
                </span>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="text-emerald-500 font-bold">
                    {assemblyResult.actualTokens} actual tokens
                  </span>
                  <span className="text-muted-foreground">/ {assemblyResult.tokenBudget} budget</span>
                  {isAdv && (
                    <span className="text-muted-foreground">
                      (Estimated: {assemblyResult.estimatedTokens})
                    </span>
                  )}
                  {assemblyResult.truncated && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 font-bold text-[10px]">
                      TRUNCATED
                    </span>
                  )}
                </div>
              </div>

              <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${
                    assemblyResult.actualTokens / assemblyResult.tokenBudget > 0.9
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      (assemblyResult.actualTokens / (assemblyResult.tokenBudget || 1)) * 100
                    )}%`
                  }}
                />
              </div>

              <div className="flex justify-between text-[11px] text-muted-foreground pt-0.5">
                <span>Fragments Included: {assemblyResult.fragments.length}</span>
                <span>Live Disk Reads: {assemblyResult.metrics.liveReadsCount}</span>
                {isAdv && (
                  <span>
                    Retrieval: {assemblyResult.metrics.searchTimeMs}ms • Assembly:{' '}
                    {assemblyResult.metrics.assemblyTimeMs}ms
                  </span>
                )}
              </div>
            </div>

            {/* Assembled Fragments Preview */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-foreground">Included Code Fragments:</h4>
              <div className="max-h-64 overflow-y-auto border border-border rounded-lg divide-y divide-border/60">
                {assemblyResult.fragments.map((f, idx) => (
                  <div key={idx} className="p-2.5 bg-card/40 text-xs space-y-1">
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-primary font-medium">
                        {f.filePath}#L{f.startLine}-L{f.endLine}
                      </span>
                      <div className="flex items-center gap-2">
                        {f.isLiveDiskRead && (
                          <span className="px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-500 text-[10px] font-bold">
                            Live Read
                          </span>
                        )}
                        <span className="text-muted-foreground text-[10px]">
                          {f.tokenCount} tokens
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground italic">{f.reason}</p>
                    {isAdv && (
                      <pre className="text-[10px] font-mono text-foreground/80 bg-background/80 p-1.5 rounded overflow-x-auto whitespace-pre-wrap max-h-20">
                        {f.content.trim()}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
