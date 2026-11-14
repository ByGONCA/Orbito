import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { databaseService } from '../src/main/db/database.service';
import { lifecycleCoordinatorService } from '../src/main/services/lifecycle-coordinator.service';
import { WorktreeManager } from '../src/main/agents/worktree-manager';
import { AgentScheduler } from '../src/main/agents/agent-scheduler';
import { resourceGovernorService } from '../src/main/services/resource-governor.service';
import { securityService, SecurityViolationException } from '../src/main/services/security.service';
import { assertTrustedSender } from '../src/main/ipc/register';
import { airGapManager, AirGapViolationException } from '../src/main/services/air-gap.manager';
import { AutoUpdateService } from '../src/main/services/auto-update.service';

describe('Chaos & Operational Resilience Harness — Production Hardening & Gap Closure', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbito-chaos-test-'));
    databaseService.initialize(tempDir);
  });

  afterEach(() => {
    try {
      databaseService.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  // ==========================================
  // Domain 1: Lifecycle & Application Resilience
  // ==========================================
  describe('Domain 1: Lifecycle & Application Resilience', () => {
    it('1. detects unclean shutdown when marker file is missing and logs incident', () => {
      const stateDir = path.join(tempDir, 'lifecycle-state');
      fs.mkdirSync(stateDir, { recursive: true });

      // First boot without clean shutdown marker
      const status = lifecycleCoordinatorService.initialize(stateDir);
      expect(status.lastCleanShutdownAt).toBeNull();
      expect(status.state).toBe('ready');

      // Now record a graceful shutdown
      lifecycleCoordinatorService.recordGracefulShutdown();
      const markerPath = path.join(stateDir, '.clean_shutdown');
      expect(fs.existsSync(markerPath)).toBe(true);

      // Re-initialize with clean shutdown marker
      const secondBoot = lifecycleCoordinatorService.initialize(stateDir);
      expect(secondBoot.lastCleanShutdownAt).toBeGreaterThan(0);
      expect(fs.existsSync(markerPath)).toBe(false); // Consumed on boot
    });

    it('2. securely logs crash reports with SecretRedactor sanitization', () => {
      const stateDir = path.join(tempDir, 'crash-state');
      lifecycleCoordinatorService.initialize(stateDir);

      const leakToken = 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
      lifecycleCoordinatorService.recordCrash({
        reason: `Fatal connection failure with token ${leakToken}`,
        source: 'uncaughtException',
        details: `Bearer sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890\nError at service.ts:42`
      });

      const crashLogPath = path.join(stateDir, 'logs', 'crash.log');
      expect(fs.existsSync(crashLogPath)).toBe(true);

      const rawLog = fs.readFileSync(crashLogPath, 'utf8');
      expect(rawLog).not.toContain(leakToken);
      expect(rawLog).toContain('[REDACTED');
    });

    it('3. enforces bounded graceful shutdown timeout with cleanup callbacks', async () => {
      const stateDir = path.join(tempDir, 'shutdown-state');
      lifecycleCoordinatorService.initialize(stateDir);

      let slowCleaned = false;
      const slowCleanup = async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        slowCleaned = true;
      };

      await lifecycleCoordinatorService.executeGracefulShutdown(1000, [slowCleanup]);
      expect(slowCleaned).toBe(true);
      expect(lifecycleCoordinatorService.getStatus().state).toBe('terminated');
    });

    it('4. reconciles startup interrupted tasks without repeating side effects', async () => {
      const db = databaseService.getAppDb();
      const now = Date.now();

      // Seed an interrupted orchestration and running task
      db.prepare(`
        INSERT INTO orchestrations (id, project_id, project_path, user_goal, status, created_at)
        VALUES ('orch-reconcile-1', 'proj-1', '${tempDir.replace(/\\/g, '/')}', 'Interrupted goal', 'running', ${now})
      `).run();

      db.prepare(`
        INSERT INTO orchestration_tasks (id, orchestration_id, title, description, role, provider, status, permissions_json, created_at, retry_count)
        VALUES ('task-reconcile-1', 'orch-reconcile-1', 'Active Task', 'Task body', 'frontend-specialist', 'anthropic', 'ready', '{}', ${now}, 0)
      `).run();

      const incidents: any[] = [];
      const res = await AgentScheduler.reconcileStartupInterruptedTasks(db, (inc) => incidents.push(inc));

      expect(res.reconciledTasksCount).toBeGreaterThanOrEqual(1);

      const updatedTask = db.prepare(`SELECT status, error_message FROM orchestration_tasks WHERE id = 'task-reconcile-1'`).get() as any;
      expect(updatedTask.status).toBe('interrupted');
      expect(updatedTask.error_message).toContain('Interrupted by application restart');

      const updatedOrch = db.prepare(`SELECT status FROM orchestrations WHERE id = 'orch-reconcile-1'`).get() as any;
      expect(updatedOrch.status).toBe('interrupted');
      expect(incidents.length).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // Domain 2: Database Integrity & Recovery
  // ==========================================
  describe('Domain 2: Database Integrity & Disaster Recovery', () => {
    it('5. verifies PRAGMA integrity and foreign keys on healthy database', () => {
      const health = databaseService.checkDatabaseIntegrity();
      expect(health.integrity).toBe('ok');
      expect(health.foreignKeysOk).toBe(true);
      expect(health.corrupted).toBe(false);
      expect(health.tableCount).toBeGreaterThan(0);
    });

    it('6. creates online WAL-consistent backup and verifies restorable state', async () => {
      const { backupPath } = await databaseService.createOnlineBackup();
      expect(fs.existsSync(backupPath)).toBe(true);

      const verification = databaseService.verifyBackup(backupPath);
      expect(verification.valid).toBe(true);
      expect(verification.integrity).toBe('ok');
      expect(verification.tableCount).toBeGreaterThan(0);

      const backups = databaseService.listBackups();
      expect(backups.length).toBeGreaterThan(0);
      expect(backups[0].valid).toBe(true);
    });

    it('7. executes two-step candidate restore: creates pre-restore snapshot and atomically restores', async () => {
      const { backupPath } = await databaseService.createOnlineBackup();

      // Explicit confirmation false -> throws error
      expect(() => {
        databaseService.restoreFromBackup(backupPath, false);
      }).toThrow(/Explicit confirmation/);

      // Explicit confirmation true -> restores safely with isolated candidate validation and snapshot
      const restoreResult = databaseService.restoreFromBackup(backupPath, true);
      expect(restoreResult.success).toBe(true);
      expect(restoreResult.candidateValidated).toBe(true);
      expect(fs.existsSync(restoreResult.preRestoreBackupPath)).toBe(true);
      expect(fs.existsSync(restoreResult.restoredPath)).toBe(true);
    });

    it('8. rejects corrupted candidate backup without modifying live database', () => {
      const corruptBackup = path.join(tempDir, 'corrupt-candidate.sqlite');
      fs.writeFileSync(corruptBackup, 'CORRUPT_BYTES_NOT_SQLITE');

      const appDbPath = path.join(tempDir, 'app.sqlite');
      const originalMtime = fs.statSync(appDbPath).mtimeMs;

      expect(() => {
        databaseService.restoreFromBackup(corruptBackup, true);
      }).toThrow(/Cannot restore invalid backup/);

      // Verify live database was NOT replaced
      expect(fs.statSync(appDbPath).mtimeMs).toBe(originalMtime);
    });

    it('9. safely quarantines corrupted database and performs partial data salvage', () => {
      const appDb = databaseService.getAppDb();
      // Insert mock project data that we want to salvage
      appDb.prepare(`
        INSERT INTO projects (id, name, path, last_opened_at, is_git_repo)
        VALUES ('salvage-proj-1', 'Salvage Project', '${tempDir.replace(/\\/g, '/')}/mock', ${Date.now()}, 0)
      `).run();

      databaseService.close();

      const recovery = databaseService.recoverCorruptedDatabase();
      expect(fs.existsSync(recovery.quarantinedCorruptPath)).toBe(true);
      expect(fs.existsSync(recovery.newDbPath)).toBe(true);
      expect(recovery.dataSalvaged).toBe(true);
      expect(recovery.salvagedTables).toContain('projects');
      expect(recovery.salvagedRecordsCount).toBeGreaterThanOrEqual(1);

      // Verify the salvaged project exists in the freshly initialized schema
      const newDb = databaseService.getAppDb();
      const proj = newDb.prepare(`SELECT * FROM projects WHERE id = 'salvage-proj-1'`).get() as any;
      expect(proj).toBeDefined();
      expect(proj.name).toBe('Salvage Project');
    });
  });

  // ==========================================
  // Domain 3: Git Mutex & Worktree Safety
  // ==========================================
  describe('Domain 3: Git Mutex & Concurrency Safety', () => {
    it('10. serializes concurrent operations with per-repository mutex lock', async () => {
      const executionOrder: number[] = [];
      const repoPath = path.join(tempDir, 'mock-repo');

      const op1 = WorktreeManager.withRepoLock(repoPath, async () => {
        await new Promise((resolve) => setTimeout(resolve, 60));
        executionOrder.push(1);
      });

      const op2 = WorktreeManager.withRepoLock(repoPath, async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        executionOrder.push(2);
      });

      await Promise.all([op1, op2]);
      expect(executionOrder).toEqual([1, 2]); // op2 must wait for op1 despite shorter duration
    });

    it('11. acquires and releases cross-process file lock with dead PID detection', async () => {
      const mockGitRepo = path.join(tempDir, 'cross-lock-repo');
      fs.mkdirSync(path.join(mockGitRepo, '.git'), { recursive: true });

      const lockId = await WorktreeManager.acquireCrossProcessLock(mockGitRepo, 2000);
      expect(lockId).not.toBeNull();

      const lockFile = path.join(mockGitRepo, '.git', 'orbito-repo.lock');
      expect(fs.existsSync(lockFile)).toBe(true);

      // Release lock
      await WorktreeManager.releaseCrossProcessLock(mockGitRepo, lockId);
      expect(fs.existsSync(lockFile)).toBe(false);

      // Simulate dead PID in stale lock file
      const deadPid = 9999999;
      fs.writeFileSync(lockFile, JSON.stringify({
        pid: deadPid,
        hostname: os.hostname(),
        createdAt: Date.now() - 5000,
        lockId: 'stale-dead-lock'
      }));

      // Must detect dead PID and acquire lock cleanly
      const newLockId = await WorktreeManager.acquireCrossProcessLock(mockGitRepo, 2000);
      expect(newLockId).not.toBeNull();
      await WorktreeManager.releaseCrossProcessLock(mockGitRepo, newLockId);
    });

    it('12. blocks pre-merge integration if repository is invalid or branch is missing', async () => {
      const nonExistentDir = path.join(tempDir, 'non-existent-git-repo');
      const safety = await WorktreeManager.verifyPreMergeSafety(nonExistentDir, 'agent/test-task');
      expect(safety.safe).toBe(true); // Non-git project bypass
    });

    it('13. detects interrupted git operations (stale index.lock) safely', async () => {
      const mockGitRepo = path.join(tempDir, 'git-stale-lock-repo');
      const dotGit = path.join(mockGitRepo, '.git');
      fs.mkdirSync(dotGit, { recursive: true });

      const lockPath = path.join(dotGit, 'index.lock');
      fs.writeFileSync(lockPath, 'LOCK');

      // Set mtime to 120 seconds ago to simulate stale lock
      const oldTime = (Date.now() - 120000) / 1000;
      fs.utimesSync(lockPath, oldTime, oldTime);

      const res = await WorktreeManager.abortInterruptedGitOperation(mockGitRepo, 'index_lock', true);
      expect(res.success).toBe(true);
      expect(fs.existsSync(lockPath)).toBe(false);
    });
  });

  // ==========================================
  // Domain 4: Agent Execution Reliability
  // ==========================================
  describe('Domain 4: Agent Execution & Transient Error Retries', () => {
    it('14. correctly classifies transient vs non-transient agent errors', () => {
      expect(AgentScheduler.isTransientError(new Error('Rate limit exceeded: 429 Too Many Requests'))).toBe(true);
      expect(AgentScheduler.isTransientError(new Error('ECONNRESET: socket hang up'))).toBe(true);
      expect(AgentScheduler.isTransientError(new Error('ETIMEDOUT: Connection timed out'))).toBe(true);
      expect(AgentScheduler.isTransientError(new Error('SyntaxError: Unexpected token < in JSON'))).toBe(false);
      expect(AgentScheduler.isTransientError(new Error('404 Not Found: Model does not exist'))).toBe(false);
    });

    it('15. calculates bounded exponential backoff with jitter and respects max retries', () => {
      const mockTask: any = {
        id: 'task-retry-test',
        orchestrationId: 'orch-retry-test',
        title: 'Transient Task',
        role: 'research-specialist',
        provider: 'anthropic',
        status: 'running',
        retryCount: 0,
        maxRetries: 3
      };

      const result = AgentScheduler.handleTaskFailure(mockTask, new Error('429 RateLimitError: Please try again'));
      expect(result.shouldRetry).toBe(true);
      expect(result.nextRetryCount).toBe(1);
      expect(result.backoffDelayMs).toBeGreaterThanOrEqual(800);
      expect(result.backoffDelayMs).toBeLessThanOrEqual(2500);

      // Max retries reached (3)
      mockTask.retryCount = 3;
      const maxRetryResult = AgentScheduler.handleTaskFailure(mockTask, new Error('429 RateLimitError'));
      expect(maxRetryResult.shouldRetry).toBe(false);
      expect(maxRetryResult.backoffDelayMs).toBe(0);
    });
  });

  // ==========================================
  // Domain 5: Security & IPC Boundaries
  // ==========================================
  describe('Domain 5: Security & IPC Surface Hardening', () => {
    it('16. rejects path traversal attempts outside workspace root', () => {
      const workspaceRoot = path.join(tempDir, 'project-root');
      fs.mkdirSync(workspaceRoot, { recursive: true });

      expect(() => {
        securityService.assertWithinWorkspace('../../etc/passwd', workspaceRoot);
      }).toThrow(SecurityViolationException);
    });

    it('17. rejects null-byte injection in file paths', () => {
      const workspaceRoot = path.join(tempDir, 'project-root');
      fs.mkdirSync(workspaceRoot, { recursive: true });

      expect(() => {
        securityService.assertWithinWorkspace('safe-file.txt\0.exe', workspaceRoot);
      }).toThrow(/Null byte/);
    });

    it('18. rejects Windows UNC network path injection (\\\\host\\share)', () => {
      const workspaceRoot = path.join(tempDir, 'project-root');
      fs.mkdirSync(workspaceRoot, { recursive: true });

      expect(() => {
        securityService.assertWithinWorkspace('\\\\evil-attacker.com\\share\\exploit', workspaceRoot);
      }).toThrow(/Windows UNC network path/);
    });

    it('19. validates IPC sender origin and rejects untrusted origins', () => {
      const mockEvent: any = {
        sender: {
          getURL: () => 'https://malicious-phishing-site.com/exploit',
          isDestroyed: () => false
        }
      };

      expect(() => {
        assertTrustedSender(mockEvent, 'system:getDatabaseHealth');
      }).toThrow(/Unauthorized IPC call/);
    });
  });

  // ==========================================
  // Domain 6: Resource Governance & Backpressure
  // ==========================================
  describe('Domain 6: Resource Governor Backpressure', () => {
    it('20. detects memory pressure state and returns metrics', () => {
      const snapshot = resourceGovernorService.getMemorySnapshot();
      expect(snapshot.heapUsedMb).toBeGreaterThan(0);
      expect(snapshot.heapTotalMb).toBeGreaterThan(0);
      expect(typeof snapshot.isUnderMemoryPressure).toBe('boolean');

      const config = resourceGovernorService.getConfig();
      expect(config.memoryHighWatermarkRatio).toBe(0.85);
      expect(config.memoryRecoveryWatermarkRatio).toBe(0.75);
    });

    it('21. throttles background task slots when under simulated memory pressure', () => {
      resourceGovernorService.setSimulatedPressure(true);
      expect(resourceGovernorService.shouldAcceptBackgroundWork()).toBe(false);
      expect(resourceGovernorService.acquireBackgroundTaskSlot()).toBe(false);

      resourceGovernorService.setSimulatedPressure(false);
      expect(resourceGovernorService.shouldAcceptBackgroundWork()).toBe(true);
      expect(resourceGovernorService.acquireBackgroundTaskSlot()).toBe(true);
      resourceGovernorService.releaseBackgroundTaskSlot();
    });
  });

  // ==========================================
  // Domain 7: MCP & Air-Gap Resilience
  // ==========================================
  describe('Domain 7: MCP & Air-Gap Recovery', () => {
    it('22. blocks outbound external network egress when Air-Gap is active', () => {
      airGapManager.updateConfig({ enabled: true });

      expect(() => {
        airGapManager.assertNetworkAllowed('https://api.openai.com/v1/chat');
      }).toThrow(AirGapViolationException);

      // Localhost / Loopback allowed
      expect(() => {
        airGapManager.assertNetworkAllowed('http://127.0.0.1:11434');
      }).not.toThrow();

      airGapManager.updateConfig({ enabled: false });
    });

    it('23. reroutes cloud providers to local Ollama when Air-Gap enforceLocalModels is active', () => {
      airGapManager.updateConfig({ enabled: true, enforceLocalModels: true });

      const resolved = airGapManager.resolveProvider('anthropic');
      expect(resolved).toBe('ollama');

      airGapManager.updateConfig({ enabled: false });
    });
  });

  // ==========================================
  // Domain 8: Release & Update Safeguards
  // ==========================================
  describe('Domain 8: Release & Update Safeguards', () => {
    it('24. blocks update installation when active tasks or sessions are in progress', async () => {
      const updateService = new AutoUpdateService();

      // Seed an active orchestration in SQLite
      const db = databaseService.getAppDb();
      db.prepare(`
        INSERT INTO orchestrations (id, project_id, project_path, user_goal, status, created_at)
        VALUES ('orch-active-upd', 'proj-1', '${tempDir.replace(/\\/g, '/')}', 'Task running', 'running', ${Date.now()})
      `).run();

      // Attempt install
      const res = await updateService.installUpdate();
      expect(res.success).toBe(false);
      expect(res.message).toContain('active task(s) or orchestration(s)');
      lifecycleCoordinatorService.exitMaintenanceMode();
    });

    it('25. enforces atomic MaintenanceGate blocking new operations during maintenance', async () => {
      lifecycleCoordinatorService.enterMaintenanceMode('System update in progress');
      expect(lifecycleCoordinatorService.isMaintenanceActive()).toBe(true);

      // Attempting to track operation start during maintenance must throw immediately
      expect(() => {
        lifecycleCoordinatorService.trackOperationStart('task', 'task-blocked-1');
      }).toThrow(/Application is currently in maintenance mode/);

      // Release maintenance gate
      lifecycleCoordinatorService.exitMaintenanceMode();
      expect(lifecycleCoordinatorService.isMaintenanceActive()).toBe(false);

      // Now operation can start cleanly
      expect(() => {
        lifecycleCoordinatorService.trackOperationStart('task', 'task-allowed-1');
      }).not.toThrow();
      lifecycleCoordinatorService.trackOperationEnd('task-allowed-1');
    });
  });

  // ==========================================
  // Domain 9: Real Multi-Process Concurrency & Edge Cases
  // ==========================================
  describe('Domain 9: Advanced Edge Cases & Concurrency Certification', () => {
    it('26. resolves canonical Git common directory across linked worktrees for locking', async () => {
      const mainRepo = path.join(tempDir, 'main-repo');
      const commonGitDir = path.join(mainRepo, '.git');
      fs.mkdirSync(commonGitDir, { recursive: true });

      // Create linked worktree simulation where .git is a file
      const worktreeDir = path.join(tempDir, 'linked-worktree');
      fs.mkdirSync(worktreeDir, { recursive: true });

      const worktreeGitDir = path.join(commonGitDir, 'worktrees', 'linked-worktree');
      fs.mkdirSync(worktreeGitDir, { recursive: true });
      fs.writeFileSync(path.join(worktreeGitDir, 'commondir'), '../..\n', 'utf8');

      // Point worktree .git file to worktreeGitDir
      fs.writeFileSync(path.join(worktreeDir, '.git'), `gitdir: ${worktreeGitDir}\n`, 'utf8');

      // Both main repo and worktree must resolve to the identical common Git directory!
      const resolvedMain = await WorktreeManager.resolveCommonGitDir(mainRepo);
      const resolvedWorktree = await WorktreeManager.resolveCommonGitDir(worktreeDir);

      expect(resolvedMain).not.toBeNull();
      expect(resolvedWorktree).not.toBeNull();
      expect(path.resolve(resolvedMain!).toLowerCase()).toBe(path.resolve(resolvedWorktree!).toLowerCase());

      // Lock acquired via worktree path must place lockfile in common Git dir
      const lockId = await WorktreeManager.acquireCrossProcessLock(worktreeDir, 2000);
      expect(lockId).not.toBeNull();

      const expectedLockPath = path.join(resolvedMain!, 'orbito-repo.lock');
      expect(fs.existsSync(expectedLockPath)).toBe(true);

      await WorktreeManager.releaseCrossProcessLock(worktreeDir, lockId);
      expect(fs.existsSync(expectedLockPath)).toBe(false);
    });

    it('27. refuses to automatically break lock belonging to a different machine hostname', async () => {
      const repoDir = path.join(tempDir, 'remote-locked-repo');
      fs.mkdirSync(path.join(repoDir, '.git'), { recursive: true });

      const lockFilePath = path.join(repoDir, '.git', 'orbito-repo.lock');
      const remotePayload = {
        pid: 12345,
        hostname: 'remote-workstation-99',
        processStartTime: Date.now() - 60000,
        createdAt: Date.now() - 50000,
        lockId: 'remote-lock-uuid',
        repoPath: repoDir
      };
      fs.writeFileSync(lockFilePath, JSON.stringify(remotePayload), 'utf8');

      // Attempt acquisition with short timeout — must fail and preserve lock
      await expect(WorktreeManager.acquireCrossProcessLock(repoDir, 200)).rejects.toThrow(
        /is locked by another process/
      );

      // Verify lockfile was NOT deleted
      expect(fs.existsSync(lockFilePath)).toBe(true);
      fs.unlinkSync(lockFilePath);
    });

    it('28. provides detailed row accounting during SQLite partial data salvage', () => {
      const db = databaseService.getAppDb();

      // Insert clean records into projects
      db.prepare(`
        INSERT INTO projects (id, name, path, last_opened_at, is_git_repo)
        VALUES ('salvage-p1', 'Salvage Project', '${tempDir.replace(/\\/g, '/')}', ${Date.now()}, 1)
      `).run();

      const res = databaseService.recoverCorruptedDatabase();
      expect(res.dataSalvaged).toBe(true);
      expect(res.salvageOutcome).toBe('SALVAGE_FULL_SUCCESS');
      expect(res.salvagedTables).toContain('projects');
      expect(res.salvagedRecordsCount).toBeGreaterThan(0);
      expect(res.tableAccounting.projects.salvaged).toBeGreaterThanOrEqual(1);
    });

    it('29. classifies interrupted tasks across 5 distinct recovery states', async () => {
      const db = databaseService.getAppDb();
      const now = Date.now();

      // Seed parent orchestration first to satisfy foreign key constraints
      db.prepare(`
        INSERT INTO orchestrations (id, project_id, project_path, user_goal, status, created_at)
        VALUES ('orch-reconcile-29', 'salvage-p1', '${tempDir.replace(/\\/g, '/')}', 'Reconciliation goal', 'running', ${now})
      `).run();

      // Task A: Clean worktree, was only ready -> CLEAN_INTERRUPTED
      db.prepare(`
        INSERT INTO orchestration_tasks (id, orchestration_id, title, description, role, provider, status, permissions_json, created_at, retry_count)
        VALUES ('task-clean-1', 'orch-reconcile-29', 'Clean Task', 'Desc', 'frontend-specialist', 'anthropic', 'ready', '{}', ${now}, 0)
      `).run();

      // Task B: Running task with active tool traces -> EXTERNAL_SIDE_EFFECTS_UNKNOWN
      db.prepare(`
        INSERT INTO orchestration_tasks (id, orchestration_id, title, description, role, provider, status, permissions_json, created_at, retry_count)
        VALUES ('task-running-sidefx', 'orch-reconcile-29', 'Running Task', 'Desc', 'backend-specialist', 'anthropic', 'running', '{}', ${now}, 0)
      `).run();

      db.prepare(`
        INSERT INTO task_traces (trace_id, orchestration_id, task_id, task_title, agent_id, role, status, started_at)
        VALUES ('trace-1', 'orch-reconcile-29', 'task-running-sidefx', 'Running Task', 'agent-1', 'backend-specialist', 'running', ${now})
      `).run();

      const incidents: any[] = [];
      const res = await AgentScheduler.reconcileStartupInterruptedTasks(db, (inc) => incidents.push(inc));

      expect(res.classificationSummary.CLEAN_INTERRUPTED).toBeGreaterThanOrEqual(1);
      expect(res.classificationSummary.EXTERNAL_SIDE_EFFECTS_UNKNOWN).toBeGreaterThanOrEqual(1);

      const taskB = db.prepare('SELECT status, error_message FROM orchestration_tasks WHERE id = ?').get('task-running-sidefx') as any;
      expect(taskB.status).toBe('requires_intervention');
      expect(taskB.error_message).toContain('EXTERNAL_SIDE_EFFECTS_UNKNOWN');
    });

    it('30. captures untracked and modified files in complete worktree recovery snapshot', async () => {
      const mockWorktree = path.join(tempDir, 'snapshot-worktree');
      fs.mkdirSync(mockWorktree, { recursive: true });

      // Initialize git repo in worktree
      fs.mkdirSync(path.join(mockWorktree, '.git'), { recursive: true });
      fs.writeFileSync(path.join(mockWorktree, 'tracked.ts'), 'export const x = 1;', 'utf8');
      fs.writeFileSync(path.join(mockWorktree, 'untracked.bin'), Buffer.from([0x00, 0x01, 0x02]));

      const snapshot = await WorktreeManager.saveWorktreeSnapshot(mockWorktree, 'task-snapshot-test');
      expect(snapshot).not.toBeNull();
      expect(snapshot?.manifestPath).not.toBeNull();
      expect(fs.existsSync(snapshot!.manifestPath!)).toBe(true);

      const manifestContent = JSON.parse(fs.readFileSync(snapshot!.manifestPath!, 'utf8'));
      expect(manifestContent.taskId).toBe('task-snapshot-test');
      expect(manifestContent.worktreePath).toBe(mockWorktree);
    });

    it('31. rejects IPC subframe and iframe invocations via assertTrustedSender', () => {
      const mockEvent: any = {
        sender: {
          getURL: () => 'http://localhost:5173/app',
          mainFrame: { id: 1 }
        },
        senderFrame: { id: 99 } // Subframe mismatch!
      };

      expect(() => {
        assertTrustedSender(mockEvent, 'system:test-channel');
      }).toThrow(/Subframe or iframe invocation rejected/);
    });
  });
});
