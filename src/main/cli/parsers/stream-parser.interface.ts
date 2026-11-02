export interface NormalizedStreamChunk {
  textDelta?: string;
  sessionId?: string;
  isError?: boolean;
  errorMessage?: string;
  isDone?: boolean;
  metadata?: Record<string, any>;
}

export interface IStreamParser {
  parseLine(line: string): NormalizedStreamChunk | null;
  reset(): void;
}
