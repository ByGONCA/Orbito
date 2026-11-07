import { BaseCLIAdapter } from '../base.adapter';

export class RooCodeAdapter extends BaseCLIAdapter {
  constructor() {
    super({
  "provider": "roocode",
  "name": "Roo Code",
  "vendor": "Roo Code Team",
  "tagline": "Customizable role-based autonomous coding agent",
  "description": "Fork of Cline featuring custom agent modes, rules integration, and multi-provider token optimization.",
  "executableNames": [
    "roocode",
    "roo-code",
    "roo-cline"
  ],
  "supportedPlatforms": [
    "win32",
    "darwin",
    "linux"
  ],
  "installCommand": "npm install -g roo-code-cli",
  "installGuideUrl": "https://docs.roocode.com",
  "authCommand": "roocode configure",
  "authType": "api-key",
  "envAuthKeys": [
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "OPENROUTER_API_KEY"
  ],
  "configAuthPaths": [
    ".roocode/settings.json"
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

export const roocodeAdapter = new RooCodeAdapter();
