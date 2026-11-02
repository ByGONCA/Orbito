import crypto from 'node:crypto';
import { skillRegistry } from './skill-registry';
import { SkillLoader } from './skill-loader';
import { SkillPermissionManager, type WorkspacePermissionTier } from './skill-permission-manager';
import { contextRetrievalService } from '../context/retrieval/context-retrieval.service';
import { contextAssemblyService } from '../context/assembly/context-assembly.service';
import { tokenCounterService } from '../context/tokens/token-counter.service';
import { databaseService } from '../db/database.service';
import { executionEngine } from '../cli/execution-engine';
import { PromptAssemblyService } from '../prompt/prompt-assembly.service';
import { SkillCompositionService } from './skill-composition.service';
import { MultiTierCacheService } from '../services/cache.service';
import type { SkillExecutionRecord } from '../../shared/skills';
import type { CLIProvider } from '../../shared/cli';

export interface ExecuteSkillOptions {
  skillId: string;
  prompt: string;
  projectId: string;
  projectPath: string;
  provider: CLIProvider;
  model?: string;
  permissionTier?: WorkspacePermissionTier;
}

export interface SkillExecutionResult {
  executionId: string;
  sessionId?: string;
  skillId: string;
  success: boolean;
  status: 'completed' | 'failed' | 'cancelled';
  durationMs: number;
  tokensUsed: number;
  assembledContextTokens: number;
  error?: string;
}

