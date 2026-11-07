import { BaseCLIAdapter } from '../base.adapter';

export class OpenCodeAdapter extends BaseCLIAdapter {
  constructor() {
    super({
  "provider": "opencode",
  "name": "OpenCode",
  "vendor": "OpenCode AI",
  "tagline": "Open-weights code orchestration CLI",
  "description": "Terminal-based coding agent connecting to local or cloud open weights models for code refactoring and creation.",
  "executableNames": [
    "opencode",
    "opencode-cli"
  ],
  "supportedPlatforms": [
    "win32",
    "darwin",
    "linux"
  ],
  "installCommand": "npm install -g opencode-cli",
  "installGuideUrl": "https://opencode.ai/docs",
  "authCommand": "opencode configure",
  "authType": "api-key",
  "envAuthKeys": [
    "OPENCODE_API_KEY",
    "OPENAI_API_KEY"
  ],
  "configAuthPaths": [
    ".opencode/config.json"
  ],
  "capabilities": {
    "supportsStreaming": true,
    "supportsResume": false,
    "supportsHeadlessPrompt": true,
    "supportsJsonOutput": false
  },
  "defaultArgs": [],
  formatPromptArgs: (prompt) => ['run', prompt]
});
  }
}

export const opencodeAdapter = new OpenCodeAdapter();
