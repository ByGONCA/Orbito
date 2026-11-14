import React, { useState, useEffect } from 'react';
import {
  Brain,
  RotateCw,
  Copy,
  Check,
  Layers,
  Cpu,
  ShieldCheck,
  GitBranch,
  BookOpen,
  FolderTree,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  Plus
} from 'lucide-react';
import type {
  ProjectIntelligenceData,
  KnowledgeCategory
} from '../../../shared/project-intelligence';

export const ProjectIntelligenceView: React.FC<{ projectPath?: string }> = ({ projectPath }) => {
  const [intel, setIntel] = useState<ProjectIntelligenceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'architecture' | 'knowledge' | 'health' | 'git'>('overview');
  const [copied, setCopied] = useState(false);
  const [knowledgeFilter, setKnowledgeFilter] = useState<KnowledgeCategory | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<KnowledgeCategory>('convention');

  const loadIntelligence = async (force = false) => {
    setIsLoading(true);
    try {
      // In renderer, window.api exposes inspectProject / analyzeProject
      const pathTarget = projectPath || '';
      const data = force
        ? await window.api.analyzeProject({ projectPath: pathTarget, forceRefresh: true })
        : await window.api.inspectProject({ projectPath: pathTarget });
      setIntel(data);
    } catch (err) {
      console.error('Failed to load project intelligence:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadIntelligence();
    const unsubscribe = window.api.onProjectIntelligenceChange?.((data) => {
      setIntel(data);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [projectPath]);

  const handleCopySummary = () => {
    if (!intel) return;
    const text = `Orbito Project Intelligence:
Path: ${intel.projectPath}
Architecture: ${intel.architecture.style} (${intel.architecture.modules.length} modules)
Tech Stack: ${intel.techStack.languages.map((l) => `${l.name} (${l.percentage}%)`).join(', ')}
Frameworks: ${intel.techStack.frameworks.join(', ') || 'None'}
Health Score: ${intel.health.overallScore}/100
Git: ${intel.git.branch} @ ${intel.git.headCommit} (${intel.git.isDirty ? 'Dirty' : 'Clean'})`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intel || !newKey || !newTitle || !newContent) return;

    try {
      await window.api.upsertKnowledgeEntry({
        projectId: intel.projectId,
        category: newCategory,
        key: newKey.trim(),
        title: newTitle.trim(),
        content: newContent.trim(),
        source: 'user_decision',
        confidence: 1.0,
        isConfirmed: true
      });
      setShowAddModal(false);
      setNewKey('');
      setNewTitle('');
      setNewContent('');
      loadIntelligence(true);
    } catch (err) {
      console.error('Failed to add knowledge entry:', err);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <div className="flex flex-col h-full bg-[#121316] text-[#ECEDEF] p-6 space-y-6 overflow-y-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-white/[0.04] text-indigo-400">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-[#ECEDEF]">Project Intelligence</h1>
            <p className="text-xs text-foreground-muted truncate max-w-xl font-mono">
              {intel?.projectPath || 'Analyzing current workspace repository...'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopySummary}
            className="p-2 text-foreground-muted hover:text-white bg-white/[0.02] hover:bg-white/[0.05] rounded-lg transition-colors border-0"
            title="Copy Intelligence Summary"
            aria-label="Copy Intelligence Summary"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => loadIntelligence(true)}
            disabled={isLoading}
            className="p-2 text-foreground-muted hover:text-white bg-white/[0.02] hover:bg-white/[0.05] rounded-lg transition-colors border-0 disabled:opacity-40"
            title="Re-run Full Project Analysis"
            aria-label="Re-run Full Project Analysis"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 py-1">
        <div className="space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-foreground-muted">Architecture</div>
          <div className="text-xl font-bold capitalize text-[#ECEDEF] tracking-tight">
            {intel?.architecture.style || 'Detecting...'}
          </div>
          <div className="text-[11px] font-mono text-zinc-500">
            {intel?.architecture.modules.length || 0} module(s)
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-foreground-muted">Health Score</div>
          <div className={`text-xl font-bold tracking-tight ${getScoreColor(intel?.health.overallScore ?? 100)}`}>
            {intel?.health.overallScore ?? '—'}/100
          </div>
          <div className="text-[11px] font-mono text-zinc-500">
            {intel?.health.findings.length || 0} finding(s)
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-foreground-muted">Primary Language</div>
          <div className="text-xl font-bold text-[#ECEDEF] tracking-tight">
            {intel?.techStack.languages[0]?.name || 'N/A'}
          </div>
          <div className="text-[11px] font-mono text-zinc-500">
            {intel?.techStack.languages[0]?.percentage || 0}% of codebase
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-foreground-muted">Git State</div>
          <div className="text-xl font-bold text-[#ECEDEF] tracking-tight truncate max-w-[140px]">
            {intel?.git.branch || 'None'}
          </div>
          <div className="text-[11px] font-mono text-zinc-500">
            {intel?.git.isDirty ? `${intel.git.modifiedFiles.length} modified` : 'clean tree'}
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-foreground-muted">Monorepo</div>
          <div className="text-xl font-bold text-[#ECEDEF] tracking-tight">
            {intel?.monorepo.isMonorepo ? 'Yes' : 'No'}
          </div>
          <div className="text-[11px] font-mono text-zinc-500 capitalize">
            {intel?.monorepo.type || 'Single Package'}
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1 bg-white/[0.02] p-1 rounded-xl w-fit">
        {[
          { id: 'overview', label: 'Tech Stack', icon: Cpu },
          { id: 'architecture', label: 'Architecture', icon: Layers },
          { id: 'knowledge', label: 'Knowledge Base', icon: BookOpen },
          { id: 'health', label: 'Health & Risks', icon: ShieldCheck },
          { id: 'git', label: 'Git & Worktrees', icon: GitBranch }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border-0 ${
                isActive
                  ? 'bg-white/[0.08] text-white shadow-sm'
                  : 'text-foreground-muted hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Tech Stack & Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h2 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" />
              Programming Languages
            </h2>
            <div className="space-y-2.5">
              {(intel?.techStack.languages || []).map((lang) => (
                <div key={lang.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#ECEDEF]">{lang.name}</span>
                    <span className="text-foreground-muted">{lang.fileCount} files ({lang.percentage}%)</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${lang.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
              {(!intel?.techStack.languages || intel.techStack.languages.length === 0) && (
                <div className="text-xs text-foreground-muted py-4">No code files detected.</div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              Frameworks & Libraries
            </h2>
            <div className="space-y-3 text-xs">
              <div>
                <div className="text-foreground-muted text-[11px] uppercase tracking-wider mb-1.5">Frameworks</div>
                <div className="flex flex-wrap gap-1.5">
                  {(intel?.techStack.frameworks || []).map((f) => (
                    <span key={f} className="px-2.5 py-1 bg-white/[0.04] text-zinc-300 rounded-md font-mono text-[11px]">
                      {f}
                    </span>
                  ))}
                  {intel?.techStack.frameworks.length === 0 && <span className="text-foreground-muted">None detected</span>}
                </div>
              </div>

              <div>
                <div className="text-foreground-muted text-[11px] uppercase tracking-wider mb-1.5">Build & Test</div>
                <div className="flex flex-wrap gap-1.5">
                  {(intel?.techStack.buildSystems || []).map((b) => (
                    <span key={b} className="px-2.5 py-1 bg-white/[0.04] text-zinc-300 rounded-md font-mono text-[11px]">
                      {b}
                    </span>
                  ))}
                  {(intel?.techStack.testFrameworks || []).map((t) => (
                    <span key={t} className="px-2.5 py-1 bg-white/[0.04] text-emerald-400/80 rounded-md font-mono text-[11px]">
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-foreground-muted text-[11px] uppercase tracking-wider mb-1.5">Databases & APIs</div>
                <div className="flex flex-wrap gap-1.5">
                  {(intel?.techStack.databaseEngines || []).map((db) => (
                    <span key={db} className="px-2.5 py-1 bg-white/[0.04] text-sky-400/80 rounded-md font-mono text-[11px]">
                      {db}
                    </span>
                  ))}
                  {(intel?.techStack.apiStyles || []).map((api) => (
                    <span key={api} className="px-2.5 py-1 bg-white/[0.04] text-amber-400/80 rounded-md font-mono text-[11px]">
                      {api}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Architecture Overview */}
      {activeTab === 'architecture' && (
        <div className="space-y-6">
          <div className="bg-white/[0.02] p-4 rounded-xl space-y-2">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Architectural Summary</h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {intel?.architecture.summary || 'Analyzing architecture structure...'}
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center justify-between">
              <span>Discovered Application Modules ({intel?.architecture.modules.length || 0})</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(intel?.architecture.modules || []).map((mod) => (
                <div key={mod.id} className="p-3.5 bg-white/[0.02] hover:bg-white/[0.04] rounded-xl space-y-1.5 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-medium text-white">{mod.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-white/[0.05] text-indigo-400 rounded">
                      {mod.type}
                    </span>
                  </div>
                  <p className="text-[11px] text-foreground-muted leading-snug">{mod.responsibility}</p>
                  <div className="text-[10px] font-mono text-zinc-500">
                    {mod.fileCount} files • Relative: {mod.relativePath}
                  </div>
                  {mod.dependencies.length > 0 && (
                    <div className="text-[10px] font-mono text-zinc-400 pt-1">
                      Imports: {mod.dependencies.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Entry points */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Application Entry Points</h3>
            <div className="space-y-1.5">
              {(intel?.architecture.entryPoints || []).map((ep) => (
                <div key={ep.path} className="flex items-center justify-between p-2.5 bg-white/[0.02] rounded-lg text-xs font-mono">
                  <span className="text-indigo-300 truncate">{ep.path}</span>
                  <span className="text-foreground-muted text-[11px]">{ep.description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Knowledge Base */}
      {activeTab === 'knowledge' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs">
              {['all', 'convention', 'architecture', 'constraint', 'decision'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setKnowledgeFilter(cat as any)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono capitalize transition-colors border-0 ${
                    knowledgeFilter === cat
                      ? 'bg-white/[0.08] text-white'
                      : 'text-foreground-muted hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 rounded-lg text-xs font-medium transition-colors border-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Convention</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {(intel?.knowledgeEntries || [])
              .filter((k) => knowledgeFilter === 'all' || k.category === knowledgeFilter)
              .map((entry) => (
                <div key={entry.id} className="p-3.5 bg-white/[0.02] rounded-xl space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{entry.title}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-white/[0.04] text-foreground-muted rounded uppercase">
                      {entry.category} • {entry.source}
                    </span>
                  </div>
                  <p className="text-zinc-300 text-xs leading-relaxed">{entry.content}</p>
                </div>
              ))}

            {(intel?.knowledgeEntries || []).length === 0 && (
              <div className="text-xs text-foreground-muted py-6 text-center">
                No project knowledge entries recorded yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Health & Risks */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {Object.entries(intel?.health.categoryScores || {}).map(([cat, score]) => (
              <div key={cat} className="p-3 bg-white/[0.02] rounded-xl space-y-1">
                <div className="text-[10px] font-mono uppercase text-foreground-muted truncate">{cat}</div>
                <div className={`text-lg font-bold ${getScoreColor(score)}`}>{score}%</div>
              </div>
            ))}
          </div>

          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
              Audit Findings ({intel?.health.findings.length || 0})
            </h3>
            {(intel?.health.findings || []).map((finding) => (
              <div key={finding.id} className="p-3.5 bg-white/[0.02] rounded-xl space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {finding.severity === 'critical' ? (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    ) : finding.severity === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <Info className="w-4 h-4 text-sky-400 shrink-0" />
                    )}
                    <span className="font-semibold text-white">{finding.title}</span>
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 bg-white/[0.04] rounded text-foreground-muted">
                    {finding.category}
                  </span>
                </div>
                <p className="text-zinc-300 text-xs leading-relaxed">{finding.message}</p>
                {finding.remediation && (
                  <div className="text-[11px] text-zinc-400 font-mono pt-1">
                    Remediation: {finding.remediation}
                  </div>
                )}
              </div>
            ))}

            {(intel?.health.findings || []).length === 0 && (
              <div className="flex items-center gap-2 text-xs text-emerald-400 py-4">
                <CheckCircle2 className="w-4 h-4" />
                <span>Clean project health audit: zero detected architectural, testing or dependency risks.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Git & Worktrees */}
      {activeTab === 'git' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-white/[0.02] rounded-xl space-y-2">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Working Tree Modifications</h3>
              <p className="text-xs text-foreground-muted">
                {intel?.git.isDirty ? `${intel.git.modifiedFiles.length} modified file(s)` : 'Working tree is completely clean'}
              </p>
              <div className="space-y-1 font-mono text-[11px] max-h-48 overflow-y-auto">
                {(intel?.git.modifiedFiles || []).map((f) => (
                  <div key={f} className="text-amber-300 truncate">M {f}</div>
                ))}
                {(intel?.git.stagedFiles || []).map((f) => (
                  <div key={f} className="text-emerald-300 truncate">A {f}</div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-white/[0.02] rounded-xl space-y-2">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Active Worktrees ({intel?.git.activeWorktrees.length || 0})</h3>
              <div className="space-y-1.5 font-mono text-[11px]">
                {(intel?.git.activeWorktrees || []).map((wt) => (
                  <div key={wt.path} className="p-2 bg-white/[0.02] rounded flex items-center justify-between">
                    <span className="text-indigo-300 truncate max-w-xs">{wt.path}</span>
                    <span className="text-foreground-muted">{wt.branch} {wt.isCurrent ? '(current)' : ''}</span>
                  </div>
                ))}
                {(intel?.git.activeWorktrees || []).length === 0 && (
                  <div className="text-foreground-muted">No additional worktrees linked.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Knowledge Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#18191D] p-5 rounded-2xl w-full max-w-md space-y-4 shadow-2xl border-0">
            <h3 className="text-sm font-semibold text-white">Add Project Convention or Rule</h3>
            <form onSubmit={handleAddKnowledge} className="space-y-3">
              <div>
                <label className="text-[11px] text-foreground-muted uppercase font-mono">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full mt-1 bg-white/[0.04] rounded-lg p-2 text-xs text-white border-0 focus:outline-none"
                >
                  <option value="convention">Convention</option>
                  <option value="architecture">Architecture</option>
                  <option value="constraint">Constraint</option>
                  <option value="decision">Decision</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-foreground-muted uppercase font-mono">Key Identifier</label>
                <input
                  type="text"
                  placeholder="e.g. styling_rule"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="w-full mt-1 bg-white/[0.04] rounded-lg p-2 text-xs text-white border-0 focus:outline-none font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] text-foreground-muted uppercase font-mono">Title</label>
                <input
                  type="text"
                  placeholder="e.g. Zero White Borders Policy"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full mt-1 bg-white/[0.04] rounded-lg p-2 text-xs text-white border-0 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] text-foreground-muted uppercase font-mono">Content</label>
                <textarea
                  placeholder="Describe the architectural rule or constraint..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={3}
                  className="w-full mt-1 bg-white/[0.04] rounded-lg p-2 text-xs text-white border-0 focus:outline-none resize-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-foreground-muted hover:text-white bg-white/[0.02] border-0"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg text-xs text-white bg-indigo-600 hover:bg-indigo-500 font-medium border-0"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
