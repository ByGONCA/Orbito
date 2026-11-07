import { BaseCLIAdapter } from '../base.adapter';

export class TraeAdapter extends BaseCLIAdapter {
  constructor() {
    super({
  "provider": "trae",
  "name": "Trae CLI",
  "vendor": "ByteDance",
  "tagline": "Adaptive AI coding environment CLI",
  "description": "Trae agent runtime providing automated code scaffolding, linting, and workspace transformation.",
  "executableNames": [
    "trae",
    "trae-cli"
  ],
  "supportedPlatforms": [
    "win32",
    "darwin",
    "linux"
  ],
  "installCommand": "https://trae.ai/download",
  "installGuideUrl": "https://docs.trae.ai",
  "authCommand": "trae login",
  "authType": "token",
  "envAuthKeys": [
    "TRAE_API_KEY",
    "TRAE_TOKEN"
  ],
  "configAuthPaths": [
    ".trae/config.json"
  ],
  "capabilities": {
    "supportsStreaming": true,
    "supportsResume": true,
    "supportsHeadlessPrompt": true,
    "supportsJsonOutput": true
  },
  "defaultArgs": [
    "--agent"
  ],
  formatPromptArgs: (prompt) => ['--prompt', prompt]
});
  }
}

export const traeAdapter = new TraeAdapter();
