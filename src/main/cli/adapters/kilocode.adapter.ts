import { BaseCLIAdapter } from '../base.adapter';

export class KiloCodeAdapter extends BaseCLIAdapter {
  constructor() {
    super({
  "provider": "kilocode",
  "name": "Kilo Code",
  "vendor": "Kilo AI",
  "tagline": "Fast terminal-native code comprehension agent",
  "description": "Lightweight agent focused on rapid bug diagnosis, refactoring, and code explanation.",
  "executableNames": [
    "kilocode",
    "kilo"
  ],
  "supportedPlatforms": [
    "win32",
    "darwin",
    "linux"
  ],
  "installCommand": "npm install -g kilocode",
  "installGuideUrl": "https://kilocode.ai/docs",
  "authCommand": "kilocode login",
  "authType": "api-key",
  "envAuthKeys": [
    "KILO_API_KEY",
    "OPENAI_API_KEY"
  ],
  "configAuthPaths": [
    ".kilocode/config.json"
  ],
  "capabilities": {
    "supportsStreaming": true,
    "supportsResume": false,
    "supportsHeadlessPrompt": true,
    "supportsJsonOutput": true
  },
  "defaultArgs": [],
  formatPromptArgs: (prompt) => ['run', prompt]
});
  }
}

export const kilocodeAdapter = new KiloCodeAdapter();
