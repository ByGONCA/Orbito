import { BaseCLIAdapter } from '../base.adapter';

export class HermesAdapter extends BaseCLIAdapter {
  constructor() {
    super({
  "provider": "hermes",
  "name": "Hermes Agent",
  "vendor": "Nous Research",
  "tagline": "Autonomous reasoning and function-calling coding agent",
  "description": "Hermes agent powered by Nous Hermes models for structured code analysis, task decomposition, and code generation.",
  "executableNames": [
    "hermes",
    "hermes-agent"
  ],
  "supportedPlatforms": [
    "win32",
    "darwin",
    "linux"
  ],
  "installCommand": "pip install hermes-agent",
  "installGuideUrl": "https://hermes-agent.io/docs",
  "authCommand": "hermes config",
  "authType": "api-key",
  "envAuthKeys": [
    "HERMES_API_KEY",
    "OPENAI_API_KEY"
  ],
  "configAuthPaths": [
    ".hermes/config.json"
  ],
  "capabilities": {
    "supportsStreaming": true,
    "supportsResume": false,
    "supportsHeadlessPrompt": true,
    "supportsJsonOutput": false
  },
  "defaultArgs": [],
  formatPromptArgs: (prompt) => ['--prompt', prompt]
});
  }
}

export const hermesAdapter = new HermesAdapter();
