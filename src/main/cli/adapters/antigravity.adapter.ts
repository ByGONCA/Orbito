import { BaseCLIAdapter } from '../base.adapter';

export class AntigravityAdapter extends BaseCLIAdapter {
  constructor() {
    super({
      provider: 'antigravity',
      name: 'Antigravity',
      vendor: 'Google DeepMind',
      tagline: 'DeepMind autonomous AI agent CLI for complex reasoning',
      description: 'Google DeepMind Antigravity CLI agent for autonomous software engineering, planning, and codebase transformations.',
      executableNames: ['agy', 'antigravity'],
      supportedPlatforms: ['win32', 'darwin', 'linux'],
      installCommand: 'curl -fsSL https://antigravity.google/install.sh | bash',
      installGuideUrl: 'https://deepmind.google/technologies/gemini',
      authCommand: 'agy auth',
      authType: 'api-key',
      envAuthKeys: ['ANTIGRAVITY_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY'],
      configAuthPaths: ['.gemini/antigravity.json', '.antigravity/config.json'],
      capabilities: {
        supportsStreaming: true,
        supportsResume: true,
        supportsHeadlessPrompt: true,
        supportsJsonOutput: true
      },
      defaultArgs: ['--dangerously-skip-permissions'],
      formatPromptArgs: (prompt) => [prompt]
    });
  }

  public override async getInteractiveLaunchSpec(options: {
    workingDirectory: string;
    customPath?: string;
    model?: string;
    extraArgs?: string[];
  }) {
    const res = await super.getInteractiveLaunchSpec(options);
    if (!res.success) return res;

    const args = [...res.spec.args];
    if (options.model) {
      args.push('--model', options.model);
    }
    if (options.extraArgs) {
      args.push(...options.extraArgs);
    }
    return {
      success: true as const,
      spec: {
        ...res.spec,
        args
      }
    };
  }
}

export const antigravityAdapter = new AntigravityAdapter();
