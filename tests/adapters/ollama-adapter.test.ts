import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OllamaAdapter } from '../../src/main/cli/adapters/ollama.adapter';
import { OllamaStreamParser } from '../../src/main/cli/parsers/ollama-stream-parser';
import * as detectorUtils from '../../src/main/cli/detector.utils';

describe('Ollama Adapter & Stream Parser Unit Tests', () => {
  let adapter: OllamaAdapter;
  let parser: OllamaStreamParser;

  beforeEach(() => {
    adapter = new OllamaAdapter();
    parser = new OllamaStreamParser();
  });

  describe('OllamaAdapter Configuration & Command Building', () => {
    it('initializes with default llama3:latest model and correct provider identity', () => {
      expect(adapter.provider).toBe('ollama');
      expect(adapter.getModel()).toBe('llama3:latest');
      expect(adapter.capabilities.supportsStreaming).toBe(true);
      expect(adapter.capabilities.supportsHeadlessPrompt).toBe(true);
    });

    it('allows customizing active local model', () => {
      adapter.setModel('mistral:7b');
      expect(adapter.getModel()).toBe('mistral:7b');
      adapter.setModel('  deepseek-r1:8b  ');
      expect(adapter.getModel()).toBe('deepseek-r1:8b');
    });

    it('builds standard non-interactive command line spec', () => {
      adapter.setModel('codellama:13b');
      const cmd = adapter.buildCommand('Refactor function calculate()', 'C:/mock/project');

      expect(cmd.executable).toBe('ollama');
      expect(cmd.args).toEqual(['run', 'codellama:13b', '--nowordwrap', 'Refactor function calculate()']);
      expect(cmd.env).toBeDefined();
      expect(cmd.env?.OLLAMA_HOST).toBe('127.0.0.1:11434');
    });

    it('returns not_installed when binary missing and daemon unresponsive', async () => {
      vi.spyOn(adapter, 'pingDaemon').mockResolvedValue(false);
      vi.spyOn(detectorUtils, 'findExecutableOnPath').mockResolvedValue(null);
      const auth = await adapter.checkAuth();
      expect(auth.isAuthenticated).toBe(false);
      expect(auth.state).toBe('not_installed');
    });

    it('returns installed but unauthenticated when binary is found on disk but daemon unresponsive', async () => {
      vi.spyOn(adapter, 'pingDaemon').mockResolvedValue(false);
      const auth = await adapter.checkAuth('C:/mock/ollama.exe');
      expect(auth.isAuthenticated).toBe(false);
      expect(auth.state).toBe('installed');
      expect(auth.details).toContain('daemon');
    });

    it('returns authenticated with available model count when daemon is running', async () => {
      vi.spyOn(adapter, 'pingDaemon').mockResolvedValue(true);
      vi.spyOn(adapter, 'listLocalModels').mockResolvedValue(['llama3:latest', 'mistral:latest']);

      const auth = await adapter.checkAuth();
      expect(auth.isAuthenticated).toBe(true);
      expect(auth.state).toBe('authenticated');
      expect(auth.details).toContain('2 model(s)');
      expect(auth.details).toContain('llama3:latest');
    });

    it('returns configured state when daemon runs but no models are downloaded yet', async () => {
      vi.spyOn(adapter, 'pingDaemon').mockResolvedValue(true);
      vi.spyOn(adapter, 'listLocalModels').mockResolvedValue([]);

      const auth = await adapter.checkAuth();
      expect(auth.isAuthenticated).toBe(true);
      expect(auth.state).toBe('configured');
      expect(auth.details).toContain('no models have been pulled yet');
    });
  });

  describe('OllamaStreamParser', () => {
    it('parses raw plaintext stream lines without crashing', () => {
      const chunk1 = parser.parseLine('Hello world from local LLM!');
      expect(chunk1).toEqual({ textDelta: 'Hello world from local LLM!\n' });

      const chunk2 = parser.parseLine('Second line of response');
      expect(chunk2).toEqual({ textDelta: 'Second line of response\n' });
    });

    it('ignores empty lines', () => {
      expect(parser.parseLine('')).toBeNull();
      expect(parser.parseLine('   \n  ')).toBeNull();
    });

    it('parses Ollama REST JSON response chunks with token deltas', () => {
      const jsonLine = JSON.stringify({
        model: 'llama3:latest',
        created_at: '2026-11-02T12:00:00Z',
        response: 'const x = 42;',
        done: false
      });

      const chunk = parser.parseLine(jsonLine);
      expect(chunk).toBeDefined();
      expect(chunk?.textDelta).toBe('const x = 42;');
    });

    it('parses chat completion message format', () => {
      const jsonLine = JSON.stringify({
        model: 'llama3:latest',
        message: { role: 'assistant', content: 'Here is your function:' },
        done: false
      });

      const chunk = parser.parseLine(jsonLine);
      expect(chunk?.textDelta).toBe('Here is your function:');
    });

    it('captures performance metrics and token counts on completion (done: true)', () => {
      const jsonLine = JSON.stringify({
        model: 'llama3:latest',
        response: '',
        done: true,
        total_duration: 1540000000,
        prompt_eval_count: 45,
        eval_count: 128
      });

      const chunk = parser.parseLine(jsonLine);
      expect(chunk?.metadata).toBeDefined();
      expect(chunk?.metadata?.totalDuration).toBe(1540000000);
      expect(chunk?.metadata?.promptTokens).toBe(45);
      expect(chunk?.metadata?.evalTokens).toBe(128);
    });

    it('resets internal state properly', () => {
      parser.reset();
      const chunk = parser.parseLine('Fresh after reset');
      expect(chunk?.textDelta).toBe('Fresh after reset\n');
    });
  });
});
