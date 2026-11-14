import { z } from 'zod';

export type AppLifecycleState =
  | 'initializing'
  | 'ready'
  | 'degraded'
  | 'shutting_down'
  | 'terminated'
  | 'recovery_required';

export interface CrashReport {
  timestamp: number;
  reason: string;
  source: 'main' | 'renderer' | 'uncaughtException' | 'unhandledRejection';
  details?: string;
  recovered: boolean;
}

export interface LifecycleHealthStatus {
  state: AppLifecycleState;
  uptimeSeconds: number;
  bootTimestamp: number;
  lastCleanShutdownAt: number | null;
  degradedReason?: string;
  activeTasksCount: number;
  pendingShutdownTimeoutMs?: number;
  recentCrashes: CrashReport[];
  isRecoveryRequired: boolean;
}

export interface RecoveryIncident {
  id: string;
  type: 'interrupted_task' | 'dirty_worktree' | 'corrupt_database' | 'unclean_shutdown' | 'stale_lock';
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  timestamp: number;
  suggestedAction: string;
  targetId?: string;
  isDestructive: boolean;
}

export const ResolveRecoveryIncidentSchema = z.object({
  incidentId: z.string().min(1),
  action: z.enum(['dismiss', 'quarantine', 'restore_backup', 'abort_merge', 'clean_lock']),
  confirmed: z.boolean().default(false)
});

export type ResolveRecoveryIncidentInput = z.infer<typeof ResolveRecoveryIncidentSchema>;

export interface DatabaseHealthStatus {
  integrity: string;
  foreignKeysOk: boolean;
  tableCount: number;
  corrupted: boolean;
  details?: Record<string, any>;
}

export interface DatabaseBackupInfo {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  timestamp: number;
  valid: boolean;
}

export const CreateDatabaseBackupSchema = z.object({
  destinationPath: z.string().optional()
});
export type CreateDatabaseBackupInput = z.infer<typeof CreateDatabaseBackupSchema>;

export const VerifyDatabaseBackupSchema = z.object({
  filePath: z.string().min(1)
});
export type VerifyDatabaseBackupInput = z.infer<typeof VerifyDatabaseBackupSchema>;

export const RestoreDatabaseBackupSchema = z.object({
  filePath: z.string().min(1),
  explicitConfirm: z.boolean().default(false)
});
export type RestoreDatabaseBackupInput = z.infer<typeof RestoreDatabaseBackupSchema>;

export const RecoverCorruptedDatabaseSchema = z.object({
  explicitConfirm: z.boolean().default(false)
});
export type RecoverCorruptedDatabaseInput = z.infer<typeof RecoverCorruptedDatabaseSchema>;

export interface WorktreeSafetyStatus {
  activeLocksCount: number;
  activeWorktreesCount: number;
  interruptedOperations: Array<{
    type: 'rebase' | 'merge' | 'cherry-pick' | 'revert';
    path: string;
  }>;
  quarantinedBranchesCount: number;
}

export const GetWorktreeHealthSchema = z.object({
  repoPath: z.string().optional()
});
export type GetWorktreeHealthInput = z.infer<typeof GetWorktreeHealthSchema>;

export const RecoverWorktreeSchema = z.object({
  repoPath: z.string().min(1),
  action: z.enum(['abort_interrupted', 'quarantine_dirty', 'clean_stale_lock']),
  target: z.string().optional()
});
export type RecoverWorktreeInput = z.infer<typeof RecoverWorktreeSchema>;

