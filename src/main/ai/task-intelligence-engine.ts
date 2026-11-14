import type { TaskCategory } from '../../shared/intelligence';
import type { SpecialistRole } from '../../shared/agents';
import type { TaskCapabilityRequirements } from './model-capability-engine';

export type ComplexityTier = 'simple' | 'routine' | 'intermediate' | 'complex' | 'critical';

export type CapabilityTierRecommendation = 'fast_economical' | 'balanced_coding' | 'frontier_reasoning';

export interface TaskOperationStep {
  stepIndex: number;
  role: SpecialistRole;
  title: string;
  objective: string;
  dependencies: number[]; // indices of required previous steps
  requiredCapabilities: TaskCapabilityRequirements;
  isModifying: boolean;
  recommendedTier: CapabilityTierRecommendation;
}

export interface TaskAnalysisResult {
  category: TaskCategory;
  complexity: ComplexityTier;
  reasoningDepth: number; // 1 - 10
  codingIntensity: number; // 1 - 10
  riskLevel: 'low' | 'medium' | 'high';
  estimatedInputTokens: number;
  expectedOperationsCount: number;
  requiresModifications: boolean;
  requiresTools: boolean;
  pipeline: TaskOperationStep[];
  rationale: string;
}

export interface TaskAnalysisOptions {
  taskDescription: string;
  projectPath?: string;
  fileCount?: number;
  estimatedInputTokens?: number;
}

export class TaskIntelligenceEngine {
  private static instance: TaskIntelligenceEngine;

  private constructor() {}

  public static getInstance(): TaskIntelligenceEngine {
    if (!TaskIntelligenceEngine.instance) {
      TaskIntelligenceEngine.instance = new TaskIntelligenceEngine();
    }
    return TaskIntelligenceEngine.instance;
  }

  /**
   * Analyzes an incoming task prompt to determine category, complexity, required capabilities, and operation pipeline.
   */
  public analyzeTask(options: TaskAnalysisOptions): TaskAnalysisResult {
    const { taskDescription, estimatedInputTokens = 2000 } = options;
    const text = taskDescription.toLowerCase();

    // 1. Infer Category
    const category = this.inferCategory(text);

    // 2. Measure indicators
    const isMultiStep = /(and then|after that|first .* then|investigate .* implement|explore .* fix|verify everything|end-to-end)/i.test(text);
    const hasSecurity = /(security|vulnerability|audit|owasp|cve|leak|sanitize|injection)/i.test(text);
    const hasArchitecture = /(architect|architecture|system design|subsystem|refactor whole|topology|cross-layer)/i.test(text);
    const hasDeepReasoning = /(why does this crash|race condition|deadlock|intermittent|memory leak|root cause)/i.test(text);
    const hasCoding = /(implement|create|build|write|patch|refactor|add feature|fix bug)/i.test(text);
    const isLightweight = /(classify|label|summarize|tldr|is this|explain in one sentence|check status)/i.test(text);

    // 3. Compute Complexity Tier & Reasoning/Coding Intensity
    let complexity: ComplexityTier = 'routine';
    let reasoningDepth = 5;
    let codingIntensity = 5;
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    if (hasArchitecture || (hasSecurity && hasCoding) || text.length > 500) {
      complexity = 'critical';
      reasoningDepth = 9;
      codingIntensity = 8;
      riskLevel = 'high';
    } else if (hasDeepReasoning || hasSecurity || isMultiStep) {
      complexity = 'complex';
      reasoningDepth = 8;
      codingIntensity = 7;
      riskLevel = 'medium';
    } else if (hasCoding) {
      complexity = 'intermediate';
      reasoningDepth = 6;
      codingIntensity = 7;
      riskLevel = 'medium';
    } else if (isLightweight) {
      complexity = 'simple';
      reasoningDepth = 2;
      codingIntensity = 1;
      riskLevel = 'low';
    }

    const requiresModifications = hasCoding || hasArchitecture || hasSecurity;
    const requiresTools = requiresModifications || text.includes('search') || text.includes('run') || text.includes('test');

    // 4. Construct Operation Pipeline
    const pipeline = this.decomposePipeline(taskDescription, category, complexity, requiresModifications);

    return {
      category,
      complexity,
      reasoningDepth,
      codingIntensity,
      riskLevel,
      estimatedInputTokens,
      expectedOperationsCount: pipeline.length,
      requiresModifications,
      requiresTools,
      pipeline,
      rationale: `Task evaluated as ${complexity.toUpperCase()} under category [${category}]. Pipeline composed of ${pipeline.length} operation(s).`
    };
  }

  public inferCategory(text: string): TaskCategory {
    if (/(classify|intent|categorize|is this|label|filter)/i.test(text)) {
      return 'classification';
    }
    if (/(summarize|summary|tldr|changelog|diff summary|brief|overview)/i.test(text)) {
      return 'summarization';
    }
    if (/(security|vulnerability|audit|owasp|cve|injection|leak|secret)/i.test(text)) {
      return 'security_review';
    }
    if (/(architect|architecture|system design|topology|structure|scaffold|subsystem)/i.test(text)) {
      return 'architecture';
    }
    if (/(why does this crash|root cause|diagnose|debug|deadlock|race condition|intermittent)/i.test(text)) {
      return 'deep_reasoning';
    }
    if (/(write|generate|implement|refactor|fix|patch|create|build|component)/i.test(text)) {
      return 'code_generation';
    }
    if (/(research|compare|evaluate libraries|documentation study|find best)/i.test(text)) {
      return 'research';
    }
    return 'general';
  }

