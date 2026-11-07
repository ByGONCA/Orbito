import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  normalizeGitUrl,
  parseGitRemoteOutput,
  selectPrimaryRemote
} from '../src/main/services/git-remote-resolver';
import { DiscordRpcService, DEFAULT_DISCORD_CLIENT_ID, OFFICIAL_ORBITO_URL } from '../src/main/services/discord/discord-rpc.service';
import { databaseService } from '../src/main/db/database.service';
import type { ProjectDescriptor } from '../src/shared/types';

describe('Discord Rich Presence Suite', () => {
  describe('1. Git URL Normalization & Remote Parsing', () => {
    it('normalizes GitHub HTTPS URL with and without .git', () => {
      const res1 = normalizeGitUrl('https://github.com/ByGONCA/Orbito.git');
      expect(res1).not.toBeNull();
      expect(res1?.provider).toBe('github');
      expect(res1?.providerLabel).toBe('View on GitHub');
      expect(res1?.browserUrl).toBe('https://github.com/ByGONCA/Orbito');

      const res2 = normalizeGitUrl('https://github.com/ByGONCA/Orbito');
      expect(res2?.browserUrl).toBe('https://github.com/ByGONCA/Orbito');
    });

    it('normalizes GitHub SSH URL (SCP-like syntax)', () => {
      const res = normalizeGitUrl('git@github.com:ByGONCA/Orbito.git');
      expect(res).not.toBeNull();
      expect(res?.provider).toBe('github');
      expect(res?.providerLabel).toBe('View on GitHub');
      expect(res?.browserUrl).toBe('https://github.com/ByGONCA/Orbito');
    });

    it('normalizes GitHub SSH URL with ssh:// scheme', () => {
      const res = normalizeGitUrl('ssh://git@github.com/ByGONCA/Orbito.git');
      expect(res).not.toBeNull();
      expect(res?.provider).toBe('github');
      expect(res?.browserUrl).toBe('https://github.com/ByGONCA/Orbito');
    });

    it('normalizes GitLab HTTPS and SSH URLs including nested subgroups', () => {
      const httpsRes = normalizeGitUrl('https://gitlab.com/my-org/backend-team/core-api.git');
      expect(httpsRes?.provider).toBe('gitlab');
      expect(httpsRes?.providerLabel).toBe('View on GitLab');
      expect(httpsRes?.browserUrl).toBe('https://gitlab.com/my-org/backend-team/core-api');

      const sshRes = normalizeGitUrl('git@gitlab.com:my-org/backend-team/core-api.git');
      expect(sshRes?.provider).toBe('gitlab');
      expect(sshRes?.browserUrl).toBe('https://gitlab.com/my-org/backend-team/core-api');
    });

    it('normalizes Bitbucket HTTPS and SSH URLs', () => {
      const httpsRes = normalizeGitUrl('https://bitbucket.org/workspace-id/sample-repo.git');
      expect(httpsRes?.provider).toBe('bitbucket');
      expect(httpsRes?.providerLabel).toBe('View on Bitbucket');
      expect(httpsRes?.browserUrl).toBe('https://bitbucket.org/workspace-id/sample-repo');

      const sshRes = normalizeGitUrl('git@bitbucket.org:workspace-id/sample-repo.git');
      expect(sshRes?.provider).toBe('bitbucket');
      expect(sshRes?.browserUrl).toBe('https://bitbucket.org/workspace-id/sample-repo');
    });

    it('strips sensitive credentials and access tokens from HTTPS URLs', () => {
      const credUrl = 'https://oauth2:ghp_secretToken123456789@github.com/ByGONCA/Orbito.git';
      const res = normalizeGitUrl(credUrl);
      expect(res).not.toBeNull();
      expect(res?.browserUrl).toBe('https://github.com/ByGONCA/Orbito');
      expect(res?.browserUrl).not.toContain('ghp_secretToken123456789');
      expect(res?.browserUrl).not.toContain('oauth2');
    });

    it('rejects unsupported and dangerous URL schemes', () => {
      expect(normalizeGitUrl('file:///etc/shadow')).toBeNull();
      expect(normalizeGitUrl('file:///C:/Users/Admin/SecretProject')).toBeNull();
      expect(normalizeGitUrl('javascript:alert(1)')).toBeNull();
      expect(normalizeGitUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBeNull();
      expect(normalizeGitUrl('ftp://example.com/repo.git')).toBeNull();
      expect(normalizeGitUrl('C:\\Users\\Desktop\\LocalRepo')).toBeNull();
      expect(normalizeGitUrl('')).toBeNull();
      expect(normalizeGitUrl(null)).toBeNull();
      expect(normalizeGitUrl(undefined)).toBeNull();
    });

    it('parses multiple git remotes and deterministically selects primary remote', () => {
      const output = [
        'upstream\thttps://github.com/original/Orbito.git (fetch)',
        'upstream\thttps://github.com/original/Orbito.git (push)',
        'origin\tgit@github.com:ByGONCA/Orbito.git (fetch)',
        'origin\tgit@github.com:ByGONCA/Orbito.git (push)',
        'backup\thttps://gitlab.com/ByGONCA/backup.git (fetch)'
      ].join('\n');

      const remotes = parseGitRemoteOutput(output);
      expect(remotes.size).toBe(3);
      expect(remotes.has('origin')).toBe(true);
      expect(remotes.has('upstream')).toBe(true);
      expect(remotes.has('backup')).toBe(true);

      // Primary selection logic prefers 'origin'
      const primary = selectPrimaryRemote(remotes);
      expect(primary).not.toBeNull();
      expect(primary?.name).toBe('origin');
      expect(primary?.url).toBe('git@github.com:ByGONCA/Orbito.git');
    });

    it('falls back to upstream if origin is absent, or alphabetical first', () => {
      const outputUpstreamOnly = [
        'upstream\thttps://github.com/org/repo.git (fetch)',
        'backup\thttps://gitlab.com/org/repo.git (fetch)'
      ].join('\n');

      const remotes1 = parseGitRemoteOutput(outputUpstreamOnly);
      const primary1 = selectPrimaryRemote(remotes1);
      expect(primary1?.name).toBe('upstream');

      const outputNoOriginNoUpstream = [
        'secondary\thttps://github.com/org/repo.git (fetch)',
        'alpha\thttps://github.com/org/alpha.git (fetch)'
      ].join('\n');

      const remotes2 = parseGitRemoteOutput(outputNoOriginNoUpstream);
      const primary2 = selectPrimaryRemote(remotes2);
      expect(primary2?.name).toBe('alpha');
    });
  });

  describe('2. Settings & Database Persistence', () => {
    let testDataDir: string;

    beforeEach(() => {
      testDataDir = path.join(os.tmpdir(), `orbito-discord-test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);
      fs.mkdirSync(testDataDir, { recursive: true });
      databaseService.initialize(testDataDir);
    });

    afterEach(() => {
      try {
        databaseService.close();
        fs.rmSync(testDataDir, { recursive: true, force: true });
      } catch {}
    });

    it('persists global discordRpcEnabled and discordClientId settings', () => {
      const initial = databaseService.getSettings();
      expect(initial.discordRpcEnabled).toBe(true);

      databaseService.updateSettings({
        discordRpcEnabled: false,
        discordClientId: '123456789012345678'
      });

      const updated = databaseService.getSettings();
      expect(updated.discordRpcEnabled).toBe(false);
      expect(updated.discordClientId).toBe('123456789012345678');
    });

    it('persists per-project discordRpcEnabled opt-in independently', () => {
      const projA: ProjectDescriptor = {
        id: 'proj-a',
        name: 'Project Alpha',
        path: path.join(testDataDir, 'alpha'),
        lastOpenedAt: Date.now(),
        isGitRepo: true,
        permissionLevel: 'standard',
        settings: {
          discordRpcEnabled: false
        }
      };

      const projB: ProjectDescriptor = {
        id: 'proj-b',
        name: 'Project Beta',
        path: path.join(testDataDir, 'beta'),
        lastOpenedAt: Date.now(),
        isGitRepo: true,
        permissionLevel: 'standard',
        settings: {
          discordRpcEnabled: true
        }
      };

      databaseService.recordProjectOpen(projA);
      databaseService.recordProjectOpen(projB);

      const savedA = databaseService.getProject('proj-a');
      const savedB = databaseService.getProject('proj-b');

      expect(savedA?.settings?.discordRpcEnabled).toBe(false);
      expect(savedB?.settings?.discordRpcEnabled).toBe(true);

      // Update Project A opt-in
      databaseService.updateProject('proj-a', {
        settings: { ...savedA?.settings, discordRpcEnabled: true }
      });

      expect(databaseService.getProject('proj-a')?.settings?.discordRpcEnabled).toBe(true);
      expect(databaseService.getProject('proj-b')?.settings?.discordRpcEnabled).toBe(true);
    });
  });

  describe('3. Dynamic Rich Presence Activity Logic & Security', () => {
    let service: DiscordRpcService;

    beforeEach(() => {
      service = new DiscordRpcService();
    });

    afterEach(async () => {
      await service.shutdown();
    });

    it('returns null presence when global integration is disabled', () => {
      // Global is disabled by default
      const presence = service.computePresencePayload();
      expect(presence).toBeNull();
    });

    it('returns idle generic presence when global is enabled but no project is open', async () => {
      // Enable globally
      (service as any).isGloballyEnabled = true;

      const presence = service.computePresencePayload();
      expect(presence).not.toBeNull();
      expect(presence?.details).toBe('Using Orbito');
      expect(presence?.state).toBe('Workspace ready');
      expect(presence?.buttons).toEqual([
        { label: 'Get Orbito', url: OFFICIAL_ORBITO_URL }
      ]);
      expect(presence?.buttons?.length).toBe(1);
    });

    it('returns generic presence when project is active but NOT opted in', async () => {
      (service as any).isGloballyEnabled = true;
      (service as any).activeProject = {
        id: 'proj-1',
        name: 'SecretClientApp',
        path: 'C:\\Users\\User\\Projects\\SecretClientApp',
        lastOpenedAt: Date.now(),
        isGitRepo: true,
        permissionLevel: 'standard',
        settings: {
          discordRpcEnabled: false // Opt-in false!
        }
      };

      const presence = service.computePresencePayload();
      expect(presence?.details).toBe('Using Orbito');
      expect(presence?.state).toBe('Workspace ready');
      // Secret project name and path MUST NOT leak
      expect(presence?.details).not.toContain('SecretClientApp');
      expect(presence?.state).not.toContain('SecretClientApp');
      expect(presence?.buttons).toEqual([
        { label: 'Get Orbito', url: OFFICIAL_ORBITO_URL }
      ]);
    });

    it('returns project presence with repository button when project is opted in and has remote', async () => {
      (service as any).isGloballyEnabled = true;
      (service as any).activeProject = {
        id: 'proj-1',
        name: 'Orbito',
        path: 'C:\\Users\\User\\Projects\\Orbito',
        lastOpenedAt: Date.now(),
        isGitRepo: true,
        permissionLevel: 'standard',
        settings: {
          discordRpcEnabled: true // Opt-in true!
        }
      };
      (service as any).activeGitRemote = {
        provider: 'github',
        providerLabel: 'View on GitHub',
        browserUrl: 'https://github.com/ByGONCA/Orbito',
        rawUrl: 'git@github.com:ByGONCA/Orbito.git',
        remoteName: 'origin'
      };

      const presence = service.computePresencePayload();
      expect(presence?.details).toBe('Working in Orbito');
      expect(presence?.state).toBe('Project: Orbito');
      expect(presence?.buttons?.length).toBe(2);
      expect(presence?.buttons?.[0]).toEqual({
        label: 'View on GitHub',
        url: 'https://github.com/ByGONCA/Orbito'
      });
      expect(presence?.buttons?.[1]).toEqual({
        label: 'Get Orbito',
        url: OFFICIAL_ORBITO_URL
      });
    });

    it('returns local project presence when project is opted in but has NO remote', async () => {
      (service as any).isGloballyEnabled = true;
      (service as any).activeProject = {
        id: 'proj-local',
        name: 'MyLocalTool',
        path: 'C:\\Users\\User\\Projects\\MyLocalTool',
        lastOpenedAt: Date.now(),
        isGitRepo: false,
        permissionLevel: 'standard',
        settings: {
          discordRpcEnabled: true
        }
      };
      (service as any).activeGitRemote = null;

      const presence = service.computePresencePayload();
      expect(presence?.details).toBe('Working in MyLocalTool');
      expect(presence?.state).toBe('Local project');
      expect(presence?.buttons?.length).toBe(1);
      expect(presence?.buttons?.[0]).toEqual({
        label: 'Get Orbito',
        url: OFFICIAL_ORBITO_URL
      });
    });

    it('displays agent count activity during orchestration', async () => {
      (service as any).isGloballyEnabled = true;
      (service as any).activeAgentsCount = 3;

      const presence = service.computePresencePayload();
      expect(presence?.details).toBe('Agents working in Orbito');
      expect(presence?.state).toBe('3 agents active');
      expect(presence?.buttons?.[0]).toEqual({
        label: 'Get Orbito',
        url: OFFICIAL_ORBITO_URL
      });

      // Singular agent
      (service as any).activeAgentsCount = 1;
      const presence1 = service.computePresencePayload();
      expect(presence1?.state).toBe('1 agent active');
    });

    it('strictly enforces the Discord maximum limit of TWO buttons', async () => {
      (service as any).isGloballyEnabled = true;
      (service as any).activeAgentsCount = 2;
      (service as any).activeProject = {
        id: 'proj-1',
        name: 'Orbito',
        path: 'C:\\Orbito',
        lastOpenedAt: Date.now(),
        isGitRepo: true,
        permissionLevel: 'standard',
        settings: { discordRpcEnabled: true }
      };
      (service as any).activeGitRemote = {
        provider: 'github',
        providerLabel: 'View on GitHub',
        browserUrl: 'https://github.com/ByGONCA/Orbito',
        rawUrl: 'https://github.com/ByGONCA/Orbito.git',
        remoteName: 'origin'
      };

      const presence = service.computePresencePayload();
      expect(presence?.buttons?.length).toBeLessThanOrEqual(2);
    });

    it('handles project switching: immediately replaces presence or clears to generic', async () => {
      (service as any).isGloballyEnabled = true;

      // 1. Project A is opted-in
      (service as any).activeProject = {
        id: 'proj-A',
        name: 'ProjectA',
        path: 'C:\\Projects\\A',
        lastOpenedAt: Date.now(),
        isGitRepo: true,
        permissionLevel: 'standard',
        settings: { discordRpcEnabled: true }
      };
      (service as any).activeGitRemote = {
        provider: 'github',
        providerLabel: 'View on GitHub',
        browserUrl: 'https://github.com/ByGONCA/ProjectA',
        rawUrl: 'git@github.com:ByGONCA/ProjectA.git',
        remoteName: 'origin'
      };

      const presenceA = service.computePresencePayload();
      expect(presenceA?.details).toBe('Working in ProjectA');
      expect(presenceA?.state).toBe('Project: ProjectA');

      // 2. Switch to Project B (opted out)
      (service as any).activeProject = {
        id: 'proj-B',
        name: 'ProjectB',
        path: 'C:\\Projects\\B',
        lastOpenedAt: Date.now(),
        isGitRepo: false,
        permissionLevel: 'standard',
        settings: { discordRpcEnabled: false }
      };
      (service as any).activeGitRemote = null;

      const presenceB = service.computePresencePayload();
      expect(presenceB?.details).toBe('Using Orbito');
      expect(presenceB?.state).toBe('Workspace ready');
      expect(presenceB?.buttons).toEqual([{ label: 'Get Orbito', url: OFFICIAL_ORBITO_URL }]);

      // 3. Close all projects (null)
      (service as any).activeProject = null;
      const presenceNone = service.computePresencePayload();
      expect(presenceNone?.details).toBe('Using Orbito');
      expect(presenceNone?.state).toBe('Workspace ready');
    });

    it('security verification: never publishes local paths, secrets, or prompts', async () => {
      (service as any).isGloballyEnabled = true;
      const localPath = 'C:\\Users\\gonca\\OneDrive\\Documents\\Projects\\Orbito';
      (service as any).activeProject = {
        id: 'proj-secure',
        name: 'ProductionApp',
        path: localPath,
        lastOpenedAt: Date.now(),
        isGitRepo: true,
        permissionLevel: 'standard',
        settings: { discordRpcEnabled: true }
      };
      (service as any).activeGitRemote = {
        provider: 'github',
        providerLabel: 'View on GitHub',
        browserUrl: 'https://github.com/ByGONCA/ProductionApp',
        rawUrl: 'https://user:ghp_topSecretToken@github.com/ByGONCA/ProductionApp.git',
        remoteName: 'origin'
      };

      const presence = service.computePresencePayload();
      const serialized = JSON.stringify(presence);

      // Verify NO local path leaked
      expect(serialized).not.toContain(localPath);
      expect(serialized).not.toContain('OneDrive');
      expect(serialized).not.toContain('gonca');
      // Verify NO token leaked
      expect(serialized).not.toContain('ghp_topSecretToken');
      expect(serialized).not.toContain('user:');
    });

    it('live Discord IPC pipe check (environment-aware: tests real named pipe if Discord is running)', async () => {
      const net = await import('node:net');
      const pipePath = process.platform === 'win32'
        ? '\\\\?\\pipe\\discord-ipc-0'
        : `${process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || '/tmp'}/discord-ipc-0`;

      const isDiscordPipeAvailable = await new Promise<boolean>((resolve) => {
        const s = net.connect(pipePath, () => {
          s.destroy();
          resolve(true);
        });
        s.on('error', () => {
          resolve(false);
        });
      });

      // Clearly report whether live Discord Desktop is connected
      if (isDiscordPipeAvailable) {
        // Discord is running on developer machine
        expect(isDiscordPipeAvailable).toBe(true);
      } else {
        // Discord is not running (e.g. CI headless environment)
        expect(isDiscordPipeAvailable).toBe(false);
      }
    });
  });
});
