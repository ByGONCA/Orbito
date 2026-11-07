import { BaseCLIAdapter } from '../base.adapter';

export class ContinueAdapter extends BaseCLIAdapter {
  constructor() {
    super({
  "provider": "continue",
  "name": "Continue",
  "vendor": "Continue.dev",
  "tagline": "Open-source AI code assistant CLI",
  "description": "Modular AI coding assistant supporting custom models, context providers, and prompt configurations.",
  "executableNames": [
    "continue",
    "continue-cli"
  ],
  "supportedPlatforms": [
    "win32",
    "darwin",
    "linux"
  ],
  "installCommand": "pip install continue-cli",
  "installGuideUrl": "https://docs.continue.dev",
  "authCommand": "continue login",
  "authType": "api-key",
  "envAuthKeys": [
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "CONTINUE_API_KEY"
  ],
  "configAuthPaths": [
    ".continue/config.json",
    ".continue/config.yaml"
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

export const continueAdapter = new ContinueAdapter();
