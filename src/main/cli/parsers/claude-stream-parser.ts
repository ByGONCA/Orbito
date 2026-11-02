import type { IStreamParser, NormalizedStreamChunk } from './stream-parser.interface';

export class ClaudeStreamParser implements IStreamParser {
  private hasEmittedDeltas = false;

  public reset(): void {
    this.hasEmittedDeltas = false;
  }

  public parseLine(line: string): NormalizedStreamChunk | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    let json: any;
    try {
      json = JSON.parse(trimmed);
    } catch {
      // Plain text output
      return { textDelta: `${line}\n` };
    }

    if (!json || typeof json !== 'object') {
      return { textDelta: `${line}\n` };
    }

    const chunk: NormalizedStreamChunk = {};

    // 1. Session ID extraction from init or result events
    if (json.session_id && typeof json.session_id === 'string') {
      chunk.sessionId = json.session_id;
    } else if (json.sessionId && typeof json.sessionId === 'string') {
      chunk.sessionId = json.sessionId;
    }

    // 2. Stream event content_block_delta (token deltas)
    if (json.type === 'stream_event' && json.event?.delta?.text) {
      chunk.textDelta = json.event.delta.text;
      this.hasEmittedDeltas = true;
    } else if (json.type === 'content_block_delta' && json.delta?.text) {
      chunk.textDelta = json.delta.text;
      this.hasEmittedDeltas = true;
    } else if (json.delta?.type === 'text_delta' && json.delta?.text) {
      chunk.textDelta = json.delta.text;
      this.hasEmittedDeltas = true;
    }

    // 3. Assistant message blocks (when not streamed via delta)
    if (json.type === 'assistant' && json.message?.content && Array.isArray(json.message.content)) {
      if (!this.hasEmittedDeltas) {
        const textParts = json.message.content
          .filter((p: any) => p && p.type === 'text' && typeof p.text === 'string')
          .map((p: any) => p.text)
          .join('');
        if (textParts) {
          chunk.textDelta = textParts;
          this.hasEmittedDeltas = true;
        }
      }
    }

    // 4. Result event (final outcome)
    if (json.type === 'result') {
      chunk.isDone = true;

      // Detect error in result
      if (json.is_error || json.subtype === 'error' || json.terminal_reason === 'api_error') {
        chunk.isError = true;
        chunk.errorMessage = typeof json.result === 'string' ? json.result : 'Claude CLI execution error';
      } else if (!this.hasEmittedDeltas && typeof json.result === 'string') {
        // Emit full result ONLY if token deltas were not emitted previously to prevent duplicates!
        chunk.textDelta = json.result;
      }

      if (json.total_cost_usd !== undefined || json.usage) {
        chunk.metadata = {
          totalCostUsd: json.total_cost_usd,
          usage: json.usage
        };
      }
    }

    // Return chunk if anything relevant was parsed
    if (chunk.textDelta !== undefined || chunk.sessionId || chunk.isError || chunk.isDone) {
      return chunk;
    }

    return null;
  }
}
