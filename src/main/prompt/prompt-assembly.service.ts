import crypto from 'node:crypto';
import type {
  PromptSection,
  PromptSectionType,
  PromptAssemblyResult,
  OptimizationMode
} from '../../shared/intelligence';
import type { CLIProvider } from '../../shared/cli';
import { tokenCounterService } from '../context/tokens/token-counter.service';

export interface PromptAssemblyOptions {
  systemPrompt?: string;
  securityConstraints?: string[];
  userObjective: string;
  acceptanceCriteria?: string[];
  skillInstructions?: string;
  contextMarkdown?: string;
  previousResults?: string;
  expectedOutputFormat?: string;
  maxTokens?: number;
  modelTarget?: CLIProvider | string;
  mode?: OptimizationMode;
  providerFormat?: 'markdown' | 'xml_tags' | 'standard';
}

export class PromptAssemblyService {
  /**
   * Compresses redundant whitespace while preserving code formatting and markdown tables.
   */
  public static compressWhitespace(text: string): string {
    if (!text) return '';

    // Split into code block and non-code block regions
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts
      .map((part) => {
        if (part.startsWith('```')) {
          // Inside code block: only collapse 3+ consecutive newlines to 2, trim trailing space
          return part.replace(/\r?\n\s*\r?\n\s*\r?\n+/g, '\n\n');
        }
        // Outside code block: collapse multiple blank lines, clean trailing whitespace
        return part
          .replace(/[ \t]+$/gm, '') // Remove trailing spaces per line
          .replace(/(\r?\n){3,}/g, '\n\n') // Max 2 consecutive newlines
          .trim();
      })
      .join('\n');
  }

  /**
   * Deduplicates repeated sentences or guidelines across prompt sections.
   */
  private static deduplicateLines(sections: PromptSection[]): {
    deduplicatedSections: PromptSection[];
    savedTokens: number;
  } {
    const seenClauses = new Set<string>();
    let savedTokens = 0;

    const deduplicatedSections = sections.map((sec) => {
      // Don't alter raw context code fragments or small objectives
      if (sec.type === 'context' || sec.type === 'objective') {
        return sec;
      }

      const lines = sec.content.split(/\r?\n/);
      const filtered: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        const normalized = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');

        if (normalized.length > 25) {
          if (seenClauses.has(normalized)) {
            savedTokens += tokenCounterService.countActualTokens(line);
            continue;
          }
          seenClauses.add(normalized);
        }
        filtered.push(line);
      }

      const newContent = filtered.join('\n');
      return {
        ...sec,
        content: newContent,
        tokens: tokenCounterService.countActualTokens(newContent)
      };
    });

