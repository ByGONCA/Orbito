import { BaseCLIAdapter } from '../base.adapter';

export class QwenAdapter extends BaseCLIAdapter {
  constructor() {
    super({
  "provider": "qwen",
  "name": "Qwen Code",
  "vendor": "Alibaba Cloud",
  "tagline": "State-of-the-art open code intelligence powered by Qwen 2.5 Coder",
  "description": "Command line coding assistant leveraging Alibaba Qwen 2.5 Coder models for polyglot code generation.",
  "executableNames": [
    "qwen",
    "qwen-code"
  ],
  "supportedPlatforms": [
    "win32",
    "darwin",
    "linux"
  ],
  "installCommand": "pip install qwen-code",
  "installGuideUrl": "https://qwenlm.github.io",
  "authCommand": "export DASHSCOPE_API_KEY=...",
  "authType": "api-key",
  "envAuthKeys": [
    "DASHSCOPE_API_KEY",
    "QWEN_API_KEY"
  ],
  "configAuthPaths": [
    ".qwen/config.json"
  ],
  "capabilities": {
    "supportsStreaming": true,
    "supportsResume": false,
    "supportsHeadlessPrompt": true,
    "supportsJsonOutput": true
  },
  "defaultArgs": [],
  formatPromptArgs: (prompt) => ['--prompt', prompt]
});
  }
}

export const qwenAdapter = new QwenAdapter();
