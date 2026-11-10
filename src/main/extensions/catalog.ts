import type { CatalogPluginItem } from '../../shared/extensions';

/**
 * Curated Official & Ecosystem Plugin Catalog
 *
 * Cloud-ready architecture:
 * In production or cloud-connected mode, this catalog can be synchronized
 * with a remote cloud database / API endpoint. When running local/offline,
 * it serves this canonical built-in registry.
 */
export const OFFICIAL_PLUGIN_CATALOG: CatalogPluginItem[] = [
  {
    id: 'orbito-clock-panel',
    name: 'orbito-clock-panel',
    displayName: 'Workspace Clock & Productivity Timer',
    version: '1.0.0',
    description: 'Relógio de produtividade em tempo real para o workspace com suporte a sessões de foco (Pomodoro), alertas e comandos UTC.',
    author: 'Orbito Core Team',
    category: 'developer',
    isOfficial: true,
    downloads: 4120,
    rating: 4.9,
    permissions: {
      shell: false,
      filesystem: { read: true }
    },
    manifest: {
      id: 'orbito-clock-panel',
      name: 'orbito-clock-panel',
      displayName: 'Workspace Clock & Productivity Timer',
      version: '1.0.0',
      description: 'Relógio de produtividade em tempo real para o workspace com suporte a sessões de foco (Pomodoro), alertas e comandos UTC.',
      author: 'Orbito Core Team',
      license: 'MIT',
      main: 'index.js',
      permissions: {
        shell: false,
        filesystem: { read: true }
      },
      contributes: {
        commands: [
          { id: 'clock.showCurrentTime', title: 'Mostrar Hora UTC Atual', handler: 'showCurrentTime' },
          { id: 'clock.startTimer', title: 'Iniciar Temporizador de Foco (25m)', handler: 'startFocusTimer' }
        ]
      }
    }
  },
  {
    id: 'orbito-git-lens',
    name: 'orbito-git-lens',
    displayName: 'Git Insights & Branch Inspector',
    version: '1.1.0',
    description: 'Visualizador de histórico Git, status de branches paralelas, gráfico de commits e inspeção rápida de repositórios.',
    author: 'Orbito Core Team',
    category: 'git',
    isOfficial: true,
    downloads: 6890,
    rating: 4.9,
    permissions: {
      shell: false,
      filesystem: { read: true }
    },
    manifest: {
      id: 'orbito-git-lens',
      name: 'orbito-git-lens',
      displayName: 'Git Insights & Branch Inspector',
      version: '1.1.0',
      description: 'Visualizador de histórico Git, status de branches paralelas, gráfico de commits e inspeção rápida de repositórios.',
      author: 'Orbito Core Team',
      license: 'MIT',
      main: 'index.js',
      permissions: {
        shell: false,
        filesystem: { read: true }
      },
      contributes: {
        commands: [
          { id: 'git.inspectBranch', title: 'Inspecionar Ramo Atual', handler: 'inspectBranch' }
        ]
      }
    }
  },
  {
    id: 'orbito-prompt-optimizer',
    name: 'orbito-prompt-optimizer',
    displayName: 'AI Prompt & Token Optimizer',
    version: '1.2.0',
    description: 'Análise de densidade de contexto, contagem de tokens Tiktoken, compressão de prompts e estimativa de custos para LLMs.',
    author: 'Orbito Core Team',
    category: 'ai-tools',
    isOfficial: true,
    downloads: 9450,
    rating: 5.0,
    permissions: {
      shell: false,
      filesystem: { read: true, write: true }
    },
    manifest: {
      id: 'orbito-prompt-optimizer',
      name: 'orbito-prompt-optimizer',
      displayName: 'AI Prompt & Token Optimizer',
      version: '1.2.0',
      description: 'Análise de densidade de contexto, contagem de tokens Tiktoken, compressão de prompts e estimativa de custos para LLMs.',
      author: 'Orbito Core Team',
      license: 'MIT',
      main: 'index.js',
      permissions: {
        shell: false,
        filesystem: { read: true, write: true }
      },
      contributes: {
        commands: [
          { id: 'prompt.analyze', title: 'Analisar Contagem de Tokens do Prompt', handler: 'analyzeTokens' }
        ]
      }
    }
  },
  {
    id: 'orbito-discord-presence',
    name: 'orbito-discord-presence',
    displayName: 'Discord Rich Presence Companion',
    version: '1.0.2',
    description: 'Sincroniza o projeto ativo, branch Git e tempo de desenvolvimento diretamente no teu perfil do Discord.',
    author: 'Orbito Team',
    category: 'general',
    isOfficial: true,
    downloads: 3200,
    rating: 4.8,
    permissions: {
      shell: false
    },
    manifest: {
      id: 'orbito-discord-presence',
      name: 'orbito-discord-presence',
      displayName: 'Discord Rich Presence Companion',
      version: '1.0.2',
      description: 'Sincroniza o projeto ativo, branch Git e tempo de desenvolvimento diretamente no teu perfil do Discord.',
      author: 'Orbito Team',
      license: 'MIT',
      main: 'index.js',
      permissions: {
        shell: false
      },
      contributes: {
        commands: []
      }
    }
  },
  {
    id: 'orbito-schema-tools',
    name: 'orbito-schema-tools',
    displayName: 'JSON & Schema Validator',
    version: '1.0.0',
    description: 'Validação e formatação instantânea para ficheiros JSON, YAML, schemas Zod e especificações OpenAPI.',
    author: 'Community Contributor',
    category: 'editor',
    isOfficial: false,
    downloads: 2150,
    rating: 4.7,
    permissions: {
      shell: false,
      filesystem: { read: true }
    },
    manifest: {
      id: 'orbito-schema-tools',
      name: 'orbito-schema-tools',
      displayName: 'JSON & Schema Validator',
      version: '1.0.0',
      description: 'Validação e formatação instantânea para ficheiros JSON, YAML, schemas Zod e especificações OpenAPI.',
      author: 'Community Contributor',
      license: 'MIT',
      main: 'index.js',
      permissions: {
        shell: false,
        filesystem: { read: true }
      },
      contributes: {
        commands: []
      }
    }
  },
  {
    id: 'orbito-ollama-health',
    name: 'orbito-ollama-health',
    displayName: 'Local LLM Health Monitor',
    version: '1.0.1',
    description: 'Monitorização em tempo real de latência, memória e modelos disponíveis em servidores locais Ollama / LM Studio.',
    author: 'AI Workspace Labs',
    category: 'ai-tools',
    isOfficial: true,
    downloads: 5780,
    rating: 4.9,
    permissions: {
      shell: false,
      network: { allowExternal: false, allowedHosts: ['localhost', '127.0.0.1'] }
    },
    manifest: {
      id: 'orbito-ollama-health',
      name: 'orbito-ollama-health',
      displayName: 'Local LLM Health Monitor',
      version: '1.0.1',
      description: 'Monitorização em tempo real de latência, memória e modelos disponíveis em servidores locais Ollama / LM Studio.',
      author: 'AI Workspace Labs',
      license: 'MIT',
      main: 'index.js',
      permissions: {
        shell: false,
        network: { allowExternal: false, allowedHosts: ['localhost', '127.0.0.1'] }
      },
      contributes: {
        commands: []
      }
    }
  }
];

