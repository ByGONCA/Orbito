import crypto from 'node:crypto';
import type {
  OrchestrationTask,
  SpecialistRole,
  AutonomousPlan,
  PlanObjective,
  PlanRisk,
  ExecutionMode
} from '../../shared/agents';
import type { CLIProvider } from '../../shared/cli';
import { SPECIALIST_ROLES } from './specialist-roles';
import { DAGValidator } from './dag-validator';
import { adaptiveModelRouter } from '../ai/adaptive-model-router';
import { TaskIntelligenceEngine } from '../ai/task-intelligence-engine';
import { projectIntelligenceService } from '../intelligence/project-intelligence.service';
import type { ProjectIntelligenceData } from '../../shared/project-intelligence';

export interface PlanOptions {
  orchestrationId: string;
  userGoal: string;
  provider: CLIProvider;
  model?: string;
  projectPath?: string;
  mode?: ExecutionMode;
  projectIntelligence?: ProjectIntelligenceData;
}

export class CoordinatorAgent {
  /**
   * Plans an autonomous task lifecycle, returning both the structured AutonomousPlan and the validated tasks DAG.
   */
  public static createPlan(options: PlanOptions): { plan: AutonomousPlan; tasks: OrchestrationTask[] } {
    const { orchestrationId, userGoal, provider, model, projectPath, mode = 'supervised' } = options;

    // 1. Ingest TaskIntelligenceEngine to deeply understand intent, complexity, and risk
    const taskEngine = TaskIntelligenceEngine.getInstance();
    const analysis = taskEngine.analyzeTask({
      taskDescription: userGoal,
      projectPath
    });

    const lower = userGoal.toLowerCase();
    const rawCategory = analysis.category as string;
    const isUiFocused =
      rawCategory === 'ui_ux' ||
      lower.includes('ui') ||
      lower.includes('frontend') ||
      lower.includes('component') ||
      lower.includes('button') ||
      lower.includes('page') ||
      lower.includes('css');

    const isSecurityFocused =
      analysis.category === 'security_review' ||
      analysis.riskLevel === 'high' ||
      lower.includes('security') ||
      lower.includes('vulnerability') ||
      lower.includes('owasp') ||
      /(^|\W)(auth|authentication|authorization|oauth)(\W|$)/i.test(lower);

    const isTestingFocused =
      rawCategory === 'testing' ||
      lower.includes('test') ||
      lower.includes('vitest') ||
      lower.includes('jest') ||
      lower.includes('coverage');

    const isDocFocused =
      rawCategory === 'documentation' ||
      lower.includes('doc') ||
      lower.includes('readme') ||
      lower.includes('jsdoc');

    const isBugFix =
      rawCategory === 'bug_fix' ||
      analysis.category === 'deep_reasoning' ||
      lower.includes('bug') ||
      lower.includes('fix') ||
      lower.includes('error') ||
      lower.includes('crash');

    // 2. Discover Project Modules if intelligence is available
    let discoveredModules: string[] = [];
    if (options.projectIntelligence?.architecture?.modules) {
      discoveredModules = options.projectIntelligence.architecture.modules.map((m: { name: string }) => m.name);
    }

    const tasks: OrchestrationTask[] = [];
    let taskCounter = 1;

    const createTask = (params: {
      role: SpecialistRole;
      title: string;
      description: string;
      dependencies: string[];
      acceptanceCriteria: string[];
      isModifying: boolean;
      plannedFiles?: string[];
      timeoutSeconds?: number;
    }): OrchestrationTask => {
      const id = `task-${orchestrationId.replace('orch-', '')}-${taskCounter++}`;
      const specialist = SPECIALIST_ROLES[params.role] || SPECIALIST_ROLES.backend;

      // Route operation to the optimal individual model per capability requirement
      const route = adaptiveModelRouter.routeOperation({
        taskDescription: `${params.title}: ${params.description}`,
        category:
          params.role === 'architect'
            ? 'architecture'
            : params.role === 'security'
            ? 'security_review'
            : params.role === 'reviewer'
            ? 'deep_reasoning'
            : params.role === 'testing'
            ? 'code_generation'
            : 'code_generation',
        preferredProvider: provider,
        preferredModel: model,
        routingMode: model ? 'manual' : 'adaptive'
      });

      return {
        id,
        orchestrationId,
        title: params.title,
        description: params.description,
        acceptanceCriteria: params.acceptanceCriteria,
        role: params.role,
        assignedProvider: route.selectedProvider,
        assignedModel: route.officialModelId || route.selectedModelId,
        dependencies: params.dependencies,
        requiredSkills: specialist.boundSkillIds,
        requiredPermissions: specialist.defaultPermissions,
        isModifying: params.isModifying,
        plannedFiles: params.plannedFiles,
        status: 'pending',
        retryCount: 0,
        maxRetries: 1,
        timeoutSeconds: params.timeoutSeconds || 180,
        createdAt: Date.now(),
        changedFiles: []
      };
    };

    // 3. Plan Generation based on Complexity & Intent
    // Case A: Simple / Routine Non-Modifying or Direct Surgical Task
    if (analysis.complexity === 'simple') {
      const singleRole: SpecialistRole = isDocFocused
        ? 'documentation'
        : isUiFocused
        ? 'frontend'
        : isSecurityFocused
        ? 'security'
        : analysis.requiresModifications
        ? 'backend'
        : 'architect';

      const t1 = createTask({
        role: singleRole,
        title: `Direct Execution: ${userGoal.length > 50 ? userGoal.substring(0, 47) + '...' : userGoal}`,
        description: `Execute direct request: "${userGoal}". Keep scope minimal and concise without extra abstractions.`,
        dependencies: [],
        acceptanceCriteria: [
          'Address the user request directly and accurately',
          'Ensure zero regressions or unrequested side-effects'
        ],
        isModifying: analysis.requiresModifications,
        plannedFiles: isDocFocused ? ['README.md'] : undefined,
        timeoutSeconds: 120
      });
      tasks.push(t1);
    }
    // Case B: Bug Investigation and Surgical Fix
    else if (isBugFix) {
      const t1 = createTask({
        role: 'architect',
        title: 'Analyze Root Cause and Error Diagnostics',
        description: `Investigate root cause of failure for: "${userGoal}". Formulate minimal reproduction hypothesis.`,
        dependencies: [],
        acceptanceCriteria: ['Identify exact file and line causing failure', 'Produce minimal reproduction steps'],
        isModifying: false
      });
      tasks.push(t1);

      const t2 = createTask({
        role: 'backend',
        title: 'Apply Surgical Fix and Defend Contracts',
        description: `Implement minimal blast-radius patch based on analysis to resolve: "${userGoal}".`,
        dependencies: [t1.id],
        acceptanceCriteria: ['Patch code defects', 'Ensure zero regression in surrounding components'],
        isModifying: true,
        plannedFiles: ['src/']
      });
      tasks.push(t2);

      const t3 = createTask({
        role: 'testing',
        title: 'Add Regression Test Suite',
        description: `Create targeted unit and regression test ensuring bug cannot recur.`,
        dependencies: [t2.id],
        acceptanceCriteria: ['Pass newly added regression tests with 100% assertions'],
        isModifying: true,
        plannedFiles: ['tests/']
      });
      tasks.push(t3);
    }
    // Case C: Security Review & Remediation
    else if (isSecurityFocused) {
      const t1 = createTask({
        role: 'security',
        title: 'Security Vulnerability & OWASP Audit',
        description: `Perform deep security audit for: "${userGoal}". Identify injection vectors and token exposure.`,
        dependencies: [],
        acceptanceCriteria: ['Identify security threats and CWE ratings', 'List affected files and lines'],
        isModifying: false
      });
      tasks.push(t1);

      const t2 = createTask({
        role: 'backend',
        title: 'Harden Security Boundaries & Sanitize Inputs',
        description: `Implement security remediations and input sanitization identified in audit.`,
        dependencies: [t1.id],
        acceptanceCriteria: ['Sanitize untrusted inputs', 'Close identified vulnerability pathways'],
        isModifying: true,
        plannedFiles: ['src/']
      });
      tasks.push(t2);

      const t3 = createTask({
        role: 'testing',
        title: 'Verify Security Boundary Protections',
        description: `Author negative and boundary tests verifying sanitization and denial of malicious inputs.`,
        dependencies: [t2.id],
        acceptanceCriteria: ['Assert unauthorized and malformed inputs are cleanly rejected'],
        isModifying: true,
        plannedFiles: ['tests/']
      });
      tasks.push(t3);
    }
    // Case D: Comprehensive Multi-Disciplinary Feature or Refactoring
    else {
      // Level 0: Architecture Spec
      const t1 = createTask({
        role: 'architect',
        title: 'Architectural Spec & Interface Contracts',
        description: `Decompose architecture, define interfaces, data contracts, and schema boundaries for: "${userGoal}".`,
        dependencies: [],
        acceptanceCriteria: ['Define clean module interfaces', 'Document integration contract specs'],
        isModifying: false
      });
      tasks.push(t1);

      // Level 1: Backend Implementation
      const tBackend = createTask({
        role: 'backend',
        title: 'Backend Logic & Service Implementation',
        description: `Implement core business logic, queries, and APIs satisfying interface contract for: "${userGoal}".`,
        dependencies: [t1.id],
        acceptanceCriteria: ['Implement service endpoints and logic', 'Handle boundary error cases'],
        isModifying: true,
        plannedFiles: ['src/main/']
      });
      tasks.push(tBackend);

      if (isUiFocused || !isTestingFocused) {
        // Evaluate collision risk between backend and frontend planned files
        // Backend touches src/main/, Frontend touches src/renderer/ -> Clean separation, can run in parallel!
        const tFrontend = createTask({
          role: 'frontend',
          title: 'Frontend UI Components & Interactivity',
          description: `Construct responsive UI components, user interactions, and state integration for: "${userGoal}".`,
          dependencies: [t1.id], // Runs in parallel with tBackend!
          acceptanceCriteria: ['Render responsive UI components', 'Connect client actions to state'],
          isModifying: true,
          plannedFiles: ['src/renderer/']
        });
        tasks.push(tFrontend);

        // Level 2: Verification (depends on both workers completing)
        const tTesting = createTask({
          role: 'testing',
          title: 'Comprehensive Test Suite Generation',
          description: `Author unit, integration, and edge-case test suites for newly built backend and frontend components.`,
          dependencies: [tBackend.id, tFrontend.id],
          acceptanceCriteria: ['Pass happy-path and boundary test assertions', 'Verify zero regressions'],
          isModifying: true,
          plannedFiles: ['tests/']
        });
        tasks.push(tTesting);
      } else {
        const tTesting = createTask({
          role: 'testing',
          title: 'Comprehensive Test Suite Generation',
          description: `Author unit and integration test suites for newly built components.`,
          dependencies: [tBackend.id],
          acceptanceCriteria: ['Pass happy-path and boundary test assertions'],
          isModifying: true,
          plannedFiles: ['tests/']
        });
        tasks.push(tTesting);
      }
    }

    // 4. Validate DAG integrity (no cycles, no missing links)
    const validation = DAGValidator.validate(tasks);
    if (!validation.valid) {
      throw new Error(`Coordinator generated invalid DAG: ${validation.errors.join('; ')}`);
    }

    // 5. Check if parallel execution is feasible without file collisions
    const parallelCandidates = tasks.filter((t, i) => {
      return tasks.some((other, j) => {
        if (i >= j) return false;
        // Both share same dependencies
        const sameDeps =
          t.dependencies.length === other.dependencies.length &&
          t.dependencies.every((d) => other.dependencies.includes(d));
        return sameDeps;
      });
    });

    const parallelExecutionFeasible = parallelCandidates.length > 0;

    // 6. Build Objectives and Risks
    const objectives: PlanObjective[] = tasks.map((t) => ({
      id: `obj-${t.id}`,
      title: t.title,
      description: t.description,
      acceptanceCriteria: t.acceptanceCriteria
    }));

    const risks: PlanRisk[] = [];
    if (analysis.riskLevel === 'high' || isSecurityFocused) {
      risks.push({
        severity: 'high',
        description: 'Security sensitive modifications or credential handling risk',
        mitigation: 'Mandatory security reviewer inspection and sanitization checks'
      });
    }
    if (tasks.filter((t) => t.isModifying).length > 1) {
      risks.push({
        severity: 'medium',
        description: 'Multi-agent branch divergence risk during parallel modification',
        mitigation: 'Isolated git worktrees and merge-tree pre-simulation before commit'
      });
    }

    // 7. Assemble AutonomousPlan
    const plan: AutonomousPlan = {
      orchestrationId,
      userGoal,
      intent: analysis.rationale || `Automated ${analysis.category} plan for user goal`,
      category: isBugFix ? 'bug_fix' : isSecurityFocused ? 'security' : isDocFocused ? 'documentation' : isUiFocused ? 'ui_ux' : analysis.category,
      complexity: analysis.complexity,
      riskLevel: isSecurityFocused ? 'high' : analysis.riskLevel,
      objectives,
      affectedModules: discoveredModules.length > 0 ? discoveredModules : ['core'],
      risks,
      verificationStrategy: {
        typecheckRequired: true,
        testsRequired: tasks.some((t) => t.isModifying),
        securityAuditRequired: isSecurityFocused || analysis.riskLevel === 'high',
        diffInspectionRequired: true
      },
      integrationStrategy: {
        mergeStrategy: 'worktree_squash',
        preMergeSimulation: true,
        requireApproval: mode !== 'autonomous'
      },
      tasks,
      parallelExecutionFeasible,
      createdAt: Date.now()
    };

    return { plan, tasks };
  }

