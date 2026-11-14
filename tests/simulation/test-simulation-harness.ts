/**
 * Pre-Production Automated Simulation & Failure Injection Harness
 * Reusable test utilities providing simulated providers, CLI processes, MCP servers,
 * and structured validation status tagging (VERIFIED, SIMULATED, BLOCKED, FAILED, NOT TESTED).
 */

export type ValidationStatus = 'VERIFIED' | 'SIMULATED' | 'BLOCKED' | 'FAILED' | 'NOT TESTED';

export interface ValidationRecord {
  testName: string;
  category: string;
  status: ValidationStatus;
  details: string;
  durationMs: number;
  metadata?: Record<string, any>;
}

export class ValidationRegistry {
  private static records: ValidationRecord[] = [];

  public static record(entry: ValidationRecord): void {
    this.records.push(entry);
  }

  public static getRecords(): ValidationRecord[] {
    return [...this.records];
  }

  public static getSummary(): Record<ValidationStatus, number> {
    const summary: Record<ValidationStatus, number> = {
      VERIFIED: 0,
      SIMULATED: 0,
      BLOCKED: 0,
      FAILED: 0,
      'NOT TESTED': 0
    };
    for (const r of this.records) {
      summary[r.status] = (summary[r.status] || 0) + 1;
    }
    return summary;
  }

  public static clear(): void {
    this.records = [];
  }
}

export interface MockAIProviderOptions {
  name: string;
  latencyMs?: number;
  tokensPerSecond?: number;
  failureMode?: 'none' | 'auth_failure' | 'rate_limit' | 'model_unavailable' | 'network_timeout' | 'crash';
  responsePayload?: string;
}

export class MockAIProvider {
  public name: string;
  public latencyMs: number;
  public tokensPerSecond: number;
  public failureMode: MockAIProviderOptions['failureMode'];
  public responsePayload: string;
  public callCount = 0;

  constructor(options: MockAIProviderOptions) {
    this.name = options.name;
    this.latencyMs = options.latencyMs ?? 10;
    this.tokensPerSecond = options.tokensPerSecond ?? 100;
    this.failureMode = options.failureMode ?? 'none';
    this.responsePayload = options.responsePayload ?? 'Mock generation output successfully produced.';
  }

  public setFailureMode(mode: MockAIProviderOptions['failureMode']): void {
    this.failureMode = mode;
  }

  public async generate(prompt: string, onChunk?: (chunk: string) => void): Promise<{
    text: string;
    tokensIn: number;
    tokensOut: number;
    durationMs: number;
  }> {
    this.callCount++;
    const start = Date.now();

    if (this.latencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.latencyMs));
    }

    if (this.failureMode === 'auth_failure') {
      throw new Error(`[MockAIProvider:${this.name}] 401 Unauthorized: Invalid API key or expired credentials.`);
    }
    if (this.failureMode === 'rate_limit') {
      throw new Error(`[MockAIProvider:${this.name}] 429 Too Many Requests: Rate limit exceeded. Retry-After: 30s.`);
    }
    if (this.failureMode === 'model_unavailable') {
      throw new Error(`[MockAIProvider:${this.name}] 503 Service Unavailable: High load or model undergoing maintenance.`);
    }
    if (this.failureMode === 'network_timeout') {
      throw new Error(`[MockAIProvider:${this.name}] ETIMEDOUT: Connection timed out to provider endpoint.`);
    }
    if (this.failureMode === 'crash') {
      throw new Error(`[MockAIProvider:${this.name}] Process terminated unexpectedly with SIGSEGV (signal 11).`);
    }

    const chunks = this.responsePayload.split(' ');
    for (const word of chunks) {
      if (onChunk) {
        onChunk(word + ' ');
      }
    }

    const durationMs = Date.now() - start;
    const tokensIn = Math.ceil(prompt.length / 4);
    const tokensOut = Math.ceil(this.responsePayload.length / 4);

    return {
      text: this.responsePayload,
      tokensIn,
      tokensOut,
      durationMs
    };
  }
}

export interface MockMCPServerOptions {
  name: string;
  tools?: Array<{ name: string; description: string; inputSchema: Record<string, any> }>;
  failureMode?: 'none' | 'crash_on_tool_call' | 'timeout' | 'disconnect_randomly';
}

export class MockMCPServer {
  public name: string;
  public tools: Array<{ name: string; description: string; inputSchema: Record<string, any> }>;
  public failureMode: MockMCPServerOptions['failureMode'];
  public isConnected = true;
  public callsReceived: Array<{ toolName: string; params: any }> = [];

  constructor(options: MockMCPServerOptions) {
    this.name = options.name;
    this.tools = options.tools || [
      {
        name: 'echo',
        description: 'Echo back input parameters',
        inputSchema: { type: 'object', properties: { message: { type: 'string' } } }
      },
      {
        name: 'calculate',
        description: 'Perform arithmetic',
        inputSchema: { type: 'object', properties: { expr: { type: 'string' } } }
      }
    ];
    this.failureMode = options.failureMode || 'none';
  }

  public async callTool(toolName: string, params: any): Promise<any> {
    this.callsReceived.push({ toolName, params });

    if (!this.isConnected) {
      throw new Error(`[MockMCPServer:${this.name}] Cannot call tool: server is disconnected.`);
    }

    if (this.failureMode === 'crash_on_tool_call') {
      this.isConnected = false;
      throw new Error(`[MockMCPServer:${this.name}] Process crashed unexpectedly with exitCode 1.`);
    }

    if (this.failureMode === 'timeout') {
      throw new Error(`[MockMCPServer:${this.name}] Tool invocation timed out after 10000ms.`);
    }

    if (toolName === 'echo') {
      return { echoed: params?.message || 'hello' };
    }
    if (toolName === 'calculate') {
      return { result: 42 };
    }

    return { success: true, tool: toolName, params };
  }

  public disconnect(): void {
    this.isConnected = false;
  }

  public reconnect(): void {
    this.isConnected = true;
  }
}

export class WorktreeFailureInjector {
  public static simulateMergeConflict(baseContent: string, branchA: string, branchB: string): string {
    return [
      '<<<<<<< HEAD',
      branchA,
      '=======',
      branchB,
      '>>>>>>> incoming-task-branch'
    ].join('\n');
  }

  public static isConflictMarkerPresent(diff: string): boolean {
    return diff.includes('<<<<<<<') && diff.includes('=======') && diff.includes('>>>>>>>');
  }
}
