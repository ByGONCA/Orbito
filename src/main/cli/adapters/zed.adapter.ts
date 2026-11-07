import { BaseCLIAdapter } from '../base.adapter';

export class ZedAdapter extends BaseCLIAdapter {
  constructor() {
    super({
  "provider": "zed",
  "name": "Zed Agent",
  "vendor": "Zed Industries",
  "tagline": "High-performance collaborative AI editor CLI agent",
  "description": "Interacts with Zed assistant engine and headless agent runner for fast Rust-native code transformations.",
  "executableNames": [
    "zed",
    "zed-cli"
  ],
  "supportedPlatforms": [
    "win32",
    "darwin",
    "linux"
  ],
  "installCommand": "https://zed.dev/download",
  "installGuideUrl": "https://zed.dev/docs",
  "authCommand": "zed --login",
  "authType": "api-key",
  "envAuthKeys": [
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "ZED_TOKEN"
  ],
  "configAuthPaths": [
    ".config/zed/settings.json"
  ],
  "capabilities": {
    "supportsStreaming": true,
    "supportsResume": false,
    "supportsHeadlessPrompt": true,
    "supportsJsonOutput": false
  },
  "defaultArgs": [
    "--agent"
  ],
  formatPromptArgs: (prompt) => ['--prompt', prompt]
});
  }
}

export const zedAdapter = new ZedAdapter();
