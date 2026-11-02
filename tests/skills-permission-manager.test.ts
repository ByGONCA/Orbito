import { describe, it, expect } from 'vitest';
import { SkillPermissionManager } from '../src/main/skills/skill-permission-manager';
import type { SkillPermissions } from '../src/shared/skills';

describe('Skill Permission Manager (Policy Enforcement & Guardrails)', () => {
  const readOnlyPerms: SkillPermissions = {
    filesystem: { read: true, write: false },
    terminal: { execute: false },
    network: { allowed: false }
  };

  const writePerms: SkillPermissions = {
    filesystem: { read: true, write: true },
    terminal: { execute: false },
    network: { allowed: false }
  };

  const terminalPerms: SkillPermissions = {
    filesystem: { read: true, write: false },
    terminal: { execute: true, allowedCommands: ['git status'] },
    network: { allowed: false }
  };

  const networkPerms: SkillPermissions = {
    filesystem: { read: true, write: false },
    terminal: { execute: false },
    network: { allowed: true }
  };

  it('allows read-only permissions across all tiers without requiring user approval', () => {
    const strictRes = SkillPermissionManager.evaluate(readOnlyPerms, 'strict');
    const stdRes = SkillPermissionManager.evaluate(readOnlyPerms, 'standard');
    const permRes = SkillPermissionManager.evaluate(readOnlyPerms, 'permissive');

    expect(strictRes.allowed).toBe(true);
    expect(strictRes.requiresUserApproval).toBe(false);

    expect(stdRes.allowed).toBe(true);
    expect(stdRes.requiresUserApproval).toBe(false);

    expect(permRes.allowed).toBe(true);
    expect(permRes.requiresUserApproval).toBe(false);
  });

  it('blocks filesystem write in strict tier and requires approval in standard tier', () => {
    const strictRes = SkillPermissionManager.evaluate(writePerms, 'strict');
    expect(strictRes.allowed).toBe(false);
    expect(strictRes.violations.some((v) => v.includes('Filesystem write'))).toBe(true);

    const stdRes = SkillPermissionManager.evaluate(writePerms, 'standard');
    expect(stdRes.allowed).toBe(true);
    expect(stdRes.requiresUserApproval).toBe(true);
  });

  it('blocks terminal execution in strict and standard tiers', () => {
    const strictRes = SkillPermissionManager.evaluate(terminalPerms, 'strict');
    expect(strictRes.allowed).toBe(false);

    const stdRes = SkillPermissionManager.evaluate(terminalPerms, 'standard');
    expect(stdRes.allowed).toBe(false);
    expect(stdRes.violations.some((v) => v.includes('terminal'))).toBe(true);

    const permRes = SkillPermissionManager.evaluate(terminalPerms, 'permissive');
    expect(permRes.allowed).toBe(true);
    expect(permRes.requiresUserApproval).toBe(true);
  });

  it('blocks network access in strict mode and flags approval in standard mode', () => {
    const strictRes = SkillPermissionManager.evaluate(networkPerms, 'strict');
    expect(strictRes.allowed).toBe(false);
    expect(strictRes.violations.some((v) => v.includes('Network egress'))).toBe(true);

    const stdRes = SkillPermissionManager.evaluate(networkPerms, 'standard');
    expect(stdRes.allowed).toBe(true);
    expect(stdRes.requiresUserApproval).toBe(true);
  });
});
