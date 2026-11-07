import { BaseCLIAdapter } from '../base.adapter';

export class KimiAdapter extends BaseCLIAdapter {
  constructor() {
    super({
  "provider": "kimi",
  "name": "Kimi Code",
  "vendor": "Moonshot AI",
  "tagline": "Long-context code intelligence CLI by Moonshot AI",
  "description": "Excels at ultra-long codebase analysis and repository understanding powered by Moonshot models.",
  "executableNames": [
    "kimi",
    "kimi-cli"
  ],
  "supportedPlatforms": [
    "win32",
    "darwin",
    "linux"
  ],
  "installCommand": "pip install kimi-cli",
  "installGuideUrl": "https://platform.moonshot.cn/docs",
  "authCommand": "kimi login",
  "authType": "api-key",
  "envAuthKeys": [
    "MOONSHOT_API_KEY",
    "KIMI_API_KEY"
  ],
  "configAuthPaths": [
    ".kimi/config.json"
  ],
  "capabilities": {
    "supportsStreaming": true,
    "supportsResume": false,
    "supportsHeadlessPrompt": true,
    "supportsJsonOutput": false
  },
  "defaultArgs": [],
  formatPromptArgs: (prompt) => ['ask', prompt]
});
  }
}

export const kimiAdapter = new KimiAdapter();
