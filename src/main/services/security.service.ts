import fs from 'node:fs';
import path from 'node:path';
import type { PermissionLevel } from '../../shared/types';
import { auditService } from './audit.service';

export class SecurityViolationException extends Error {
  constructor(message: string) {
    super(`[SecurityViolation] ${message}`);
    this.name = 'SecurityViolationException';
  }
}

export class SecurityService {
  /**
   * Asserts that a target path is strictly within the authorized workspace root.
   * Resolves symlinks and relative paths to canonical physical paths.
   */
  public assertWithinWorkspace(targetPath: string, workspaceRoot: string): string {
    if (!targetPath || !workspaceRoot) {
      const err = 'Both targetPath and workspaceRoot are required for path validation.';
      auditService.logSecurityViolation('security_kernel', 'path_validation_failed', err);
      throw new SecurityViolationException(err);
    }

    const resolvedRoot = path.resolve(workspaceRoot);
    if (!fs.existsSync(resolvedRoot)) {
      const err = `Workspace root does not exist on disk: ${workspaceRoot}`;
      auditService.logSecurityViolation('security_kernel', 'root_not_found', err, workspaceRoot);
      throw new SecurityViolationException(err);
    }

    const canonicalRoot = fs.realpathSync(resolvedRoot);

    // Resolve target path
    const resolvedTarget = path.isAbsolute(targetPath)
      ? path.resolve(targetPath)
      : path.resolve(canonicalRoot, targetPath);

    // Check if target exists on disk to resolve physical symlinks
    let canonicalTarget = resolvedTarget;
    if (fs.existsSync(resolvedTarget)) {
      canonicalTarget = fs.realpathSync(resolvedTarget);
    } else {
      // If the file does not yet exist (e.g. creating a new file), check its existing parent directory
      const parentDir = path.dirname(resolvedTarget);
      if (fs.existsSync(parentDir)) {
        const canonicalParent = fs.realpathSync(parentDir);
        canonicalTarget = path.join(canonicalParent, path.basename(resolvedTarget));
      }
    }

    const relative = path.relative(canonicalRoot, canonicalTarget);

    // If relative starts with '..' or is absolute, target lies outside canonicalRoot
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      const err = `Path traversal attempt rejected. Target '${targetPath}' resolves to '${canonicalTarget}', outside authorized root '${canonicalRoot}'`;
      auditService.logSecurityViolation('security_kernel', 'path_traversal_blocked', err, targetPath, canonicalRoot);
      throw new SecurityViolationException(err);
    }

    return canonicalTarget;
  }

  /**
   * Validates whether a file operation (read/write) is permitted under the active permission tier.
   */
  public assertFileOperationPermitted(operation: 'read' | 'write', level: PermissionLevel): void {
    if (operation === 'write' && level === 'restricted') {
      const err = `File write rejected. Current workspace permission level is 'restricted' (read-only mode).`;
      auditService.logSecurityViolation('permission_manager', 'file_write_restricted', err);
      throw new SecurityViolationException(err);
    }
  }

  /**
   * Validates shell command execution safety.
   * Blocks shell chaining operators (&&, ;, |, `, $()) when in restricted/standard mode.
   */
  public validateCommandSafety(command: string, level: PermissionLevel): void {
    if (level === 'restricted') {
      const err = `Command execution forbidden under 'restricted' permission tier.`;
      auditService.logSecurityViolation('permission_manager', 'command_forbidden_restricted', err, command);
      throw new SecurityViolationException(err);
    }

    // Dangerous shell chaining and redirection patterns
    const dangerousPattern = /[;&|`$<>]/;
    if (level === 'standard' && dangerousPattern.test(command)) {
      const err = `Command contains dangerous shell operator characters. Full Access permission tier required to execute compound commands.`;
      auditService.logSecurityViolation('permission_manager', 'compound_command_blocked', err, command);
      throw new SecurityViolationException(err);
    }
  }
}

export const securityService = new SecurityService();
