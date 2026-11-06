import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { workspaceService } from '../src/main/services/workspace.service';
import { securityService, SecurityViolationException } from '../src/main/services/security.service';
import { auditService } from '../src/main/services/audit.service';

describe('Phase 6.1: Filesystem Security Adversarial Verification Suite', () => {
  let tempBaseDir: string;
  let workspaceDir: string;
  let outsideDir: string;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-security-adv-'));
    workspaceDir = path.join(tempBaseDir, 'workspace');
    outsideDir = path.join(tempBaseDir, 'outside');

    fs.mkdirSync(workspaceDir, { recursive: true });
    fs.mkdirSync(outsideDir, { recursive: true });

    fs.writeFileSync(path.join(outsideDir, 'sensitive.txt'), 'SENSITIVE_OUTSIDE_DATA');
    auditService.clear();
  });

  afterEach(() => {
    if (fs.existsSync(tempBaseDir)) {
      try {
        fs.rmSync(tempBaseDir, { recursive: true, force: true });
      } catch {
        // Windows file lock resilience
      }
    }
  });

  describe('1. Symlink Traversal & Destination Symlink Defense', () => {
    it('blocks saveFileContent when destination is an existing symbolic link pointing outside', () => {
      const symlinkPath = path.join(workspaceDir, 'link_to_sensitive.txt');
      const targetOutside = path.join(outsideDir, 'sensitive.txt');

      try {
        fs.symlinkSync(targetOutside, symlinkPath, 'file');
      } catch (e: any) {
        // Skip on Windows if developer mode symlink permission is not enabled
        if (e.code === 'EPERM') return;
        throw e;
      }

      expect(() => {
        workspaceService.saveFileContent(symlinkPath, workspaceDir, 'OVERWRITE_ATTEMPT');
      }).toThrow(/SecurityViolation|symbolic links/i);

      // Verify the outside sensitive file was NOT modified
      expect(fs.readFileSync(targetOutside, 'utf8')).toBe('SENSITIVE_OUTSIDE_DATA');
    });

    it('blocks saveFileContent when destination is an existing symbolic link pointing inside workspace', () => {
      const insideTarget = path.join(workspaceDir, 'inside_target.txt');
      fs.writeFileSync(insideTarget, 'ORIGINAL_INSIDE');

      const symlinkPath = path.join(workspaceDir, 'link_to_inside.txt');
      try {
        fs.symlinkSync(insideTarget, symlinkPath, 'file');
      } catch (e: any) {
        if (e.code === 'EPERM') return;
        throw e;
      }

      expect(() => {
        workspaceService.saveFileContent(symlinkPath, workspaceDir, 'OVERWRITE_ATTEMPT');
      }).toThrow(/symbolic links/i);

      expect(fs.readFileSync(insideTarget, 'utf8')).toBe('ORIGINAL_INSIDE');
    });

    it('blocks createFile if a broken symlink already exists at the target path', () => {
      const brokenSymlink = path.join(workspaceDir, 'broken_link.txt');
      try {
        fs.symlinkSync(path.join(outsideDir, 'non_existent.txt'), brokenSymlink, 'file');
      } catch (e: any) {
        if (e.code === 'EPERM') return;
        throw e;
      }

      expect(() => {
        workspaceService.createFile(brokenSymlink, workspaceDir, 'content');
      }).toThrow(/already exists/i);
    });

    it('rejects deleteItem on a symlink pointing outside the workspace (fails closed)', () => {
      const subDirOutside = path.join(outsideDir, 'secret_sub');
      fs.mkdirSync(subDirOutside, { recursive: true });
      fs.writeFileSync(path.join(subDirOutside, 'critical.txt'), 'CRITICAL_DATA');

      const dirSymlink = path.join(workspaceDir, 'outside_dir_link');
      try {
        fs.symlinkSync(subDirOutside, dirSymlink, 'junction');
      } catch (e: any) {
        if (e.code === 'EPERM') return;
        throw e;
      }

      // AssertWithinWorkspace rejects because symlink resolves to outside target
      expect(() => {
        workspaceService.deleteItem(dirSymlink, workspaceDir);
      }).toThrow(/Path traversal attempt rejected|SecurityViolation/i);

      // Outside directory and critical file must remain intact
      expect(fs.existsSync(subDirOutside)).toBe(true);
      expect(fs.readFileSync(path.join(subDirOutside, 'critical.txt'), 'utf8')).toBe('CRITICAL_DATA');
    });

    it('unlinks only the symlink itself on deleteItem for inside symlinks without deleting files in target directory', () => {
      const insideSub = path.join(workspaceDir, 'inside_sub');
      fs.mkdirSync(insideSub, { recursive: true });
      fs.writeFileSync(path.join(insideSub, 'inside_file.txt'), 'INSIDE_DATA');

      const dirSymlink = path.join(workspaceDir, 'inside_dir_link');
      try {
        fs.symlinkSync(insideSub, dirSymlink, 'junction');
      } catch (e: any) {
        if (e.code === 'EPERM') return;
        throw e;
      }

      const res = workspaceService.deleteItem(dirSymlink, workspaceDir);
      expect(res.success).toBe(true);

      // Symlink was removed
      try {
        fs.lstatSync(dirSymlink);
        expect.unreachable('Symlink should have been deleted');
      } catch (err: any) {
        expect(err.code).toBe('ENOENT');
      }

      // Target directory and its file remain intact
      expect(fs.existsSync(insideSub)).toBe(true);
      expect(fs.readFileSync(path.join(insideSub, 'inside_file.txt'), 'utf8')).toBe('INSIDE_DATA');
    });

    it('blocks moveItem when destination directory is a symlink pointing outside the workspace', () => {
      const srcFile = path.join(workspaceDir, 'move_src.txt');
      fs.writeFileSync(srcFile, 'MOVE_DATA');

      const destSymlink = path.join(workspaceDir, 'outside_dest_link');
      try {
        fs.symlinkSync(outsideDir, destSymlink, 'junction');
      } catch (e: any) {
        if (e.code === 'EPERM') return;
        throw e;
      }

      expect(() => {
        workspaceService.moveItem(srcFile, destSymlink, workspaceDir);
      }).toThrow(/symbolic link|SecurityViolation/i);
    });
  });

  describe('2. Path Traversal & Parent Directory Defense', () => {
    it('blocks path traversal via relative "../" paths in createFile', () => {
      expect(() => {
        workspaceService.createFile('../outside_create.txt', workspaceDir, 'data');
      }).toThrow(/Path traversal attempt rejected/i);
    });

    it('blocks path traversal via multi-level non-existent subdirectories escaping root', () => {
      const deepEscape = path.join(workspaceDir, '..', '..', 'deep_escape.txt');
      expect(() => {
        securityService.assertWithinWorkspace(deepEscape, workspaceDir);
      }).toThrow(SecurityViolationException);
    });

    it('blocks creating files or directories inside protected .git directory', () => {
      fs.mkdirSync(path.join(workspaceDir, '.git'), { recursive: true });

      expect(() => {
        workspaceService.createFile(path.join(workspaceDir, '.git', 'hooks.js'), workspaceDir, 'bad');
      }).toThrow(/protected Git repository/i);

      expect(() => {
        workspaceService.createDirectory(path.join(workspaceDir, '.git', 'bad_dir'), workspaceDir);
      }).toThrow(/protected Git repository/i);
    });

    it('blocks deleting or renaming the project root directory itself', () => {
      expect(() => {
        workspaceService.deleteItem(workspaceDir, workspaceDir);
      }).toThrow(/Cannot delete the project root/i);

      expect(() => {
        workspaceService.renameItem(workspaceDir, 'new_root', workspaceDir);
      }).toThrow(/Cannot rename the project root/i);
    });

    it('blocks null-byte injection in path operations', () => {
      expect(() => {
        securityService.assertWithinWorkspace('safe.txt\0/../../escape.txt', workspaceDir);
      }).toThrow(/Null byte injection/i);
    });

    it('blocks Windows reserved device names in createFile, createDirectory, and renameItem', () => {
      expect(() => {
        workspaceService.createFile(path.join(workspaceDir, 'CON.txt'), workspaceDir, 'test');
      }).toThrow(/reserved system device name/i);

      expect(() => {
        workspaceService.createDirectory(path.join(workspaceDir, 'NUL'), workspaceDir);
      }).toThrow(/reserved system device name/i);

      const validFile = path.join(workspaceDir, 'valid.txt');
      fs.writeFileSync(validFile, 'hello');

      expect(() => {
        workspaceService.renameItem(validFile, 'PRN.txt', workspaceDir);
      }).toThrow(/reserved system device name/i);
    });
  });

  describe('3. Concurrency, Existing Destinations & Safe Fallbacks', () => {
    it('refuses to overwrite existing files on createFile (exclusive wx flag)', () => {
      const target = path.join(workspaceDir, 'already_exists.txt');
      fs.writeFileSync(target, 'ORIGINAL');

      expect(() => {
        workspaceService.createFile(target, workspaceDir, 'NEW_CONTENT');
      }).toThrow(/already exists/i);

      expect(fs.readFileSync(target, 'utf8')).toBe('ORIGINAL');
    });

    it('handles atomic saveFileContent safely and cleans up temporary files on success', () => {
      const target = path.join(workspaceDir, 'atomic_test.txt');
      fs.writeFileSync(target, 'VERSION_1');

      const success = workspaceService.saveFileContent(target, workspaceDir, 'VERSION_2');
      expect(success).toBe(true);
      expect(fs.readFileSync(target, 'utf8')).toBe('VERSION_2');

      // Verify no orphaned .tmp-* files remain in the directory
      const tmpFiles = fs.readdirSync(workspaceDir).filter((f) => f.startsWith('.tmp-'));
      expect(tmpFiles.length).toBe(0);
    });

    it('blocks moving a directory into itself or its own subdirectory', () => {
      const parentFolder = path.join(workspaceDir, 'parent_folder');
      const childFolder = path.join(parentFolder, 'child_folder');
      fs.mkdirSync(childFolder, { recursive: true });

      expect(() => {
        workspaceService.moveItem(parentFolder, childFolder, workspaceDir);
      }).toThrow(/Cannot move a directory into itself/i);
    });
  });

  describe('4. Windows Path Normalization & Case-Sensitivity Containment', () => {
    it('correctly resolves and validates path regardless of Windows drive letter casing', () => {
      const filePath = path.join(workspaceDir, 'case_test.txt');
      fs.writeFileSync(filePath, 'CASE_DATA');

      // Create a path with toggled case if Windows
      let variedPath = filePath;
      if (process.platform === 'win32' && filePath.length >= 2 && filePath[1] === ':') {
        const driveLetter = filePath[0];
        const toggledDrive = driveLetter === driveLetter.toUpperCase()
          ? driveLetter.toLowerCase()
          : driveLetter.toUpperCase();
        variedPath = toggledDrive + filePath.substring(1);
      }

      const canonical = securityService.assertWithinWorkspace(variedPath, workspaceDir);
      expect(canonical.toLowerCase()).toBe(filePath.toLowerCase());
    });
  });
});
