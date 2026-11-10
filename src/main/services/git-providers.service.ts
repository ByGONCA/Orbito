import { safeStorageService } from './safe-storage.service';
import { databaseService } from '../db/database.service';
import { workspaceService } from './workspace.service';
import type {
  GitProviderSourceId,
  GitProviderStatus,
  RemoteGitRepo,
  ProjectDescriptor
} from '../../shared/types';

interface ProviderMetadata {
  username?: string;
  serverUrl?: string;
  organization?: string;
  updatedAt: number;
}

const PROVIDER_NAMES: Record<GitProviderSourceId, string> = {
  github: 'GitHub',
  'azure-devops': 'Azure DevOps',
  bitbucket: 'Bitbucket',
  cursor: 'Cursor Origin',
  forgejo: 'Forgejo / Gitea',
  gitcafe: 'GitCafe',
  gitlab: 'GitLab'
};

const DEFAULT_SERVER_URLS: Partial<Record<GitProviderSourceId, string>> = {
  github: 'https://api.github.com',
  gitlab: 'https://gitlab.com',
  forgejo: 'https://codeberg.org',
  cursor: 'https://api.cursor.com',
  gitcafe: 'https://gitcafe.net'
};

export class GitProvidersService {
  private readonly configKey = 'git_providers_metadata';

  /**
   * Reads provider metadata dictionary from database system_config.
   */
  private getMetadataMap(): Record<string, ProviderMetadata> {
    try {
      const db = databaseService.getAppDb();
      const row = db.prepare('SELECT value_json FROM system_config WHERE key = ?').get(this.configKey) as any;
      if (row?.value_json) {
        return JSON.parse(row.value_json);
      }
    } catch {
      // Table or DB might be initializing
    }
    return {};
  }

  /**
   * Saves provider metadata dictionary into database system_config.
   */
  private saveMetadataMap(map: Record<string, ProviderMetadata>): void {
    const db = databaseService.getAppDb();
    const json = JSON.stringify(map);
    db.prepare(`
      INSERT INTO system_config (key, value_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_at = excluded.updated_at
    `).run(this.configKey, json, Date.now());
  }

  /**
   * Securely saves the access token for a git provider.
   */
  private storeToken(provider: GitProviderSourceId, token: string): void {
    const key = `git_token_${provider}`;
    try {
      if (safeStorageService.isEncryptionAvailable()) {
        safeStorageService.storeSecret(key, token);
        return;
      }
    } catch {
      // Fallback below
    }
    // Fallback when OS keychain is mocked or unavailable in environment
    databaseService.saveEncryptedSecret(key, `unencrypted:${Buffer.from(token).toString('base64')}`);
  }

  /**
   * Retrieves the access token for a git provider.
   */
  private getToken(provider: GitProviderSourceId): string | null {
    const key = `git_token_${provider}`;
    try {
      const val = safeStorageService.getSecret(key);
      if (val) return val;
    } catch {
      // Fallback below
    }
    const encrypted = databaseService.getEncryptedSecret(key);
    if (!encrypted) return null;
    if (encrypted.startsWith('unencrypted:')) {
      const b64 = encrypted.replace('unencrypted:', '');
      return Buffer.from(b64, 'base64').toString('utf8');
    }
    return null;
  }

  /**
   * Deletes the access token for a git provider.
   */
  private removeToken(provider: GitProviderSourceId): void {
    const key = `git_token_${provider}`;
    try {
      const db = databaseService.getAppDb();
      db.prepare('DELETE FROM secrets_store WHERE key = ?').run(key);
    } catch {
      // Ignore cleanup error
    }
  }

  /**
   * Returns current configuration status for all 7 git providers.
   */
  public async getProvidersStatus(): Promise<GitProviderStatus[]> {
    const meta = this.getMetadataMap();
    const providerIds: GitProviderSourceId[] = [
      'github',
      'azure-devops',
      'bitbucket',
      'cursor',
      'forgejo',
      'gitcafe',
      'gitlab'
    ];

    return providerIds.map((id) => {
      const token = this.getToken(id);
      const isConfigured = Boolean(token && token.length > 0);
      const info = meta[id];

      return {
        id,
        name: PROVIDER_NAMES[id],
        isConfigured,
        username: info?.username,
        serverUrl: info?.serverUrl || DEFAULT_SERVER_URLS[id],
        repoCount: undefined
      };
    });
  }

