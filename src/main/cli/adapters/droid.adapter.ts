import { BaseCLIAdapter } from '../base.adapter';

export class DroidAdapter extends BaseCLIAdapter {
  constructor() {
    super({
  "provider": "droid",
  "name": "Droid (Factory)",
  "vendor": "Factory AI",
  "tagline": "Enterprise-grade agentic software engineering platform",
  "description": "Factory code droid for terminal automation, missions, and multi-file code maintenance.",
  "executableNames": [
    "droid"
  ],
  "supportedPlatforms": [
    "win32",
    "darwin",
    "linux"
  ],
  "installCommand": "curl -fsSL https://app.factory.ai/install.sh | bash",
  "installGuideUrl": "https://docs.factory.ai",
  "authCommand": "droid login",
  "authType": "token",
  "envAuthKeys": [
    "FACTORY_API_KEY",
    "DROID_TOKEN"
  ],
  "configAuthPaths": [
    ".factory/config.json"
  ],
  "capabilities": {
    "supportsStreaming": true,
    "supportsResume": true,
    "supportsHeadlessPrompt": true,
    "supportsJsonOutput": true
  },
  "defaultArgs": [
    "exec"
  ],
  formatPromptArgs: (prompt) => ['--prompt', prompt]
});
  }
}

export const droidAdapter = new DroidAdapter();
