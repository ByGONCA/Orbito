import { BaseCLIAdapter } from '../base.adapter';

export class AuggieAdapter extends BaseCLIAdapter {
  constructor() {
    super({
  "provider": "auggie",
  "name": "Auggie",
  "vendor": "Augment Code",
  "tagline": "Enterprise codebase context CLI companion by Augment Code",
  "description": "Brings Augment Code deep context engine and agentic capabilities into your shell and CI/CD pipelines.",
  "executableNames": [
    "auggie"
  ],
  "supportedPlatforms": [
    "win32",
    "darwin",
    "linux"
  ],
  "installCommand": "npm install -g @augmentcode/auggie@latest",
  "installGuideUrl": "https://docs.augmentcode.com",
  "authCommand": "auggie login",
  "authType": "token",
  "envAuthKeys": [
    "AUGMENT_API_KEY",
    "AUGGIE_TOKEN"
  ],
  "configAuthPaths": [
    ".augment/config.json"
  ],
  "capabilities": {
    "supportsStreaming": true,
    "supportsResume": false,
    "supportsHeadlessPrompt": true,
    "supportsJsonOutput": false
  },
  "defaultArgs": [
    "--print"
  ],
  formatPromptArgs: (prompt) => [prompt]
});
  }
}

export const auggieAdapter = new AuggieAdapter();
