import { BaseCLIAdapter } from '../base.adapter';

export class RovoAdapter extends BaseCLIAdapter {
  constructor() {
    super({
  "provider": "rovo",
  "name": "Rovo Dev",
  "vendor": "Atlassian",
  "tagline": "Enterprise dev knowledge and issue-driven coding agent",
  "description": "Atlassian Rovo Dev CLI connecting Jira issue context, Bitbucket repos, and enterprise pull requests.",
  "executableNames": [
    "rovo",
    "rovo-cli"
  ],
  "supportedPlatforms": [
    "win32",
    "darwin",
    "linux"
  ],
  "installCommand": "npm install -g @atlassian/rovo-cli",
  "installGuideUrl": "https://www.atlassian.com/software/rovo",
  "authCommand": "rovo login",
  "authType": "oauth",
  "envAuthKeys": [
    "ATLASSIAN_API_TOKEN",
    "ROVO_API_KEY"
  ],
  "configAuthPaths": [
    ".atlassian/rovo.json"
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

export const rovoAdapter = new RovoAdapter();
