import { BaseCLIAdapter } from '../base.adapter';

export class CodeBuddyAdapter extends BaseCLIAdapter {
  constructor() {
    super({
  "provider": "codebuddy",
  "name": "CodeBuddy",
  "vendor": "CodeBuddy",
  "tagline": "Interactive CLI code assistant and project builder",
  "description": "Streamlined coding agent for full-stack code navigation, refactoring, and automated testing.",
  "executableNames": [
    "codebuddy",
    "codebuddy-cli"
  ],
  "supportedPlatforms": [
    "win32",
    "darwin",
    "linux"
  ],
  "installCommand": "npm install -g codebuddy-cli",
  "installGuideUrl": "https://codebuddy.ca/docs",
  "authCommand": "codebuddy login",
  "authType": "token",
  "envAuthKeys": [
    "CODEBUDDY_API_KEY",
    "OPENAI_API_KEY"
  ],
  "configAuthPaths": [
    ".codebuddy/credentials.json"
  ],
  "capabilities": {
    "supportsStreaming": true,
    "supportsResume": false,
    "supportsHeadlessPrompt": true,
    "supportsJsonOutput": false
  },
  "defaultArgs": [],
  formatPromptArgs: (prompt) => ['ask', prompt]
});
  }
}

export const codebuddyAdapter = new CodeBuddyAdapter();
