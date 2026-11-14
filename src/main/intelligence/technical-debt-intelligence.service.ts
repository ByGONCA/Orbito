import crypto from 'node:crypto';
import type {
  EngineeringFinding,
  RemediationEffortCategory,
  FindingSeverity
} from '../../shared/continuous-intelligence';
import type { ProjectIntelligenceData } from '../../shared/project-intelligence';

export interface DebtPrioritizationFactors {
  technicalImpact: number; // 1-10
  securityImplications: number; // 1-10
  maintainabilityImpact: number; // 1-10
  changeFrequency: number; // 1-10
  failureHistory: number; // 1-10
  dependencyCentrality: number; // 1-10
  confidence: number; // 0.0 - 1.0
  effort: RemediationEffortCategory;
}

export class TechnicalDebtIntelligenceService {
  /**
   * Computes an explainable technical debt priority score (1.0 - 100.0) — Methodology v1.1.0.
   * Enforces severity floors for critical findings so that high remediation effort or
   * imperfect confidence never suppresses critical security or structural vulnerabilities.
   */
  public calculateDebtPriorityScore(factors: DebtPrioritizationFactors): number {
    // 1. Severity & Risk Floor (Methodology v1.1.0 Invariant):
    // Critical security risks or catastrophic technical defects enforce an absolute floor.
    let severityFloor = 1.0;
    if (factors.securityImplications >= 9) {
      severityFloor = 80.0;
    } else if (factors.technicalImpact >= 9) {
      severityFloor = 75.0;
    } else if (factors.securityImplications >= 7 || factors.technicalImpact >= 7) {
      severityFloor = 55.0;
    }

    // 2. Base weighted risk (max 100):
    // Security (25%) + Technical Impact (20%) + Failure History (15%) +
    // Maintainability (15%) + Change Frequency (15%) + Centrality (10%)
    const rawWeighted =
      factors.securityImplications * 2.5 +
      factors.technicalImpact * 2.0 +
      factors.failureHistory * 1.5 +
      factors.maintainabilityImpact * 1.5 +
      factors.changeFrequency * 1.5 +
      factors.dependencyCentrality * 1.0;

    // 3. Effort ROI Adjustment (Additive bonus/penalty for planning, not dampening multipliers):
    // Trivial/small items receive a quick-win boost (+8/+4), epic tasks face planning discount (-6).
    let effortBonus = 0.0;
    switch (factors.effort) {
      case 'trivial':
        effortBonus = 8.0;
        break;
      case 'small':
        effortBonus = 4.0;
        break;
      case 'medium':
        effortBonus = 0.0;
        break;
      case 'large':
        effortBonus = -3.0;
        break;
      case 'epic':
        effortBonus = -6.0;
        break;
    }

    // 4. Confidence scaling (bounded to prevent total suppression on exploratory data)
    const confidenceMultiplier = Math.max(0.7, Math.min(1.0, factors.confidence));
    const calculatedScore = (rawWeighted + effortBonus) * confidenceMultiplier;

    // Enforce floor and bounds [1.0, 100.0]
    const finalScore = Math.max(severityFloor, Math.min(100.0, calculatedScore));

    return Math.round(finalScore * 10) / 10;
  }

