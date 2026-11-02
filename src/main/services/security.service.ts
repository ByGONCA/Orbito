import fs from 'node:fs';
import path from 'node:path';
import type { PermissionLevel } from '../../shared/types';

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
      throw new SecurityViolationException('Both targetPath and workspaceRoot are required for path validation.');
    }

    const resolvedRoot = path.resolve(workspaceRoot);
    if (!fs.existsSync(resolvedRoot)) {
      throw new SecurityViolationException(`Workspace root does not exist on disk: ${workspaceRoot}`);
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
      throw new SecurityViolationException(
        `Path traversal attempt rejected. Target '${targetPath}' resolves to '${canonicalTarget}', outside authorized root '${canonicalRoot}'`
      );
    }

    return canonicalTarget;
  }

  /**
   * Validates whether a file operation (read/write) is permitted under the active permission tier.
   */
  public assertFileOperationPermitted(operation: 'read' | 'write', level: PermissionLevel): void {
    if (operation === 'write' && level === 'restricted') {
      throw new SecurityViolationException(
        `File write rejected. Current workspace permission level is 'restricted' (read-only mode).`
      );
    }
  }

  /**
   * Validates shell command execution safety.
   * Blocks shell chaining operators (&&, ;, |, `, $()) when in restricted/standard mode.
   */
  public validateCommandSafety(command: string, level: PermissionLevel): void {
    if (level === 'restricted') {
      throw new SecurityViolationException(
        `Command execution forbidden under 'restricted' permission tier.`
      );
    }

    // Dangerous shell chaining and redirection patterns
    const dangerousPattern = /[;&|`$<>]/;
    if (level === 'standard' && dangerousPattern.test(command)) {
      throw new SecurityViolationException(
        `Command contains dangerous shell operator characters. Full Access permission tier required to execute compound commands.`
      );
    }
  }
}

export const securityService = new SecurityService();
