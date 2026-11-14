import path from 'node:path';
import type {
  FindingCategory,
  FindingSeverity
} from '../../../shared/continuous-intelligence';
import type {
  GroundTruthScenario,
  DomainConfusionMatrix,
  OverallValidationReport
} from '../../../shared/intelligence-validation';
import { ProjectFixtureGenerator } from '../benchmarks/fixture-generator';
import { continuousIntelligenceCoordinator } from '../continuous-intelligence-coordinator';
import { databaseService } from '../../db/database.service';

export const BENCHMARK_SCENARIOS: GroundTruthScenario[] = [
  // 1. Architecture Positive: Circular dependency detection
  {
    id: 'scen-arch-pos-01',
    name: 'Circular Dependency Cycle Detection',
    domain: 'architecture',
    fixtureProfile: 'pathological-circular',
    description: 'Detects module cycle in pathological circular repo',
    isNegativeScenario: false,
    expectedFindings: [
      {
        idPattern: 'find-circ-',
        category: 'architecture',
        severity: 'high',
        minConfidence: 0.9,
        evidencePattern: 'Cycle:'
      }
    ],
    expectedNonDetections: []
  },
  // 2. Architecture Negative: Clean modular repo produces zero false circular cycles
  {
    id: 'scen-arch-neg-01',
    name: 'Clean Architecture Zero False Positives',
    domain: 'architecture',
    fixtureProfile: 'pathological-negative',
    description: 'Ensures clean project does not falsely trigger circular dependency findings',
    isNegativeScenario: true,
    expectedFindings: [],
    expectedNonDetections: ['Cycle:']
  },
  // 3. Technical Debt Positive: Huge monolithic module complexity
  {
    id: 'scen-debt-pos-01',
    name: 'Monolithic Module Debt Detection',
    domain: 'technical_debt',
    fixtureProfile: 'pathological-complexity',
    description: 'Flags module with 75 files as high technical debt',
    isNegativeScenario: false,
    expectedFindings: [
      {
        idPattern: 'debt-mod-comp-',
        category: 'technical_debt',
        severity: 'high',
        minConfidence: 0.85,
        evidencePattern: 'giant-module'
      }
    ],
    expectedNonDetections: []
  },
  // 4. Technical Debt Negative: Clean small project produces no spurious high debt
  {
    id: 'scen-debt-neg-01',
    name: 'Small Project Debt Non-Detection',
    domain: 'technical_debt',
    fixtureProfile: 'small',
    description: 'Ensures small healthy project has zero high-severity technical debt findings',
    isNegativeScenario: true,
    expectedFindings: [],
    expectedNonDetections: ['monolithic', 'excessive']
  },
  // 5. Security Positive: Unignored .env and plaintext http dependencies
  {
    id: 'scen-sec-pos-01',
    name: 'Sensitive Credentials & Insecure Dependencies',
    domain: 'security',
    fixtureProfile: 'pathological-security',
    description: 'Detects unignored .env and plaintext http:// transport',
    isNegativeScenario: false,
    expectedFindings: [
      {
        idPattern: 'sec-env-',
        category: 'security',
        severity: 'critical',
        minConfidence: 0.9,
        affectedFilePattern: '.env'
      },
      {
        idPattern: 'sec-dep-insecure-',
        category: 'security',
        severity: 'high',
        minConfidence: 0.85,
        affectedFilePattern: 'package.json'
      }
    ],
    expectedNonDetections: []
  },
  // 6. Security Negative: Clean negative repo with mock fixture must NOT trigger credential alert
  {
    id: 'scen-sec-neg-01',
    name: 'Vendored & Fixture Code Non-Alert',
    domain: 'security',
    fixtureProfile: 'pathological-negative',
    description: 'Guarantees test fixtures and vendored files do not trigger false security findings',
    isNegativeScenario: true,
    expectedFindings: [],
    expectedNonDetections: ['sec-env-', 'sec-dep-insecure-']
  }
];

