import { BaseCLIAdapter } from '../base.adapter';

export class ClineAdapter extends BaseCLIAdapter {
  constructor() {
    super({
  "provider": "cline",
  "name": "Cline",
  "vendor": "Cline Bot",
  "tagline": "Autonomous coding agent with file system and CLI tools",
  "description": "Autonomous coding agent capable of executing terminal commands, editing complex multi-file codebases, and browsing documentation.",
  "executableNames": [
    "cline"
  ],
  "supportedPlatforms": [
    "win32",
    "darwin",
    "linux"
  ],
  "installCommand": "npm install -g cline",
  "installGuideUrl": "https://docs.cline.bot",
  "authCommand": "cline configure",
  "authType": "api-key",
  "envAuthKeys": [
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "OPENROUTER_API_KEY"
  ],
  "configAuthPaths": [
    ".cline/settings.json"
  ],
  "capabilities": {
    "supportsStreaming": true,
    "supportsResume": true,
    "supportsHeadlessPrompt": true,
    "supportsJsonOutput": true
  },
  "defaultArgs": [
    "-y"
  ],
  formatPromptArgs: (prompt) => ['--prompt', prompt]
});
  }
}

export const clineAdapter = new ClineAdapter();
