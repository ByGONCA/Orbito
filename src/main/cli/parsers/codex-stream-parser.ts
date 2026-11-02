import type { IStreamParser, NormalizedStreamChunk } from './stream-parser.interface';

export class CodexStreamParser implements IStreamParser {
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
      return { textDelta: `${line}\n` };
    }

    if (!json || typeof json !== 'object') {
      return { textDelta: `${line}\n` };
    }

    const chunk: NormalizedStreamChunk = {};

    // 1. Session ID or Thread ID extraction
    if (json.session_id && typeof json.session_id === 'string') {
      chunk.sessionId = json.session_id;
    } else if (json.thread_id && typeof json.thread_id === 'string') {
      chunk.sessionId = json.thread_id;
    } else if (json.type === 'session' && json.id) {
      chunk.sessionId = String(json.id);
    }

    // 2. Token / Delta streaming
    if (json.type === 'response.text.delta' && typeof json.delta === 'string') {
      chunk.textDelta = json.delta;
      this.hasEmittedDeltas = true;
    } else if (json.type === 'message_delta' && json.delta?.text) {
      chunk.textDelta = json.delta.text;
      this.hasEmittedDeltas = true;
    } else if (json.delta?.text && typeof json.delta.text === 'string') {
      chunk.textDelta = json.delta.text;
      this.hasEmittedDeltas = true;
    } else if (json.type === 'content_part' && json.part?.text) {
      chunk.textDelta = json.part.text;
      this.hasEmittedDeltas = true;
    }

    // 3. Error detection
    if (json.type === 'error' || json.error) {
      chunk.isError = true;
      if (typeof json.error === 'string') {
        chunk.errorMessage = json.error;
      } else if (json.error?.message) {
        chunk.errorMessage = json.error.message;
      } else {
        chunk.errorMessage = JSON.stringify(json.error || json);
      }
    }

    // 4. Response done
    if (json.type === 'response.done' || json.type === 'thread.message.completed') {
      chunk.isDone = true;

      // Only emit text if streaming deltas were not emitted
      if (!this.hasEmittedDeltas && json.response?.output) {
        const output = json.response.output;
        if (Array.isArray(output)) {
          const parts = output
            .flatMap((item: any) => item.content || [])
            .filter((c: any) => c && typeof c.text === 'string')
            .map((c: any) => c.text)
            .join('');
          if (parts) chunk.textDelta = parts;
        }
      }
    }

    if (chunk.textDelta !== undefined || chunk.sessionId || chunk.isError || chunk.isDone) {
      return chunk;
    }

    return null;
  }
}
