import { BrowserWindow } from 'electron';
import { Client } from '@xhayper/discord-rpc';
import type { ProjectDescriptor } from '../../../shared/types';
import { databaseService } from '../../db/database.service';
import { detectProjectGitRemote, type NormalizedGitRemote } from '../git-remote-resolver';
import { appLogger } from '../app-logger';

export const DEFAULT_DISCORD_CLIENT_ID = '1568419446719127684';
export const OFFICIAL_ORBITO_URL = 'https://github.com/ByGONCA/Orbito';
export const OFFICIAL_ORBITO_ICON_URL = 'https://cdn.discordapp.com/app-icons/1568419446719127684/d3fcb37422664c5e4e15a8448d5091a8.png?size=512';

export type DiscordConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface DiscordActivitySnapshot {
  details: string;
  state: string;
  buttons?: Array<{ label: string; url: string }>;
  startTimestamp?: number;
  largeImageKey?: string;
  largeImageText?: string;
  smallImageKey?: string;
  smallImageText?: string;
}

export interface DiscordStatusResponse {
  enabled: boolean;
  connected: boolean;
  status: DiscordConnectionState;
  currentPresence: DiscordActivitySnapshot | null;
  error: string | null;
  clientId: string;
  isProjectOptedIn: boolean;
  activeProjectName: string | null;
}

export class DiscordRpcService {
  private client: Client | null = null;
  private status: DiscordConnectionState = 'disconnected';
  private errorDetails: string | null = null;
  private isGloballyEnabled = false;
  private configuredClientId: string = DEFAULT_DISCORD_CLIENT_ID;

  private activeProject: ProjectDescriptor | null = null;
  private activeGitRemote: NormalizedGitRemote | null = null;
  private activeAgentsCount = 0;
  private currentPresence: DiscordActivitySnapshot | null = null;
  private sessionStartedAt = Date.now();

  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectDelay = 10000; // 10s initial backoff
  private maxReconnectDelay = 60000; // 60s max backoff
  private updateDebounceTimer: NodeJS.Timeout | null = null;
  private isDestroyed = false;

  /**
   * Initializes Discord RPC from persisted database workspace configuration.
   */
  public async initialize(): Promise<void> {
    try {
      const settings = databaseService.getSettings();
      this.isGloballyEnabled = Boolean(settings.discordRpcEnabled);
      const dbClientId = (settings.discordClientId || '').trim();
      // Auto-migrate from legacy VS Code placeholder ID
      if (dbClientId === '383226320970055681') {
        this.configuredClientId = DEFAULT_DISCORD_CLIENT_ID;
        databaseService.updateSettings({ discordClientId: undefined });
      } else {
        this.configuredClientId = dbClientId || DEFAULT_DISCORD_CLIENT_ID;
      }

      // Restore active project if available
      if (settings.currentProjectId) {
        const project = databaseService.getProject(settings.currentProjectId);
        if (project) {
          this.activeProject = project;
          if (project.isGitRepo) {
            this.activeGitRemote = await detectProjectGitRemote(project.path);
          }
        }
      }

      if (this.isGloballyEnabled) {
        appLogger.info('DiscordRPC', 'Global Discord RPC enabled, connecting...');
        this.connect();
      } else {
        this.status = 'disconnected';
        this.errorDetails = null;
        this.broadcastStatus();
      }
    } catch (err: any) {
      appLogger.error('DiscordRPC', `Failed to initialize Discord RPC: ${err?.message || err}`);
      this.status = 'error';
      this.errorDetails = err?.message || 'Initialization error';
    }
  }

  /**
   * Toggles global Discord integration enable/disable.
   */
  public async setEnabled(enabled: boolean): Promise<DiscordStatusResponse> {
    this.isGloballyEnabled = enabled;
    databaseService.updateSettings({ discordRpcEnabled: enabled });

    if (!enabled) {
      this.clearReconnectTimer();
      await this.disconnect();
      this.status = 'disconnected';
      this.errorDetails = null;
      this.currentPresence = null;
      this.broadcastStatus();
    } else {
      this.reconnectDelay = 10000;
      this.connect();
    }

    return this.getStatus();
  }

  /**
   * Sets custom Application Client ID.
   */
  public async setClientId(clientId?: string): Promise<DiscordStatusResponse> {
    const cleanId = (clientId || '').trim();
    this.configuredClientId = cleanId || DEFAULT_DISCORD_CLIENT_ID;
    databaseService.updateSettings({ discordClientId: cleanId });

    if (this.isGloballyEnabled) {
      // Reconnect with new Client ID
      await this.disconnect();
      this.connect();
    }

    return this.getStatus();
  }

