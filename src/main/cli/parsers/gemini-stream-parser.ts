import type { IStreamParser, NormalizedStreamChunk } from './stream-parser.interface';

export class GeminiStreamParser implements IStreamParser {
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

    // 1. Session ID extraction
    if (json.session_id && typeof json.session_id === 'string') {
      chunk.sessionId = json.session_id;
    } else if (json.sessionId && typeof json.sessionId === 'string') {
      chunk.sessionId = json.sessionId;
    }

    // 2. Candidate text parts
    if (json.candidates && Array.isArray(json.candidates)) {
      const parts: string[] = [];
      for (const candidate of json.candidates) {
        if (candidate.finishReason) {
          chunk.isDone = true;
        }
        if (candidate.content?.parts && Array.isArray(candidate.content.parts)) {
          for (const part of candidate.content.parts) {
            if (part && typeof part.text === 'string') {
              parts.push(part.text);
            }
          }
        }
      }
      if (parts.length > 0) {
        chunk.textDelta = parts.join('');
        this.hasEmittedDeltas = true;
      }
    } else if (typeof json.response === 'string') {
      chunk.textDelta = json.response;
      this.hasEmittedDeltas = true;
    }

    // 3. Error detection
    if (json.error) {
      chunk.isError = true;
      if (typeof json.error === 'string') {
        chunk.errorMessage = json.error;
      } else if (json.error?.message) {
        chunk.errorMessage = json.error.message;
      } else {
        chunk.errorMessage = JSON.stringify(json.error);
      }
    }

    if (json.status === 'completed' || json.status === 'done') {
      chunk.isDone = true;
    }

    if (chunk.textDelta !== undefined || chunk.sessionId || chunk.isError || chunk.isDone) {
      return chunk;
    }

    return null;
  }
}
