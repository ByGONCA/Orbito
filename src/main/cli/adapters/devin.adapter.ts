import { BaseCLIAdapter } from '../base.adapter';

export class DevinAdapter extends BaseCLIAdapter {
  constructor() {
    super({
  "provider": "devin",
  "name": "Devin",
  "vendor": "Cognition AI",
  "tagline": "Autonomous AI software engineer CLI runner",
  "description": "Connects to Cognition AI Devin service to delegate end-to-end software engineering tasks.",
  "executableNames": [
    "devin",
    "devin-cli"
  ],
  "supportedPlatforms": [
    "win32",
    "darwin",
    "linux"
  ],
  "installCommand": "npm install -g @cognition/devin",
  "installGuideUrl": "https://docs.devin.ai",
  "authCommand": "devin login",
  "authType": "api-key",
  "envAuthKeys": [
    "DEVIN_API_KEY",
    "COGNITION_API_KEY"
  ],
  "configAuthPaths": [
    ".devin/credentials.json"
  ],
  "capabilities": {
    "supportsStreaming": true,
    "supportsResume": true,
    "supportsHeadlessPrompt": true,
    "supportsJsonOutput": true
  },
  "defaultArgs": [],
  formatPromptArgs: (prompt) => ['run', prompt]
});
  }
}

export const devinAdapter = new DevinAdapter();
