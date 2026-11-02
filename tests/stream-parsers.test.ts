import { describe, it, expect } from 'vitest';
import { ClaudeStreamParser } from '../src/main/cli/parsers/claude-stream-parser';
import { CodexStreamParser } from '../src/main/cli/parsers/codex-stream-parser';
import { GeminiStreamParser } from '../src/main/cli/parsers/gemini-stream-parser';

describe('Provider-Specific Stream Parsers Unit Tests', () => {
  describe('ClaudeStreamParser', () => {
    it('captures sessionId from init event', () => {
      const parser = new ClaudeStreamParser();
      const line = JSON.stringify({
        type: 'system',
        subtype: 'init',
        session_id: '6ca16ab6-4df1-4dcd-9645-ca0970e4ccfc',
        tools: ['Bash', 'Edit']
      });

      const chunk = parser.parseLine(line);
      expect(chunk).toBeDefined();
      expect(chunk?.sessionId).toBe('6ca16ab6-4df1-4dcd-9645-ca0970e4ccfc');
      expect(chunk?.textDelta).toBeUndefined();
    });

    it('streams token deltas without duplication on result', () => {
      const parser = new ClaudeStreamParser();

      // Delta 1
      const d1 = parser.parseLine(
        JSON.stringify({
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: 'Hello ' }
          }
        })
      );
      expect(d1?.textDelta).toBe('Hello ');

      // Delta 2
      const d2 = parser.parseLine(
        JSON.stringify({
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'world!' }
        })
      );
      expect(d2?.textDelta).toBe('world!');

      // Final result event with full text
      const r = parser.parseLine(
        JSON.stringify({
          type: 'result',
          subtype: 'success',
          result: 'Hello world!',
          session_id: '6ca16ab6-4df1-4dcd-9645-ca0970e4ccfc',
          total_cost_usd: 0.002
        })
      );

      // Crucial deduplication check: textDelta MUST NOT be repeated!
      expect(r?.isDone).toBe(true);
      expect(r?.sessionId).toBe('6ca16ab6-4df1-4dcd-9645-ca0970e4ccfc');
      expect(r?.textDelta).toBeUndefined();
      expect(r?.metadata?.totalCostUsd).toBe(0.002);
    });

    it('emits full text if no streaming deltas were received', () => {
      const parser = new ClaudeStreamParser();
      const r = parser.parseLine(
        JSON.stringify({
          type: 'result',
          subtype: 'success',
          result: 'Single non-streamed response',
          session_id: 'sess-single'
        })
      );

      expect(r?.isDone).toBe(true);
      expect(r?.textDelta).toBe('Single non-streamed response');
    });

    it('identifies and isolates error results', () => {
      const parser = new ClaudeStreamParser();
      const r = parser.parseLine(
        JSON.stringify({
          type: 'result',
          is_error: true,
          result: 'Not logged in · Please run /login',
          terminal_reason: 'api_error'
        })
      );

      expect(r?.isDone).toBe(true);
      expect(r?.isError).toBe(true);
      expect(r?.errorMessage).toBe('Not logged in · Please run /login');
    });
  });

  describe('CodexStreamParser', () => {
    it('captures sessionId and threadId', () => {
      const parser = new CodexStreamParser();
      const s1 = parser.parseLine(JSON.stringify({ type: 'session', session_id: 'codex-sess-999' }));
      expect(s1?.sessionId).toBe('codex-sess-999');

      const s2 = parser.parseLine(JSON.stringify({ type: 'thread.created', thread_id: 'thread-abc-123' }));
      expect(s2?.sessionId).toBe('thread-abc-123');
    });

    it('streams deltas and avoids duplication on response.done', () => {
      const parser = new CodexStreamParser();

      const d1 = parser.parseLine(JSON.stringify({ type: 'response.text.delta', delta: 'Calculating ' }));
      const d2 = parser.parseLine(JSON.stringify({ type: 'response.text.delta', delta: 'result: 42' }));

      expect(d1?.textDelta).toBe('Calculating ');
      expect(d2?.textDelta).toBe('result: 42');

      const done = parser.parseLine(
        JSON.stringify({
          type: 'response.done',
          response: {
            output: [{ content: [{ text: 'Calculating result: 42' }] }]
          }
        })
      );

      expect(done?.isDone).toBe(true);
      expect(done?.textDelta).toBeUndefined(); // Deduplicated!
    });

    it('identifies errors in stream', () => {
      const parser = new CodexStreamParser();
      const err = parser.parseLine(
        JSON.stringify({
          type: 'error',
          error: { message: 'Organization quota exceeded', code: 'insufficient_quota' }
        })
      );

      expect(err?.isError).toBe(true);
      expect(err?.errorMessage).toBe('Organization quota exceeded');
    });
  });

  describe('GeminiStreamParser', () => {
    it('captures sessionId and candidate text parts', () => {
      const parser = new GeminiStreamParser();

      const s = parser.parseLine(JSON.stringify({ session_id: 'gem-session-555' }));
      expect(s?.sessionId).toBe('gem-session-555');

      const c1 = parser.parseLine(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: 'Gemini streaming response.' }]
              }
            }
          ]
        })
      );
      expect(c1?.textDelta).toBe('Gemini streaming response.');

      const done = parser.parseLine(JSON.stringify({ candidates: [{ finishReason: 'STOP' }] }));
      expect(done?.isDone).toBe(true);
    });

    it('identifies API errors properly', () => {
      const parser = new GeminiStreamParser();
      const err = parser.parseLine(
        JSON.stringify({
          error: { code: 403, message: 'Gemini API key is blocked or invalid' }
        })
      );

      expect(err?.isError).toBe(true);
      expect(err?.errorMessage).toBe('Gemini API key is blocked or invalid');
    });
  });
});
