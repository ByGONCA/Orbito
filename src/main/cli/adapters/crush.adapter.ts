import { BaseCLIAdapter } from '../base.adapter';

export class CrushAdapter extends BaseCLIAdapter {
  constructor() {
    super({
  "provider": "crush",
  "name": "Crush",
  "vendor": "Charmbracelet",
  "tagline": "Glamorous terminal-native AI coding agent",
  "description": "Terminal AI coding assistant by Charmbracelet featuring mid-session model switching, LSP analysis, and MCP integration.",
  "executableNames": [
    "crush"
  ],
  "supportedPlatforms": [
    "win32",
    "darwin",
    "linux"
  ],
  "installCommand": "go install github.com/charmbracelet/crush@latest",
  "installGuideUrl": "https://github.com/charmbracelet/crush",
  "authCommand": "export OPENAI_API_KEY=... / ANTHROPIC_API_KEY=...",
  "authType": "api-key",
  "envAuthKeys": [
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "CRUSH_API_KEY"
  ],
  "configAuthPaths": [
    ".config/crush/config.yaml"
  ],
  "capabilities": {
    "supportsStreaming": true,
    "supportsResume": true,
    "supportsHeadlessPrompt": true,
    "supportsJsonOutput": false
  },
  "defaultArgs": [],
  formatPromptArgs: (prompt) => ['--prompt', prompt]
});
  }
}

export const crushAdapter = new CrushAdapter();
