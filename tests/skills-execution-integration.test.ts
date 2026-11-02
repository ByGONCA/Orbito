import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { databaseService } from '../src/main/db/database.service';
import { skillRegistry } from '../src/main/skills/skill-registry';
import { skillExecutionEngine } from '../src/main/skills/skill-execution-engine';
import { executionEngine } from '../src/main/cli/execution-engine';

const TEST_DIR = path.join(process.cwd(), '.test-skills-exec-workspace');

describe('Skills Execution Engine (Integration, Context Retrieval & Persistence)', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    fs.mkdirSync(TEST_DIR, { recursive: true });

    databaseService.initialize();
    skillRegistry.initialize();

    // Clean execution logs
    databaseService.getAppDb().prepare('DELETE FROM skill_executions').run();
  });

  afterEach(() => {
    databaseService.close();
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('rejects execution of disabled skill and persists failure record', async () => {
    skillRegistry.toggleSkill('performance-analysis', false);

    const res = await skillExecutionEngine.execute({
      skillId: 'performance-analysis',
      prompt: 'Check performance bottlenecks',
      projectId: 'proj-1',
      projectPath: TEST_DIR,
      provider: 'claude'
    });

    expect(res.success).toBe(false);
    expect(res.status).toBe('failed');
    expect(res.error).toContain('disabled');

    // Verify record in SQLite
    const records = databaseService.listSkillExecutions('proj-1');
    expect(records.length).toBe(1);
    expect(records[0].skillId).toBe('performance-analysis');
    expect(records[0].status).toBe('failed');
    expect(records[0].errorMessage).toContain('disabled');

    // Restore enabled
    skillRegistry.toggleSkill('performance-analysis', true);
  });

  it('blocks execution when skill required permissions violate strict tier', async () => {
    // bug-fixing has filesystem: { write: true }
    const res = await skillExecutionEngine.execute({
      skillId: 'bug-fixing',
      prompt: 'Fix the null pointer bug',
      projectId: 'proj-1',
      projectPath: TEST_DIR,
      provider: 'claude',
      permissionTier: 'strict' // Strict forbids filesystem write
    });

    expect(res.success).toBe(false);
    expect(res.status).toBe('failed');
    expect(res.error).toContain('Permission violation');

    const records = databaseService.listSkillExecutions('proj-1');
    expect(records.length).toBe(1);
    expect(records[0].errorMessage).toContain('Permission violation');
  });

  it('assembles context and executes command via ExecutionEngine, recording complete run', async () => {
    // Mock executionEngine.execute to avoid needing a live third-party CLI process
    const execSpy = vi.spyOn(executionEngine, 'execute').mockResolvedValue({
      sessionId: 'session-skill-test-123'
    });

    const res = await skillExecutionEngine.execute({
      skillId: 'code-review',
      prompt: 'Review the authentication flow',
      projectId: 'proj-1',
      projectPath: TEST_DIR,
      provider: 'claude',
      permissionTier: 'standard'
    });

    expect(res.success).toBe(true);
    expect(res.status).toBe('completed');
    expect(res.sessionId).toBeDefined();
    expect(execSpy).toHaveBeenCalledOnce();

    // Verify that the prompt sent to the CLI contains the skill instructions
    const passedPrompt = execSpy.mock.calls[0][0].prompt;
    expect(passedPrompt).toContain('SKILL INSTRUCTION SET: Code Review Specialist');
    expect(passedPrompt).toContain('Review the authentication flow');

    // Verify execution history recorded in SQLite
    const records = databaseService.listSkillExecutions('proj-1');
    expect(records.length).toBe(1);
    expect(records[0].skillId).toBe('code-review');
    expect(records[0].status).toBe('completed');
    expect(records[0].tokensUsed).toBeGreaterThan(0);
  });
});
