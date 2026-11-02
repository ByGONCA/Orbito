import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Search,
  Shield,
  ShieldAlert,
  Play,
  Clock,
  Layers,
  Cpu,
  CheckCircle,
  XCircle,
  FileCode2,
  FolderPlus,
  RefreshCw,
  Terminal,
  Globe,
  HardDrive,
  Info,
  Sliders,
  Check,
  ChevronRight
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspace.store';
import type { SkillMetadata, SkillDetails, SkillExecutionRecord, SkillCategory } from '../../../shared/skills';

const CATEGORIES: { id: 'all' | SkillCategory; label: string }[] = [
  { id: 'all', label: 'All Skills' },
  { id: 'quality', label: 'Quality' },
  { id: 'debugging', label: 'Debugging' },
  { id: 'refactoring', label: 'Refactoring' },
  { id: 'testing', label: 'Testing' },
  { id: 'security', label: 'Security' },
  { id: 'documentation', label: 'Docs' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'analysis', label: 'Analysis' }
];

export const SkillsManager: React.FC = () => {
  const {
    uiMode,
    project,
    activeProvider,
    skills,
    setSkills,
    skillExecutions,
    setSkillExecutions,
    addLog
  } = useWorkspaceStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | SkillCategory>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [activeDetailSkill, setActiveDetailSkill] = useState<SkillDetails | null>(null);
  const [testPrompt, setTestPrompt] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [execMessage, setExecMessage] = useState<string | null>(null);

  const loadSkills = async () => {
    setIsLoading(true);
    try {
      const list = await window.api.listSkills();
      setSkills(list);
      const execs = await window.api.listSkillExecutions(project?.id);
      setSkillExecutions(execs);
    } catch (err: any) {
      addLog(`Failed to load skills: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSkills();
  }, [project?.id]);

  const handleToggle = async (skillId: string, currentEnabled: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const next = !currentEnabled;
      await window.api.toggleSkill({ skillId, enabled: next });
      setSkills(skills.map((s) => (s.id === skillId ? { ...s, enabled: next } : s)));
      addLog(`Skill "${skillId}" toggled to ${next ? 'ENABLED' : 'DISABLED'}`, 'info');
    } catch (err: any) {
      addLog(`Toggle failed: ${err.message}`, 'error');
    }
  };

  const handleOpenDetails = async (skill: SkillMetadata) => {
    try {
      const details = await window.api.getSkillDetails(skill.id);
      if (details) {
        setActiveDetailSkill(details);
        setTestPrompt(`Please run ${details.name} on the current project.`);
        setExecMessage(null);
      }
    } catch (err: any) {
      addLog(`Failed to load skill details: ${err.message}`, 'error');
    }
  };

  const handleExecuteSkill = async () => {
    if (!activeDetailSkill || !project) return;
    setIsExecuting(true);
    setExecMessage(null);
    try {
      addLog(`Activating skill "${activeDetailSkill.name}" with provider ${activeProvider}...`, 'info');
      const res = await window.api.executeSkill({
        skillId: activeDetailSkill.id,
        prompt: testPrompt,
        projectId: project.id,
        projectPath: project.path,
        provider: activeProvider
      });

      if (res.success) {
        setExecMessage(`Skill triggered successfully! Session ID: ${res.sessionId || res.executionId}`);
        addLog(`Skill run started (Session: ${res.sessionId || res.executionId})`, 'info');
        const execs = await window.api.listSkillExecutions(project.id);
        setSkillExecutions(execs);
      } else {
        setExecMessage('Skill execution failed. Check console logs.');
      }
    } catch (err: any) {
      setExecMessage(`Execution error: ${err.message}`);
      addLog(`Skill execution failed: ${err.message}`, 'error');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleImportCustom = async () => {
    try {
      const selectedDir = await window.api.openDirectoryDialog();
      if (!selectedDir) return;

      addLog(`Importing custom skill from: ${selectedDir.path}`, 'info');
      const res = await window.api.importCustomSkill({ sourceDirectory: selectedDir.path });
      if (res.success && res.skill) {
        addLog(`Imported custom skill: ${res.skill.name}`, 'info');
        if (res.securityNotice) {
          alert(res.securityNotice);
        }
        await loadSkills();
      } else {
        alert(`Failed to import custom skill: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Import error: ${err.message}`);
    }
  };

  const filteredSkills = skills.filter((s) => {
    const matchesCat = selectedCategory === 'all' || s.category === selectedCategory;
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Top Controls Bar */}
      <div className="border-b border-border bg-card/60 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              Skills Engine
              <span className="text-[11px] font-normal text-muted-foreground px-2 py-0.5 rounded-full bg-secondary">
                {skills.length} available
              </span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Modular AI capabilities with permission enforcement & context integration
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {uiMode === 'advanced' && (
            <button
              onClick={handleImportCustom}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-lg transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5 text-primary" />
              <span>Import Custom Skill</span>
            </button>
          )}

          <button
            onClick={loadSkills}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-lg transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Reload</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-5 py-2.5 border-b border-border bg-card/20 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search skills, tags, keywords..."
            className="w-full bg-secondary/50 border border-border rounded-md pl-8 pr-3 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-primary"
          />
        </div>
      </div>

      {/* Main Grid View */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSkills.map((skill) => {
            const hasWrite = skill.permissions.filesystem.write;
            const hasTerminal = skill.permissions.terminal.execute;

            return (
              <div
                key={skill.id}
                onClick={() => handleOpenDetails(skill)}
                className={`flex flex-col justify-between p-4 rounded-xl border transition-all cursor-pointer select-none ${
                  skill.enabled
                    ? 'bg-card border-border hover:border-primary/50 shadow-xs'
                    : 'bg-card/40 border-border/50 opacity-60 hover:opacity-100'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-foreground">{skill.name}</span>
                      <span className="text-[10px] text-muted-foreground">v{skill.version}</span>
                    </div>

                    <button
                      onClick={(e) => handleToggle(skill.id, skill.enabled, e)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        skill.enabled ? 'bg-primary' : 'bg-muted'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${
                          skill.enabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">
                    {skill.description}
                  </p>

                  <div className="flex flex-wrap gap-1 mb-3">
                    <span className="text-[10px] font-medium bg-secondary text-secondary-foreground px-2 py-0.5 rounded capitalize">
                      {skill.category}
                    </span>
                    {skill.isBuiltIn ? (
                      <span className="text-[10px] font-medium bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded">
                        Built-in
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded">
                        Custom
                      </span>
                    )}

                    {uiMode === 'advanced' && (hasWrite || hasTerminal) && (
                      <span className="text-[10px] font-medium bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded flex items-center gap-1">
                        <ShieldAlert className="w-2.5 h-2.5" />
                        {hasWrite && 'Write'} {hasTerminal && 'Terminal'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    {skill.supportedProviders.map((p) => (
                      <span key={p} className="capitalize text-[10px] bg-secondary/80 px-1.5 py-0.5 rounded">
                        {p}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 text-primary hover:underline font-medium">
                    <span>Inspect</span>
                    <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Execution History Table in Advanced Mode */}
        {uiMode === 'advanced' && skillExecutions.length > 0 && (
          <div className="mt-8 border border-border rounded-xl bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-card/60 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-primary" />
                Recent Skill Executions ({skillExecutions.length})
              </h3>
            </div>
            <div className="overflow-x-auto max-h-60">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/40 text-muted-foreground border-b border-border text-[11px]">
                  <tr>
                    <th className="px-4 py-2">Skill</th>
                    <th className="px-4 py-2">Provider</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Tokens</th>
                    <th className="px-4 py-2">Duration</th>
                    <th className="px-4 py-2">Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {skillExecutions.map((exec) => (
                    <tr key={exec.id} className="hover:bg-secondary/20 font-mono text-[11px]">
                      <td className="px-4 py-2 font-medium text-foreground">{exec.skillId}</td>
                      <td className="px-4 py-2 capitalize">{exec.provider}</td>
                      <td className="px-4 py-2">
                        {exec.status === 'completed' ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Completed
                          </span>
                        ) : exec.status === 'failed' ? (
                          <span className="text-rose-400 flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> Failed
                          </span>
                        ) : (
                          <span className="text-amber-400 flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 animate-spin" /> Running
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">{exec.tokensUsed}</td>
                      <td className="px-4 py-2">{exec.durationMs}ms</td>
                      <td className="px-4 py-2 truncate max-w-xs text-muted-foreground">{exec.inputSummary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Skill Detail & Quick Execution Modal */}
      {activeDetailSkill && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-card/80">
              <div>
                <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  {activeDetailSkill.name}
                  <span className="text-xs font-normal text-muted-foreground">v{activeDetailSkill.version}</span>
                </h3>
                <p className="text-xs text-muted-foreground">{activeDetailSkill.description}</p>
              </div>
              <button
                onClick={() => setActiveDetailSkill(null)}
                className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Permissions & Security Review */}
              <div className="bg-secondary/40 p-3 rounded-lg border border-border text-xs space-y-2">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-primary" />
                  Security & Permission Boundaries
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div className="p-2 rounded bg-background border border-border flex items-center gap-2">
                    <HardDrive className="w-3.5 h-3.5 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-foreground">Filesystem</div>
                      <div className="text-muted-foreground">
                        {activeDetailSkill.permissions.filesystem.write ? 'Read & Write' : 'Read-only'}
                      </div>
                    </div>
                  </div>

                  <div className="p-2 rounded bg-background border border-border flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-foreground">Terminal</div>
                      <div className="text-muted-foreground">
                        {activeDetailSkill.permissions.terminal.execute ? 'Allowed' : 'Disabled'}
                      </div>
                    </div>
                  </div>

                  <div className="p-2 rounded bg-background border border-border flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-foreground">Network</div>
                      <div className="text-muted-foreground">
                        {activeDetailSkill.permissions.network.allowed ? 'Egress Allowed' : 'Prohibited'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Instructions Preview */}
              <div>
                <h4 className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                  <FileCode2 className="w-3.5 h-3.5 text-primary" />
                  Markdown Instructions (On-demand Prompt Specialization)
                </h4>
                <div className="bg-background border border-border rounded-lg p-3 text-xs font-mono max-h-48 overflow-y-auto whitespace-pre-wrap text-muted-foreground leading-relaxed">
                  {activeDetailSkill.instructions}
                </div>
              </div>

              {/* Quick Test Execution */}
              <div className="border-t border-border pt-4">
                <h4 className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-emerald-400" />
                  Execute Skill on Active Project
                </h4>

                {project ? (
                  <div className="space-y-2">
                    <textarea
                      value={testPrompt}
                      onChange={(e) => setTestPrompt(e.target.value)}
                      rows={2}
                      className="w-full bg-background border border-border rounded-md p-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-primary font-sans"
                      placeholder="Enter directive for this skill..."
                    />

                    {execMessage && (
                      <div className="text-xs p-2 rounded bg-secondary text-foreground border border-border">
                        {execMessage}
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={handleExecuteSkill}
                        disabled={isExecuting || !activeDetailSkill.enabled}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50"
                      >
                        {isExecuting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                        <span>{isExecuting ? 'Executing...' : 'Run with Context'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground italic">
                    Open a project workspace to execute skills with automated context assembly.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
