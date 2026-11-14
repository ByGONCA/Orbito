import React, { useState, useEffect } from 'react';
import {
  Brain,
  Zap,
  Sliders,
  ShieldCheck,
  Check,
  RefreshCw,
  Coins,
  Cpu,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { SettingSection } from '../common/SettingSection';
import { SettingRow } from '../common/SettingRow';
import { Button } from '../../ui/Button';
import { useWorkspaceStore } from '../../../stores/workspace.store';

interface ModelItem {
  id: string;
  officialModelId: string;
  displayName: string;
  provider: string;
  contextWindow: number;
  inRate: number;
  outRate: number;
  reasoningScore: number;
  codingScore: number;
  latencyMs: number;
  isAvailable: boolean;
}

const STATIC_MODELS: ModelItem[] = [
  {
    id: 'anthropic:claude-3-7-sonnet',
    officialModelId: 'claude-3-7-sonnet-20250219',
    displayName: 'Claude 3.7 Sonnet',
    provider: 'claude',
    contextWindow: 200000,
    inRate: 3.0,
    outRate: 15.0,
    reasoningScore: 98,
    codingScore: 97,
    latencyMs: 1200,
    isAvailable: true
  },
  {
    id: 'anthropic:claude-3-5-sonnet',
    officialModelId: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude 3.5 Sonnet',
    provider: 'claude',
    contextWindow: 200000,
    inRate: 3.0,
    outRate: 15.0,
    reasoningScore: 94,
    codingScore: 95,
    latencyMs: 950,
    isAvailable: true
  },
  {
    id: 'anthropic:claude-3-5-haiku',
    officialModelId: 'claude-3-5-haiku-20241022',
    displayName: 'Claude 3.5 Haiku',
    provider: 'claude',
    contextWindow: 200000,
    inRate: 0.8,
    outRate: 4.0,
    reasoningScore: 82,
    codingScore: 84,
    latencyMs: 380,
    isAvailable: true
  },
  {
    id: 'openai:gpt-4o',
    officialModelId: 'gpt-4o',
    displayName: 'OpenAI GPT-4o',
    provider: 'codex',
    contextWindow: 128000,
    inRate: 2.5,
    outRate: 10.0,
    reasoningScore: 92,
    codingScore: 93,
    latencyMs: 650,
    isAvailable: false
  },
  {
    id: 'openai:o3-mini',
    officialModelId: 'o3-mini',
    displayName: 'OpenAI o3-mini',
    provider: 'codex',
    contextWindow: 200000,
    inRate: 1.1,
    outRate: 4.4,
    reasoningScore: 96,
    codingScore: 95,
    latencyMs: 1800,
    isAvailable: false
  },
  {
    id: 'google:gemini-2.5-pro',
    officialModelId: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    provider: 'gemini',
    contextWindow: 1000000,
    inRate: 1.25,
    outRate: 5.0,
    reasoningScore: 96,
    codingScore: 94,
    latencyMs: 1100,
    isAvailable: false
  },
  {
    id: 'google:gemini-2.5-flash',
    officialModelId: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    provider: 'gemini',
    contextWindow: 1000000,
    inRate: 0.075,
    outRate: 0.3,
    reasoningScore: 85,
    codingScore: 86,
    latencyMs: 250,
    isAvailable: false
  },
  {
    id: 'ollama:llama3.3:70b',
    officialModelId: 'llama3.3:70b',
    displayName: 'Llama 3.3 70B (Local)',
    provider: 'ollama',
    contextWindow: 128000,
    inRate: 0.0,
    outRate: 0.0,
    reasoningScore: 89,
    codingScore: 88,
    latencyMs: 1500,
    isAvailable: true
  }
];

export const AdaptiveIntelligencePage: React.FC = () => {
  const addLog = useWorkspaceStore((state) => state.addLog);

  const [isEnabled, setIsEnabled] = useState(true);
  const [routingMode, setRoutingMode] = useState<'adaptive' | 'manual' | 'advanced'>('adaptive');
  const [optimizationPolicy, setOptimizationPolicy] = useState<'balanced' | 'cost_efficient' | 'max_quality'>('balanced');
  const [singleProviderOnly, setSingleProviderOnly] = useState(false);
  const [maxSwitches, setMaxSwitches] = useState(5);
  const [maxBudgetTask, setMaxBudgetTask] = useState(10);
  const [models, setModels] = useState<ModelItem[]>(STATIC_MODELS);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check provider auth status for live availability
  const refreshModels = async () => {
    setIsRefreshing(true);
    try {
      const updated = await Promise.all(
        STATIC_MODELS.map(async (m) => {
          let available = false;
          if (m.provider === 'claude') {
            try {
              available = await window.api.hasSecret({ key: 'ANTHROPIC_API_KEY' });
            } catch {
              available = true; // CLI auth fallback
            }
          } else if (m.provider === 'codex') {
            try {
              available = await window.api.hasSecret({ key: 'OPENAI_API_KEY' });
            } catch {
              available = false;
            }
          } else if (m.provider === 'gemini') {
            try {
              available = await window.api.hasSecret({ key: 'GEMINI_API_KEY' });
            } catch {
              available = false;
            }
          } else if (m.provider === 'ollama') {
            available = true;
          }
          return { ...m, isAvailable: available };
        })
      );
      setModels(updated);
      addLog('Model availability discovery refreshed.', 'info');
    } catch {
      setModels(STATIC_MODELS);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refreshModels();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-150 border-0">
      <div>
        <h2 className="text-xl font-semibold text-[#ECEDEF] tracking-tight">
          Adaptive Intelligence
        </h2>
        <p className="text-xs text-[#8F949E] mt-1">
          Dynamic multi-model orchestration, in-flight model routing, and evidence-based capability matching.
        </p>
      </div>

      {/* Section 1: Execution Mode */}
      <SettingSection
        title="Orchestration Architecture"
        description="Select how Orbito transitions between models across subtask operations."
      >
        <div className="space-y-3 pt-1">
          <SettingRow
            title="Adaptive Intelligence Engine"
            description="Enable dynamic model selection and in-flight transitions based on task complexity."
          >
            <button
              type="button"
              onClick={() => setIsEnabled(!isEnabled)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors border-0 focus:outline-none ${
                isEnabled ? 'bg-emerald-500/80' : 'bg-white/10'
              }`}
              title={isEnabled ? 'Disable Adaptive Intelligence' : 'Enable Adaptive Intelligence'}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  isEnabled ? 'translate-x-4' : 'translate-x-1'
                }`}
              />
            </button>
          </SettingRow>

          <SettingRow
            title="Routing Operational Mode"
            description="Manual (pinned model), Adaptive (dynamic per stage), or Advanced (multi-model competition)."
          >
            <div className="flex gap-2">
              {(['adaptive', 'manual', 'advanced'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setRoutingMode(mode)}
                  className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-md border-0 transition-colors ${
                    routingMode === mode
                      ? 'bg-white/15 text-[#ECEDEF]'
                      : 'bg-white/[0.03] text-[#8F949E] hover:bg-white/[0.08] hover:text-[#ECEDEF]'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </SettingRow>

          <SettingRow
            title="Optimization Policy"
            description="Balance quality against API expenditure and latency constraints."
          >
            <div className="flex gap-2">
              {(['balanced', 'cost_efficient', 'max_quality'] as const).map((policy) => (
                <button
                  key={policy}
                  type="button"
                  onClick={() => setOptimizationPolicy(policy)}
                  className={`px-3 py-1.5 text-xs font-mono rounded-md border-0 transition-colors ${
                    optimizationPolicy === policy
                      ? 'bg-white/15 text-[#ECEDEF]'
                      : 'bg-white/[0.03] text-[#8F949E] hover:bg-white/[0.08] hover:text-[#ECEDEF]'
                  }`}
                >
                  {policy.replace('_', ' ')}
                </button>
              ))}
            </div>
          </SettingRow>

          <SettingRow
            title="Single-Provider Strict Optimization"
            description="Confine all dynamic model routing solely to models within your active provider."
          >
            <button
              type="button"
              onClick={() => setSingleProviderOnly(!singleProviderOnly)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors border-0 focus:outline-none ${
                singleProviderOnly ? 'bg-emerald-500/80' : 'bg-white/10'
              }`}
              title="Toggle Single-Provider Optimization"
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  singleProviderOnly ? 'translate-x-4' : 'translate-x-1'
                }`}
              />
            </button>
          </SettingRow>
        </div>
      </SettingSection>

      {/* Section 2: Budget & Transition Safety Gates */}
      <SettingSection
        title="Safety & Budget Controls"
        description="Enforce resource expenditure ceilings and prevent cyclic model transitions."
      >
        <div className="space-y-3 pt-1">
          <SettingRow
            title="Maximum Transitions Per Task"
            description="Halts model switching if a task exceeds this transition count to prevent infinite loops."
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[#A4A8AF]">{maxSwitches} switches</span>
              <input
                type="range"
                min="1"
                max="10"
                value={maxSwitches}
                onChange={(e) => setMaxSwitches(parseInt(e.target.value, 10))}
                className="w-24 accent-white/40 cursor-pointer"
                title="Adjust switch threshold"
              />
            </div>
          </SettingRow>

          <SettingRow
            title="Per-Task Budget Ceiling (USD)"
            description="Execution halts and requests explicit confirmation if projected cost exceeds this limit."
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-emerald-400">${maxBudgetTask}.00</span>
              <input
                type="range"
                min="1"
                max="50"
                value={maxBudgetTask}
                onChange={(e) => setMaxBudgetTask(parseInt(e.target.value, 10))}
                className="w-24 accent-white/40 cursor-pointer"
                title="Adjust budget ceiling"
              />
            </div>
          </SettingRow>
        </div>
      </SettingSection>

      {/* Section 3: Model Explorer (Anti-Boxiness, Zero White Borders) */}
      <SettingSection
        title="Model Intelligence Catalog"
        description="Known models with live availability status, context windows, and capability profiles."
        action={
          <button
            type="button"
            onClick={refreshModels}
            disabled={isRefreshing}
            className="p-1.5 text-[#8F949E] hover:text-[#ECEDEF] transition-colors rounded border-0"
            title="Refresh availability"
            aria-label="Refresh availability"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        }
      >
        <div className="space-y-2 pt-2">
          {models.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors border-0"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-2 h-2 rounded-full ${
                    m.isAvailable ? 'bg-emerald-400' : 'bg-white/20'
                  }`}
                  title={m.isAvailable ? 'Available' : 'Unauthenticated'}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[#ECEDEF]">{m.displayName}</span>
                    <span className="text-[11px] font-mono text-[#6A6E78]">{m.provider}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-[#8F949E]">
                    <span>{m.contextWindow.toLocaleString()} ctx</span>
                    <span>Reasoning {m.reasoningScore}%</span>
                    <span>Coding {m.codingScore}%</span>
                    <span>{m.latencyMs}ms</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-mono text-[#A4A8AF]">
                  ${m.inRate} / ${m.outRate}
                </div>
                <div className="text-[10px] text-[#6A6E78]">per 1M tokens</div>
              </div>
            </div>
          ))}
        </div>
      </SettingSection>
    </div>
  );
};
