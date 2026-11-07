import { BaseCLIAdapter } from '../base.adapter';

export class CopilotAdapter extends BaseCLIAdapter {
  constructor() {
    super({
  "provider": "copilot",
  "name": "GitHub Copilot CLI",
  "vendor": "GitHub / Microsoft",
  "tagline": "AI command-line code suggestion and explanation",
  "description": "GitHub Copilot extension for command line shell suggestions, code explanation, and Git commit workflows.",
  "executableNames": [
    "gh",
    "copilot"
  ],
  "supportedPlatforms": [
    "win32",
    "darwin",
    "linux"
  ],
  "installCommand": "gh extension install github/gh-copilot",
  "installGuideUrl": "https://docs.github.com/copilot/github-copilot-in-the-cli",
  "authCommand": "gh auth login",
  "authType": "oauth",
  "envAuthKeys": [
    "GITHUB_TOKEN",
    "GH_TOKEN",
    "COPILOT_API_KEY"
  ],
  "configAuthPaths": [
    ".config/gh/hosts.yml"
  ],
  "capabilities": {
    "supportsStreaming": true,
    "supportsResume": false,
    "supportsHeadlessPrompt": true,
    "supportsJsonOutput": false
  },
  "defaultArgs": [
    "copilot",
    "suggest",
    "-t",
    "shell"
  ],
  formatPromptArgs: (prompt) => [prompt]
});
  }
}

export const copilotAdapter = new CopilotAdapter();
