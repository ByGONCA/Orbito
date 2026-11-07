const fs = require('fs');
const path = require('path');

const adaptersDir = path.join(__dirname, '..', 'src', 'main', 'cli', 'adapters');

const adapterConfigs = [
  {
    id: 'aider',
    className: 'AiderAdapter',
    fileName: 'aider.adapter.ts',
    varName: 'aiderAdapter',
    config: {
      provider: 'aider',
      name: 'Aider',
      vendor: 'Aider AI',
      tagline: 'AI pair programming in your terminal',
      description: 'Aider lets you pair program with LLMs to edit code in your local git repository directly from your terminal.',
      executableNames: ['aider'],
      supportedPlatforms: ['win32', 'darwin', 'linux'],
      minVersion: '0.50.0',
      installCommand: 'pip install aider-chat',
      installGuideUrl: 'https://aider.chat/docs/install.html',
      authCommand: 'export OPENAI_API_KEY=... / ANTHROPIC_API_KEY=...',
      authType: 'api-key',
      envAuthKeys: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY', 'DEEPSEEK_API_KEY'],
      configAuthPaths: ['.aider.conf.yml'],
      capabilities: {
        supportsStreaming: true,
        supportsResume: true,
        supportsHeadlessPrompt: true,
        supportsJsonOutput: false
      },
      defaultArgs: ['--no-auto-commits', '--yes'],
      formatPromptArgs: (prompt) => ['--message', prompt]
    }
  },
  {
    id: 'amp',
    className: 'AmpAdapter',
    fileName: 'amp.adapter.ts',
    varName: 'ampAdapter',
    config: {
      provider: 'amp',
      name: 'Amp',
      vendor: 'Amp AI',
      tagline: 'Modern extensible AI developer environment CLI',
      description: 'Amp CLI provides command-line assistance, code transformation, and multi-file code editing.',
      executableNames: ['amp', 'amp-cli'],
      supportedPlatforms: ['win32', 'darwin', 'linux'],
      installCommand: 'npm install -g @amp/cli',
      installGuideUrl: 'https://amp.dev',
      authCommand: 'amp login',
      authType: 'token',
      envAuthKeys: ['AMP_API_KEY', 'AMP_TOKEN'],
      configAuthPaths: ['.amp/config.json'],
      capabilities: {
        supportsStreaming: true,
        supportsResume: false,
        supportsHeadlessPrompt: true,
        supportsJsonOutput: true
      },
      defaultArgs: [],
      formatPromptArgs: (prompt) => ['prompt', prompt]
    }
  },
  {
    id: 'ante',
    className: 'AnteAdapter',
    fileName: 'ante.adapter.ts',
    varName: 'anteAdapter',
    config: {
      provider: 'ante',
      name: 'Ante',
      vendor: 'Antigma Labs',
      tagline: 'Blazing fast, zero-dependency Rust AI coding agent',
      description: 'Self-contained AI coding agent built in Rust with built-in llama.cpp local inference and cloud LLM routing.',
      executableNames: ['ante'],
      supportedPlatforms: ['win32', 'darwin', 'linux'],
      installCommand: 'curl -fsSL https://ante.run/install.sh | bash',
      installGuideUrl: 'https://ante.run/docs',
      authCommand: 'ante auth',
      authType: 'api-key',
      envAuthKeys: ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'ANTE_API_KEY'],
      configAuthPaths: ['.ante/config.toml'],
      capabilities: {
        supportsStreaming: true,
        supportsResume: true,
        supportsHeadlessPrompt: true,
        supportsJsonOutput: true
      },
      defaultArgs: [],
      formatPromptArgs: (prompt) => ['--prompt', prompt]
    }
  },
  {
    id: 'auggie',
    className: 'AuggieAdapter',
    fileName: 'auggie.adapter.ts',
    varName: 'auggieAdapter',
    config: {
      provider: 'auggie',
      name: 'Auggie',
      vendor: 'Augment Code',
      tagline: 'Enterprise codebase context CLI companion by Augment Code',
      description: 'Brings Augment Code deep context engine and agentic capabilities into your shell and CI/CD pipelines.',
      executableNames: ['auggie'],
      supportedPlatforms: ['win32', 'darwin', 'linux'],
      installCommand: 'npm install -g @augmentcode/auggie@latest',
      installGuideUrl: 'https://docs.augmentcode.com',
      authCommand: 'auggie login',
      authType: 'token',
      envAuthKeys: ['AUGMENT_API_KEY', 'AUGGIE_TOKEN'],
      configAuthPaths: ['.augment/config.json'],
      capabilities: {
        supportsStreaming: true,
        supportsResume: false,
        supportsHeadlessPrompt: true,
        supportsJsonOutput: false
      },
      defaultArgs: ['--print'],
      formatPromptArgs: (prompt) => [prompt]
    }
  },
  {
    id: 'cline',
    className: 'ClineAdapter',
    fileName: 'cline.adapter.ts',
    varName: 'clineAdapter',
    config: {
      provider: 'cline',
      name: 'Cline',
      vendor: 'Cline Bot',
      tagline: 'Autonomous coding agent with file system and CLI tools',
      description: 'Autonomous coding agent capable of executing terminal commands, editing complex multi-file codebases, and browsing documentation.',
      executableNames: ['cline'],
      supportedPlatforms: ['win32', 'darwin', 'linux'],
      installCommand: 'npm install -g cline',
      installGuideUrl: 'https://docs.cline.bot',
      authCommand: 'cline configure',
      authType: 'api-key',
      envAuthKeys: ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'OPENROUTER_API_KEY'],
      configAuthPaths: ['.cline/settings.json'],
      capabilities: {
        supportsStreaming: true,
        supportsResume: true,
        supportsHeadlessPrompt: true,
        supportsJsonOutput: true
      },
      defaultArgs: ['-y'],
      formatPromptArgs: (prompt) => ['--prompt', prompt]
    }
  },
  {
    id: 'codebuddy',
    className: 'CodeBuddyAdapter',
    fileName: 'codebuddy.adapter.ts',
    varName: 'codebuddyAdapter',
    config: {
      provider: 'codebuddy',
      name: 'CodeBuddy',
      vendor: 'CodeBuddy',
      tagline: 'Interactive CLI code assistant and project builder',
      description: 'Streamlined coding agent for full-stack code navigation, refactoring, and automated testing.',
      executableNames: ['codebuddy', 'codebuddy-cli'],
      supportedPlatforms: ['win32', 'darwin', 'linux'],
      installCommand: 'npm install -g codebuddy-cli',
      installGuideUrl: 'https://codebuddy.ca/docs',
      authCommand: 'codebuddy login',
      authType: 'token',
      envAuthKeys: ['CODEBUDDY_API_KEY', 'OPENAI_API_KEY'],
      configAuthPaths: ['.codebuddy/credentials.json'],
      capabilities: {
        supportsStreaming: true,
        supportsResume: false,
        supportsHeadlessPrompt: true,
        supportsJsonOutput: false
      },
      defaultArgs: [],
      formatPromptArgs: (prompt) => ['ask', prompt]
    }
  },
  {
    id: 'codebuff',
    className: 'CodebuffAdapter',
    fileName: 'codebuff.adapter.ts',
    varName: 'codebuffAdapter',
    config: {
      provider: 'codebuff',
      name: 'Codebuff',
      vendor: 'Codebuff AI (YC F24)',
      tagline: 'Multi-agent AI coding assistant in your terminal',
      description: 'Coordinates specialized internal agents (planner, editor, reviewer) for complex multi-file codebase changes with knowledge.md support.',
      executableNames: ['codebuff', 'freebuff'],
      supportedPlatforms: ['win32', 'darwin', 'linux'],
      installCommand: 'npm install -g codebuff',
      installGuideUrl: 'https://github.com/codebuff/codebuff',
      authCommand: 'codebuff login',
      authType: 'api-key',
      envAuthKeys: ['OPENROUTER_API_KEY', 'CODEBUFF_API_KEY'],
      configAuthPaths: ['.codebuff/config.json'],
      capabilities: {
        supportsStreaming: true,
        supportsResume: true,
        supportsHeadlessPrompt: true,
        supportsJsonOutput: false
      },
      defaultArgs: [],
      formatPromptArgs: (prompt) => ['--prompt', prompt]
    }
  },
  {
    id: 'continue',
    className: 'ContinueAdapter',
    fileName: 'continue.adapter.ts',
    varName: 'continueAdapter',
    config: {
      provider: 'continue',
      name: 'Continue',
      vendor: 'Continue.dev',
      tagline: 'Open-source AI code assistant CLI',
      description: 'Modular AI coding assistant supporting custom models, context providers, and prompt configurations.',
      executableNames: ['continue', 'continue-cli'],
      supportedPlatforms: ['win32', 'darwin', 'linux'],
      installCommand: 'pip install continue-cli',
      installGuideUrl: 'https://docs.continue.dev',
      authCommand: 'continue login',
      authType: 'api-key',
      envAuthKeys: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'CONTINUE_API_KEY'],
      configAuthPaths: ['.continue/config.json', '.continue/config.yaml'],
      capabilities: {
        supportsStreaming: true,
        supportsResume: false,
        supportsHeadlessPrompt: true,
        supportsJsonOutput: true
      },
      defaultArgs: [],
      formatPromptArgs: (prompt) => ['prompt', prompt]
    }
  },
  {
    id: 'crush',
    className: 'CrushAdapter',
    fileName: 'crush.adapter.ts',
    varName: 'crushAdapter',
    config: {
      provider: 'crush',
      name: 'Crush',
      vendor: 'Charmbracelet',
      tagline: 'Glamorous terminal-native AI coding agent',
      description: 'Terminal AI coding assistant by Charmbracelet featuring mid-session model switching, LSP analysis, and MCP integration.',
      executableNames: ['crush'],
      supportedPlatforms: ['win32', 'darwin', 'linux'],
      installCommand: 'go install github.com/charmbracelet/crush@latest',
      installGuideUrl: 'https://github.com/charmbracelet/crush',
      authCommand: 'export OPENAI_API_KEY=... / ANTHROPIC_API_KEY=...',
      authType: 'api-key',
      envAuthKeys: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'CRUSH_API_KEY'],
      configAuthPaths: ['.config/crush/config.yaml'],
      capabilities: {
        supportsStreaming: true,
        supportsResume: true,
        supportsHeadlessPrompt: true,
        supportsJsonOutput: false
      },
      defaultArgs: [],
      formatPromptArgs: (prompt) => ['--prompt', prompt]
    }
  },
  {
    id: 'cursor',
    className: 'CursorAdapter',
    fileName: 'cursor.adapter.ts',
    varName: 'cursorAdapter',
    config: {
      provider: 'cursor',
      name: 'Cursor Agent',
      vendor: 'Anysphere',
      tagline: 'Cursor Composer and CLI agent for terminal execution',
      description: 'Executes Cursor agent workflows from the command line with multi-file code editing and repo indexing.',
      executableNames: ['cursor'],
      supportedPlatforms: ['win32', 'darwin', 'linux'],
      installCommand: 'https://cursor.com/download',
      installGuideUrl: 'https://docs.cursor.com',
      authCommand: 'cursor --login',
      authType: 'token',
      envAuthKeys: ['CURSOR_API_KEY', 'CURSOR_TOKEN'],
      configAuthPaths: ['.cursor/config.json'],
      capabilities: {
        supportsStreaming: true,
        supportsResume: true,
        supportsHeadlessPrompt: true,
        supportsJsonOutput: true
      },
      defaultArgs: ['--agent'],
      formatPromptArgs: (prompt) => ['--prompt', prompt]
    }
  },
  {
    id: 'devin',
    className: 'DevinAdapter',
    fileName: 'devin.adapter.ts',
    varName: 'devinAdapter',
    config: {
      provider: 'devin',
      name: 'Devin',
      vendor: 'Cognition AI',
      tagline: 'Autonomous AI software engineer CLI runner',
      description: 'Connects to Cognition AI Devin service to delegate end-to-end software engineering tasks.',
      executableNames: ['devin', 'devin-cli'],
      supportedPlatforms: ['win32', 'darwin', 'linux'],
      installCommand: 'npm install -g @cognition/devin',
      installGuideUrl: 'https://docs.devin.ai',
      authCommand: 'devin login',
      authType: 'api-key',
      envAuthKeys: ['DEVIN_API_KEY', 'COGNITION_API_KEY'],
      configAuthPaths: ['.devin/credentials.json'],
      capabilities: {
        supportsStreaming: true,
        supportsResume: true,
        supportsHeadlessPrompt: true,
        supportsJsonOutput: true
      },
      defaultArgs: [],
      formatPromptArgs: (prompt) => ['run', prompt]
    }
  },
  {
    id: 'droid',
    className: 'DroidAdapter',
    fileName: 'droid.adapter.ts',
    varName: 'droidAdapter',
    config: {
      provider: 'droid',
      name: 'Droid (Factory)',
      vendor: 'Factory AI',
      tagline: 'Enterprise-grade agentic software engineering platform',
      description: 'Factory code droid for terminal automation, missions, and multi-file code maintenance.',
      executableNames: ['droid'],
      supportedPlatforms: ['win32', 'darwin', 'linux'],
      installCommand: 'curl -fsSL https://app.factory.ai/install.sh | bash',
      installGuideUrl: 'https://docs.factory.ai',
      authCommand: 'droid login',
      authType: 'token',
      envAuthKeys: ['FACTORY_API_KEY', 'DROID_TOKEN'],
      configAuthPaths: ['.factory/config.json'],
      capabilities: {
        supportsStreaming: true,
        supportsResume: true,
        supportsHeadlessPrompt: true,
        supportsJsonOutput: true
      },
      defaultArgs: ['exec'],
      formatPromptArgs: (prompt) => ['--prompt', prompt]
    }
  },
  {
    id: 'copilot',
    className: 'CopilotAdapter',
    fileName: 'copilot.adapter.ts',
    varName: 'copilotAdapter',
    config: {
      provider: 'copilot',
      name: 'GitHub Copilot CLI',
      vendor: 'GitHub / Microsoft',
      tagline: 'AI command-line code suggestion and explanation',
      description: 'GitHub Copilot extension for command line shell suggestions, code explanation, and Git commit workflows.',
      executableNames: ['gh', 'copilot'],
      supportedPlatforms: ['win32', 'darwin', 'linux'],
      installCommand: 'gh extension install github/gh-copilot',
      installGuideUrl: 'https://docs.github.com/copilot/github-copilot-in-the-cli',
      authCommand: 'gh auth login',
      authType: 'oauth',
      envAuthKeys: ['GITHUB_TOKEN', 'GH_TOKEN', 'COPILOT_API_KEY'],
      configAuthPaths: ['.config/gh/hosts.yml'],
      capabilities: {
        supportsStreaming: true,
        supportsResume: false,
        supportsHeadlessPrompt: true,
        supportsJsonOutput: false
      },
      defaultArgs: ['copilot', 'suggest', '-t', 'shell'],
      formatPromptArgs: (prompt) => [prompt]
    }
  },
  {
    id: 'goose',
    className: 'GooseAdapter',
    fileName: 'goose.adapter.ts',
    varName: 'gooseAdapter',
    config: {
      provider: 'goose',
      name: 'Goose',
      vendor: 'Block',
      tagline: 'Open-source autonomous on-machine coding agent',
      description: 'Extensible open-source agent that writes code, runs terminal commands, and edits local projects.',
      executableNames: ['goose'],
      supportedPlatforms: ['win32', 'darwin', 'linux'],
      installCommand: 'curl -fsSL https://github.com/block/goose/releases/latest/download/goose.sh | bash',
      installGuideUrl: 'https://block.github.io/goose/docs',
      authCommand: 'goose configure',
      authType: 'api-key',
      envAuthKeys: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'DATABRICKS_HOST'],
      configAuthPaths: ['.config/goose/config.yaml'],
      capabilities: {
        supportsStreaming: true,
        supportsResume: true,
        supportsHeadlessPrompt: true,
        supportsJsonOutput: true
      },
      defaultArgs: ['run'],
      formatPromptArgs: (prompt) => ['--text', prompt]
    }
  },
  {
    id: 'hermes',
    className: 'HermesAdapter',
    fileName: 'hermes.adapter.ts',
    varName: 'hermesAdapter',
    config: {
      provider: 'hermes',
      name: 'Hermes Agent',
      vendor: 'Nous Research',
      tagline: 'Autonomous reasoning and function-calling coding agent',
      description: 'Hermes agent powered by Nous Hermes models for structured code analysis, task decomposition, and code generation.',
      executableNames: ['hermes', 'hermes-agent'],
      supportedPlatforms: ['win32', 'darwin', 'linux'],
      installCommand: 'pip install hermes-agent',
      installGuideUrl: 'https://hermes-agent.io/docs',
      authCommand: 'hermes config',
      authType: 'api-key',
      envAuthKeys: ['HERMES_API_KEY', 'OPENAI_API_KEY'],
      configAuthPaths: ['.hermes/config.json'],
      capabilities: {
        supportsStreaming: true,
        supportsResume: false,
        supportsHeadlessPrompt: true,
        supportsJsonOutput: false
      },
      defaultArgs: [],
      formatPromptArgs: (prompt) => ['--prompt', prompt]
    }
  },
  {
    id: 'kilocode',
    className: 'KiloCodeAdapter',
    fileName: 'kilocode.adapter.ts',
    varName: 'kilocodeAdapter',
    config: {
      provider: 'kilocode',
      name: 'Kilo Code',
      vendor: 'Kilo AI',
      tagline: 'Fast terminal-native code comprehension agent',
      description: 'Lightweight agent focused on rapid bug diagnosis, refactoring, and code explanation.',
      executableNames: ['kilocode', 'kilo'],
      supportedPlatforms: ['win32', 'darwin', 'linux'],
      installCommand: 'npm install -g kilocode',
      installGuideUrl: 'https://kilocode.ai/docs',
      authCommand: 'kilocode login',
      authType: 'api-key',
      envAuthKeys: ['KILO_API_KEY', 'OPENAI_API_KEY'],
      configAuthPaths: ['.kilocode/config.json'],
      capabilities: {
        supportsStreaming: true,
        supportsResume: false,
        supportsHeadlessPrompt: true,
        supportsJsonOutput: true
      },
      defaultArgs: [],
      formatPromptArgs: (prompt) => ['run', prompt]
    }
  },
  {
    id: 'kimi',
    className: 'KimiAdapter',
    fileName: 'kimi.adapter.ts',
    varName: 'kimiAdapter',
    config: {
      provider: 'kimi',
      name: 'Kimi Code',
      vendor: 'Moonshot AI',
      tagline: 'Long-context code intelligence CLI by Moonshot AI',
      description: 'Excels at ultra-long codebase analysis and repository understanding powered by Moonshot models.',
      executableNames: ['kimi', 'kimi-cli'],
      supportedPlatforms: ['win32', 'darwin', 'linux'],
      installCommand: 'pip install kimi-cli',
      installGuideUrl: 'https://platform.moonshot.cn/docs',
      authCommand: 'kimi login',
      authType: 'api-key',
      envAuthKeys: ['MOONSHOT_API_KEY', 'KIMI_API_KEY'],
      configAuthPaths: ['.kimi/config.json'],
      capabilities: {
        supportsStreaming: true,
        supportsResume: false,
        supportsHeadlessPrompt: true,
        supportsJsonOutput: false
      },
      defaultArgs: [],
      formatPromptArgs: (prompt) => ['ask', prompt]
    }
  },
  {
    id: 'kiro',
    className: 'KiroAdapter',
    fileName: 'kiro.adapter.ts',
    varName: 'kiroAdapter',
    config: {
      provider: 'kiro',
      name: 'Kiro CLI',
      vendor: 'Kiro AI',
      tagline: 'Developer CLI for code synthesis and test generation',
      description: 'Terminal assistant specializing in automated test generation, code coverage, and documentation.',
      executableNames: ['kiro', 'kiro-cli'],
      supportedPlatforms: ['win32', 'darwin', 'linux'],
      installCommand: 'npm install -g kiro-cli',
      installGuideUrl: 'https://kiro.ai/docs',
      authCommand: 'kiro auth',
      authType: 'token',
      envAuthKeys: ['KIRO_API_KEY', 'KIRO_TOKEN'],
      configAuthPaths: ['.kiro/auth.json'],
      capabilities: {
        supportsStreaming: true,
        supportsResume: false,
        supportsHeadlessPrompt: true,
        supportsJsonOutput: true
      },
      defaultArgs: [],
      formatPromptArgs: (prompt) => ['exec', prompt]
    }
  },
  {
    id: 'vibe',
    className: 'VibeAdapter',
    fileName: 'vibe.adapter.ts',
    varName: 'vibeAdapter',
    config: {
      provider: 'vibe',
      name: 'Mistral Vibe',
      vendor: 'Mistral AI',
      tagline: 'High-speed code reasoning powered by Mistral Codestral',
      description: 'Mistral AI developer CLI integrating Codestral for fill-in-the-middle, instruction following, and fast code completion.',
      executableNames: ['vibe', 'mistral-vibe', 'codestral'],
      supportedPlatforms: ['win32', 'darwin', 'linux'],
      installCommand: 'pip install mistral-vibe',
      installGuideUrl: 'https://docs.mistral.ai',
      authCommand: 'export MISTRAL_API_KEY=...',
      authType: 'api-key',
      envAuthKeys: ['MISTRAL_API_KEY', 'CODESTRAL_API_KEY'],
      configAuthPaths: ['.mistral/config.json'],
      capabilities: {
        supportsStreaming: true,
        supportsResume: false,
        supportsHeadlessPrompt: true,
        supportsJsonOutput: true
      },
      defaultArgs: [],
      formatPromptArgs: (prompt) => ['--prompt', prompt]
    }
  },
  {
    id: 'opencode',
    className: 'OpenCodeAdapter',
    fileName: 'opencode.adapter.ts',
    varName: 'opencodeAdapter',
    config: {
      provider: 'opencode',
      name: 'OpenCode',
      vendor: 'OpenCode AI',
      tagline: 'Open-weights code orchestration CLI',
      description: 'Terminal-based coding agent connecting to local or cloud open weights models for code refactoring and creation.',
      executableNames: ['opencode', 'opencode-cli'],
      supportedPlatforms: ['win32', 'darwin', 'linux'],
      installCommand: 'npm install -g opencode-cli',
      installGuideUrl: 'https://opencode.ai/docs',
      authCommand: 'opencode configure',
      authType: 'api-key',
      envAuthKeys: ['OPENCODE_API_KEY', 'OPENAI_API_KEY'],
      configAuthPaths: ['.opencode/config.json'],
      capabilities: {
        supportsStreaming: true,
        supportsResume: false,
        supportsHeadlessPrompt: true,
        supportsJsonOutput: false
      },
      defaultArgs: [],
      formatPromptArgs: (prompt) => ['run', prompt]
    }
  },
  {
    id: 'openhands',
    className: 'OpenHandsAdapter',
    fileName: 'openhands.adapter.ts',
    varName: 'openhandsAdapter',
    config: {
      provider: 'openhands',
      name: 'OpenHands',
      vendor: 'All-Hands AI',
      tagline: 'Open-source autonomous AI software developer',
      description: 'Full-stack software engineering agent that writes code, fixes bugs, and executes tests in an isolated sandbox.',
      executableNames: ['openhands', 'all-hands'],
      supportedPlatforms: ['win32', 'darwin', 'linux'],
      installCommand: 'pip install openhands-ai',
      installGuideUrl: 'https://docs.all-hands.dev',
      authCommand: 'openhands setup',
      authType: 'api-key',
      envAuthKeys: ['ALL_HANDS_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'],
      configAuthPaths: ['.openhands/config.toml'],
      capabilities: {
        supportsStreaming: true,
        supportsResume: true,
        supportsHeadlessPrompt: true,
        supportsJsonOutput: true
      },
      defaultArgs: [],
      formatPromptArgs: (prompt) => ['--task', prompt]
    }
  },
  {
    id: 'pi',
    className: 'PiAdapter',
    fileName: 'pi.adapter.ts',
    varName: 'piAdapter',
    config: {
      provider: 'pi',
      name: 'Pi Coding Agent',
      vendor: 'Inflection AI',
      tagline: 'Empathetic conversational terminal pair programmer',
      description: 'Conversational coding assistant designed for conceptual planning, code architecture, and debugging discussions.',
      executableNames: ['pi', 'pi-cli'],
      supportedPlatforms: ['win32', 'darwin', 'linux'],
      installCommand: 'npm install -g pi-coding-agent',
      installGuideUrl: 'https://pi.ai',
      authCommand: 'pi login',
      authType: 'token',
      envAuthKeys: ['PI_API_KEY', 'INFLECTION_API_KEY'],
      configAuthPaths: ['.pi/auth.json'],
      capabilities: {
        supportsStreaming: true,
        supportsResume: false,
        supportsHeadlessPrompt: true,
        supportsJsonOutput: false
      },
      defaultArgs: [],
      formatPromptArgs: (prompt) => ['--prompt', prompt]
    }
  },
  {
    id: 'qwen',
    className: 'QwenAdapter',
    fileName: 'qwen.adapter.ts',
    varName: 'qwenAdapter',
    config: {
      provider: 'qwen',
      name: 'Qwen Code',
      vendor: 'Alibaba Cloud',
      tagline: 'State-of-the-art open code intelligence powered by Qwen 2.5 Coder',
      description: 'Command line coding assistant leveraging Alibaba Qwen 2.5 Coder models for polyglot code generation.',
      executableNames: ['qwen', 'qwen-code'],
      supportedPlatforms: ['win32', 'darwin', 'linux'],
      installCommand: 'pip install qwen-code',
      installGuideUrl: 'https://qwenlm.github.io',
      authCommand: 'export DASHSCOPE_API_KEY=...',
      authType: 'api-key',
      envAuthKeys: ['DASHSCOPE_API_KEY', 'QWEN_API_KEY'],
      configAuthPaths: ['.qwen/config.json'],
      capabilities: {
        supportsStreaming: true,
        supportsResume: false,
        supportsHeadlessPrompt: true,
        supportsJsonOutput: true
      },
      defaultArgs: [],
      formatPromptArgs: (prompt) => ['--prompt', prompt]
    }
  },
  {
    id: 'roocode',
    className: 'RooCodeAdapter',
    fileName: 'roocode.adapter.ts',
    varName: 'roocodeAdapter',
    config: {
      provider: 'roocode',
      name: 'Roo Code',
      vendor: 'Roo Code Team',
      tagline: 'Customizable role-based autonomous coding agent',
      description: 'Fork of Cline featuring custom agent modes, rules integration, and multi-provider token optimization.',
      executableNames: ['roocode', 'roo-code', 'roo-cline'],
      supportedPlatforms: ['win32', 'darwin', 'linux'],
      installCommand: 'npm install -g roo-code-cli',
      installGuideUrl: 'https://docs.roocode.com',
      authCommand: 'roocode configure',
      authType: 'api-key',
      envAuthKeys: ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'OPENROUTER_API_KEY'],
      configAuthPaths: ['.roocode/settings.json'],
      capabilities: {
        supportsStreaming: true,
        supportsResume: true,
        supportsHeadlessPrompt: true,
        supportsJsonOutput: true
      },
      defaultArgs: ['-y'],
      formatPromptArgs: (prompt) => ['--prompt', prompt]
    }
  },
  {
    id: 'rovo',
    className: 'RovoAdapter',
    fileName: 'rovo.adapter.ts',
    varName: 'rovoAdapter',
    config: {
      provider: 'rovo',
      name: 'Rovo Dev',
      vendor: 'Atlassian',
      tagline: 'Enterprise dev knowledge and issue-driven coding agent',
      description: 'Atlassian Rovo Dev CLI connecting Jira issue context, Bitbucket repos, and enterprise pull requests.',
      executableNames: ['rovo', 'rovo-cli'],
      supportedPlatforms: ['win32', 'darwin', 'linux'],
      installCommand: 'npm install -g @atlassian/rovo-cli',
      installGuideUrl: 'https://www.atlassian.com/software/rovo',
      authCommand: 'rovo login',
      authType: 'oauth',
      envAuthKeys: ['ATLASSIAN_API_TOKEN', 'ROVO_API_KEY'],
      configAuthPaths: ['.atlassian/rovo.json'],
      capabilities: {
        supportsStreaming: true,
        supportsResume: false,
        supportsHeadlessPrompt: true,
        supportsJsonOutput: true
      },
      defaultArgs: [],
      formatPromptArgs: (prompt) => ['prompt', prompt]
    }
  },
  {
    id: 'trae',
    className: 'TraeAdapter',
    fileName: 'trae.adapter.ts',
    varName: 'traeAdapter',
    config: {
      provider: 'trae',
      name: 'Trae CLI',
      vendor: 'ByteDance',
      tagline: 'Adaptive AI coding environment CLI',
      description: 'Trae agent runtime providing automated code scaffolding, linting, and workspace transformation.',
      executableNames: ['trae', 'trae-cli'],
      supportedPlatforms: ['win32', 'darwin', 'linux'],
      installCommand: 'https://trae.ai/download',
      installGuideUrl: 'https://docs.trae.ai',
      authCommand: 'trae login',
      authType: 'token',
      envAuthKeys: ['TRAE_API_KEY', 'TRAE_TOKEN'],
      configAuthPaths: ['.trae/config.json'],
      capabilities: {
        supportsStreaming: true,
        supportsResume: true,
        supportsHeadlessPrompt: true,
        supportsJsonOutput: true
      },
      defaultArgs: ['--agent'],
      formatPromptArgs: (prompt) => ['--prompt', prompt]
    }
  },
  {
    id: 'zed',
    className: 'ZedAdapter',
    fileName: 'zed.adapter.ts',
    varName: 'zedAdapter',
    config: {
      provider: 'zed',
      name: 'Zed Agent',
      vendor: 'Zed Industries',
      tagline: 'High-performance collaborative AI editor CLI agent',
      description: 'Interacts with Zed assistant engine and headless agent runner for fast Rust-native code transformations.',
      executableNames: ['zed', 'zed-cli'],
      supportedPlatforms: ['win32', 'darwin', 'linux'],
      installCommand: 'https://zed.dev/download',
      installGuideUrl: 'https://zed.dev/docs',
      authCommand: 'zed --login',
      authType: 'api-key',
      envAuthKeys: ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'ZED_TOKEN'],
      configAuthPaths: ['.config/zed/settings.json'],
      capabilities: {
        supportsStreaming: true,
        supportsResume: false,
        supportsHeadlessPrompt: true,
        supportsJsonOutput: false
      },
      defaultArgs: ['--agent'],
      formatPromptArgs: (prompt) => ['--prompt', prompt]
    }
  }
];

for (const a of adapterConfigs) {
  const code = `import { BaseCLIAdapter } from '../base.adapter';

export class ${a.className} extends BaseCLIAdapter {
  constructor() {
    super(${JSON.stringify(a.config, (key, value) => {
      if (typeof value === 'function') {
        return value.toString();
      }
      return value;
    }, 2).replace(/"(formatPromptArgs)":\s*"(.*?)"/g, (_, k, v) => `${k}: ${v.replace(/\\"/g, '"')}`)});
  }
}

export const ${a.varName} = new ${a.className}();
`;

  fs.writeFileSync(path.join(adaptersDir, a.fileName), code, 'utf8');
  console.log('Created adapter:', a.fileName);
}
