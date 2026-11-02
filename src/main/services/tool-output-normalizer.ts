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
   * Normalizes unified git diff outputs, retaining file headers while collapsing unchanged regions.
   */
  public static normalizeDiff(diffText: string, maxLines: number = 200): string {
    const clean = this.stripAnsi(diffText);
    const lines = clean.split(/\r?\n/);
    if (lines.length <= maxLines) return clean;

    const result: string[] = [];
    let fileCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('diff --git') || line.startsWith('--- a/') || line.startsWith('+++ b/')) {
        fileCount++;
        result.push(line);
      } else if (result.length < maxLines - 10) {
        result.push(line);
      }
    }

    result.push(
      `\n[... Diff truncated: ${lines.length - result.length} lines omitted across ${fileCount} files ...]`
    );
    return result.join('\n');
  }
}