  /**
   * Updates currently active project descriptor and resolves Git remotes.
   */
  public async setActiveProject(project: ProjectDescriptor | null): Promise<void> {
    this.activeProject = project;
    this.activeGitRemote = null;

    if (project && project.isGitRepo) {
      try {
        this.activeGitRemote = await detectProjectGitRemote(project.path);
      } catch {
        this.activeGitRemote = null;
      }
    }

    this.schedulePresenceUpdate();
  }

  /**
   * Updates active multi-agent orchestrator / execution count.
   */
  public setAgentCount(count: number): void {
    const safeCount = Math.max(0, count);
    if (this.activeAgentsCount !== safeCount) {
      this.activeAgentsCount = safeCount;
      this.schedulePresenceUpdate();
    }
  }

  /**
   * Returns current status snapshot for UI and IPC queries.
   */
  public getStatus(): DiscordStatusResponse {
    const isProjectOptedIn = Boolean(this.activeProject && this.activeProject.settings?.discordRpcEnabled !== false);

    return {
      enabled: this.isGloballyEnabled,
      connected: this.status === 'connected',
      status: this.status,
      currentPresence: this.currentPresence,
      error: this.errorDetails,
      clientId: this.configuredClientId,
      isProjectOptedIn,
      activeProjectName: this.activeProject ? (this.activeProject.customName || this.activeProject.name) : null
    };
  }

  /**
   * Builds the desired Rich Presence activity payload according to privacy and project settings.
   */
  public computePresencePayload(): DiscordActivitySnapshot | null {
    if (!this.isGloballyEnabled) {
      return null;
    }

    const orbitoButton = { label: 'Get Orbito', url: OFFICIAL_ORBITO_URL };
    const isProjectOptedIn = Boolean(this.activeProject && this.activeProject.settings?.discordRpcEnabled !== false);
    const largeImage = this.configuredClientId === DEFAULT_DISCORD_CLIENT_ID
      ? OFFICIAL_ORBITO_ICON_URL
      : 'orbito';

    // Case 1: Active agents running
    if (this.activeAgentsCount > 0) {
      const count = this.activeAgentsCount;
      const buttons: Array<{ label: string; url: string }> = [];

      // If project opted in and has remote, include repo button first
      if (isProjectOptedIn && this.activeGitRemote?.browserUrl) {
        buttons.push({
          label: this.activeGitRemote.providerLabel,
          url: this.activeGitRemote.browserUrl
        });
      }
      buttons.push(orbitoButton);

      return {
        details: this.activeProject ? `Agents in ${this.activeProject.customName || this.activeProject.name}` : 'Agents working in Orbito',
        state: `${count} ${count === 1 ? 'agent' : 'agents'} active`,
        buttons: buttons.slice(0, 2),
        startTimestamp: this.sessionStartedAt,
        largeImageKey: largeImage,
        largeImageText: 'Orbito - AI Workspace',
        smallImageKey: this.configuredClientId === DEFAULT_DISCORD_CLIENT_ID ? undefined : 'bot',
        smallImageText: 'AI Agent Running'
      };
    }

    // Case 2: Project is active (opted in by default unless explicitly disabled)
    if (isProjectOptedIn && this.activeProject) {
      const projectName = this.activeProject.customName || this.activeProject.name;
      const buttons: Array<{ label: string; url: string }> = [];

      if (this.activeGitRemote?.browserUrl) {
        buttons.push({
          label: this.activeGitRemote.providerLabel,
          url: this.activeGitRemote.browserUrl
        });
        buttons.push(orbitoButton);

        return {
          details: `Working in ${projectName}`,
          state: `Project: ${projectName}`,
          buttons: buttons.slice(0, 2),
          startTimestamp: this.sessionStartedAt,
          largeImageKey: largeImage,
          largeImageText: 'Orbito - AI Workspace'
        };
      } else {
        buttons.push(orbitoButton);

        return {
          details: `Working in ${projectName}`,
          state: 'Local project',
          buttons: buttons.slice(0, 2),
          startTimestamp: this.sessionStartedAt,
          largeImageKey: largeImage,
          largeImageText: 'Orbito - AI Workspace'
        };
      }
    }

    // Case 3: Idle / Workspace ready / Project not opted in / No project open
    return {
      details: 'Using Orbito',
      state: 'Workspace ready',
      buttons: [orbitoButton],
      startTimestamp: this.sessionStartedAt,
      largeImageKey: largeImage,
      largeImageText: 'Orbito - AI Workspace'
    };
  }

