import type { ModelRecord } from '../../shared/model-registry';
import { traceService } from '../services/trace-service';

export interface StageExecutionSummary {
  stageId: string;
  role: string;
  modelUsed: string;
  summary: string;
  filesModified?: string[];
}

export interface ModelSwitchEvent {
  fromModel: string;
  toModel: string;
  fromProvider: string;
  toProvider: string;
  reason: string;
  stageName: string;
  timestamp: number;
}

export interface ContextHandoffPackage {
  taskId: string;
  orchestrationId: string;
  originalGoal: string;
  currentObjective: string;
  currentRole: string;
  fromModel: string;
  toModel: string;
  fromProvider: string;
  toProvider: string;
  switchReason: string;
  completedStages: StageExecutionSummary[];
  architecturalInvariants: string[];
  changedFiles: string[];
  diffSnippet?: string;
  toolResults?: { toolName: string; summary: string }[];
  reviewerFeedback?: string;
  switchCount: number;
}

export class ModelContextHandoffManager {
  private static instance: ModelContextHandoffManager;
  private switchHistories: Map<string, ModelSwitchEvent[]> = new Map();
  private maxSwitchesPerTask: number = 5;

  private constructor() {}

  public static getInstance(): ModelContextHandoffManager {
    if (!ModelContextHandoffManager.instance) {
      ModelContextHandoffManager.instance = new ModelContextHandoffManager();
    }
    return ModelContextHandoffManager.instance;
  }

  /**
   * Records a model switch event and verifies switch budget / loop detection.
   */
  public recordSwitch(taskId: string, event: ModelSwitchEvent): { allowed: boolean; reason?: string } {
    let history = this.switchHistories.get(taskId);
    if (!history) {
      history = [];
      this.switchHistories.set(taskId, history);
    }

    // 1. Check budget limit
    if (history.length >= this.maxSwitchesPerTask) {
      return {
        allowed: false,
        reason: `Maximum model switch limit (${this.maxSwitchesPerTask}) reached for task ${taskId}. Halting transition.`
      };
    }

    // 2. Loop detection (e.g. A -> B -> A -> B)
    history.push(event);
    if (this.detectSwitchLoop(history)) {
      return {
        allowed: false,
        reason: `Model switching loop detected (${event.fromModel} <-> ${event.toModel}). Halting circular transition.`
      };
    }

    // Record span in trace service
    try {
      traceService.recordSpan(taskId, {
        name: `Model Handoff: ${event.fromModel} -> ${event.toModel}`,
        layer: 'cli',
        status: 'completed',
        startedAt: event.timestamp,
        completedAt: Date.now(),
        metadata: {
          fromModel: event.fromModel,
          toModel: event.toModel,
          fromProvider: event.fromProvider,
          toProvider: event.toProvider,
          reason: event.reason,
          stage: event.stageName,
          switchCount: history.length
        }
      });
    } catch {}

    return { allowed: true };
  }

  /**
   * Detects ping-pong or cyclic switching loops in switch history.
   */
  public detectSwitchLoop(history: ModelSwitchEvent[]): boolean {
    if (history.length < 4) return false;

    const n = history.length;
    // Check A -> B -> A -> B
    if (
      history[n - 1].fromModel === history[n - 3].fromModel &&
      history[n - 1].toModel === history[n - 3].toModel &&
      history[n - 2].fromModel === history[n - 4].fromModel &&
      history[n - 2].toModel === history[n - 4].toModel
    ) {
      return true;
    }

    // Check 3-model cycle A -> B -> C -> A
    if (history.length >= 6) {
      const h = history.map((e) => `${e.fromModel}->${e.toModel}`);
      if (h[n - 1] === h[n - 4] && h[n - 2] === h[n - 5] && h[n - 3] === h[n - 6]) {
        return true;
      }
    }

    return false;
  }

  /**
   * Compiles a structured, deduplicated, token-efficient context handoff prompt for the target model.
   */
  public assembleHandoffPrompt(pkg: ContextHandoffPackage, _targetModel?: ModelRecord): string {
    const sections: string[] = [];

    // Header: Transition Notice
    sections.push(
      `### ADAPTIVE MODEL HANDOFF CONTEXT\n` +
      `You are taking over task execution as specialist **${pkg.currentRole.toUpperCase()}**.\n` +
      `Model transition: \`${pkg.fromModel}\` -> \`${pkg.toModel}\`\n` +
      `Transition reason: ${pkg.switchReason}`
    );

    // 1. Original User Goal
    sections.push(`### OVERALL PROJECT GOAL:\n${pkg.originalGoal}`);

    // 2. Completed Stages Summary
    if (pkg.completedStages.length > 0) {
      const stageLines = pkg.completedStages
        .map((s, idx) => `  ${idx + 1}. [${s.role}] (${s.modelUsed}): ${s.summary}`)
        .join('\n');
      sections.push(`### COMPLETED STAGES EVIDENCE:\n${stageLines}`);
    }

    // 3. Architectural Invariants & Constraints
    if (pkg.architecturalInvariants.length > 0) {
      const invLines = pkg.architecturalInvariants.map((inv) => `- ${inv}`).join('\n');
      sections.push(`### NON-NEGOTIABLE ARCHITECTURAL INVARIANTS:\n${invLines}`);
    }

    // 4. File Changes & Unified Diff Snippet
    if (pkg.changedFiles.length > 0) {
      sections.push(`### MODIFIED FILES:\n${pkg.changedFiles.map((f) => `- ${f}`).join('\n')}`);
    }

    if (pkg.diffSnippet && pkg.diffSnippet.trim().length > 0) {
      // Truncate diff snippet if excessively long (> 100 lines) to avoid context blowup
      const lines = pkg.diffSnippet.split('\n');
      const truncatedDiff = lines.length > 120 ? lines.slice(0, 120).join('\n') + '\n... [diff truncated for context budget]' : pkg.diffSnippet;
      sections.push(`### ACTIVE GIT DIFF:\n\`\`\`diff\n${truncatedDiff}\n\`\`\``);
    }

    // 5. Reviewer Feedback / Remediation Diagnostics
    if (pkg.reviewerFeedback) {
      sections.push(
        `### PREVIOUS REVIEW FEEDBACK (REMEDIATION REQUIRED):\n` +
        `The previous execution attempt failed verification with this feedback:\n` +
        `> ${pkg.reviewerFeedback}\n` +
        `Address and resolve these specific defects.`
      );
    }

    // 6. Current Stage Directive
    sections.push(
      `### CURRENT STAGE OBJECTIVE:\n` +
      `Target Action: ${pkg.currentObjective}\n` +
      `Produce concrete, robust implementation addressing the objective while honoring all invariants.`
    );

    return sections.join('\n\n');
  }

  public getSwitchHistory(taskId: string): ModelSwitchEvent[] {
    return this.switchHistories.get(taskId) || [];
  }

  public clearHistory(taskId: string): void {
    this.switchHistories.delete(taskId);
  }
}

export const modelContextHandoffManager = ModelContextHandoffManager.getInstance();
