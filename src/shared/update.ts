import { z } from 'zod';

export type ReleaseChannel = 'stable' | 'beta' | 'nightly';

export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'
  | 'blocked-by-air-gap';

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
  channel: ReleaseChannel;
  sha256?: string;
  downloadUrl?: string;
  fileName?: string;
  fileSize?: number;
  isPortable?: boolean;
}

export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export interface CheckUpdateResult {
  available: boolean;
  currentVersion: string;
  latestVersion?: string;
  updateInfo?: UpdateInfo;
  error?: string;
  blockedByAirGap?: boolean;
}

export interface InstallUpdateResult {
  success: boolean;
  message?: string;
  stagedPath?: string;
  requiresManualRestart?: boolean;
}

export const CheckForUpdatesSchema = z.object({
  channel: z.enum(['stable', 'beta', 'nightly']).optional(),
  force: z.boolean().optional()
});

export const DownloadUpdateSchema = z.object({
  version: z.string(),
  downloadUrl: z.string().url(),
  sha256: z.string().optional(),
  fileName: z.string().optional()
});

export const InstallUpdateSchema = z.object({
  restartImmediately: z.boolean().optional()
});
