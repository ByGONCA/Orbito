import path from 'node:path';
import fs from 'node:fs';
import { tokenCounterService } from '../tokens/token-counter.service';
import { databaseService } from '../../db/database.service';
import type { ContextFragment, ContextAssemblyResult } from '../../../shared/context';

export interface AssemblyOptions {
  projectPath: string;
  fragments: ContextFragment[];
  maxTokens?: number;
  modelTarget?: 'claude' | 'codex' | 'gemini';
}

export class ContextAssemblyService {
  /**
   * Assembles prioritized fragments, performs live disk reads on modified files,
   * merges overlapping ranges, and strictly enforces the token budget.
   */
  public async assemble(options: AssemblyOptions): Promise<ContextAssemblyResult> {
    const startTime = Date.now();
    const { projectPath, fragments, modelTarget = 'claude' } = options;

    const tokenBudget = options.maxTokens || tokenCounterService.getModelMaxBudget(modelTarget);

    // 1. Check for modified files and perform Live Disk Reads
    let liveReadsCount = 0;
    const verifiedFragments: ContextFragment[] = [];

    for (const frag of fragments) {
      const fullPath = path.isAbsolute(frag.filePath)
        ? frag.filePath
        : path.join(projectPath, frag.filePath);

      let content = frag.content;
      let isLiveDiskRead = false;

      if (fs.existsSync(fullPath)) {
        try {
          const stat = fs.statSync(fullPath);
          const cached = databaseService.getFileHash(frag.filePath);

          // If modified since last indexed, or if cached is missing, perform live read
          if (!cached || Math.abs(stat.mtimeMs - cached.mtimeMs) > 10) {
            const raw = fs.readFileSync(fullPath, 'utf8');
            const lines = raw.split(/\r?\n/);
            const start = Math.max(1, frag.startLine);
            const end = Math.min(lines.length, frag.endLine);
            content = lines.slice(start - 1, end).join('\n');
            isLiveDiskRead = true;
            liveReadsCount++;
          }
        } catch {
          // Keep cached content if file cannot be read
        }
      }

      verifiedFragments.push({
        ...frag,
        content,
        isLiveDiskRead,
        tokenCount: tokenCounterService.countActualTokens(content)
      });
    }

    // 2. Deduplicate and merge overlapping ranges for the same file
    const mergedFragments = this.mergeOverlappingFragments(verifiedFragments);

    // 3. Prioritize and enforce token budget
    mergedFragments.sort((a, b) => b.priority - a.priority);

    const includedFragments: ContextFragment[] = [];
    let accumulatedActualTokens = 0;
    let accumulatedEstimatedTokens = 0;
    let truncated = false;

    // Fixed header budget reservation (~50 tokens)
    const headerReservation = 50;

    for (const frag of mergedFragments) {
      const fragActual = tokenCounterService.countActualTokens(frag.content);
      const fragEstimated = tokenCounterService.estimateTokens(frag.content);

      if (accumulatedActualTokens + fragActual + headerReservation > tokenBudget) {
        // If high priority and can be partially trimmed
        if (includedFragments.length === 0) {
          // Truncate the single large fragment to fit budget
          const lines = frag.content.split('\n');
          const halfLines = lines.slice(0, Math.floor(lines.length / 2));
          const trimmedContent = halfLines.join('\n') + '\n// ... [Context truncated to fit budget]';
          const trimmedTokens = tokenCounterService.countActualTokens(trimmedContent);

          includedFragments.push({
            ...frag,
            content: trimmedContent,
            tokenCount: trimmedTokens
          });
          accumulatedActualTokens += trimmedTokens;
          accumulatedEstimatedTokens += tokenCounterService.estimateTokens(trimmedContent);
        }
        truncated = true;
        break;
      }

      includedFragments.push(frag);
      accumulatedActualTokens += fragActual;
      accumulatedEstimatedTokens += fragEstimated;
    }

    // 4. Format into structured, agent-friendly Markdown text
    const assembledText = this.formatAssembledContext(projectPath, includedFragments, {
      actualTokens: accumulatedActualTokens,
      estimatedTokens: accumulatedEstimatedTokens,
      budget: tokenBudget,
      truncated
    });

    const totalActual = tokenCounterService.countActualTokens(assembledText);
    const totalEstimated = tokenCounterService.estimateTokens(assembledText);

    return {
      assembledText,
      fragments: includedFragments,
      estimatedTokens: totalEstimated,
      actualTokens: totalActual,
      tokenBudget,
      truncated,
      metrics: {
        searchTimeMs: 0,
        assemblyTimeMs: Date.now() - startTime,
        liveReadsCount
      }
    };
  }

