import type { SpecialistRole, AgentCapability } from '../../shared/agents';
import type { CLIProvider } from '../../shared/cli';
import { SPECIALIST_ROLES } from './specialist-roles';
import { cliManager } from '../cli/cli-manager';
import { mcpRegistry } from '../mcp/mcp-registry';
import { mcpPermissionManager } from '../mcp/security/mcp-permission-manager';

export class AgentCapabilityRegistry {
  private activeTaskCounts: Map<string, number> = new Map();
  private cliStatusCache: Map<
    string,
    { isInstalled: boolean; version?: string; authStatus: 'authenticated' | 'configured' | 'missing' | 'unsupported'; timestamp: number }
  > = new Map();
  private readonly CLI_CACHE_TTL_MS = 15000;

  public trackTaskStart(agentId: string): void {
    const cur = this.activeTaskCounts.get(agentId) || 0;
    this.activeTaskCounts.set(agentId, cur + 1);
  }

  public trackTaskEnd(agentId: string): void {
    const cur = this.activeTaskCounts.get(agentId) || 0;
    this.activeTaskCounts.set(agentId, Math.max(0, cur - 1));
  }

  /**
   * Retrieves live capabilities of all agents in the Orbito ecosystem.
   */
  public async getAgentCapabilities(projectPath?: string): Promise<AgentCapability[]> {
    const capabilities: AgentCapability[] = [];
    const allServers = mcpRegistry.listServers();

    // 1. Specialist Internal Personas
    for (const [roleKey, specialist] of Object.entries(SPECIALIST_ROLES)) {
      const activeCount = this.activeTaskCounts.get(roleKey) || 0;

      // Filter MCP tools authorized for this specialist persona
      const authorizedServers: string[] = [];
      const discoveredTools: string[] = [];

      for (const server of allServers) {
        if (!server.enabled) continue;
        const perm = mcpPermissionManager.evaluateServerAccess(server, roleKey);
        if (perm.allowed) {
          authorizedServers.push(server.name);
          if (server.tools) {
            discoveredTools.push(...server.tools.map((t) => t.name));
          }
        }
      }

      capabilities.push({
        agentId: roleKey,
        name: specialist.title,
        role: roleKey as SpecialistRole,
        provider: 'claude', // Default underlying CLI
        isInstalled: true,
        version: '1.0.0',
        authStatus: 'authenticated',
        supportedModels: ['claude-3-7-sonnet', 'claude-3-5-sonnet', 'gpt-4o', 'antigravity-2.0'],
        maxTokens: 200000,
        boundSkills: specialist.boundSkillIds,
        authorizedMCPServers: authorizedServers,
        discoveredToolsCount: discoveredTools.length,
        discoveredTools,
        status: activeCount > 0 ? 'busy' : 'idle',
        activeTasksCount: activeCount
      });
    }

    // 2. Primary External CLI Coding Agents
    const externalProviders: Array<{ id: string; provider: CLIProvider; name: string }> = [
      { id: 'claude-code', provider: 'claude', name: 'Claude Code CLI' },
      { id: 'codex', provider: 'codex', name: 'OpenAI Codex CLI' },
      { id: 'antigravity', provider: 'antigravity', name: 'Google Antigravity CLI' },
      { id: 'opencode', provider: 'opencode', name: 'OpenCode Interpreter' },
      { id: 'ollama', provider: 'ollama', name: 'Ollama Local Daemon' },
      { id: 'gemini', provider: 'gemini', name: 'Google Gemini CLI' }
    ];

    for (const ext of externalProviders) {
      let isInstalled = false;
      let version: string | undefined;
      let authStatus: 'authenticated' | 'configured' | 'missing' | 'unsupported' = 'missing';

      const cached = this.cliStatusCache.get(ext.provider);
      if (cached && Date.now() - cached.timestamp < this.CLI_CACHE_TTL_MS) {
        isInstalled = cached.isInstalled;
        version = cached.version;
        authStatus = cached.authStatus;
      } else {
        try {
          const adapter = cliManager.getAdapter(ext.provider);
          if (adapter) {
            const det = await adapter.detect();
            isInstalled = det.isInstalled;
            version = det.version;
            const auth = await cliManager.checkAuth(ext.provider);
            if (auth.isAuthenticated) {
              authStatus = 'authenticated';
            } else if (auth.state === 'configured') {
              authStatus = 'configured';
            }
          }
          this.cliStatusCache.set(ext.provider, {
            isInstalled,
            version,
            authStatus,
            timestamp: Date.now()
          });
        } catch {
          // CLI detection error fallback
        }
      }

      // Check MCP tools authorized for this external agent
      const authorizedServers: string[] = [];
      const discoveredTools: string[] = [];

      for (const server of allServers) {
        if (!server.enabled) continue;
        const perm = mcpPermissionManager.evaluateServerAccess(server, ext.id);
        if (perm.allowed) {
          authorizedServers.push(server.name);
          if (server.tools) {
            discoveredTools.push(...server.tools.map((t) => t.name));
          }
        }
      }

      const activeCount = this.activeTaskCounts.get(ext.id) || 0;

      capabilities.push({
        agentId: ext.id,
        name: ext.name,
        role: 'general',
        provider: ext.provider,
        isInstalled,
        version,
        authStatus,
        supportedModels: ext.provider === 'claude' ? ['claude-3-7-sonnet'] : ext.provider === 'codex' ? ['gpt-4o', 'o3-mini'] : ['default'],
        maxTokens: 128000,
        boundSkills: [],
        authorizedMCPServers: authorizedServers,
        discoveredToolsCount: discoveredTools.length,
        discoveredTools,
        status: !isInstalled ? 'offline' : activeCount > 0 ? 'busy' : 'idle',
        activeTasksCount: activeCount
      });
    }

    return capabilities;
  }

  /**
   * Intelligently selects the best capable agent for a task given role, required tools, and workload.
   */
  public async findBestAgentForTask(
    role: SpecialistRole,
    requiredTools: string[] = [],
    preferredProvider?: CLIProvider
  ): Promise<{ agentId: string; provider: CLIProvider; reason: string }> {
    const allCaps = await this.getAgentCapabilities();

    // 1. Look for internal specialist role first
    const specialistCap = allCaps.find((c) => c.role === role);
    if (specialistCap) {
      // Check if task needs tools that specialist lacks
      const missingTools = requiredTools.filter((t) => !specialistCap.discoveredTools.includes(t));
      if (missingTools.length === 0) {
        return {
          agentId: specialistCap.agentId,
          provider: preferredProvider || specialistCap.provider,
          reason: `Specialist "${specialistCap.name}" matches role and possesses all required tools.`
        };
      }
    }

    // 2. Fall back to installed external provider with matching tools and lowest workload
    const matchingAgents = allCaps.filter((c) => {
      if (!c.isInstalled && c.role === 'general') return false;
      return requiredTools.every((t) => c.discoveredTools.includes(t));
    });

    if (matchingAgents.length > 0) {
      // Sort by fewest active tasks
      matchingAgents.sort((a, b) => a.activeTasksCount - b.activeTasksCount);
      const chosen = matchingAgents[0];
      return {
        agentId: chosen.agentId,
        provider: chosen.provider,
        reason: `Selected capable agent "${chosen.name}" with lowest active workload (${chosen.activeTasksCount} tasks).`
      };
    }

    // Default fallback
    return {
      agentId: role,
      provider: preferredProvider || 'claude',
      reason: `Default specialist role "${role}" assigned.`
    };
  }
}

export const agentCapabilityRegistry = new AgentCapabilityRegistry();
