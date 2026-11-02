import fs from 'node:fs';
import type { SkillMetadata } from '../../shared/skills';
import type {
  SkillLoadingLevel,
  SkillOperationalSummary,
  ComposedSkillInstructions
} from '../../shared/intelligence';
import { skillRegistry } from './skill-registry';
import { SkillLoader } from './skill-loader';
import { tokenCounterService } from '../context/tokens/token-counter.service';

/**
 * Built-in Level 2 operational summaries (~35–50 tokens each instead of ~400 tokens full instructions).
 */
const BUILTIN_OPERATIONAL_SUMMARIES: Record<string, SkillOperationalSummary> = {
  'code-review': {
    id: 'code-review',
    name: 'Code Review Specialist',
    summary: 'Analyzes code for defects, architectural anti-patterns, style compliance, and maintainability.',
    requiredCapabilities: ['code_analysis', 'diff_inspection'],
    expectedOutput: 'Categorized list of issues with severity (Critical/Warning/Nitpick) and concrete remediation code.',
    tokens: 42
  },
  'bug-investigation': {
    id: 'bug-investigation',
    name: 'Bug Investigation Specialist',
    summary: 'Diagnoses runtime errors, stack traces, and test failures by isolating root causes.',
    requiredCapabilities: ['root_cause_analysis', 'log_parsing'],
    expectedOutput: 'Root cause explanation, reproduction hypothesis, and minimal repair proposal.',
    tokens: 40
  },
  'bug-fixing': {
    id: 'bug-fixing',
    name: 'Bug Fixing Specialist',
    summary: 'Applies targeted, surgical patches to fix identified defects without side effects.',
    requiredCapabilities: ['code_modification', 'patching'],
    expectedOutput: 'Precise unified diff or file modifications resolving the issue, accompanied by a regression test.',
    tokens: 38
  },
  refactoring: {
    id: 'refactoring',
    name: 'Code Refactoring Specialist',
    summary: 'Restructures code to improve readability and decoupling while preserving exact external behavior.',
    requiredCapabilities: ['clean_code', 'pattern_refactoring'],
    expectedOutput: 'Cleaned code implementation with step-by-step rationale for architectural transformations.',
    tokens: 39
  },
  documentation: {
    id: 'documentation',
    name: 'Documentation Specialist',
    summary: 'Generates comprehensive, accurate technical documentation, API specs, and JSDoc/TSDoc blocks.',
    requiredCapabilities: ['technical_writing', 'api_specs'],
    expectedOutput: 'Markdown documentation or in-source documentation blocks matching project conventions.',
    tokens: 35
  },
  'test-generation': {
    id: 'test-generation',
    name: 'Test Generation Specialist',
    summary: 'Designs unit, integration, and property test suites covering happy paths, edge cases, and error boundaries.',
    requiredCapabilities: ['test_authoring', 'mocking'],
    expectedOutput: 'Executable Vitest/Jest test suites with thorough assertions and minimal mocking.',
    tokens: 41
  },
  'security-review': {
    id: 'security-review',
    name: 'Security Review Specialist',
    summary: 'Audits source code for OWASP Top 10 vulnerabilities, injection flaws, secrets leakage, and privilege bypasses.',
    requiredCapabilities: ['vulnerability_audit', 'threat_modeling'],
    expectedOutput: 'CWE/OWASP-tagged security findings with impact assessment and verified mitigation diffs.',
    tokens: 44
  },
  'project-understanding': {
    id: 'project-understanding',
    name: 'Project Understanding Specialist',
    summary: 'Explains codebase architecture, entrypoints, directory layouts, and dataflow topologies.',
    requiredCapabilities: ['architecture_discovery', 'system_mapping'],
    expectedOutput: 'Concise architectural overview highlighting core components and execution pathways.',
    tokens: 38
  },
  'performance-analysis': {
    id: 'performance-analysis',
    name: 'Performance Analysis Specialist',
    summary: 'Identifies algorithmic bottlenecks, memory leaks, unindexed queries, and excessive latency.',
    requiredCapabilities: ['profiling', 'bottleneck_identification'],
    expectedOutput: 'Profiling diagnosis with Big-O complexity analysis and performance optimization diffs.',
    tokens: 41
  },
  'code-explanation': {
    id: 'code-explanation',
    name: 'Code Explanation Specialist',
    summary: 'Provides clear, plain-English explanations of complex logic, types, and asynchronous flows.',
    requiredCapabilities: ['explanation', 'code_walkthrough'],
    expectedOutput: 'Structured breakdown of logic flow, inputs, outputs, and key assumptions.',
    tokens: 36
  }
};

