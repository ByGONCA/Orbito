import { BaseCLIAdapter } from '../base.adapter';

export class AmpAdapter extends BaseCLIAdapter {
  constructor() {
    super({
  "provider": "amp",
  "name": "Amp",
  "vendor": "Amp AI",
  "tagline": "Modern extensible AI developer environment CLI",
  "description": "Amp CLI provides command-line assistance, code transformation, and multi-file code editing.",
  "executableNames": [
    "amp",
    "amp-cli"
  ],
  "supportedPlatforms": [
    "win32",
    "darwin",
    "linux"
  ],
  "installCommand": "npm install -g @amp/cli",
  "installGuideUrl": "https://amp.dev",
  "authCommand": "amp login",
  "authType": "token",
  "envAuthKeys": [
    "AMP_API_KEY",
    "AMP_TOKEN"
  ],
  "configAuthPaths": [
    ".amp/config.json"
  ],
  "capabilities": {
    "supportsStreaming": true,
    "supportsResume": false,
    "supportsHeadlessPrompt": true,
    "supportsJsonOutput": true
  },
  "defaultArgs": [],
  formatPromptArgs: (prompt) => ['prompt', prompt]
});
  }
}

export const ampAdapter = new AmpAdapter();
