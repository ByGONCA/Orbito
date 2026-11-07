import { BaseCLIAdapter } from '../base.adapter';

export class AiderAdapter extends BaseCLIAdapter {
  constructor() {
    super({
  "provider": "aider",
  "name": "Aider",
  "vendor": "Aider AI",
  "tagline": "AI pair programming in your terminal",
  "description": "Aider lets you pair program with LLMs to edit code in your local git repository directly from your terminal.",
  "executableNames": [
    "aider"
  ],
  "supportedPlatforms": [
    "win32",
    "darwin",
    "linux"
  ],
  "minVersion": "0.50.0",
  "installCommand": "pip install aider-chat",
  "installGuideUrl": "https://aider.chat/docs/install.html",
  "authCommand": "export OPENAI_API_KEY=... / ANTHROPIC_API_KEY=...",
  "authType": "api-key",
  "envAuthKeys": [
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GEMINI_API_KEY",
    "OPENROUTER_API_KEY",
    "DEEPSEEK_API_KEY"
  ],
  "configAuthPaths": [
    ".aider.conf.yml"
  ],
  "capabilities": {
    "supportsStreaming": true,
    "supportsResume": true,
    "supportsHeadlessPrompt": true,
    "supportsJsonOutput": false
  },
  "defaultArgs": [
    "--no-auto-commits",
    "--yes"
  ],
  formatPromptArgs: (prompt) => ['--message', prompt]
});
  }
}

export const aiderAdapter = new AiderAdapter();
