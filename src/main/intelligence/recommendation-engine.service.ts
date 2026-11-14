import crypto from 'node:crypto';
import type {
  EngineeringFinding,
  EngineeringRecommendation,
  RecommendationPriority,
  RemediationEffortCategory
} from '../../shared/continuous-intelligence';

export class RecommendationEngineService {
  /**
   * Synthesizes actionable recommendations from correlated findings.
   */
  public generateRecommendations(
    projectId: string,
    projectPath: string,
    findings: EngineeringFinding[]
  ): EngineeringRecommendation[] {
    const recommendations: EngineeringRecommendation[] = [];
    const now = Date.now();

    // Filter to active/unresolved and non-dismissed findings
    const activeFindings = findings.filter(
      (f) => f.status !== 'resolved' && f.status !== 'false_positive' && !f.userDismissed
    );

    // Group findings by category
    const byCategory = new Map<string, EngineeringFinding[]>();
    for (const f of activeFindings) {
      if (!byCategory.has(f.category)) {
        byCategory.set(f.category, []);
      }
      byCategory.get(f.category)!.push(f);
    }

    // 1. Security Recommendations (Highest Priority)
    const secFindings = byCategory.get('security') || [];
    for (const sf of secFindings) {
      const recId = `rec-sec-${projectId.slice(0, 8)}-${crypto.createHash('md5').update(sf.id).digest('hex').slice(0, 6)}`;
      recommendations.push({
        id: recId,
        projectId,
        projectPath,
        title: sf.severity === 'critical' ? 'Urgent: Remediate Exposed Sensitive Credentials' : 'Fix Security Vulnerability',
        problem: sf.explanation,
        supportingEvidence: sf.evidence,
        expectedImpact: 'Prevents unauthorized secret exposure, credential leakage, or insecure network transit.',
        confidence: sf.confidence,
        estimatedEffort: sf.effortCategory || 'trivial',
        priority: sf.severity === 'critical' ? 'critical' : 'high',
        category: 'security',
        relatedFindingIds: [sf.id],
        suggestedNextAction: sf.suggestedRemediation,
        taskGoalPrompt: `Review and remediate security finding: ${sf.explanation}. Follow suggested action: ${sf.suggestedRemediation}. Verify that no secrets remain unredacted or unignored.`,
        status: 'active',
        createdAt: now,
        updatedAt: now
      });
    }

    // 2. Circular Dependencies Recommendations
    const circFindings = (byCategory.get('architecture') || []).filter((f) => f.evidence.includes('Cycle:'));
    if (circFindings.length > 0) {
      const cycleEvidences = circFindings.map((f) => f.evidence).join(' | ');
      const relatedIds = circFindings.map((f) => f.id);
      const recId = `rec-arch-circ-${projectId.slice(0, 8)}`;
      recommendations.push({
        id: recId,
        projectId,
        projectPath,
        title: 'Break Circular Module Dependencies',
        problem: `Detected ${circFindings.length} circular dependency cycle(s) in codebase architecture.`,
        supportingEvidence: cycleEvidences,
        expectedImpact: 'Improves bundle modularity, prevents cyclic import runtime undefined references, and stabilizes dependency tree.',
        confidence: 0.95,
        estimatedEffort: circFindings.length > 2 ? 'medium' : 'small',
        priority: 'high',
        category: 'architecture',
        relatedFindingIds: relatedIds,
        suggestedNextAction: 'Extract shared types, schemas, or leaf contracts to a designated shared leaf directory.',
        taskGoalPrompt: `Refactor modules to eliminate the following circular dependency cycles: ${cycleEvidences}. Move shared interfaces or constants to a dedicated shared leaf module.`,
        status: 'active',
        createdAt: now,
        updatedAt: now
      });
    }

    // 3. Technical Debt Prioritized Recommendations
    const debtFindings = (byCategory.get('technical_debt') || []).filter(
      (f) => (f.technicalDebtScore || 0) >= 6.5
    );
    for (const df of debtFindings.slice(0, 3)) {
      const recId = `rec-debt-${projectId.slice(0, 8)}-${crypto.createHash('md5').update(df.id).digest('hex').slice(0, 6)}`;
      recommendations.push({
        id: recId,
        projectId,
        projectPath,
        title: `Remediate High-Priority Debt: ${df.evidence.slice(0, 50)}`,
        problem: df.explanation,
        supportingEvidence: df.evidence,
        expectedImpact: 'Reduces technical debt, enhances maintainability, and decreases regression probability during agent iterations.',
        confidence: df.confidence,
        estimatedEffort: df.effortCategory || 'medium',
        priority: (df.technicalDebtScore || 0) > 8.0 ? 'high' : 'medium',
        category: 'technical_debt',
        relatedFindingIds: [df.id],
        suggestedNextAction: df.suggestedRemediation,
        taskGoalPrompt: `Remediate high-priority technical debt item: ${df.explanation}. Suggested plan: ${df.suggestedRemediation}.`,
        status: 'active',
        createdAt: now,
        updatedAt: now
      });
    }

    // 4. Performance Recommendations
    const perfFindings = byCategory.get('performance') || [];
    for (const pf of perfFindings) {
      const recId = `rec-perf-${projectId.slice(0, 8)}-${crypto.createHash('md5').update(pf.id).digest('hex').slice(0, 6)}`;
      recommendations.push({
        id: recId,
        projectId,
        projectPath,
        title: 'Optimize Workflow & Execution Performance',
        problem: pf.explanation,
        supportingEvidence: pf.evidence,
        expectedImpact: 'Lowers resource consumption, reduces execution latencies, and avoids memory pressure.',
        confidence: pf.confidence,
        estimatedEffort: pf.effortCategory || 'small',
        priority: pf.severity === 'high' ? 'high' : 'medium',
        category: 'performance',
        relatedFindingIds: [pf.id],
        suggestedNextAction: pf.suggestedRemediation,
        taskGoalPrompt: `Investigate and resolve performance bottleneck: ${pf.explanation}. Remediation: ${pf.suggestedRemediation}.`,
        status: 'active',
        createdAt: now,
        updatedAt: now
      });
    }

    // 5. Agent Performance Recommendations
    const agentFindings = byCategory.get('agent_performance') || [];
    for (const af of agentFindings) {
      const recId = `rec-agent-${projectId.slice(0, 8)}-${crypto.createHash('md5').update(af.id).digest('hex').slice(0, 6)}`;
      recommendations.push({
        id: recId,
        projectId,
        projectPath,
        title: 'Tune Agent Role Configuration and Fallback Models',
        problem: af.explanation,
        supportingEvidence: af.evidence,
        expectedImpact: 'Reduces retry waste, increases task verification success rate, and lowers operational token costs.',
        confidence: af.confidence,
        estimatedEffort: 'small',
        priority: 'high',
        category: 'agent_performance',
        relatedFindingIds: [af.id],
        suggestedNextAction: af.suggestedRemediation,
        taskGoalPrompt: `Update agent orchestration settings for role. Problem: ${af.explanation}. Suggested next action: ${af.suggestedRemediation}.`,
        status: 'active',
        createdAt: now,
        updatedAt: now
      });
    }

    return recommendations;
  }
}

export const recommendationEngineService = new RecommendationEngineService();