export class SkillCompositionService {
  private static skillUsageStats = new Map<
    string,
    { invocations: number; tokensUsed: number; durationMs: number; successCount: number }
  >();

  /**
   * Retrieves a skill at the requested progressive loading level.
   */
  public static getSkillAtLevel(
    skillId: string,
    level: SkillLoadingLevel = 'full'
  ): {
    id: string;
    name: string;
    level: SkillLoadingLevel;
    content: string;
    tokens: number;
  } | null {
    const skill = skillRegistry.getSkill(skillId);
    if (!skill) return null;

    if (level === 'metadata') {
      const summaryText = `[${skill.id}] ${skill.name}: ${skill.description}`;
      return {
        id: skill.id,
        name: skill.name,
        level: 'metadata',
        content: summaryText,
        tokens: tokenCounterService.countActualTokens(summaryText)
      };
    }

    if (level === 'summary') {
      const summary = BUILTIN_OPERATIONAL_SUMMARIES[skill.id] || {
        id: skill.id,
        name: skill.name,
        summary: skill.description,
        requiredCapabilities: skill.tags,
        expectedOutput: 'Structured output satisfying task requirements.',
        tokens: tokenCounterService.countActualTokens(skill.description)
      };

      const summaryText = `[SKILL SUMMARY: ${summary.name}]\n- Capability: ${summary.summary}\n- Expected Output: ${summary.expectedOutput}`;
      return {
        id: skill.id,
        name: skill.name,
        level: 'summary',
        content: summaryText,
        tokens: tokenCounterService.countActualTokens(summaryText)
      };
    }

    // Full Instructions (Level 3)
    const details = SkillLoader.loadDetails(skill);
    const content = details.instructions || details.description;
    return {
      id: skill.id,
      name: skill.name,
      level: 'full',
      content,
      tokens: tokenCounterService.countActualTokens(content)
    };
  }

  /**
   * Composes multiple active skills into a unified, deduplicated instruction block.
   */
  public static composeSkills(
    skillIds: string[],
    level: SkillLoadingLevel = 'full',
    maxTokens?: number
  ): ComposedSkillInstructions {
    if (skillIds.length === 0) {
      return {
        primarySkillId: '',
        activeSkillIds: [],
        composedText: '',
        totalTokens: 0,
        tokensSaved: 0,
        conflictsResolved: []
      };
    }

    const primarySkillId = skillIds[0];
    const loadedSkills: Array<{ id: string; name: string; content: string; tokens: number }> = [];

    let rawTotalTokens = 0;
    for (const id of skillIds) {
      const loaded = this.getSkillAtLevel(id, level);
      if (loaded) {
        loadedSkills.push(loaded);
        rawTotalTokens += loaded.tokens;
      }
    }

    if (loadedSkills.length === 1) {
      return {
        primarySkillId,
        activeSkillIds: [primarySkillId],
        composedText: loadedSkills[0].content,
        totalTokens: loadedSkills[0].tokens,
        tokensSaved: 0,
        conflictsResolved: []
      };
    }

    // Deduplicate common instructions and overlapping guidelines
    const seenClauses = new Set<string>();
    const composedSections: string[] = [];
    const conflictsResolved: string[] = [];

    // Header indicating multi-skill composition
    composedSections.push(
      `### Composed Skill Protocol [Primary: ${loadedSkills[0].name} + Supporting: ${loadedSkills.slice(1).map((s) => s.name).join(', ')}]`
    );

    for (let i = 0; i < loadedSkills.length; i++) {
      const skill = loadedSkills[i];
      const isPrimary = i === 0;

      composedSections.push(`\n#### ${skill.name} ${isPrimary ? '(Primary Focus)' : '(Supporting)'}`);

      const lines = skill.content.split(/\r?\n/);
      const filteredLines: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        // Skip repetitive generic boilerplate lines across multiple skills
        const normalized = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');

        if (
          normalized.length > 15 &&
          (normalized.includes('typescriptbestpractices') ||
            normalized.includes('cleancodeprinciples') ||
            normalized.includes('donotmodifyunrelated') ||
            normalized.includes('preserveexistingcomments') ||
            normalized.includes('followprojectconventions'))
        ) {
          if (seenClauses.has(normalized)) {
            conflictsResolved.push(`Deduplicated generic guideline in ${skill.name}: "${trimmed.slice(0, 40)}..."`);
            continue;
          }
          seenClauses.add(normalized);
        }

        filteredLines.push(line);
      }

      composedSections.push(filteredLines.join('\n'));
    }

