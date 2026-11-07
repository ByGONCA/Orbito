import { BaseCLIAdapter } from '../base.adapter';

export class KiroAdapter extends BaseCLIAdapter {
  constructor() {
    super({
  "provider": "kiro",
  "name": "Kiro CLI",
  "vendor": "Kiro AI",
  "tagline": "Developer CLI for code synthesis and test generation",
  "description": "Terminal assistant specializing in automated test generation, code coverage, and documentation.",
  "executableNames": [
    "kiro",
    "kiro-cli"
  ],
  "supportedPlatforms": [
    "win32",
    "darwin",
    "linux"
  ],
  "installCommand": "npm install -g kiro-cli",
  "installGuideUrl": "https://kiro.ai/docs",
  "authCommand": "kiro auth",
  "authType": "token",
  "envAuthKeys": [
    "KIRO_API_KEY",
    "KIRO_TOKEN"
  ],
  "configAuthPaths": [
    ".kiro/auth.json"
  ],
  "capabilities": {
    "supportsStreaming": true,
    "supportsResume": false,
    "supportsHeadlessPrompt": true,
    "supportsJsonOutput": true
  },
  "defaultArgs": [],
  formatPromptArgs: (prompt) => ['exec', prompt]
});
  }
}

export const kiroAdapter = new KiroAdapter();
