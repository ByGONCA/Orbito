import { z } from 'zod';

export type CLIProvider =
  | 'powershell'
  | 'cmd'
  | 'bash'
  | 'antigravity'
  | 'claude'
  | 'codex'
  | 'gemini'
  | 'ollama'
  | 'aider'
  | 'amp'
  | 'ante'
  | 'auggie'
  | 'cline'
  | 'codebuddy'
  | 'codebuff'
  | 'continue'
  | 'crush'
  | 'cursor'
  | 'devin'
  | 'droid'
  | 'copilot'
  | 'goose'
  | 'hermes'
  | 'kilocode'
  | 'kimi'
  | 'kiro'
  | 'vibe'
  | 'opencode'
  | 'openhands'
  | 'pi'
  | 'qwen'
  | 'roocode'
  | 'rovo'
  | 'trae'
  | 'zed';

export type AuthType = 'oauth' | 'api-key' | 'adc' | 'token' | 'missing' | 'none';

export type CLIAuthDetailedState =
  | 'not_installed'
  | 'installed'
  | 'configured'
  | 'authenticated'
  | 'authentication_required'
  | 'authentication_expired'
  | 'unsupported_platform'
  | 'error';

export type CLISessionStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface CLIInstallationStatus {
  provider: CLIProvider;
  isInstalled: boolean;
  resolvedPath?: string;
  version?: string;
  isCompatible: boolean;
  requiresUpdate: boolean;
  installGuideUrl: string;
}

export interface CLIAuthStatus {
  provider: CLIProvider;
  state: CLIAuthDetailedState;
  isAuthenticated: boolean;
  authType: AuthType;
  details?: string;
}

export interface CLICapabilities {
  supportsStreaming: boolean;
  supportsResume: boolean;
  supportsContinue?: boolean;
  supportsListSessions?: boolean;
  supportsHeadlessPrompt: boolean;
  supportsJsonOutput: boolean;
}

export interface AgentMetadata {
  id: CLIProvider;
  name: string;
  tagline: string;
  vendor: string;
  officialWebsite: string;
  documentationUrl: string;
  installCommand?: string;
  installGuideUrl: string;
  authCommand?: string;
  authType: AuthType;
  requiresAuth: boolean;
  executableName: string;
  supportedPlatforms: ('win33' | 'win32' | 'darwin' | 'linux')[];
  minVersion?: string;
  integrationAvailability: 'standalone_cli' | 'sdk' | 'extension' | 'hosted_service' | 'desktop_app';
  capabilities: CLICapabilities;
  description: string;
  defaultArgs?: string[];
}

export interface AgentCustomConfig {
  provider: CLIProvider;
  customPath?: string;
  customArgs?: string[];
  envVars?: Record<string, string>;
  enabled?: boolean;
  defaultModel?: string;
}

export interface CLISessionRecord {
  id: string;
  provider: CLIProvider;
  providerSessionId?: string;
  projectId?: string;
  status: CLISessionStatus;
  createdAt: number;
  updatedAt: number;
  prompt: string;
  exitCode?: number;
  durationMs?: number;
}

export interface CLISessionMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'error';
  content: string;
  timestamp: number;
}

export interface CLIStreamEvent {
  sessionId: string;
  type: 'stdout' | 'stderr' | 'status' | 'exit';
  content: string;
  timestamp: number;
  exitCode?: number;
}

// ==========================================
// Zod Schemas for Runtime IPC Validation
// ==========================================

export const DetectCLIsSchema = z.object({
  customPaths: z.record(z.string()).optional()
});

export const CLIProviderEnum = z.enum([
  'powershell',
  'cmd',
  'bash',
  'antigravity',
  'claude',
  'codex',
  'gemini',
  'ollama',
  'aider',
  'amp',
  'ante',
  'auggie',
  'cline',
  'codebuddy',
  'codebuff',
  'continue',
  'crush',
  'cursor',
  'devin',
  'droid',
  'copilot',
  'goose',
  'hermes',
  'kilocode',
  'kimi',
  'kiro',
  'vibe',
  'opencode',
  'openhands',
  'pi',
  'qwen',
  'roocode',
  'rovo',
  'trae',
  'zed'
]);

export const CheckCLIAuthSchema = z.object({
  provider: CLIProviderEnum,
  customPath: z.string().optional()
});

export const ExecuteCLIPromptSchema = z.object({
  provider: CLIProviderEnum,
  prompt: z.string().min(1),
  projectId: z.string().optional(),
  workingDirectory: z.string().min(1),
  customPath: z.string().optional(),
  timeoutSeconds: z.number().int().min(5).max(3600).default(300),
  resumeSessionId: z.string().optional()
});

export const CancelCLISessionSchema = z.object({
  sessionId: z.string().min(1)
});

export const ListCLISessionsSchema = z.object({
  projectId: z.string().optional(),
  provider: CLIProviderEnum.optional()
});

export const GetSessionMessagesSchema = z.object({
  sessionId: z.string().min(1)
});

export const InstallCLISchema = z.object({
  provider: CLIProviderEnum
});

export const SaveAgentConfigSchema = z.object({
  provider: CLIProviderEnum,
  customPath: z.string().optional(),
  customArgs: z.array(z.string()).optional(),
  envVars: z.record(z.string()).optional(),
  enabled: z.boolean().default(true),
  defaultModel: z.string().optional()
});
