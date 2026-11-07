import { BaseCLIAdapter } from '../base.adapter';

export class OpenHandsAdapter extends BaseCLIAdapter {
  constructor() {
    super({
  "provider": "openhands",
  "name": "OpenHands",
  "vendor": "All-Hands AI",
  "tagline": "Open-source autonomous AI software developer",
  "description": "Full-stack software engineering agent that writes code, fixes bugs, and executes tests in an isolated sandbox.",
  "executableNames": [
    "openhands",
    "all-hands"
  ],
  "supportedPlatforms": [
    "win32",
    "darwin",
    "linux"
  ],
  "installCommand": "pip install openhands-ai",
  "installGuideUrl": "https://docs.all-hands.dev",
  "authCommand": "openhands setup",
  "authType": "api-key",
  "envAuthKeys": [
    "ALL_HANDS_API_KEY",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY"
  ],
  "configAuthPaths": [
    ".openhands/config.toml"
  ],
  "capabilities": {
    "supportsStreaming": true,
    "supportsResume": true,
    "supportsHeadlessPrompt": true,
    "supportsJsonOutput": true
  },
  "defaultArgs": [],
  formatPromptArgs: (prompt) => ['--task', prompt]
});
  }
}

export const openhandsAdapter = new OpenHandsAdapter();
