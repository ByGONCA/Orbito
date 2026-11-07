import { BaseCLIAdapter } from '../base.adapter';

export class GooseAdapter extends BaseCLIAdapter {
  constructor() {
    super({
  "provider": "goose",
  "name": "Goose",
  "vendor": "Block",
  "tagline": "Open-source autonomous on-machine coding agent",
  "description": "Extensible open-source agent that writes code, runs terminal commands, and edits local projects.",
  "executableNames": [
    "goose"
  ],
  "supportedPlatforms": [
    "win32",
    "darwin",
    "linux"
  ],
  "installCommand": "curl -fsSL https://github.com/block/goose/releases/latest/download/goose.sh | bash",
  "installGuideUrl": "https://block.github.io/goose/docs",
  "authCommand": "goose configure",
  "authType": "api-key",
  "envAuthKeys": [
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "DATABRICKS_HOST"
  ],
  "configAuthPaths": [
    ".config/goose/config.yaml"
  ],
  "capabilities": {
    "supportsStreaming": true,
    "supportsResume": true,
    "supportsHeadlessPrompt": true,
    "supportsJsonOutput": true
  },
  "defaultArgs": [
    "run"
  ],
  formatPromptArgs: (prompt) => ['--text', prompt]
});
  }
}

export const gooseAdapter = new GooseAdapter();