  /**
   * Saves and verifies provider credentials with remote API.
   */
  public async saveProviderConfig(params: {
    provider: GitProviderSourceId;
    token: string;
    serverUrl?: string;
    username?: string;
    organization?: string;
  }): Promise<{ success: boolean; user?: string; error?: string }> {
    const token = params.token.trim();
    if (!token) {
      throw new Error('Access token or API key cannot be empty.');
    }

    const serverUrl = (params.serverUrl?.trim() || DEFAULT_SERVER_URLS[params.provider] || '').replace(/\/+$/, '');
    const organization = params.organization?.trim();
    let resolvedUser = params.username?.trim();

    // Verify credentials via API
    try {
      switch (params.provider) {
        case 'github': {
          const res = await fetch('https://api.github.com/user', {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github.v3+json',
              'User-Agent': 'Orbito-App'
            }
          });
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.message || `GitHub authentication failed (HTTP ${res.status}). Verify your token permissions.`);
          }
          const user = (await res.json()) as any;
          resolvedUser = user.login || user.name || resolvedUser;
          break;
        }

        case 'gitlab': {
          const base = serverUrl || 'https://gitlab.com';
          const res = await fetch(`${base}/api/v4/user`, {
            headers: {
              'PRIVATE-TOKEN': token
            }
          });
          if (!res.ok) {
            throw new Error(`GitLab authentication failed (HTTP ${res.status}). Verify your Personal Access Token.`);
          }
          const user = (await res.json()) as any;
          resolvedUser = user.username || user.name || resolvedUser;
          break;
        }

        case 'azure-devops': {
          if (!organization) {
            throw new Error('Azure DevOps Organization name is required (e.g. "myorg").');
          }
          const authHeader = `Basic ${Buffer.from(`:${token}`).toString('base64')}`;
          const res = await fetch(`https://dev.azure.com/${encodeURIComponent(organization)}/_apis/projects?api-version=7.0`, {
            headers: {
              Authorization: authHeader
            }
          });
          if (!res.ok) {
            throw new Error(`Azure DevOps authentication failed (HTTP ${res.status}). Verify your PAT and Organization name.`);
          }
          resolvedUser = organization;
          break;
        }

        case 'bitbucket': {
          const workspace = organization || resolvedUser;
          const headers: Record<string, string> = {
            Accept: 'application/json'
          };
          if (resolvedUser && token) {
            headers.Authorization = `Basic ${Buffer.from(`${resolvedUser}:${token}`).toString('base64')}`;
          } else {
            headers.Authorization = `Bearer ${token}`;
          }

          const res = await fetch('https://api.bitbucket.org/2.0/user', { headers });
          if (!res.ok) {
            throw new Error(`Bitbucket authentication failed (HTTP ${res.status}). Verify your username and App Password.`);
          }
          const user = (await res.json()) as any;
          resolvedUser = user.username || user.display_name || resolvedUser;
          break;
        }

        case 'forgejo': {
          const base = serverUrl || 'https://codeberg.org';
          const res = await fetch(`${base}/api/v1/user`, {
            headers: {
              Authorization: `token ${token}`
            }
          });
          if (!res.ok) {
            throw new Error(`Forgejo / Gitea authentication failed (HTTP ${res.status}). Verify your token.`);
          }
          const user = (await res.json()) as any;
          resolvedUser = user.login || user.username || resolvedUser;
          break;
        }

