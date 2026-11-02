import type { NormalizedToolOutput } from '../../shared/intelligence';
import { tokenCounterService } from '../context/tokens/token-counter.service';
import crypto from 'node:crypto';

export interface NormalizeOptions {
  maxLines?: number;
  maxCharacters?: number;
  preserveErrors?: boolean;
  storeRawAudit?: boolean;
}

export class ToolOutputNormalizer {
  private static readonly ANSI_REGEX =
    // eslint-disable-next-line no-control-regex
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

  private static readonly MAX_RAW_OUTPUTS = 100;
  private static readonly rawOutputStore = new Map<string, { content: string; timestamp: number }>();

  /**
   * Retrieves the full un-truncated raw tool output by rawOutputId.
   */
  public static getRawOutput(rawOutputId: string): string | null {
    if (!rawOutputId) return null;
    const entry = this.rawOutputStore.get(rawOutputId);
    return entry ? entry.content : null;
  }

  /**
   * Clears the in-memory raw output store.
   */
  public static clearRawOutputs(): void {
    this.rawOutputStore.clear();
  }

  /**
   * Cleans ANSI escape sequences from terminal or CLI output.
   */
  public static stripAnsi(text: string): string {
    return (text || '').replace(this.ANSI_REGEX, '');
  }

  /**
   * Normalizes and compresses voluminous tool outputs into clean, AI-optimized summaries.
   */
  public static normalize(
    rawOutput: string,
    options: NormalizeOptions = {}
  ): NormalizedToolOutput {
    const rawClean = this.stripAnsi(rawOutput || '').trim();
    const originalLength = rawClean.length;
    const initialTokens = tokenCounterService.countActualTokens(rawClean);

    const maxLines = options.maxLines || 120;
    const maxChars = options.maxCharacters || 12000;

    if (originalLength <= maxChars && rawClean.split('\n').length <= maxLines) {
      return {
        normalized: rawClean,
        originalLength,
        normalizedLength: originalLength,
        tokensSaved: 0,
        isTruncated: false
      };
    }

    const lines = rawClean.split(/\r?\n/);
    const totalLines = lines.length;

    // Detect errors or failure markers
    const errorLines: string[] = [];
    const isErrorLine = (line: string) =>
      /(error|fatal|fail|failed|failure|exception|panic|syntaxerror|typeerror|unhandledrejection|assert)/i.test(
        line
      );

    for (const line of lines) {
      if (isErrorLine(line) && errorLines.length < 15) {
        errorLines.push(line.trim());
      }
    }

    // Keep head and tail lines
    const headCount = Math.floor(maxLines * 0.35); // 35% of budget at head
    const tailCount = Math.floor(maxLines * 0.65); // 65% of budget at tail (errors usually at bottom)

    const headLines = lines.slice(0, headCount);
    const tailLines = lines.slice(Math.max(headCount, totalLines - tailCount));
    const omittedCount = totalLines - (headLines.length + tailLines.length);

    const sections: string[] = [];

    // Header if critical error lines found
    if (errorLines.length > 0 && options.preserveErrors !== false) {
      sections.push('--- [DETECTED ERROR HIGHLIGHTS] ---');
      sections.push(errorLines.join('\n'));
      sections.push('-----------------------------------\n');
    }

    sections.push(headLines.join('\n'));
    if (omittedCount > 0) {
      sections.push(
        `\n[... Truncated ${omittedCount} intermediate lines of tool output. Critical context retained ...] \n`
      );
    }
    sections.push(tailLines.join('\n'));

    let normalized = sections.join('\n');
    if (normalized.length > maxChars) {
      normalized =
        normalized.slice(0, maxChars) +
        '\n[... Remaining output truncated to character limit ...]';
    }

    const finalTokens = tokenCounterService.countActualTokens(normalized);
    const tokensSaved = Math.max(0, initialTokens - finalTokens);
    const rawOutputId = crypto.randomBytes(4).toString('hex');

    // Store raw output for on-demand retrieval if requested or truncated
    if (options.storeRawAudit !== false) {
      if (this.rawOutputStore.size >= this.MAX_RAW_OUTPUTS) {
        const oldestKey = this.rawOutputStore.keys().next().value;
        if (oldestKey) this.rawOutputStore.delete(oldestKey);
      }
      this.rawOutputStore.set(rawOutputId, {
        content: rawClean,
        timestamp: Date.now()
      });
    }

    return {
      normalized,
      originalLength,
      normalizedLength: normalized.length,
      tokensSaved,
      isTruncated: true,
      errorSnippet: errorLines.length > 0 ? errorLines.slice(0, 3).join('; ') : undefined,
      rawOutputId
    };
  }

