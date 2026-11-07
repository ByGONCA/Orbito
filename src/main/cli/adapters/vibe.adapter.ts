import { BaseCLIAdapter } from '../base.adapter';

export class VibeAdapter extends BaseCLIAdapter {
  constructor() {
    super({
  "provider": "vibe",
  "name": "Mistral Vibe",
  "vendor": "Mistral AI",
  "tagline": "High-speed code reasoning powered by Mistral Codestral",
  "description": "Mistral AI developer CLI integrating Codestral for fill-in-the-middle, instruction following, and fast code completion.",
  "executableNames": [
    "vibe",
    "mistral-vibe",
    "codestral"
  ],
  "supportedPlatforms": [
    "win32",
    "darwin",
    "linux"
  ],
  "installCommand": "pip install mistral-vibe",
  "installGuideUrl": "https://docs.mistral.ai",
  "authCommand": "export MISTRAL_API_KEY=...",
  "authType": "api-key",
  "envAuthKeys": [
    "MISTRAL_API_KEY",
    "CODESTRAL_API_KEY"
  ],
  "configAuthPaths": [
    ".mistral/config.json"
  ],
  "capabilities": {
    "supportsStreaming": true,
    "supportsResume": false,
    "supportsHeadlessPrompt": true,
    "supportsJsonOutput": true
  },
  "defaultArgs": [],
  formatPromptArgs: (prompt) => ['--prompt', prompt]
});
  }
}

export const vibeAdapter = new VibeAdapter();
