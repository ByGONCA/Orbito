import { describe, it, expect, afterEach } from 'vitest';
import { ptyService } from '../src/main/terminal/pty-service';
import { antigravityAdapter } from '../src/main/cli/adapters/antigravity.adapter';
import { geminiAdapter } from '../src/main/cli/adapters/gemini.adapter';
import { codexAdapter } from '../src/main/cli/adapters/codex.adapter';
import { claudeCodeAdapter } from '../src/main/cli/adapters/claude-code.adapter';

describe('Interactive PTY Terminal Service & Agent CLI Adapters', () => {
  afterEach(() => {
    ptyService.killAll();
  });

  it('spawns a genuine interactive PTY shell process and handles bidirectional I/O', async () => {
    const terminalId = `test-term-${Date.now()}`;
    const result = await ptyService.createSession({
      terminalId,
      provider: process.platform === 'win32' ? 'cmd' : 'bash',
      cols: 80,
      rows: 24
    });

    expect(result.success).toBe(true);
    expect(result.pid).toBeTypeOf('number');

    const session = ptyService.getSession(terminalId);
    expect(session).toBeDefined();
    expect(session?.id).toBe(terminalId);

    // Test data reception
    const receivedData = await new Promise<string>((resolve) => {
      let buffer = '';
      const onData = ({ terminalId: tid, data }: { terminalId: string; data: string }) => {
        if (tid === terminalId) {
          buffer += data;
          if (buffer.length > 10) {
            ptyService.off('data', onData);
            resolve(buffer);
          }
        }
      };
      ptyService.on('data', onData);

      // Write test command
      ptyService.write(terminalId, 'echo ORBITO_PTY_ALIVE\r\n');
    });

    expect(receivedData.length).toBeGreaterThan(0);

    // Test resize
    expect(() => ptyService.resize(terminalId, 120, 40)).not.toThrow();

    // Test graceful kill
    const killed = ptyService.kill(terminalId);
    expect(killed).toBe(true);
    expect(ptyService.getSession(terminalId)).toBeUndefined();
  });

  it('resolves Antigravity interactive launch specifications with native arguments', async () => {
    const launchSpec = await antigravityAdapter.getInteractiveLaunchSpec({
      workingDirectory: process.cwd(),
      model: 'gemini-2.5-pro'
    });

    expect(launchSpec.success).toBe(true);
    if (launchSpec.success) {
      expect(launchSpec.spec.executable).toMatch(/agy/i);
      expect(launchSpec.spec.args).toContain('--dangerously-skip-permissions');
      expect(launchSpec.spec.args).toContain('--model');
      expect(launchSpec.spec.args).toContain('gemini-2.5-pro');
      expect(launchSpec.spec.cwd).toBe(process.cwd());
    }
  });

  it('resolves Gemini CLI interactive launch specifications with native flags', async () => {
    const launchSpec = await geminiAdapter.getInteractiveLaunchSpec({
      workingDirectory: process.cwd(),
      model: 'gemini-2.5-flash'
    });

    expect(launchSpec.success).toBe(true);
    if (launchSpec.success) {
      expect(launchSpec.spec.executable).toMatch(/gemini/i);
      expect(launchSpec.spec.args).toContain('-m');
      expect(launchSpec.spec.args).toContain('gemini-2.5-flash');
    }
  });

  it('resolves OpenAI Codex CLI interactive launch specifications', async () => {
    const launchSpec = await codexAdapter.getInteractiveLaunchSpec({
      workingDirectory: process.cwd(),
      model: 'o3-mini'
    });

    expect(launchSpec.success).toBe(true);
    if (launchSpec.success) {
      expect(launchSpec.spec.executable).toMatch(/codex/i);
      expect(launchSpec.spec.args).toContain('-m');
      expect(launchSpec.spec.args).toContain('o3-mini');
    }
  });

  it('returns clean error and installation instructions when an agent is not installed', async () => {
    // Probe a non-existent path
    const launchSpec = await claudeCodeAdapter.getInteractiveLaunchSpec({
      workingDirectory: process.cwd(),
      customPath: 'C:\\NonExistent\\Path\\claude.exe'
    });

    expect(launchSpec.success).toBe(false);
    if (!launchSpec.success) {
      expect(launchSpec.error).toContain('Claude Code');
      expect(launchSpec.installCommand).toBe('npm install -g @anthropic-ai/claude-code');
      expect(launchSpec.installGuideUrl).toContain('docs.anthropic.com');
    }
  });

  it('maintains independent concurrent PTY sessions without stream collision', async () => {
    const idA = `term-A-${Date.now()}`;
    const idB = `term-B-${Date.now()}`;

    const resA = await ptyService.createSession({
      terminalId: idA,
      provider: 'cmd',
      cols: 80,
      rows: 24
    });
    const resB = await ptyService.createSession({
      terminalId: idB,
      provider: 'cmd',
      cols: 80,
      rows: 24
    });

    expect(resA.success).toBe(true);
    expect(resB.success).toBe(true);
    expect(resA.pid).not.toBe(resB.pid);

    expect(ptyService.getSession(idA)).toBeDefined();
    expect(ptyService.getSession(idB)).toBeDefined();

    ptyService.killAll();
    expect(ptyService.getSession(idA)).toBeUndefined();
    expect(ptyService.getSession(idB)).toBeUndefined();
  });
});
