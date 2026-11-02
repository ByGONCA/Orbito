import crypto from 'node:crypto';
import type { OrchestrationTask, SpecialistRole } from '../../shared/agents';
import { SPECIALIST_ROLES } from './specialist-roles';
import { DAGValidator } from './dag-validator';

export interface PlanOptions {
  orchestrationId: string;
  userGoal: string;
  provider: 'claude' | 'codex' | 'gemini';
  model?: string;
}

export class CoordinatorAgent {
  /**
   * Decomposes user natural language goal into a validated, dependency-ordered DAG of specialist tasks.
   */
  public static plan(options: PlanOptions): OrchestrationTask[] {
    const { orchestrationId, userGoal, provider, model } = options;
    const lower = userGoal.toLowerCase();

    // 1. Analyze user intent to determine optimal specialist composition
    const isUiFocused = lower.includes('ui') || lower.includes('frontend') || lower.includes('component') || lower.includes('button') || lower.includes('page') || lower.includes('css');
    const isSecurityFocused = lower.includes('security') || lower.includes('vulnerability') || lower.includes('owasp') || lower.includes('auth');
    const isTestingFocused = lower.includes('test') || lower.includes('vitest') || lower.includes('jest') || lower.includes('coverage');
    const isDocFocused = lower.includes('doc') || lower.includes('readme') || lower.includes('jsdoc');
    const isBugFix = lower.includes('bug') || lower.includes('fix') || lower.includes('error') || lower.includes('crash');

    const tasks: OrchestrationTask[] = [];
    let taskCounter = 1;

    const createTask = (params: {
      role: SpecialistRole;
      title: string;
      description: string;
      dependencies: string[];
      acceptanceCriteria: string[];
      isModifying: boolean;
    }): OrchestrationTask => {
      const id = `task-${orchestrationId.replace('orch-', '')}-${taskCounter++}`;
      const specialist = SPECIALIST_ROLES[params.role];

      return {
        id,
        orchestrationId,
        title: params.title,
        description: params.description,
        acceptanceCriteria: params.acceptanceCriteria,
        role: params.role,
        assignedProvider: provider,
        assignedModel: model,
        dependencies: params.dependencies,
        requiredSkills: specialist.boundSkillIds,
        requiredPermissions: specialist.defaultPermissions,
        isModifying: params.isModifying,
        status: 'pending',
        retryCount: 0,
        maxRetries: 1,
        timeoutSeconds: 180,
        createdAt: Date.now(),
        changedFiles: []
      };
    };

    // Scenario A: Bug Investigation and Surgical Fix
    if (isBugFix) {
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
        isModifying: true
      });
      tasks.push(t2);

      const t3 = createTask({
        role: 'testing',
        title: 'Add Regression Test Suite',
        description: `Create targeted unit and regression test ensuring bug cannot recur.`,
        dependencies: [t2.id],
        acceptanceCriteria: ['Pass newly added regression tests with 100% assertions'],
        isModifying: true
      });
      tasks.push(t3);
    }
    // Scenario B: Security Review & Remediation
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
        isModifying: true
      });
      tasks.push(t2);
    }
    // Scenario C: Comprehensive Feature / Multi-Disciplinary Work
    else {
      // Step 1: Architecture & Interface Design (Level 0)
      const t1 = createTask({
        role: 'architect',
        title: 'Architectural Spec & Interface Contracts',
        description: `Decompose architecture, define interfaces, data contracts, and schema boundaries for: "${userGoal}".`,
        dependencies: [],
        acceptanceCriteria: ['Define clean module interfaces', 'Document integration contract specs'],
        isModifying: false
      });
      tasks.push(t1);

      // Step 2 & 3: Parallel Implementation (Level 1)
      const tBackend = createTask({
        role: 'backend',
        title: 'Backend Logic & Service Implementation',
        description: `Implement core business logic, queries, and APIs satisfying interface contract for: "${userGoal}".`,
        dependencies: [t1.id],
        acceptanceCriteria: ['Implement service endpoints and logic', 'Handle boundary error cases'],
        isModifying: true
      });
      tasks.push(tBackend);

      if (isUiFocused || !isTestingFocused) {
        const tFrontend = createTask({
          role: 'frontend',
          title: 'Frontend UI Components & Interactivity',
          description: `Construct responsive UI components, user interactions, and state integration for: "${userGoal}".`,
          dependencies: [t1.id],
          acceptanceCriteria: ['Render responsive UI components', 'Connect client actions to state'],
          isModifying: true
        });
        tasks.push(tFrontend);

        // Step 4: Verification & Automated Tests (Level 2 - depends on both parallel workers!)
        const tTesting = createTask({
          role: 'testing',
          title: 'Comprehensive Test Suite Generation',
          description: `Author unit, integration, and edge-case test suites for newly built backend and frontend components.`,
          dependencies: [tBackend.id, tFrontend.id],
          acceptanceCriteria: ['Pass happy-path and boundary test assertions', 'Verify zero regressions'],
          isModifying: true
        });
        tasks.push(tTesting);
      } else {
        const tTesting = createTask({
          role: 'testing',
          title: 'Comprehensive Test Suite Generation',
          description: `Author unit and integration test suites for newly built components.`,
          dependencies: [tBackend.id],
          acceptanceCriteria: ['Pass happy-path and boundary test assertions'],
          isModifying: true
        });
        tasks.push(tTesting);
      }
    }

    // 2. Validate DAG (reject cycles, self-dependencies, or missing links)
    const validation = DAGValidator.validate(tasks);
    if (!validation.valid) {
      throw new Error(`Coordinator generated invalid DAG: ${validation.errors.join('; ')}`);
    }

    return tasks;
  }
}
