import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type GitProvider = 'github' | 'gitlab' | 'bitbucket' | 'other';

export interface NormalizedGitRemote {
  provider: GitProvider;
  providerLabel: string;
  browserUrl: string;
  rawUrl: string;
  remoteName: string;
  owner?: string;
  repo?: string;
}

/**
 * Normalizes any supported Git remote URL (SSH, HTTPS, etc.) into a safe HTTP/HTTPS browser URL.
 * Sanitizes sensitive authentication credentials and rejects non-web schemes.
 */
export function normalizeGitUrl(
  rawUrl?: string | null
): { provider: GitProvider; providerLabel: string; browserUrl: string; owner?: string; repo?: string } | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  // Reject unsafe schemes, Windows local paths, and backslashes
  if (
    lower.startsWith('file:') ||
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    /^[a-z]:[/\\]/i.test(trimmed) ||
    trimmed.includes('\\')
  ) {
    return null;
  }

  let host = '';
  let pathPart = '';

  // 1. Check for SCP-like SSH syntax: git@hostname:owner/repo.git or user@host:path
  const scpMatch = trimmed.match(/^(?:[\w.-]+@)?([^:/]+):([^\/].*)$/);
  if (scpMatch && !trimmed.includes('://')) {
    host = scpMatch[1].toLowerCase();
    // Reject single-letter host names (e.g. drive letters)
    if (host.length <= 1) return null;
    pathPart = scpMatch[2];
  } else {
    // 2. Standard URI syntax (https://, http://, ssh://, git://)
    try {
      const parsed = new URL(trimmed);
      const protocol = parsed.protocol.toLowerCase();
      if (protocol !== 'https:' && protocol !== 'http:' && protocol !== 'ssh:' && protocol !== 'git:') {
        return null;
      }
      host = parsed.hostname.toLowerCase();
      // Remove leading slashes
      pathPart = parsed.pathname.replace(/^\/+/, '');
    } catch {
      return null;
    }
  }

  // Strip .git extension (case-insensitive) and trailing slashes
  pathPart = pathPart.replace(/\.git\/?$/i, '').replace(/\/+$/, '');
  if (!host || !pathPart) return null;

  // Determine provider
  let provider: GitProvider = 'other';
  let providerLabel = 'View Repository';

  if (host === 'github.com' || host.endsWith('.github.com')) {
    provider = 'github';
    providerLabel = 'View on GitHub';
  } else if (host === 'gitlab.com' || host.endsWith('.gitlab.com')) {
    provider = 'gitlab';
    providerLabel = 'View on GitLab';
  } else if (host === 'bitbucket.org' || host.endsWith('.bitbucket.org')) {
    provider = 'bitbucket';
    providerLabel = 'View on Bitbucket';
  }

  // Extract owner/repo if two segments exist
  const segments = pathPart.split('/').filter(Boolean);
  const owner = segments.length >= 2 ? segments[segments.length - 2] : undefined;
  const repo = segments.length >= 1 ? segments[segments.length - 1] : undefined;

  const browserUrl = `https://${host}/${pathPart}`;

  return {
    provider,
    providerLabel,
    browserUrl,
    owner,
    repo
  };
}

/**
 * Parses git remote -v output and returns structured map of remotes with fetch and push URLs.
 */
export function parseGitRemoteOutput(output: string): Map<string, { fetch?: string; push?: string }> {
  const remotes = new Map<string, { fetch?: string; push?: string }>();
  const lines = output
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^([^\s]+)\s+([^\s]+)\s+\((fetch|push)\)$/);
    if (match) {
      const [, name, url, type] = match;
      if (!remotes.has(name)) {
        remotes.set(name, {});
      }
      const item = remotes.get(name)!;
      if (type === 'fetch') item.fetch = url;
      else if (type === 'push') item.push = url;
    }
  }

  return remotes;
}

/**
 * Selects the primary remote deterministically:
 * 1. 'origin' (fetch preferred over push)
 * 2. 'upstream' (fetch preferred over push)
 * 3. First alphabetically sorted remote name
 */
export function selectPrimaryRemote(
  remotes: Map<string, { fetch?: string; push?: string }>
): { name: string; url: string } | null {
  if (remotes.size === 0) return null;

  // 1. origin
  if (remotes.has('origin')) {
    const r = remotes.get('origin')!;
    const url = r.fetch || r.push;
    if (url) return { name: 'origin', url };
  }

  // 2. upstream
  if (remotes.has('upstream')) {
    const r = remotes.get('upstream')!;
    const url = r.fetch || r.push;
    if (url) return { name: 'upstream', url };
  }

  // 3. Alphabetical first
  const sortedNames = Array.from(remotes.keys()).sort();
  for (const name of sortedNames) {
    const r = remotes.get(name)!;
    const url = r.fetch || r.push;
    if (url) return { name, url };
  }

  return null;
}

/**
 * Detects the primary remote for a given project directory, running `git remote -v`.
 */
export async function detectProjectGitRemote(projectPath: string): Promise<NormalizedGitRemote | null> {
  try {
    const { stdout } = await execFileAsync('git', ['remote', '-v'], {
      cwd: projectPath,
      timeout: 5000,
      windowsHide: true
    });

    const remotes = parseGitRemoteOutput(stdout);
    const primary = selectPrimaryRemote(remotes);
    if (!primary) return null;

    const normalized = normalizeGitUrl(primary.url);
    if (!normalized) return null;

    return {
      ...normalized,
      rawUrl: primary.url,
      remoteName: primary.name
    };
  } catch {
    return null;
  }
}
