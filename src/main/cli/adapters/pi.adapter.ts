import { BaseCLIAdapter } from '../base.adapter';

export class PiAdapter extends BaseCLIAdapter {
  constructor() {
    super({
  "provider": "pi",
  "name": "Pi Coding Agent",
  "vendor": "Inflection AI",
  "tagline": "Empathetic conversational terminal pair programmer",
  "description": "Conversational coding assistant designed for conceptual planning, code architecture, and debugging discussions.",
  "executableNames": [
    "pi",
    "pi-cli"
  ],
  "supportedPlatforms": [
    "win32",
    "darwin",
    "linux"
  ],
  "installCommand": "npm install -g pi-coding-agent",
  "installGuideUrl": "https://pi.ai",
  "authCommand": "pi login",
  "authType": "token",
  "envAuthKeys": [
    "PI_API_KEY",
    "INFLECTION_API_KEY"
  ],
  "configAuthPaths": [
    ".pi/auth.json"
  ],
  "capabilities": {
    "supportsStreaming": true,
    "supportsResume": false,
    "supportsHeadlessPrompt": true,
    "supportsJsonOutput": false
  },
  "defaultArgs": [],
  formatPromptArgs: (prompt) => ['--prompt', prompt]
});
  }
}

export const piAdapter = new PiAdapter();