    let composedText = composedSections.join('\n');

    // If max token budget provided and exceeded, condense supporting skills
    let finalTokens = tokenCounterService.countActualTokens(composedText);
    if (maxTokens && finalTokens > maxTokens) {
      // Re-compose with Level 2 summaries for supporting skills
      const condensed: string[] = [];
      condensed.push(`### Composed Skill Protocol [Primary: ${loadedSkills[0].name}]`);
      condensed.push(`\n#### ${loadedSkills[0].name} (Primary Full Instructions)`);
      condensed.push(loadedSkills[0].content);

      for (let i = 1; i < loadedSkills.length; i++) {
        const sum = this.getSkillAtLevel(loadedSkills[i].id, 'summary');
        if (sum) {
          condensed.push(`\n#### ${sum.name} (Supporting Summary)`);
          condensed.push(sum.content);
        }
      }
      composedText = condensed.join('\n');
      finalTokens = tokenCounterService.countActualTokens(composedText);
    }

    const tokensSaved = Math.max(0, rawTotalTokens - finalTokens);

    return {
      primarySkillId,
      activeSkillIds: loadedSkills.map((s) => s.id),
      composedText,
      totalTokens: finalTokens,
      tokensSaved,
      conflictsResolved
    };
  }

  /**
   * Records skill execution metrics for dynamic ranking and optimization.
   */
  public static recordSkillUsage(
    skillId: string,
    tokensUsed: number,
    durationMs: number,
    success: boolean
  ): void {
    const existing = this.skillUsageStats.get(skillId) || {
      invocations: 0,
      tokensUsed: 0,
      durationMs: 0,
      successCount: 0
    };

    this.skillUsageStats.set(skillId, {
      invocations: existing.invocations + 1,
      tokensUsed: existing.tokensUsed + tokensUsed,
      durationMs: existing.durationMs + durationMs,
      successCount: existing.successCount + (success ? 1 : 0)
    });
  }

  /**
   * Retrieves usage statistics for a specific skill.
   */
  public static getSkillUsageStats(skillId: string): {
    invocations: number;
    tokensUsed: number;
    durationMs: number;
    successCount: number;
    avgExecutionTimeMs: number;
  } | null {
    const stats = this.skillUsageStats.get(skillId);
    if (!stats) return null;
    return {
      ...stats,
      avgExecutionTimeMs: stats.invocations > 0 ? Math.round(stats.durationMs / stats.invocations) : 0
    };
  }

  /**
   * Retrieves telemetry metrics for all activated skills.
   */
  public static getSkillTelemetry(): Record<
    string,
    { invocations: number; avgTokens: number; successRate: number }
  > {
    const result: Record<string, any> = {};
    for (const [id, stats] of this.skillUsageStats.entries()) {
      result[id] = {
        invocations: stats.invocations,
        avgTokens: stats.invocations > 0 ? Math.round(stats.tokensUsed / stats.invocations) : 0,
        successRate: stats.invocations > 0 ? Number((stats.successCount / stats.invocations).toFixed(2)) : 0
      };
    }
    return result;
  }
}