  /**
   * Analyzes project intelligence data and existing findings to detect and prioritize technical debt.
   */
  public analyzeTechnicalDebt(
    projectData: ProjectIntelligenceData,
    existingFindings: EngineeringFinding[] = []
  ): EngineeringFinding[] {
    const findings: EngineeringFinding[] = [];
    const now = Date.now();
    const { projectId, projectPath, architecture, techStack, health } = projectData;

    // 1. Missing Automated Tests on Core Tech
    if (techStack.testFrameworks.length === 0) {
      const testDebtId = `debt-test-suite-${projectId.slice(0, 8)}`;
      const existingTest = existingFindings.find((e) => e.id === testDebtId);

      const score = this.calculateDebtPriorityScore({
        technicalImpact: 8,
        securityImplications: 6,
        maintainabilityImpact: 9,
        changeFrequency: 8,
        failureHistory: 7,
        dependencyCentrality: 8,
        confidence: 0.95,
        effort: 'medium'
      });

      findings.push({
        id: testDebtId,
        projectId,
        projectPath,
        detectionTimestamp: now,
        category: 'technical_debt',
        severity: 'high',
        confidence: 0.95,
        affectedFiles: [projectPath],
        evidence: 'Zero automated test frameworks detected in manifests or dependencies.',
        explanation: 'The project lacks an automated test framework. Unverified code changes significantly increase regression risks during autonomous refactoring and deployment.',
        suggestedRemediation: 'Install and configure a modern test runner (e.g. Vitest) and create initial smoke tests.',
        relatedHistoricalFindingIds: [],
        status: existingTest ? existingTest.status : 'new',
        effortCategory: 'medium',
        technicalDebtScore: score,
        updatedAt: now
      });
    }

    // 2. High Complexity Modules as Debt
    for (const mod of architecture.modules || []) {
      if (mod.fileCount > 25) {
        const effort: RemediationEffortCategory = mod.fileCount > 50 ? 'large' : 'medium';
        const compId = `debt-mod-comp-${projectId.slice(0, 8)}-${crypto.createHash('md5').update(mod.name).digest('hex').slice(0, 8)}`;
        const existingComp = existingFindings.find((e) => e.id === compId);

        const score = this.calculateDebtPriorityScore({
          technicalImpact: mod.fileCount > 50 ? 9 : 6,
          securityImplications: mod.fileCount > 50 ? 5 : 3,
          maintainabilityImpact: mod.fileCount > 50 ? 9 : 7,
          changeFrequency: 7,
          failureHistory: 6,
          dependencyCentrality: 8,
          confidence: 0.95,
          effort
        });

        findings.push({
          id: compId,
          projectId,
          projectPath,
          detectionTimestamp: now,
          category: 'technical_debt',
          severity: mod.fileCount > 50 ? 'high' : 'medium',
          confidence: 0.9,
          affectedFiles: [mod.path || mod.name],
          evidence: `Module '${mod.name}' has ${mod.fileCount} files.`,
          explanation: `Architectural debt: excessive accumulation of files in module '${mod.name}'. High module complexity slows feature development and increases bug density.`,
          suggestedRemediation: `Refactor '${mod.name}' by extracting discrete sub-modules or services.`,
          relatedHistoricalFindingIds: [],
          status: existingComp ? existingComp.status : 'new',
          effortCategory: effort,
          technicalDebtScore: score,
          updatedAt: now
        });
      }
    }

    // 3. Health Finding Conversion & Deduplication
    for (const hf of health.findings || []) {
      if (hf.category === 'architecture' || hf.category === 'dependencies' || hf.category === 'testing') {
        const hash = crypto.createHash('md5').update(`${hf.title}:${hf.evidence}`).digest('hex').slice(0, 8);
        const debtId = `debt-hf-${projectId.slice(0, 8)}-${hash}`;

        // Check if already in existingFindings to preserve status
        const existing = existingFindings.find((e) => e.id === debtId);
        if (existing && (existing.status === 'accepted' || existing.status === 'deferred')) {
          findings.push({
            ...existing,
            updatedAt: now
          });
          continue;
        }

        let severity: FindingSeverity = 'medium';
        if (hf.severity === 'critical') severity = 'high';
        else if (hf.severity === 'info') severity = 'info';

        const score = this.calculateDebtPriorityScore({
          technicalImpact: severity === 'high' ? 8 : 5,
          securityImplications: 4,
          maintainabilityImpact: 7,
          changeFrequency: 5,
          failureHistory: 4,
          dependencyCentrality: 6,
          confidence: 0.85,
          effort: 'small'
        });

        findings.push({
          id: debtId,
          projectId,
          projectPath,
          detectionTimestamp: now,
          category: 'technical_debt',
          severity,
          confidence: 0.85,
          affectedFiles: [projectPath],
          evidence: hf.evidence || hf.message,
          explanation: hf.message,
          suggestedRemediation: hf.remediation || 'Address root cause identified in health audit.',
          relatedHistoricalFindingIds: [],
          status: existing ? existing.status : 'new',
          effortCategory: 'small',
          technicalDebtScore: score,
          updatedAt: now
        });
      }
    }

    // Sort findings descending by debt priority score
    return findings.sort((a, b) => (b.technicalDebtScore || 0) - (a.technicalDebtScore || 0));
  }
}

export const technicalDebtIntelligenceService = new TechnicalDebtIntelligenceService();