  /**
   * Connects to Discord Desktop IPC named pipe with error recovery.
   */
  private connect(): void {
    if (!this.isGloballyEnabled || this.isDestroyed) return;

    this.clearReconnectTimer();
    this.status = 'connecting';
    this.errorDetails = null;
    this.broadcastStatus();

    try {
      const clientId = this.configuredClientId || DEFAULT_DISCORD_CLIENT_ID;
      const client = new Client({ clientId });

      client.on('ready', () => {
        if (this.client !== client) return;
        this.status = 'connected';
        this.errorDetails = null;
        this.reconnectDelay = 10000; // Reset backoff on successful connect
        appLogger.info('DiscordRPC', `Connected to Discord as ${client.user?.username || 'user'}`);
        this.publishPresence();
        this.broadcastStatus();
      });

      client.on('disconnected', () => {
        if (this.client !== client) return;
        appLogger.warn('DiscordRPC', 'Discord connection lost / disconnected.');
        this.status = 'disconnected';
        this.broadcastStatus();
        this.scheduleReconnect();
      });

      this.client = client;

      client.login().catch((err: any) => {
        if (this.client !== client) return;
        this.handleConnectFailure(err);
      });
    } catch (err: any) {
      this.handleConnectFailure(err);
    }
  }

  /**
   * Handles connection failure and triggers backoff schedule.
   */
  private handleConnectFailure(err: any): void {
    const rawMsg = err?.message || String(err);
    let friendlyMessage = 'Discord Desktop is not running or RPC is unavailable.';

    if (rawMsg.includes('Invalid Client ID')) {
      friendlyMessage = `Invalid Discord Application Client ID: "${this.configuredClientId}". Check Developer Portal.`;
    }

    this.status = 'error';
    this.errorDetails = friendlyMessage;
    appLogger.warn('DiscordRPC', `Connection attempt failed: ${friendlyMessage} (${rawMsg})`);

    this.broadcastStatus();
    this.scheduleReconnect();
  }

  /**
   * Schedules a reconnect attempt using exponential backoff.
   */
  private scheduleReconnect(): void {
    if (!this.isGloballyEnabled || this.isDestroyed || this.reconnectTimer) return;

    appLogger.info('DiscordRPC', `Scheduling reconnect in ${this.reconnectDelay / 1000}s`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.isGloballyEnabled && !this.isDestroyed) {
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
        this.connect();
      }
    }, this.reconnectDelay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Debounces presence updates to respect Discord RPC rate limits (max 1/15s burstable).
   */
  private schedulePresenceUpdate(): void {
    if (!this.isGloballyEnabled) return;

    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer);
    }

    this.updateDebounceTimer = setTimeout(() => {
      this.updateDebounceTimer = null;
      this.publishPresence();
    }, 1200);
  }

  /**
   * Publishes the computed activity to Discord Desktop.
   */
  private async publishPresence(): Promise<void> {
    if (!this.isGloballyEnabled || this.status !== 'connected' || !this.client?.user) {
      return;
    }

    const payload = this.computePresencePayload();
    if (!payload) return;

    try {
      const activityData: any = {
        details: payload.details,
        state: payload.state,
        startTimestamp: payload.startTimestamp,
        largeImageKey: payload.largeImageKey || 'orbito',
        largeImageText: payload.largeImageText || 'Orbito - AI Workspace'
      };

      if (payload.smallImageKey) {
        activityData.smallImageKey = payload.smallImageKey;
        activityData.smallImageText = payload.smallImageText;
      }

      if (payload.buttons && payload.buttons.length > 0) {
        activityData.buttons = payload.buttons.slice(0, 2);
      }

      await this.client.user.setActivity(activityData);
      this.currentPresence = payload;
      this.broadcastStatus();
    } catch (err: any) {
      appLogger.warn('DiscordRPC', `Failed to setActivity: ${err?.message || err}`);
    }
  }

  /**
   * Gracefully clears Discord activity and disconnects client.
   */
  public async disconnect(): Promise<void> {
    const current = this.client;
    this.client = null;

    if (current) {
      try {
        if (current.user) {
          await current.user.clearActivity().catch(() => {});
        }
        await current.destroy().catch(() => {});
      } catch {}
    }
  }

  /**
   * Broadcasts status event to all renderer windows.
   */
  public broadcastStatus(): void {
    try {
      const windows = BrowserWindow.getAllWindows();
      const status = this.getStatus();
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send('discord:status-changed', status);
        }
      }
    } catch {}
  }

  /**
   * Application shutdown hook.
   */
  public async shutdown(): Promise<void> {
    this.isDestroyed = true;
    this.clearReconnectTimer();
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer);
      this.updateDebounceTimer = null;
    }
    await this.disconnect();
  }
}

export const discordRpcService = new DiscordRpcService();
