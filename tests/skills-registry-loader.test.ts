import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { databaseService } from '../src/main/db/database.service';
import { skillRegistry } from '../src/main/skills/skill-registry';
import { SkillLoader } from '../src/main/skills/skill-loader';
import { CustomSkillsService } from '../src/main/skills/custom-skills.service';

const TEST_STORAGE_DIR = path.join(process.cwd(), '.test-skills-storage');
const TEST_CUSTOM_SRC = path.join(process.cwd(), '.test-custom-skill-src');

describe('Skills Registry & Progressive Dynamic Loader', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_STORAGE_DIR)) fs.rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
    if (fs.existsSync(TEST_CUSTOM_SRC)) fs.rmSync(TEST_CUSTOM_SRC, { recursive: true, force: true });

    databaseService.initialize();
    skillRegistry.initialize(TEST_STORAGE_DIR);
  });

  afterEach(() => {
    databaseService.close();
    if (fs.existsSync(TEST_STORAGE_DIR)) fs.rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
    if (fs.existsSync(TEST_CUSTOM_SRC)) fs.rmSync(TEST_CUSTOM_SRC, { recursive: true, force: true });
  });

  it('discovers and loads all 10 built-in skills with valid metadata', () => {
    const skills = skillRegistry.listSkills();

    // At least 10 built-in skills
    expect(skills.length).toBeGreaterThanOrEqual(10);

    const expectedIds = [
      'code-review',
      'bug-investigation',
      'bug-fixing',
      'refactoring',
      'documentation',
      'test-generation',
      'security-review',
      'project-understanding',
      'performance-analysis',
      'code-explanation'
    ];

    for (const expectedId of expectedIds) {
      const skill = skills.find((s) => s.id === expectedId);
      expect(skill, `Expected skill ${expectedId} to be registered`).toBeDefined();
      expect(skill?.isBuiltIn).toBe(true);
      expect(skill?.enabled).toBe(true);
      expect(skill?.checksum).toBeDefined();
      expect(skill?.permissions).toBeDefined();
    }
  });

  it('verifies progressive dynamic loading (loads instructions on-demand only)', () => {
    const meta = skillRegistry.getSkill('code-review');
    expect(meta).toBeDefined();
    // Metadata only contains paths and summary
    expect((meta as any).instructions).toBeUndefined();

    // Load full details lazily
    const details = SkillLoader.loadDetails(meta!);
    expect(details.instructions).toBeDefined();
    expect(details.instructions.length).toBeGreaterThan(50);
    expect(details.instructions).toContain('Code Review Specialist Guidelines');
  });

  it('toggles skill enabled state and persists in database', () => {
    expect(skillRegistry.getSkill('refactoring')?.enabled).toBe(true);

    skillRegistry.toggleSkill('refactoring', false);
    expect(skillRegistry.getSkill('refactoring')?.enabled).toBe(false);

    // Verify persisted in SQLite
    const persisted = databaseService.getSkill('refactoring');
    expect(persisted?.enabled).toBe(false);

    // Toggle back on
    skillRegistry.toggleSkill('refactoring', true);
    expect(skillRegistry.getSkill('refactoring')?.enabled).toBe(true);
  });

  it('imports custom skill, disables by default, and allows deletion', () => {
    // Create synthetic custom skill folder
    fs.mkdirSync(TEST_CUSTOM_SRC, { recursive: true });
    fs.writeFileSync(
      path.join(TEST_CUSTOM_SRC, 'manifest.json'),
      JSON.stringify({
        id: 'team-conventions',
        name: 'Team Conventions Enforcer',
        description: 'Enforces internal naming and commit standards.',
        version: '1.0.0',
        author: 'Internal Team',
        category: 'quality',
        tags: ['conventions', 'style'],
        supportedProviders: ['claude', 'codex'],
        requiredCapabilities: [],
        requiredPermissions: {
          filesystem: { read: true, write: false },
          terminal: { execute: false },
          network: { allowed: false }
        },
        contextRequirements: {
          indexingNeeded: true,
          maxContextTokens: 8000
        }
      })
    );
    fs.writeFileSync(
      path.join(TEST_CUSTOM_SRC, 'instructions.md'),
      '# Team Conventions Instructions\nEnsure all variables use camelCase.'
    );

    const importRes = CustomSkillsService.importFromFolder(TEST_CUSTOM_SRC);
    expect(importRes.success).toBe(true);
    expect(importRes.skill).toBeDefined();
    expect(importRes.skill?.id).toBe('team-conventions');
    expect(importRes.skill?.isBuiltIn).toBe(false);
    expect(importRes.skill?.enabled).toBe(false); // Disabled by default for security!

    // Verify it exists in registry
    expect(skillRegistry.getSkill('team-conventions')).toBeDefined();

    // Verify deletion
    const deleteRes = skillRegistry.removeCustomSkill('team-conventions');
    expect(deleteRes).toBe(true);
    expect(skillRegistry.getSkill('team-conventions')).toBeNull();
  });
});
