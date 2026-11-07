import { BaseCLIAdapter } from '../base.adapter';

export class AnteAdapter extends BaseCLIAdapter {
  constructor() {
    super({
  "provider": "ante",
  "name": "Ante",
  "vendor": "Antigma Labs",
  "tagline": "Blazing fast, zero-dependency Rust AI coding agent",
  "description": "Self-contained AI coding agent built in Rust with built-in llama.cpp local inference and cloud LLM routing.",
  "executableNames": [
    "ante"
  ],
  "supportedPlatforms": [
    "win32",
    "darwin",
    "linux"
  ],
  "installCommand": "curl -fsSL https://ante.run/install.sh | bash",
  "installGuideUrl": "https://ante.run/docs",
  "authCommand": "ante auth",
  "authType": "api-key",
  "envAuthKeys": [
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "ANTE_API_KEY"
  ],
  "configAuthPaths": [
    ".ante/config.toml"
  ],
  "capabilities": {
    "supportsStreaming": true,
    "supportsResume": true,
    "supportsHeadlessPrompt": true,
    "supportsJsonOutput": true
  },
  "defaultArgs": [],
  formatPromptArgs: (prompt) => ['--prompt', prompt]
});
  }
}

export const anteAdapter = new AnteAdapter();
