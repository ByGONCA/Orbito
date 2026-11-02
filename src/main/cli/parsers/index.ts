import type { CLIProvider } from '../../../shared/cli';
import type { IStreamParser } from './stream-parser.interface';
import { ClaudeStreamParser } from './claude-stream-parser';
import { CodexStreamParser } from './codex-stream-parser';
import { GeminiStreamParser } from './gemini-stream-parser';

export * from './stream-parser.interface';
export * from './claude-stream-parser';
export * from './codex-stream-parser';
export * from './gemini-stream-parser';

export function createStreamParser(provider: CLIProvider): IStreamParser {
  switch (provider) {
    case 'claude':
      return new ClaudeStreamParser();
    case 'codex':
      return new CodexStreamParser();
    case 'gemini':
      return new GeminiStreamParser();
    default:
      return new ClaudeStreamParser();
  }
}
