import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export async function findExecutableOnPath(executableName: string): Promise<string | null> {
  const isWin = process.platform === 'win32';
  const probeCommand = isWin ? 'where.exe' : 'which';

  return new Promise((resolve) => {
    execFile(probeCommand, [executableName], { timeout: 3000 }, (error, stdout) => {
      if (error || !stdout) {
        // Also check with .cmd or .exe extensions on Windows if not provided
        if (isWin && !executableName.endsWith('.cmd') && !executableName.endsWith('.exe')) {
          execFile('where.exe', [`${executableName}.cmd`], { timeout: 3000 }, (err2, out2) => {
            if (err2 || !out2) {
              resolve(null);
            } else {
              const firstLine = out2.trim().split(/\r?\n/)[0];
              resolve(firstLine || null);
            }
          });
          return;
        }
        resolve(null);
        return;
      }

      const firstLine = stdout.trim().split(/\r?\n/)[0];
      resolve(firstLine || null);
    });
  });
}

export async function probeVersion(executablePath: string, versionFlag = '--version'): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(executablePath, [versionFlag], { timeout: 4000 }, (error, stdout, stderr) => {
      if (error) {
        resolve(null);
        return;
      }

      const output = (stdout || stderr).trim();
      // Match common semver formats like 0.2.14, 1.0.0, v2.3.0
      const match = output.match(/v?(\d+\.\d+\.\d+[\w.-]*)/);
      resolve(match ? match[1] : output.split(/\r?\n/)[0] || null);
    });
  });
}

export function parseSemver(versionStr: string): { major: number; minor: number; patch: number } | null {
  const clean = versionStr.replace(/^v/, '');
  const parts = clean.split('.').map((p) => parseInt(p, 10));
  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return {
      major: parts[0],
      minor: parts[1],
      patch: isNaN(parts[2]) ? 0 : parts[2]
    };
  }
  return null;
}

export function isVersionAtLeast(current: string, minimum: string): boolean {
  const curr = parseSemver(current);
  const min = parseSemver(minimum);
  if (!curr || !min) return true;

  if (curr.major !== min.major) return curr.major > min.major;
  if (curr.minor !== min.minor) return curr.minor > min.minor;
  return curr.patch >= min.patch;
}
