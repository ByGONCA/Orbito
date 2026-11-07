import { BaseCLIAdapter } from '../base.adapter';

export class CursorAdapter extends BaseCLIAdapter {
  constructor() {
    super({
  "provider": "cursor",
  "name": "Cursor Agent",
  "vendor": "Anysphere",
  "tagline": "Cursor Composer and CLI agent for terminal execution",
  "description": "Executes Cursor agent workflows from the command line with multi-file code editing and repo indexing.",
  "executableNames": [
    "cursor"
  ],
  "supportedPlatforms": [
    "win32",
    "darwin",
    "linux"
  ],
  "installCommand": "https://cursor.com/download",
  "installGuideUrl": "https://docs.cursor.com",
  "authCommand": "cursor --login",
  "authType": "token",
  "envAuthKeys": [
    "CURSOR_API_KEY",
    "CURSOR_TOKEN"
  ],
  "configAuthPaths": [
    ".cursor/config.json"
  ],
  "capabilities": {
    "supportsStreaming": true,
    "supportsResume": true,
    "supportsHeadlessPrompt": true,
    "supportsJsonOutput": true
  },
  "defaultArgs": [
    "--agent"
  ],
  formatPromptArgs: (prompt) => ['--prompt', prompt]
});
  }
}

export const cursorAdapter = new CursorAdapter();