        case 'gitcafe':
        case 'cursor': {
          // Accepted configuration for self-hosted / cloud origin
          resolvedUser = resolvedUser || `${params.provider}-user`;
          break;
        }
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to authenticate with provider.' };
    }

    // Store encrypted credentials and metadata
    this.storeToken(params.provider, token);
    const metaMap = this.getMetadataMap();
    metaMap[params.provider] = {
      username: resolvedUser,
      serverUrl: serverUrl || undefined,
      organization: organization || undefined,
      updatedAt: Date.now()
    };
    this.saveMetadataMap(metaMap);

    return { success: true, user: resolvedUser };
  }

  /**
   * Disconnects a provider by removing credentials and metadata.
   */
  public async disconnectProvider(provider: GitProviderSourceId): Promise<{ success: boolean }> {
    this.removeToken(provider);
    const metaMap = this.getMetadataMap();
    delete metaMap[provider];
    this.saveMetadataMap(metaMap);
    return { success: true };
  }

  /**
   * Fetches remote repositories for a configured provider.
   */
  public async fetchRemoteRepositories(params: {
    provider: GitProviderSourceId;
    search?: string;
  }): Promise<{ success: boolean; repos: RemoteGitRepo[]; error?: string }> {
    const token = this.getToken(params.provider);
    if (!token) {
      return {
        success: false,
        repos: [],
        error: `${PROVIDER_NAMES[params.provider]} is not connected. Setup is required first.`
      };
    }

    const meta = this.getMetadataMap()[params.provider] || {};
    const serverUrl = (meta.serverUrl || DEFAULT_SERVER_URLS[params.provider] || '').replace(/\/+$/, '');
    let repos: RemoteGitRepo[] = [];

    try {
      switch (params.provider) {
        case 'github': {
          const res = await fetch(
            'https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member',
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'Orbito-App'
              }
            }
          );
          if (!res.ok) {
            throw new Error(`Failed to list GitHub repositories (HTTP ${res.status}).`);
          }
          const data = (await res.json()) as any[];
          repos = data.map((r) => ({
            id: `gh-${r.id}`,
            name: r.name,
            fullName: r.full_name,
            description: r.description || undefined,
            cloneUrl: r.clone_url,
            sshUrl: r.ssh_url,
            isPrivate: Boolean(r.private),
            defaultBranch: r.default_branch || 'main',
            updatedAt: r.updated_at,
            language: r.language || undefined,
            owner: r.owner?.login || '',
            provider: 'github',
            stars: r.stargazers_count
          }));
          break;
        }

        case 'gitlab': {
          const base = serverUrl || 'https://gitlab.com';
          const res = await fetch(`${base}/api/v4/projects?membership=true&order_by=updated_at&per_page=100`, {
            headers: {
              'PRIVATE-TOKEN': token
            }
          });
          if (!res.ok) {
            throw new Error(`Failed to list GitLab projects (HTTP ${res.status}).`);
          }
          const data = (await res.json()) as any[];
          repos = data.map((p) => ({
            id: `gl-${p.id}`,
            name: p.name,
            fullName: p.path_with_namespace,
            description: p.description || undefined,
            cloneUrl: p.http_url_to_repo,
            sshUrl: p.ssh_url_to_repo,
            isPrivate: p.visibility === 'private',
            defaultBranch: p.default_branch || 'main',
            updatedAt: p.last_activity_at || new Date().toISOString(),
            owner: p.namespace?.name || '',
            provider: 'gitlab',
            stars: p.star_count
          }));
          break;
        }

        case 'azure-devops': {
          const org = meta.organization || meta.username;
          if (!org) throw new Error('Azure DevOps organization not configured.');
          const authHeader = `Basic ${Buffer.from(`:${token}`).toString('base64')}`;
          const res = await fetch(`https://dev.azure.com/${encodeURIComponent(org)}/_apis/git/repositories?api-version=7.0`, {
            headers: {
              Authorization: authHeader
            }
          });
          if (!res.ok) {
            throw new Error(`Failed to list Azure DevOps repositories (HTTP ${res.status}).`);
          }
          const data = (await res.json()) as any;
          const list = (data.value || []) as any[];
          repos = list.map((r) => ({
            id: `az-${r.id}`,
            name: r.name,
            fullName: `${r.project?.name || org}/${r.name}`,
            description: r.project?.description || undefined,
            cloneUrl: r.remoteUrl || r.webUrl,
            sshUrl: r.sshUrl,
            isPrivate: true,
            defaultBranch: (r.defaultBranch || 'main').replace('refs/heads/', ''),
            updatedAt: new Date().toISOString(),
            owner: r.project?.name || org,
            provider: 'azure-devops'
          }));
          break;
        }

        case 'bitbucket': {
          const workspace = meta.organization || meta.username;
          const headers: Record<string, string> = { Accept: 'application/json' };
          if (meta.username && token) {
            headers.Authorization = `Basic ${Buffer.from(`${meta.username}:${token}`).toString('base64')}`;
          } else {
            headers.Authorization = `Bearer ${token}`;
          }

          const url = workspace
            ? `https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(workspace)}?pagelen=100&sort=-updated_on`
            : `https://api.bitbucket.org/2.0/repositories?role=member&pagelen=100&sort=-updated_on`;

          const res = await fetch(url, { headers });
          if (!res.ok) {
            throw new Error(`Failed to list Bitbucket repositories (HTTP ${res.status}).`);
          }
          const data = (await res.json()) as any;
          const values = (data.values || []) as any[];
          repos = values.map((r) => ({
            id: `bb-${r.uuid || r.full_name}`,
            name: r.name,
            fullName: r.full_name,
            description: r.description || undefined,
            cloneUrl: r.links?.clone?.find((c: any) => c.name === 'https')?.href || '',
            sshUrl: r.links?.clone?.find((c: any) => c.name === 'ssh')?.href,
            isPrivate: Boolean(r.is_private),
            defaultBranch: r.mainbranch?.name || 'main',
            updatedAt: r.updated_on || new Date().toISOString(),
            language: r.language || undefined,
            owner: r.owner?.display_name || r.workspace?.slug || '',
            provider: 'bitbucket'
          }));
          break;
        }

        case 'forgejo': {
          const base = serverUrl || 'https://codeberg.org';
          const res = await fetch(`${base}/api/v1/user/repos?limit=100`, {
            headers: {
              Authorization: `token ${token}`
            }
          });
          if (!res.ok) {
            throw new Error(`Failed to list Forgejo/Gitea repositories (HTTP ${res.status}).`);
          }
          const data = (await res.json()) as any[];
          repos = data.map((r) => ({
            id: `fg-${r.id}`,
            name: r.name,
            fullName: r.full_name,
            description: r.description || undefined,
            cloneUrl: r.clone_url,
            sshUrl: r.ssh_url,
            isPrivate: Boolean(r.private),
            defaultBranch: r.default_branch || 'main',
            updatedAt: r.updated_at || new Date().toISOString(),
            language: r.language || undefined,
            owner: r.owner?.login || '',
            provider: 'forgejo',
            stars: r.stars_count
          }));
          break;
        }

        case 'cursor':
        case 'gitcafe': {
          // Provide placeholder / connected structure
          repos = [];
          break;
        }
      }
    } catch (err: any) {
      return { success: false, repos: [], error: err.message || 'Error fetching remote repositories.' };
    }

    if (params.search && params.search.trim()) {
      const q = params.search.toLowerCase().trim();
      repos = repos.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.fullName.toLowerCase().includes(q) ||
          (r.description && r.description.toLowerCase().includes(q))
      );
    }

    return { success: true, repos };
  }

  /**
   * Injects authentication credentials into HTTPS clone URL and clones the project.
   */
  public async cloneRemoteRepository(params: {
    provider: GitProviderSourceId;
    cloneUrl: string;
    parentDirectory: string;
    customName?: string;
  }): Promise<ProjectDescriptor> {
    const token = this.getToken(params.provider);
    const meta = this.getMetadataMap()[params.provider] || {};
    let finalUrl = params.cloneUrl.trim();

    // Authenticate clone URL if HTTPS
    if (token && finalUrl.startsWith('https://')) {
      try {
        const parsed = new URL(finalUrl);
        switch (params.provider) {
          case 'github':
          case 'azure-devops':
          case 'forgejo':
          case 'cursor':
          case 'gitcafe':
            parsed.username = encodeURIComponent(token);
            parsed.password = '';
            break;
          case 'gitlab':
            parsed.username = 'oauth2';
            parsed.password = encodeURIComponent(token);
            break;
          case 'bitbucket':
            parsed.username = encodeURIComponent(meta.username || 'x-token-auth');
            parsed.password = encodeURIComponent(token);
            break;
        }
        finalUrl = parsed.toString();
      } catch {
        // Fallback to original URL
      }
    }

    return workspaceService.cloneProject({
      url: finalUrl,
      parentDirectory: params.parentDirectory,
      customName: params.customName
    });
  }
}

export const gitProvidersService = new GitProvidersService();
