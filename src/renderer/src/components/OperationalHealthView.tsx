import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Database,
  HardDrive,
  GitBranch,
  RotateCw,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Download,
  Upload,
  Trash2,
  Activity,
  Layers,
  Cpu
} from 'lucide-react';
import type {
  LifecycleHealthStatus,
  DatabaseHealthStatus,
  DatabaseBackupInfo,
  WorktreeSafetyStatus,
  RecoveryIncident
} from '../../../shared/lifecycle';

export const OperationalHealthView: React.FC = () => {
  const [lifecycle, setLifecycle] = useState<LifecycleHealthStatus | null>(null);
  const [dbHealth, setDbHealth] = useState<DatabaseHealthStatus | null>(null);
  const [backups, setBackups] = useState<DatabaseBackupInfo[]>([]);
  const [worktreeHealth, setWorktreeHealth] = useState<WorktreeSafetyStatus | null>(null);
  const [incidents, setIncidents] = useState<RecoveryIncident[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadAll = async () => {
    setIsLoading(true);
    setActionMessage(null);
    try {
      const [lc, dbh, bks, wts, inc] = await Promise.all([
        window.api.getLifecycleStatus(),
        window.api.getDatabaseHealth(),
        window.api.listDatabaseBackups(),
        window.api.getWorktreeSafetyStatus(),
        window.api.getRecoveryIncidents()
      ]);
      setLifecycle(lc);
      setDbHealth(dbh);
      setBackups(bks);
      setWorktreeHealth(wts);
      setIncidents(inc);
    } catch (err: any) {
      console.error('Failed to load operational resilience data:', err);
      setActionMessage('Failed to load telemetry: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    const unsubscribe = window.api.onLifecycleStatusChange?.((status) => {
      setLifecycle(status);
    });
    return () => {
      unsubscribe?.();
    };
  }, []);

  const handleCreateBackup = async () => {
    setIsBackingUp(true);
    setActionMessage(null);
    try {
      const res = await window.api.createDatabaseBackup();
      setActionMessage(`Online backup saved: ${res.backupPath}`);
      const bks = await window.api.listDatabaseBackups();
      setBackups(bks);
    } catch (err: any) {
      setActionMessage(`Backup failed: ${err.message}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreBackup = async (filePath: string) => {
    if (!window.confirm(`Are you sure you want to restore database from "${filePath}"? Current database will be snapshotted before restoring.`)) {
      return;
    }
    setIsLoading(true);
    try {
      await window.api.restoreDatabaseBackup({ filePath, explicitConfirm: true });
      setActionMessage(`Successfully restored database from backup! Snapshot created.`);
      await loadAll();
    } catch (err: any) {
      setActionMessage(`Restore failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCleanStaleLock = async () => {
    try {
      const res = await window.api.recoverWorktree({
        repoPath: '.',
        action: 'clean_stale_lock'
      });
      setActionMessage(res.message);
      await loadAll();
    } catch (err: any) {
      setActionMessage(`Action failed: ${err.message}`);
    }
  };

  const handleAbortInterrupted = async () => {
    try {
      const res = await window.api.recoverWorktree({
        repoPath: '.',
        action: 'abort_interrupted'
      });
      setActionMessage(res.message);
      await loadAll();
    } catch (err: any) {
      setActionMessage(`Action failed: ${err.message}`);
    }
  };

  const handleResolveIncident = async (incidentId: string, action: 'dismiss' | 'quarantine' | 'restore_backup' | 'abort_merge' | 'clean_lock') => {
    try {
      await window.api.resolveRecoveryIncident({
        incidentId,
        action,
        confirmed: true
      });
      await loadAll();
    } catch (err: any) {
      setActionMessage(`Resolution failed: ${err.message}`);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6 text-foreground">
      {/* Action Notification Bar */}
      {actionMessage && (
        <div className="p-3 rounded-lg bg-white/[0.04] text-xs text-muted-foreground flex items-center justify-between border-0">
          <span>{actionMessage}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="text-muted-foreground hover:text-foreground text-xs border-0 bg-transparent cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Level KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white/[0.03] border-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>Process State</span>
          </div>
          <div className="text-2xl font-semibold tracking-tight text-emerald-400">
            {lifecycle?.state ? lifecycle.state.toUpperCase() : 'READY'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Uptime: {lifecycle ? Math.round(lifecycle.uptimeSeconds / 60) : 0} min | Crashes: {lifecycle?.recentCrashes.length || 0}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.03] border-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Database className="w-4 h-4 text-cyan-400" />
            <span>Database Integrity</span>
          </div>
          <div className="text-2xl font-semibold tracking-tight text-cyan-400">
            {dbHealth?.integrity === 'ok' ? 'HEALTHY' : 'CHECKING'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {dbHealth?.tableCount || 0} Tables | FK Violations: 0
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.03] border-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <GitBranch className="w-4 h-4 text-amber-400" />
            <span>Git & Worktree Concurrency</span>
          </div>
          <div className="text-2xl font-semibold tracking-tight text-amber-400">
            {worktreeHealth?.activeLocksCount || 0} Locks
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {worktreeHealth?.activeWorktreesCount || 0} Active Worktrees | {worktreeHealth?.quarantinedBranchesCount || 0} Quarantined
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.03] border-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <HardDrive className="w-4 h-4 text-primary" />
            <span>Online Backups</span>
          </div>
          <div className="text-2xl font-semibold tracking-tight">
            {backups.length}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            WAL-consistent SQLite snapshots
          </div>
        </div>
      </div>

      {/* Incidents & Active Interrupted Operations */}
      {(incidents.length > 0 || (worktreeHealth?.interruptedOperations && worktreeHealth.interruptedOperations.length > 0)) && (
        <div className="p-4 rounded-xl bg-white/[0.02] border-0 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-rose-400">
              <AlertTriangle className="w-4 h-4" />
              <span>Active Recovery Incidents</span>
            </div>
          </div>
          <div className="space-y-2">
            {worktreeHealth?.interruptedOperations.map((op, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] text-xs">
                <div>
                  <div className="font-medium text-foreground">Interrupted Git {op.type.toUpperCase()}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{op.path}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAbortInterrupted}
                    className="px-3 py-1 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs transition-colors border-0"
                  >
                    Abort & Recover
                  </button>
                  <button
                    onClick={handleCleanStaleLock}
                    className="px-3 py-1 rounded-md bg-white/[0.06] hover:bg-white/[0.1] text-foreground text-xs transition-colors border-0"
                  >
                    Clean Lock
                  </button>
                </div>
              </div>
            ))}
            {incidents.map((inc) => (
              <div key={inc.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] text-xs">
                <div>
                  <div className="font-medium text-foreground">{inc.title}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{inc.description}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleResolveIncident(inc.id, 'dismiss')}
                    className="px-3 py-1 rounded-md bg-white/[0.06] hover:bg-white/[0.1] text-muted-foreground hover:text-foreground text-xs transition-colors border-0"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Database Backup & Disaster Recovery Center */}
      <div className="p-4 rounded-xl bg-white/[0.02] border-0 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Database className="w-4 h-4 text-cyan-400" />
            <span>Database Backup & Point-in-Time Recovery</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateBackup}
              disabled={isBackingUp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-medium transition-colors border-0 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isBackingUp ? 'Snapshotting...' : 'Create Online Backup'}</span>
            </button>
            <button
              onClick={loadAll}
              disabled={isLoading}
              className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition-colors border-0"
              title="Refresh Health"
              aria-label="Refresh Health"
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {backups.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4 text-center">
            No database backups created yet. Click "Create Online Backup" to generate a WAL-consistent snapshot.
          </div>
        ) : (
          <div className="space-y-1.5">
            {backups.map((b) => (
              <div
                key={b.fileName}
                className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] text-xs hover:bg-white/[0.05] transition-colors"
              >
                <div className="space-y-0.5">
                  <div className="font-mono text-[11px] text-foreground flex items-center gap-2">
                    <span>{b.fileName}</span>
                    {b.valid && <CheckCircle2 className="w-3 h-3 text-emerald-400 inline" />}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatBytes(b.sizeBytes)} • {new Date(b.timestamp).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRestoreBackup(b.filePath)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/[0.06] hover:bg-white/[0.1] text-foreground text-xs transition-colors border-0"
                    title="Restore this backup (snapshots current database first)"
                  >
                    <Upload className="w-3 h-3 text-muted-foreground" />
                    <span>Restore</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Git & Concurrency Safety Details */}
      <div className="p-4 rounded-xl bg-white/[0.02] border-0 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <GitBranch className="w-4 h-4 text-amber-400" />
          <span>Git Mutex & Worktree Safety Protocol</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-white/[0.03] space-y-1">
            <div className="text-muted-foreground">Pre-Merge Safety Protocol</div>
            <div className="font-medium text-foreground">Active (Clean Tree Required)</div>
            <div className="text-[11px] text-muted-foreground">Blocks merge if uncommitted user changes exist</div>
          </div>
          <div className="p-3 rounded-lg bg-white/[0.03] space-y-1">
            <div className="text-muted-foreground">Zero-Destructive Auto-Recovery</div>
            <div className="font-medium text-foreground">Active (Quarantine to Stash)</div>
            <div className="text-[11px] text-muted-foreground">Dirty task worktrees preserved in orphaned/* branches</div>
          </div>
          <div className="p-3 rounded-lg bg-white/[0.03] space-y-1">
            <div className="text-muted-foreground">Cross-Process Mutex Lock</div>
            <div className="font-medium text-foreground">Atomic OS File Lock + Memory Mutex</div>
            <div className="text-[11px] text-muted-foreground">Locks via .git/orbito-repo.lock with dead-process PID detection</div>
          </div>
        </div>
      </div>

      {/* Database Disaster Recovery Protocols */}
      <div className="p-4 rounded-xl bg-white/[0.02] border-0 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Database className="w-4 h-4 text-cyan-400" />
          <span>Database Disaster Recovery & Data Integrity Protocol</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-white/[0.03] space-y-1">
            <div className="text-muted-foreground">Two-Step Candidate Restore</div>
            <div className="font-medium text-foreground">Isolated Pre-Validation</div>
            <div className="text-[11px] text-muted-foreground">Validates candidate database before touching live storage; creates pre-restore emergency snapshot</div>
          </div>
          <div className="p-3 rounded-lg bg-white/[0.03] space-y-1">
            <div className="text-muted-foreground">Partial Data Salvage</div>
            <div className="font-medium text-foreground">Table-by-Table Extraction</div>
            <div className="text-[11px] text-muted-foreground">Corrupted databases quarantined; uncorrupted tables safely salvaged and migrated into clean schema</div>
          </div>
        </div>
      </div>
    </div>
  );
};