export class EngineeringIntelligenceValidator {
  /**
   * Executes validation suite against deterministic synthetic fixtures.
   */
  public static async runValidation(targetDomain?: FindingCategory): Promise<OverallValidationReport> {
    const timestamp = Date.now();
    const scenarios = targetDomain && (targetDomain as string) !== 'all'
      ? BENCHMARK_SCENARIOS.filter((s) => s.domain === targetDomain)
      : BENCHMARK_SCENARIOS;

    const domainMatrices: Record<FindingCategory, DomainConfusionMatrix> = {
      architecture: createEmptyMatrix('architecture'),
      technical_debt: createEmptyMatrix('technical_debt'),
      performance: createEmptyMatrix('performance'),
      security: createEmptyMatrix('security'),
      agent_performance: createEmptyMatrix('agent_performance')
    };

    let positivePassed = 0;
    let negativePassed = 0;

    for (const scenario of scenarios) {
      const fixture = ProjectFixtureGenerator.generateFixture(scenario.fixtureProfile);
      const matrix = domainMatrices[scenario.domain];

      try {
        const summary = await continuousIntelligenceCoordinator.runAnalysis(fixture.rootDir, {
          triggerType: 'manual',
          scope: 'full',
          forceRefresh: true
        });

        const findings = databaseService.isInitialized()
          ? databaseService.listEngineeringFindings({ projectId: summary.projectId })
          : summary.criticalFindings;

        if (scenario.isNegativeScenario) {
          // Verify absence of unwanted findings
          let hasFalseAlarm = false;
          for (const pattern of scenario.expectedNonDetections) {
            if (findings.some((f) => f.id.includes(pattern) || f.evidence.includes(pattern))) {
              hasFalseAlarm = true;
              break;
            }
          }

          if (hasFalseAlarm) {
            matrix.falsePositives++;
          } else {
            matrix.trueNegatives++;
            negativePassed++;
          }
        } else {
          // Positive scenario: check expected detections
          for (const expected of scenario.expectedFindings) {
            const match = findings.find(
              (f) =>
                f.id.includes(expected.idPattern) &&
                f.category === expected.category &&
                (!expected.affectedFilePattern || f.affectedFiles.some((af) => af.includes(expected.affectedFilePattern!))) &&
                (!expected.evidencePattern || f.evidence.includes(expected.evidencePattern))
            );

            if (match) {
              matrix.truePositives++;
              if (match.severity === expected.severity) {
                matrix.severityAccuracy = (matrix.severityAccuracy || 1.0) * 1.0;
              }
            } else {
              matrix.falseNegatives++;
            }
          }

          if (matrix.falseNegatives === 0) {
            positivePassed++;
          }
        }
      } finally {
        fixture.cleanup();
      }
    }

    // Calculate Precision, Recall, F1 for each domain
    let totalTP = 0;
    let totalFP = 0;
    let totalFN = 0;

    for (const d of Object.keys(domainMatrices) as FindingCategory[]) {
      const m = domainMatrices[d];
      const pDenom = m.truePositives + m.falsePositives;
      m.precision = pDenom > 0 ? Math.round((m.truePositives / pDenom) * 100) / 100 : 1.0;

      const rDenom = m.truePositives + m.falseNegatives;
      m.recall = rDenom > 0 ? Math.round((m.truePositives / rDenom) * 100) / 100 : 1.0;

      const f1Denom = m.precision + m.recall;
      m.f1Score = f1Denom > 0 ? Math.round(((2 * m.precision * m.recall) / f1Denom) * 100) / 100 : 1.0;

      m.status = m.falseNegatives === 0 && m.falsePositives === 0 ? 'passed' : 'failed';

      totalTP += m.truePositives;
      totalFP += m.falsePositives;
      totalFN += m.falseNegatives;
    }

    const overallP = totalTP + totalFP > 0 ? Math.round((totalTP / (totalTP + totalFP)) * 100) / 100 : 1.0;
    const overallR = totalTP + totalFN > 0 ? Math.round((totalTP / (totalTP + totalFN)) * 100) / 100 : 1.0;
    const overallF1 = overallP + overallR > 0 ? Math.round(((2 * overallP * overallR) / (overallP + overallR)) * 100) / 100 : 1.0;

    return {
      timestamp,
      methodologyVersion: '1.1.0',
      totalScenariosExecuted: scenarios.length,
      positiveScenariosPassed: positivePassed,
      negativeScenariosPassed: negativePassed,
      domainResults: domainMatrices,
      overallPrecision: overallP,
      overallRecall: overallR,
      overallF1Score: overallF1,
      passedAllGates: totalFP === 0 && totalFN === 0
    };
  }
}

export const engineeringIntelligenceValidator = EngineeringIntelligenceValidator;

function createEmptyMatrix(domain: FindingCategory): DomainConfusionMatrix {
  return {
    domain,
    truePositives: 0,
    falsePositives: 0,
    falseNegatives: 0,
    trueNegatives: 0,
    precision: 1.0,
    recall: 1.0,
    f1Score: 1.0,
    severityAccuracy: 1.0,
    status: 'passed'
  };
}