  private mergeOverlappingFragments(fragments: ContextFragment[]): ContextFragment[] {
    const byFile = new Map<string, ContextFragment[]>();
    for (const frag of fragments) {
      const list = byFile.get(frag.filePath) || [];
      list.push(frag);
      byFile.set(frag.filePath, list);
    }

    const merged: ContextFragment[] = [];

    for (const [filePath, list] of byFile) {
      if (list.length === 1) {
        merged.push(list[0]);
        continue;
      }

      // Sort by start line
      list.sort((a, b) => a.startLine - b.startLine);

      let current = list[0];
      for (let i = 1; i < list.length; i++) {
        const next = list[i];
        // If overlapping or adjacent within 3 lines
        if (next.startLine <= current.endLine + 3) {
          const combinedEnd = Math.max(current.endLine, next.endLine);
          // Merge content
          const linesCurrent = current.content.split('\n');
          const linesNext = next.content.split('\n');
          const overlap = current.endLine - next.startLine + 1;
          const mergedLines = [...linesCurrent, ...linesNext.slice(Math.max(0, overlap))];

          current = {
            ...current,
            endLine: combinedEnd,
            content: mergedLines.join('\n'),
            reason: `${current.reason}; ${next.reason}`,
            priority: Math.max(current.priority, next.priority),
            isLiveDiskRead: current.isLiveDiskRead || next.isLiveDiskRead
          };
        } else {
          merged.push(current);
          current = next;
        }
      }
      merged.push(current);
    }

    return merged;
  }

  private formatAssembledContext(
    projectPath: string,
    fragments: ContextFragment[],
    meta: { actualTokens: number; estimatedTokens: number; budget: number; truncated: boolean }
  ): string {
    const parts: string[] = [];

    parts.push('# CONTEXT ENGINE — PROJECT KNOWLEDGE BASE');
    parts.push(
      `<!-- Metrics: Actual Tokens (BPE): ${meta.actualTokens} | Estimated: ${meta.estimatedTokens} | Budget: ${meta.budget}${meta.truncated ? ' | [TRUNCATED]' : ''} -->\n`
    );

    if (fragments.length === 0) {
      parts.push('_No relevant code fragments retrieved for this query._');
      return parts.join('\n');
    }

    for (const frag of fragments) {
      const absPath = path.isAbsolute(frag.filePath) ? frag.filePath : path.join(projectPath, frag.filePath);
      const fileUri = `file:///${absPath.replace(/\\/g, '/')}`;
      const ext = path.extname(frag.filePath).replace('.', '') || 'text';

      parts.push(`## [${frag.filePath}#L${frag.startLine}-L${frag.endLine}](${fileUri}#L${frag.startLine}-L${frag.endLine})`);
      parts.push(`_Reason: ${frag.reason} ${frag.isLiveDiskRead ? '• [Live Disk Read]' : '• [Indexed]'}_\n`);
      parts.push(`\`\`\`${ext}`);
      parts.push(frag.content.trimEnd());
      parts.push('```\n');
    }

    return parts.join('\n');
  }
}

export const contextAssemblyService = new ContextAssemblyService();
