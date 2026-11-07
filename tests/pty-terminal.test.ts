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

  it('handles signal propagation including SIGINT and SIGTERM gracefully', async () => {
    const terminalId = `term-sig-${Date.now()}`;
    const res = await ptyService.createSession({
      terminalId,
      provider: process.platform === 'win32' ? 'cmd' : 'bash',
      cols: 80,
      rows: 24
    });

    expect(res.success).toBe(true);
    expect(ptyService.isSessionAlive(terminalId)).toBe(true);

    // Send SIGINT (Ctrl+C)
    const sigIntHandled = ptyService.sendSignal(terminalId, 'SIGINT');
    expect(sigIntHandled).toBe(true);

    // Send SIGTERM
    const sigTermHandled = ptyService.sendSignal(terminalId, 'SIGTERM');
    expect(sigTermHandled).toBe(true);

    // Session is cleaned up after termination
    expect(ptyService.getSession(terminalId)).toBeUndefined();
  });

  it('sanitizes invalid and boundary resize parameters without crashing', async () => {
    const terminalId = `term-resize-${Date.now()}`;
    const res = await ptyService.createSession({
      terminalId,
      provider: process.platform === 'win32' ? 'cmd' : 'bash',
      cols: 80,
      rows: 24
    });

    expect(res.success).toBe(true);

    // Negative and zero values should be safely clamped/ignored without throwing
    expect(ptyService.resize(terminalId, -50, 0)).toBe(true);
    expect(ptyService.resize(terminalId, 9999, 5000)).toBe(true);

    ptyService.kill(terminalId);
    // Resizing non-existent session returns false cleanly
    expect(ptyService.resize(terminalId, 80, 24)).toBe(false);
  });

  it('handles invalid working directories by falling back safely to cwd', async () => {
    const terminalId = `term-invalid-dir-${Date.now()}`;
    const res = await ptyService.createSession({
      terminalId,
      provider: process.platform === 'win32' ? 'cmd' : 'bash',
      workingDirectory: 'C:\\NonExistent_Fake_Directory_Orbito_404',
      cols: 80,
      rows: 24
    });

    expect(res.success).toBe(true);
    const session = ptyService.getSession(terminalId);
    expect(session).toBeDefined();
    expect(session?.workingDirectory).toBe(process.cwd());

    ptyService.kill(terminalId);
  });

  it('safely handles write and kill calls on non-existent or terminated sessions', async () => {
    const ghostId = `ghost-${Date.now()}`;
    expect(ptyService.write(ghostId, 'echo ghost\r\n')).toBe(false);
    expect(ptyService.write(ghostId, '')).toBe(false);
    expect(ptyService.kill(ghostId)).toBe(false);
    expect(await ptyService.killAsync(ghostId)).toBe(false);
    expect(ptyService.isSessionAlive(ghostId)).toBe(false);
    expect(ptyService.hasSession(ghostId)).toBe(false);
  });

  it('tracks session metadata and supports killAsync and killAllAsync', async () => {
    const id1 = `term-async-1-${Date.now()}`;
    const id2 = `term-async-2-${Date.now()}`;

    await ptyService.createSession({
      terminalId: id1,
      provider: process.platform === 'win32' ? 'cmd' : 'bash'
    });
    await ptyService.createSession({
      terminalId: id2,
      provider: process.platform === 'win32' ? 'cmd' : 'bash'
    });

    const sessions = ptyService.listSessions();
    expect(sessions.length).toBeGreaterThanOrEqual(2);
    expect(sessions.some((s) => s.id === id1)).toBe(true);
    expect(sessions.some((s) => s.id === id2)).toBe(true);

    const killed1 = await ptyService.killAsync(id1);
    expect(killed1).toBe(true);
    expect(ptyService.hasSession(id1)).toBe(false);

    await ptyService.killAllAsync();
    expect(ptyService.listSessions()).toHaveLength(0);
  });
});
