import type { SkillPermissions } from '../../shared/skills';

export interface PermissionEvaluationResult {
  allowed: boolean;
  requiresUserApproval: boolean;
  violations: string[];
}

export type WorkspacePermissionTier = 'strict' | 'standard' | 'permissive';

export class SkillPermissionManager {
  /**
   * Evaluates if a skill's required permissions violate the workspace policy.
   */
  public static evaluate(
    permissions: SkillPermissions,
    tier: WorkspacePermissionTier = 'standard'
  ): PermissionEvaluationResult {
    const violations: string[] = [];
    let requiresUserApproval = false;

    // 1. Filesystem Permissions
    if (permissions.filesystem.write) {
      if (tier === 'strict') {
        violations.push('Filesystem write is prohibited in strict security mode.');
      } else if (tier === 'standard') {
        requiresUserApproval = true;
      }
    }

    // 2. Terminal Permissions
    if (permissions.terminal.execute) {
      if (tier === 'strict' || tier === 'standard') {
        violations.push('Direct terminal command execution is disabled in standard/strict mode.');
      } else {
        requiresUserApproval = true;
      }
    }

    // 3. Network Permissions
    if (permissions.network.allowed) {
      if (tier === 'strict') {
        violations.push('Network egress is prohibited in strict security mode.');
      } else if (tier === 'standard') {
        requiresUserApproval = true;
      }
    }

    return {
      allowed: violations.length === 0,
      requiresUserApproval,
      violations
    };
  }
}
