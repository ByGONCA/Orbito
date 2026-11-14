import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import path from 'node:path';
import type {
  ProjectIntelligenceData,
  ArchitecturalOverview,
  ProjectHealthReport,
  ProjectKnowledgeEntry,
  KnowledgeCategory,
  AgentRoleType,
  RoleContextPackage
} from '../../shared/project-intelligence';
import { projectDiscoveryService } from './project-discovery.service';
import { architecturalIntelligenceService } from './architectural-intelligence.service';
import { gitIntelligenceService } from './git-intelligence.service';
import { projectHealthService } from './project-health.service';
import { roleContextAssemblerService } from './role-context-assembler.service';
import { databaseService } from '../db/database.service';

export class ProjectIntelligenceService extends EventEmitter {
  private memoryCache = new Map<string, ProjectIntelligenceData>();
  private analyzingPaths = new Set<string>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private isWatcherEnabled = true;

  public async analyzeProject(
    projectPath: string,
    options: { forceRefresh?: boolean; projectId?: string } = {}
  ): Promise<ProjectIntelligenceData> {
    const normPath = path.resolve(projectPath);
    const resolvedProjectId = options.projectId || this.deriveProjectId(normPath);

    // Return in-flight analysis if already running to prevent redundant concurrent walks
    if (this.analyzingPaths.has(normPath) && !options.forceRefresh) {
      const cached = this.memoryCache.get(normPath);
      if (cached) return cached;
    }

    // Check memory cache
    if (!options.forceRefresh && this.memoryCache.has(normPath)) {
      return this.memoryCache.get(normPath)!;
    }

    // Check SQLite persistence
    if (!options.forceRefresh && databaseService.isInitialized()) {
      try {
        const persisted = databaseService.getProjectIntelligence(resolvedProjectId);
        if (persisted && Date.now() - persisted.lastAnalyzedAt < 300000) { // 5-minute fresh window
          this.memoryCache.set(normPath, persisted);
          return persisted;
        }
      } catch {}
    }

    this.analyzingPaths.add(normPath);
    this.emit('analyzing', { projectPath: normPath, isAnalyzing: true });

    try {
      // 1. Repository & Tech Stack Discovery
      const { techStack, monorepo, knowledgeEntries } = await projectDiscoveryService.discover(
        normPath,
        resolvedProjectId
      );

      // 2. Architectural Analysis
      const architecture = await architecturalIntelligenceService.analyzeArchitecture(
        normPath,
        monorepo.isMonorepo
      );

      // 3. Git & Worktree Intelligence
      const git = await gitIntelligenceService.getGitIntelligence(normPath);

      // 4. Project Health & Risk Evaluation
      const health = projectHealthService.evaluateHealth(normPath, techStack, architecture);

      // 5. Merge with existing user/agent knowledge entries in DB
      let combinedKnowledge = [...knowledgeEntries];
      if (databaseService.isInitialized()) {
        try {
          const stored = databaseService.listKnowledgeEntries(resolvedProjectId);
          const map = new Map<string, ProjectKnowledgeEntry>();
          for (const k of combinedKnowledge) map.set(k.key, k);
          for (const s of stored) map.set(s.key, s); // User or previously saved entries take precedence
          combinedKnowledge = Array.from(map.values());
        } catch {}
      }

      const intelligenceData: ProjectIntelligenceData = {
        projectId: resolvedProjectId,
        projectPath: normPath,
        techStack,
        monorepo,
        architecture,
        git,
        health,
        knowledgeEntries: combinedKnowledge,
        lastAnalyzedAt: Date.now()
      };

      // Update memory cache
      this.memoryCache.set(normPath, intelligenceData);

      // Persist in DB
      if (databaseService.isInitialized()) {
        try {
          databaseService.upsertProjectIntelligence(intelligenceData);
          for (const k of combinedKnowledge) {
            databaseService.upsertKnowledgeEntry(k);
          }
        } catch {}
      }

      this.emit('analyzed', intelligenceData);
      return intelligenceData;
    } finally {
      this.analyzingPaths.delete(normPath);
      this.emit('analyzing', { projectPath: normPath, isAnalyzing: false });
    }
  }

  public async getProjectIntelligence(projectPath: string): Promise<ProjectIntelligenceData> {
    const norm = path.resolve(projectPath);
    if (this.memoryCache.has(norm)) {
      return this.memoryCache.get(norm)!;
    }
    return this.analyzeProject(projectPath);
  }

  public async getArchitecture(projectPath: string): Promise<ArchitecturalOverview> {
    const data = await this.getProjectIntelligence(projectPath);
    return data.architecture;
  }

  public async getHealth(projectPath: string): Promise<ProjectHealthReport> {
    const data = await this.getProjectIntelligence(projectPath);
    return data.health;
  }

  public async getKnowledge(
    projectPath: string,
    category?: KnowledgeCategory
  ): Promise<ProjectKnowledgeEntry[]> {
    const data = await this.getProjectIntelligence(projectPath);
    if (category) {
      return data.knowledgeEntries.filter((k) => k.category === category);
    }
    return data.knowledgeEntries;
  }

  public async addKnowledgeEntry(
    entryInput: Omit<ProjectKnowledgeEntry, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ProjectKnowledgeEntry> {
    const now = Date.now();
    const entry: ProjectKnowledgeEntry = {
      ...entryInput,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now
    };

    if (databaseService.isInitialized()) {
      databaseService.upsertKnowledgeEntry(entry);
    }

    // Invalidate project memory cache to refresh
    for (const [p, val] of this.memoryCache.entries()) {
      if (val.projectId === entry.projectId) {
        val.knowledgeEntries = val.knowledgeEntries.filter((k) => k.id !== entry.id && k.key !== entry.key);
        val.knowledgeEntries.push(entry);
        break;
      }
    }

    return entry;
  }

  public async assembleContextForRole(
    projectPath: string,
    role: AgentRoleType,
    taskDescription: string,
    maxTokens = 4000
  ): Promise<RoleContextPackage> {
    const intel = await this.getProjectIntelligence(projectPath);
    return roleContextAssemblerService.assembleForRole(role, taskDescription, intel, maxTokens);
  }

  public notifyFileChanged(projectPath: string, filePath: string): void {
    if (!this.isWatcherEnabled) return;
    const norm = path.resolve(projectPath);

    // Debounce background incremental refresh (2500ms)
    const existing = this.debounceTimers.get(norm);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.debounceTimers.delete(norm);
      this.analyzeProject(norm, { forceRefresh: true }).catch(() => {});
    }, 2500);

    this.debounceTimers.set(norm, timer);
  }

  public setWatcherEnabled(enabled: boolean): void {
    this.isWatcherEnabled = enabled;
  }

  public clearCache(projectPath?: string): void {
    if (projectPath) {
      this.memoryCache.delete(path.resolve(projectPath));
    } else {
      this.memoryCache.clear();
    }
  }

  private deriveProjectId(projectPath: string): string {
    try {
      if (databaseService.isInitialized()) {
        const desc = databaseService.getProjectByPath(projectPath);
        if (desc && desc.id) return desc.id;
      }
    } catch {}
    // Deterministic hash based on path
    return `proj-${crypto.createHash('md5').update(projectPath).digest('hex').substring(0, 12)}`;
  }
}

export const projectIntelligenceService = new ProjectIntelligenceService();