  /**
   * Normalizes unified git diff outputs with balanced multi-file representation.
   * Ensures no single file monopolizes the token budget while starving others.
   */
  public static normalizeDiff(diffText: string, maxLines: number = 200): string {
    const clean = this.stripAnsi(diffText);
    const allLines = clean.split(/\r?\n/);
    if (allLines.length <= maxLines) return clean;

    // Split diff into per-file chunks
    const fileChunks: Array<{ header: string; lines: string[]; fileName: string }> = [];
    let currentChunk: { header: string; lines: string[]; fileName: string } | null = null;

    for (const line of allLines) {
      if (line.startsWith('diff --git ')) {
        if (currentChunk) fileChunks.push(currentChunk);
        const fileNameMatch = line.match(/diff --git a\/(.+?) b\//);
        const fileName = fileNameMatch ? fileNameMatch[1] : 'file';
        currentChunk = { header: line, lines: [], fileName };
      } else if (currentChunk) {
        currentChunk.lines.push(line);
      } else {
        // Diff without standard diff --git header
        currentChunk = { header: line, lines: [], fileName: 'diff' };
      }
    }
    if (currentChunk) fileChunks.push(currentChunk);

    if (fileChunks.length <= 1) {
      // Single file diff truncation
      const head = allLines.slice(0, Math.floor(maxLines * 0.7));
      const tail = allLines.slice(Math.max(head.length, allLines.length - Math.floor(maxLines * 0.3)));
      return [
        ...head,
        `\n[... Diff truncated: ${allLines.length - (head.length + tail.length)} intermediate diff lines omitted ...]`,
        ...tail
      ].join('\n');
    }

    // Multi-file balanced distribution
    const fileCount = fileChunks.length;
    const reservedForSummary = 5;
    const availableLines = Math.max(fileCount * 4, maxLines - reservedForSummary);
    const quotaPerFile = Math.max(6, Math.floor(availableLines / fileCount));

    const result: string[] = [];
    let totalOmittedLines = 0;

    for (const chunk of fileChunks) {
      result.push(chunk.header);

      // Separate file metadata (index, ---, +++) from diff content lines
      const metaLines: string[] = [];
      const contentLines: string[] = [];

      for (const cl of chunk.lines) {
        if (cl.startsWith('index ') || cl.startsWith('--- ') || cl.startsWith('+++ ')) {
          metaLines.push(cl);
        } else {
          contentLines.push(cl);
        }
      }

      result.push(...metaLines);

      const contentQuota = Math.max(2, quotaPerFile - metaLines.length - 1);
      if (contentLines.length <= contentQuota) {
        result.push(...contentLines);
      } else {
        const headCount = Math.ceil(contentQuota * 0.6);
        const tailCount = Math.floor(contentQuota * 0.4);
        result.push(...contentLines.slice(0, headCount));
        const omitted = contentLines.length - (headCount + tailCount);
        totalOmittedLines += omitted;
        result.push(`  [... ${omitted} diff lines omitted in ${chunk.fileName} ...]`);
        if (tailCount > 0) {
          result.push(...contentLines.slice(contentLines.length - tailCount));
        }
      }
    }

    result.push(
      `\n[... Multi-file diff balanced: ${totalOmittedLines} total lines omitted across ${fileCount} files ...]`
    );

    return result.join('\n');
  }
}