export const PLUGIN_CODE_TEMPLATES: Record<string, string> = {
  'orbito-clock-panel': `/**
 * Workspace Clock & Productivity Timer Plugin
 */
module.exports = {
  activate(context) {
    context.log("[Clock & Timer] Plugin de produtividade ativado com sucesso!");
    if (context.commands) {
      context.commands.register("clock.showCurrentTime", () => {
        const now = new Date().toISOString();
        context.log("Hora UTC Atual: " + now);
        return now;
      });
      context.commands.register("clock.startTimer", () => {
        context.log("Temporizador Pomodoro iniciado: 25 minutos.");
        return { status: "running", durationMinutes: 25 };
      });
    }
  },
  deactivate() {
    console.log("[Clock & Timer] Desativado.");
  }
};
`,
  'orbito-git-lens': `/**
 * Git Insights & Branch Inspector Plugin
 */
module.exports = {
  activate(context) {
    context.log("[Git Insights] Inspetor de histórico Git inicializado.");
    if (context.commands) {
      context.commands.register("git.inspectBranch", (branch) => {
        context.log("Inspecionando ramo: " + (branch || "atual"));
        return { status: "clean", inspectedAt: Date.now() };
      });
    }
  },
  deactivate() {
    console.log("[Git Insights] Desativado.");
  }
};
`,
  'orbito-prompt-optimizer': `/**
 * AI Prompt & Token Optimizer Plugin
 */
module.exports = {
  activate(context) {
    context.log("[AI Prompt Optimizer] Otimizador de tokens carregado.");
    if (context.commands) {
      context.commands.register("prompt.analyze", (text) => {
        const charCount = text ? text.length : 0;
        const estTokens = Math.ceil(charCount / 4);
        context.log("Tokens estimados: ~" + estTokens);
        return { tokens: estTokens, chars: charCount };
      });
    }
  },
  deactivate() {
    console.log("[AI Prompt Optimizer] Desativado.");
  }
};
`,
  'orbito-discord-presence': `/**
 * Discord Rich Presence Companion Plugin
 */
module.exports = {
  activate(context) {
    context.log("[Discord Companion] Sincronização de estado pronta.");
  },
  deactivate() {
    console.log("[Discord Companion] Desativado.");
  }
};
`,
  'orbito-schema-tools': `/**
 * JSON & Schema Validator Plugin
 */
module.exports = {
  activate(context) {
    context.log("[Schema Validator] Ferramentas de validação ativas.");
  },
  deactivate() {
    console.log("[Schema Validator] Desativado.");
  }
};
`,
  'orbito-ollama-health': `/**
 * Local LLM Health Monitor Plugin
 */
module.exports = {
  activate(context) {
    context.log("[Local LLM Health] Monitor de conectividade Air-Gap iniciado.");
  },
  deactivate() {
    console.log("[Local LLM Health] Desativado.");
  }
};
`
};
