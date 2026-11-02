import type { IStreamParser, NormalizedStreamChunk } from './stream-parser.interface';

export class OllamaStreamParser implements IStreamParser {
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
      // Direct raw text streaming from 'ollama run'
      return { textDelta: `${line}\n` };
    }

    if (!json || typeof json !== 'object') {
      return { textDelta: `${line}\n` };
    }

    const chunk: NormalizedStreamChunk = {};

    // Ollama REST / JSON stream format: { "model": "...", "response": "token", "done": false }
    if (typeof json.response === 'string') {
      chunk.textDelta = json.response;
      this.hasEmittedDeltas = true;
    } else if (typeof json.message?.content === 'string') {
      chunk.textDelta = json.message.content;
      this.hasEmittedDeltas = true;
    }

    if (json.done === true) {
      if (typeof json.total_duration === 'number') {
        chunk.metadata = {
          totalDuration: json.total_duration,
          promptTokens: json.prompt_eval_count,
          evalTokens: json.eval_count
        };
      }
    }

    return Object.keys(chunk).length > 0 ? chunk : null;
  }
}