  /**
   * Decomposes user natural language goal into a validated, dependency-ordered DAG of specialist tasks.
   * Backward-compatible helper that delegates to createPlan().
   */
  public static plan(options: PlanOptions): OrchestrationTask[] {
    return this.createPlan(options).tasks;
  }

  /**
   * Formulates a human-readable explanation of an autonomous plan.
   */
  public static explainPlan(plan: AutonomousPlan): string {
    const lines: string[] = [];
    lines.push(`### Autonomous Plan: ${plan.userGoal}`);
    lines.push(`- **Category:** ${plan.category} | **Complexity:** ${plan.complexity} | **Risk Level:** ${plan.riskLevel}`);
    lines.push(`- **Parallel Feasible:** ${plan.parallelExecutionFeasible ? 'Yes' : 'No (Sequential Pipeline)'}`);
    lines.push(`- **Total Subtasks:** ${plan.tasks.length}`);
    lines.push('');
    lines.push('#### Subtask Schedule:');
    for (const t of plan.tasks) {
      const deps = t.dependencies.length > 0 ? `(depends on: ${t.dependencies.join(', ')})` : '(root)';
      lines.push(`1. **[${t.role.toUpperCase()}]** ${t.title} ${deps}`);
      lines.push(`   - Modifying: ${t.isModifying ? 'Yes' : 'No'} | Provider: ${t.assignedProvider} (${t.assignedModel || 'default'})`);
    }
    if (plan.risks.length > 0) {
      lines.push('');
      lines.push('#### Identified Risks & Mitigations:');
      for (const r of plan.risks) {
        lines.push(`- [${r.severity.toUpperCase()}] ${r.description} → Mitigation: ${r.mitigation}`);
      }
    }
    return lines.join('\n');
  }
}