export class SkillExecutionEngine {
  /**
   * Executes a skill against a target project and provider with full context integration.
   */
  public async execute(options: ExecuteSkillOptions): Promise<SkillExecutionResult> {
    const startTime = Date.now();
    const executionId = `skexec-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const { skillId, prompt, projectId, projectPath, provider, model, permissionTier = 'standard' } = options;

    const skill = skillRegistry.getSkill(skillId);
    if (!skill) {
      return this.recordFailure(
        executionId,
        skillId,
        projectId,
        provider,
        model,
        prompt,
        startTime,
        `Skill not found: ${skillId}`
      );
    }

    if (!skill.enabled) {
      return this.recordFailure(
        executionId,
        skillId,
        projectId,
        provider,
        model,
        prompt,
        startTime,
        `Skill is disabled: ${skill.name}. Enable it in Skills Manager before executing.`
      );
    }

    // 1. Evaluate permissions
    const permEval = SkillPermissionManager.evaluate(skill.permissions, permissionTier);
    if (!permEval.allowed) {
      return this.recordFailure(
        executionId,
        skillId,
        projectId,
        provider,
        model,
        prompt,
        startTime,
        `Permission violation: ${permEval.violations.join('; ')}`
      );
    }

    // 2. Load instructions
    const details = SkillLoader.loadDetails(skill);

    // 3. Retrieve & Assemble Context if required
    let assembledContextText = '';
    let assembledTokens = 0;

    if (skill.contextRequirements.indexingNeeded) {
      try {
        const fragments = await contextRetrievalService.retrieve({
          taskDescription: `${skill.name}: ${prompt}`,
          maxCandidates: 15
        });

        const assembly = await contextAssemblyService.assemble({
          projectPath,
          fragments,
          maxTokens: skill.contextRequirements.maxContextTokens || 16000,
          modelTarget: provider
        });

        assembledContextText = assembly.assembledText;
        assembledTokens = assembly.actualTokens;
      } catch (err: any) {
        console.warn(`[SkillExecutionEngine] Context assembly warning for skill ${skillId}:`, err.message);
      }
    }

    // 4. Construct composite prompt via PromptAssemblyService
    const promptAssembly = PromptAssemblyService.assemblePrompt({
      systemPrompt: `SKILL INSTRUCTION SET: ${details.name} (v${details.version})`,
      securityConstraints: [
        'Adhere to project security policies.',
        'Do not alter unrelated code or files.'
      ],
      userObjective: prompt,
      skillInstructions: details.instructions,
      contextMarkdown: assembledContextText,
      expectedOutputFormat: 'Complete skill execution and produce direct output.'
    });
    const specializedPrompt = promptAssembly.assembledPrompt;
    const totalInputTokens = promptAssembly.totalTokens;

    // Check response cache for deterministic read-only operations
    const cacheKey = `skill:${skillId}:${promptAssembly.promptFingerprint}`;
    const cachedResponse = MultiTierCacheService.modelResponseCache.get(cacheKey);
    if (cachedResponse && MultiTierCacheService.isCacheEligible({ category: skill.category, prompt })) {
      const durationMs = Date.now() - startTime;
      SkillCompositionService.recordSkillUsage(skillId, 0, durationMs, true);
      return {
        executionId,
        skillId,
        success: true,
        status: 'completed',
        durationMs,
        tokensUsed: 0,
        assembledContextTokens: 0
      };
    }

    // Record initial running state in DB
    const initialRecord: SkillExecutionRecord = {
      id: executionId,
      skillId,
      projectId,
      provider,
      model,
      status: 'running',
      inputSummary: prompt.slice(0, 200),
      durationMs: 0,
      tokensUsed: totalInputTokens,
      createdAt: startTime
    };

    try {
      databaseService.recordSkillExecution(initialRecord);
    } catch {}

    // 5. Execute via Execution Engine
    try {
      const cliSessionId = `sess-sk-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      await executionEngine.execute({
        sessionId: cliSessionId,
        provider,
        prompt: specializedPrompt,
        workingDirectory: projectPath,
        projectId
      });

      const durationMs = Date.now() - startTime;
      const finalStatus = 'completed';

      const finalRecord: SkillExecutionRecord = {
        id: executionId,
        skillId,
        projectId,
        provider,
        model,
        status: finalStatus,
        inputSummary: prompt.slice(0, 200),
        durationMs,
        tokensUsed: totalInputTokens,
        createdAt: startTime
      };

      try {
        databaseService.recordSkillExecution(finalRecord);
      } catch {}

      SkillCompositionService.recordSkillUsage(skillId, totalInputTokens, durationMs, true);
      if (MultiTierCacheService.isCacheEligible({ category: skill.category, prompt })) {
        MultiTierCacheService.modelResponseCache.set(cacheKey, 'completed', totalInputTokens);
      }

      return {
        executionId,
        sessionId: cliSessionId,
        skillId,
        success: true,
        status: finalStatus,
        durationMs,
        tokensUsed: totalInputTokens,
        assembledContextTokens: assembledTokens
      };
    } catch (err: any) {
      return this.recordFailure(
        executionId,
        skillId,
        projectId,
        provider,
        model,
        prompt,
        startTime,
        err.message || 'Execution error'
      );
    }
  }

  private buildPrompt(
    skillName: string,
    version: string,
    instructions: string,
    contextMarkdown: string,
    userPrompt: string
  ): string {
    return PromptAssemblyService.assemblePrompt({
      systemPrompt: `SKILL PROTOCOL: ${skillName} (v${version})`,
      userObjective: userPrompt,
      skillInstructions: instructions,
      contextMarkdown
    }).assembledPrompt;
  }

  private recordFailure(
    id: string,
    skillId: string,
    projectId: string,
    provider: string,
    model: string | undefined,
    prompt: string,
    startTime: number,
    errorMessage: string
  ): SkillExecutionResult {
    const durationMs = Date.now() - startTime;
    const record: SkillExecutionRecord = {
      id,
      skillId,
      projectId,
      provider,
      model,
      status: 'failed',
      inputSummary: prompt.slice(0, 200),
      durationMs,
      tokensUsed: 0,
      createdAt: startTime,
      errorMessage
    };

    try {
      databaseService.recordSkillExecution(record);
    } catch {}

    return {
      executionId: id,
      skillId,
      success: false,
      status: 'failed',
      durationMs,
      tokensUsed: 0,
      assembledContextTokens: 0,
      error: errorMessage
    };
  }
}

export const skillExecutionEngine = new SkillExecutionEngine();