    return { deduplicatedSections, savedTokens };
  }

  /**
   * Assembles a structured, token-budgeted prompt from modular sections.
   */
  public static assemblePrompt(options: PromptAssemblyOptions): PromptAssemblyResult {
    const {
      systemPrompt,
      securityConstraints = [],
      userObjective,
      acceptanceCriteria = [],
      skillInstructions,
      contextMarkdown,
      previousResults,
      expectedOutputFormat,
      maxTokens,
      modelTarget = 'claude',
      mode = 'balanced',
      providerFormat = 'markdown'
    } = options;

    const rawSections: PromptSection[] = [];

    // 1. Core System Instructions (Mandatory, Priority 100)
    if (systemPrompt && systemPrompt.trim()) {
      const clean = this.compressWhitespace(systemPrompt);
      rawSections.push({
        type: 'system',
        title: 'Core System Protocol',
        content: clean,
        tokens: tokenCounterService.countActualTokens(clean),
        priority: 100,
        mandatory: true
      });
    }

    // 2. Security Constraints (Mandatory, Priority 95)
    if (securityConstraints.length > 0) {
      const secContent = securityConstraints.map((c) => `- ${c}`).join('\n');
      rawSections.push({
        type: 'security',
        title: 'Mandatory Security Constraints',
        content: secContent,
        tokens: tokenCounterService.countActualTokens(secContent),
        priority: 95,
        mandatory: true
      });
    }

    // 3. User Objective / Task (Mandatory, Priority 90)
    const cleanObjective = this.compressWhitespace(userObjective || '');
    rawSections.push({
      type: 'objective',
      title: 'Task Objective',
      content: cleanObjective,
      tokens: tokenCounterService.countActualTokens(cleanObjective),
      priority: 90,
      mandatory: true
    });

    // 4. Task Acceptance Criteria (Priority 85)
    if (acceptanceCriteria.length > 0) {
      const criteriaContent = acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n');
      rawSections.push({
        type: 'acceptance_criteria',
        title: 'Acceptance Criteria',
        content: criteriaContent,
        tokens: tokenCounterService.countActualTokens(criteriaContent),
        priority: 85,
        mandatory: false
      });
    }

    // 5. Selected Skill Instructions (Priority 80)
    if (skillInstructions && skillInstructions.trim()) {
      const cleanSkills = this.compressWhitespace(skillInstructions);
      rawSections.push({
        type: 'skills',
        title: 'Active Domain Skills',
        content: cleanSkills,
        tokens: tokenCounterService.countActualTokens(cleanSkills),
        priority: 80,
        mandatory: false
      });
    }

    // 6. Relevant Context Fragments (Priority 70)
    if (contextMarkdown && contextMarkdown.trim()) {
      const cleanContext = this.compressWhitespace(contextMarkdown);
      rawSections.push({
        type: 'context',
        title: 'Relevant Codebase Context',
        content: cleanContext,
        tokens: tokenCounterService.countActualTokens(cleanContext),
        priority: 70,
        mandatory: false
      });
    }

    // 7. Previous Execution Results (Priority 60)
    if (previousResults && previousResults.trim()) {
      const cleanPrev = this.compressWhitespace(previousResults);
      rawSections.push({
        type: 'history',
        title: 'Prior Execution Summary',
        content: cleanPrev,
        tokens: tokenCounterService.countActualTokens(cleanPrev),
        priority: 60,
        mandatory: false
      });
    }

    // 8. Expected Output Format (Priority 50)
    if (expectedOutputFormat && expectedOutputFormat.trim()) {
      const cleanFormat = this.compressWhitespace(expectedOutputFormat);
      rawSections.push({
        type: 'format',
        title: 'Output Format Specification',
        content: cleanFormat,
        tokens: tokenCounterService.countActualTokens(cleanFormat),
        priority: 50,
        mandatory: false
      });
    }

    // Section deduplication
    const { deduplicatedSections, savedTokens } = this.deduplicateLines(rawSections);

    // Calculate budget limit
    const totalCapacity =
      maxTokens ||
      tokenCounterService.calculateAvailableContextBudget(modelTarget, 0.1);

    // Budget enforcement: sort non-mandatory sections by priority, trim lowest if over budget
    let currentTotalTokens = deduplicatedSections.reduce((sum, s) => sum + s.tokens, 0);
    const finalSections = [...deduplicatedSections];

    if (currentTotalTokens > totalCapacity) {
      // Sort in ascending order of priority (trim lowest first)
      const trimmable = finalSections
        .filter((s) => !s.mandatory)
        .sort((a, b) => a.priority - b.priority);

      for (const section of trimmable) {
        if (currentTotalTokens <= totalCapacity) break;
        const excess = currentTotalTokens - totalCapacity;

        if (section.tokens <= excess) {
          // Drop entire section if not enough budget
          currentTotalTokens -= section.tokens;
          const idx = finalSections.findIndex((s) => s.type === section.type);
          if (idx !== -1) finalSections.splice(idx, 1);
        } else {
          // Trim section to remaining available budget
          const availableForSection = Math.max(0, section.tokens - excess);
          if (availableForSection <= 20) {
            currentTotalTokens -= section.tokens;
            const idx = finalSections.findIndex((s) => s.type === section.type);
            if (idx !== -1) finalSections.splice(idx, 1);
          } else {
            const lines = section.content.split('\n');
            const keepRatio = availableForSection / section.tokens;
            const keepCount = Math.max(1, Math.floor(lines.length * keepRatio));
            const trimmedContent =
              lines.slice(0, keepCount).join('\n') +
              '\n[... Section truncated to fit token budget ...]';
            const newTokens = tokenCounterService.countActualTokens(trimmedContent);
            currentTotalTokens = currentTotalTokens - section.tokens + newTokens;
            section.content = trimmedContent;
            section.tokens = newTokens;
          }
        }
      }
    }

    // Render formatted prompt text
    const assembledPrompt = this.renderPromptText(finalSections, providerFormat);
    const totalTokens = tokenCounterService.countActualTokens(assembledPrompt);

    // Fingerprint for caching
    const fingerprintPayload = `${modelTarget}|${assembledPrompt}`;
    const promptFingerprint = crypto
      .createHash('sha256')
      .update(fingerprintPayload)
      .digest('hex');

    // Token breakdown per section
    const tokenBreakdown: Record<PromptSectionType, number> = {
      system: 0,
      security: 0,
      objective: 0,
      acceptance_criteria: 0,
      skills: 0,
      context: 0,
      history: 0,
      format: 0
    };

    for (const sec of finalSections) {
      tokenBreakdown[sec.type] = (tokenBreakdown[sec.type] || 0) + sec.tokens;
    }

    return {
      assembledPrompt,
      promptFingerprint,
      totalTokens,
      sections: finalSections,
      tokenBreakdown,
      deduplicationSavingsTokens: savedTokens,
      cacheEligible: true
    };
  }

  /**
   * Formats structured sections into string output according to provider preference.
   */
  private static renderPromptText(
    sections: PromptSection[],
    format: 'markdown' | 'xml_tags' | 'standard'
  ): string {
    if (format === 'xml_tags') {
      return sections
        .map((s) => `<${s.type}>\n<!-- ${s.title} -->\n${s.content}\n</${s.type}>`)
        .join('\n\n');
    }

    return sections
      .map((s) => `### ${s.title}\n${s.content}`)
      .join('\n\n');
  }
}
