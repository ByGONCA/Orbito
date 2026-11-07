import { BaseCLIAdapter } from '../base.adapter';

export class CodebuffAdapter extends BaseCLIAdapter {
  constructor() {
    super({
  "provider": "codebuff",
  "name": "Codebuff",
  "vendor": "Codebuff AI (YC F24)",
  "tagline": "Multi-agent AI coding assistant in your terminal",
  "description": "Coordinates specialized internal agents (planner, editor, reviewer) for complex multi-file codebase changes with knowledge.md support.",
  "executableNames": [
    "codebuff",
    "freebuff"
  ],
  "supportedPlatforms": [
    "win32",
    "darwin",
    "linux"
  ],
  "installCommand": "npm install -g codebuff",
  "installGuideUrl": "https://github.com/codebuff/codebuff",
  "authCommand": "codebuff login",
  "authType": "api-key",
  "envAuthKeys": [
    "OPENROUTER_API_KEY",
    "CODEBUFF_API_KEY"
  ],
  "configAuthPaths": [
    ".codebuff/config.json"
  ],
  "capabilities": {
    "supportsStreaming": true,
    "supportsResume": true,
    "supportsHeadlessPrompt": true,
    "supportsJsonOutput": false
  },
  "defaultArgs": [],
  formatPromptArgs: (prompt) => ['--prompt', prompt]
});
  }
}

export const codebuffAdapter = new CodebuffAdapter();