  private decomposePipeline(
    prompt: string,
    category: TaskCategory,
    complexity: ComplexityTier,
    isModifying: boolean
  ): TaskOperationStep[] {
    const steps: TaskOperationStep[] = [];

    // Simple / Routine non-modifying task
    if (complexity === 'simple') {
      steps.push({
        stepIndex: 0,
        role: 'architect',
        title: 'Direct Execution & Assessment',
        objective: prompt,
        dependencies: [],
        requiredCapabilities: {
          minClassification: 80,
          minSummarization: 80,
          maxAcceptableLatencyMs: 800
        },
        isModifying: false,
        recommendedTier: 'fast_economical'
      });
      return steps;
    }

    // Routine / Intermediate task (e.g. standard bug fix or single component)
    if (complexity === 'routine' || complexity === 'intermediate') {
      // Step 1: Investigation / Plan
      steps.push({
        stepIndex: 0,
        role: 'architect',
        title: 'Explore & Analyze Objective',
        objective: `Analyze context and formulate implementation strategy for: "${prompt}"`,
        dependencies: [],
        requiredCapabilities: {
          minReasoning: 80,
          minArchitecture: 75
        },
        isModifying: false,
        recommendedTier: 'balanced_coding'
      });

      if (isModifying) {
        // Step 2: Implementation
        steps.push({
          stepIndex: 1,
          role: 'backend',
          title: 'Implement Changes',
          objective: `Implement required modifications for: "${prompt}"`,
          dependencies: [0],
          requiredCapabilities: {
            minCoding: 85,
            minDebugging: 80,
            minToolUse: 85
          },
          isModifying: true,
          recommendedTier: 'balanced_coding'
        });

        // Step 3: Verification
        steps.push({
          stepIndex: 2,
          role: 'reviewer',
          title: 'Independent Review & Verification',
          objective: `Verify code diff, compiler diagnostics, and contract adherence for: "${prompt}"`,
          dependencies: [1],
          requiredCapabilities: {
            minReasoning: 85,
            minDebugging: 85
          },
          isModifying: false,
          recommendedTier: 'balanced_coding'
        });
      }
      return steps;
    }

    // Complex / Critical task (Full 5-stage lifecycle)
    // 1. Initial Classification & Repository Exploration (Fast & economical)
    steps.push({
      stepIndex: 0,
      role: 'architect',
      title: 'Repository Exploration & Diagnostics',
      objective: `Scan relevant files, dependency trees, and error logs for: "${prompt}"`,
      dependencies: [],
      requiredCapabilities: {
        minResearch: 85,
        minSummarization: 85,
        minToolUse: 80,
        maxAcceptableLatencyMs: 1200
      },
      isModifying: false,
      recommendedTier: 'fast_economical'
    });

    // 2. Deep Architecture / Root Cause Analysis (Frontier Reasoning)
    steps.push({
      stepIndex: 1,
      role: 'architect',
      title: 'Architectural Analysis & Design Plan',
      objective: `Synthesize exploration findings and formulate robust architecture plan for: "${prompt}"`,
      dependencies: [0],
      requiredCapabilities: {
        minReasoning: 92,
        minArchitecture: 92,
        minStructuredOutput: 90
      },
      isModifying: false,
      recommendedTier: 'frontier_reasoning'
    });

    // 3. Surgical Implementation (Specialized Coding)
    steps.push({
      stepIndex: 2,
      role: 'backend',
      title: 'Execute Implementation',
      objective: `Implement code modifications following architectural spec for: "${prompt}"`,
      dependencies: [1],
      requiredCapabilities: {
        minCoding: 92,
        minDebugging: 90,
        minToolUse: 90
      },
      isModifying: true,
      recommendedTier: 'frontier_reasoning'
    });

    // 4. Test Suite & Hardening (Coding / Testing)
    steps.push({
      stepIndex: 3,
      role: 'testing',
      title: 'Add Regression & Unit Tests',
      objective: `Create comprehensive test cases asserting behavior for: "${prompt}"`,
      dependencies: [2],
      requiredCapabilities: {
        minCoding: 88,
        minDebugging: 88
      },
      isModifying: true,
      recommendedTier: 'balanced_coding'
    });

    // 5. Independent Verification Gate (Independent Review Model)
    steps.push({
      stepIndex: 4,
      role: 'reviewer',
      title: 'Independent Review & Verification Gate',
      objective: `Perform independent critique, security analysis, and test run on final changes for: "${prompt}"`,
      dependencies: [2, 3],
      requiredCapabilities: {
        minReasoning: 92,
        minDebugging: 90,
        minArchitecture: 90
      },
      isModifying: false,
      recommendedTier: 'frontier_reasoning'
    });

    return steps;
  }
}

export const taskIntelligenceEngine = TaskIntelligenceEngine.getInstance();
