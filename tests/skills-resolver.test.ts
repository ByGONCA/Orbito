import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { databaseService } from '../src/main/db/database.service';
import { skillRegistry } from '../src/main/skills/skill-registry';
import { SkillResolver } from '../src/main/skills/skill-resolver';

describe('Skill Resolver (Intent Matching & Progressive Disclosure)', () => {
  beforeEach(() => {
    databaseService.initialize();
    skillRegistry.initialize();
  });

  afterEach(() => {
    databaseService.close();
  });

  it('resolves code-review intent with high confidence', () => {
    const results = SkillResolver.resolve('Please do a code review on this pull request to spot bugs and antipatterns');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.skill.id).toBe('code-review');
    expect(top.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('resolves bug-investigation intent from stack trace prompt', () => {
    const results = SkillResolver.resolve('Diagnose this crash and investigate the root cause of this stack trace error');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.skill.id).toBe('bug-investigation');
    expect(top.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('resolves test-generation intent for unit test requests', () => {
    const results = SkillResolver.resolve('Write a vitest test suite covering edge cases and unit test assertions');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.skill.id).toBe('test-generation');
    expect(top.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('resolves security-review intent for vulnerability audits', () => {
    const results = SkillResolver.resolve('Perform an OWASP security audit to check for injection vulnerabilities and token leaks');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.skill.id).toBe('security-review');
    expect(top.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('respects provider compatibility filter', () => {
    // When provider is specified, only returns compatible skills
    const results = SkillResolver.resolve('review this code', 'claude');
    for (const res of results) {
      expect(res.skill.supportedProviders).toContain('claude');
    }
  });
});
