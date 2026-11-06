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

    if (targetPath.includes('\0') || workspaceRoot.includes('\0')) {
      const err = 'Null byte injection detected in path.';
      auditService.logSecurityViolation('security_kernel', 'null_byte_detected', err, targetPath);
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
   * Classifies whether a shell command is strictly read-only inspection.
   * Disqualifies any command containing redirection (>), pipes (|), chaining (&&, ;, ||),
   * subshell substitution ($(), ``), or write/modifying subcommands.
   */
  public isReadOnlyCommand(command: string): boolean {
    if (!command || !command.trim()) return false;
    const trimmed = command.trim();

    // Any shell chaining, backgrounding, piping, redirection, or command substitution makes it unsafe
    if (/[;&|`$<>]/m.test(trimmed) || /\r|\n/.test(trimmed)) {
      return false;
    }

    const tokens = trimmed.split(/\s+/);
    const base = tokens[0].toLowerCase().replace(/^.*[/\\]/, '');

    // Allow benign directory/file listings and location inspection
    const readOnlyListingCommands = new Set([
      'dir',
      'ls',
      'pwd',
      'get-location',
      'gl',
      'get-childitem',
      'gci'
    ]);
    if (readOnlyListingCommands.has(base)) {
      return true;
    }

    // Allow benign file content inspection
    const readOnlyViewerCommands = new Set([
      'cat',
      'type',
      'get-content',
      'gc',
      'head',
      'tail',
      'more',
      'less'
    ]);
    if (readOnlyViewerCommands.has(base)) {
      return true;
    }

    // Allow benign system / environmental / text inspection
    const readOnlyEnvCommands = new Set([
      'echo',
      'write-output',
      'write-host',
      'whoami',
      'date',
      'get-date',
      'hostname',
      'uname',
      'which',
      'where',
      'where.exe'
    ]);
    if (readOnlyEnvCommands.has(base)) {
      return true;
    }

    // Git inspection commands
    if (base === 'git') {
      const sub = tokens[1]?.toLowerCase();
      if (!sub) return true; // Just `git`

      const allowedGitSub = new Set([
        'status',
        'log',
        'diff',
        'show',
        'rev-parse',
        'describe',
        'version'
      ]);
      if (allowedGitSub.has(sub)) {
        return true;
      }

      // `git branch` or `git tag` only in listing mode (no modifying flags)
      if (sub === 'branch' || sub === 'tag') {
        const hasModifyingFlag = tokens.slice(2).some((t) =>
          /^-[dDmaMc]/.test(t) || t === '--delete' || t === '--create'
        );
        return !hasModifyingFlag;
      }

      return false;
    }

    // Version probes for development runtimes
    const runtimeProbes = new Set(['node', 'npm', 'npx', 'python', 'python3', 'tsc', 'git', 'pnpm', 'yarn', 'cargo', 'rustc', 'go']);
    if (runtimeProbes.has(base) && tokens.length === 2) {
      const arg = tokens[1].toLowerCase();
      if (arg === '-v' || arg === '--version' || arg === '-version' || arg === '-V') {
        return true;
      }
    }

    // Fail closed for all other unclassified commands
    return false;
  }

  /**
   * Validates shell command execution safety against active permission tier.
   * - 'restricted': rejects destructive/write commands. Preserves verified read-only inspection commands when allowReadOnly=true.
   * - 'standard': allows single commands, blocks compound/chaining operators (&&, ;, |, `, $()).
   * - 'full': allows all commands without restriction.
   */
  public validateCommandSafety(
    command: string,
    level: PermissionLevel,
    options?: { allowReadOnly?: boolean }
  ): void {
    if (level === 'restricted') {
      if (options?.allowReadOnly && this.isReadOnlyCommand(command)) {
        auditService.logAccess('permission_manager', 'read_only_shell_permitted', undefined, undefined, 'info', {
          command
        });
        return;
      }

      const err = this.isReadOnlyCommand(command)
        ? `Command execution forbidden under 'restricted' permission tier.`
        : `Command execution rejected: write or destructive command forbidden under 'restricted' permission tier.`;
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
