import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import type {
  EngineeringFinding,
  BaselineComparison
} from '../../shared/continuous-intelligence';
import type { ProjectIntelligenceData } from '../../shared/project-intelligence';
import { databaseService } from '../db/database.service';

export class ContinuousCodeIntelligenceService {
  /**
   * Analyzes project structure, architecture, and code changes against baseline.
   */
  public analyzeCodeIntelligence(
    projectData: ProjectIntelligenceData,
    previousBaseline?: any
  ): { findings: EngineeringFinding[]; baselineData: any } {
    const findings: EngineeringFinding[] = [];
    const now = Date.now();
    const { projectId, projectPath, architecture, techStack, git } = projectData;

    // Current baseline snapshot components
    const currentModules = architecture.modules || [];
    const currentModuleNames = currentModules.map((m) => m.name);
    const circularCycles = architecture.circularDependencies || [];

    // Current baseline data object
    const currentBaselineData = {
      modules: currentModuleNames,
      moduleCount: currentModules.length,
      circularCount: circularCycles.length,
      entryPoints: (architecture.entryPoints || []).map((e) => e.path),
      dependencies: {
        frameworks: techStack.frameworks || [],
        libraries: techStack.libraries || [],
        buildSystems: techStack.buildSystems || []
      },
      headCommit: git.headCommit,
      timestamp: now
    };

    // 1. Circular Dependencies Analysis
    if (circularCycles.length > 0) {
      for (let i = 0; i < circularCycles.length; i++) {
        const cycle = circularCycles[i];
        const cycleStr = cycle.cycle.join(' -> ');
        const isNew = previousBaseline
          ? !previousBaseline.circularCount || previousBaseline.circularCount < circularCycles.length
          : false;

        const baselineComp: BaselineComparison | undefined = previousBaseline
          ? {
              metricKey: 'circular_dependencies_count',
              previousValue: previousBaseline.circularCount || 0,
              currentValue: circularCycles.length,
              diffSummary: isNew ? 'Newly introduced dependency cycle detected' : 'Existing cycle remains'
            }
          : undefined;

        findings.push({
          id: `find-circ-${projectId.slice(0, 8)}-${crypto.createHash('md5').update(cycleStr).digest('hex').slice(0, 8)}`,
          projectId,
          projectPath,
          detectionTimestamp: now,
          category: 'architecture',
          severity: isNew ? 'high' : 'medium',
          confidence: 0.95,
          affectedFiles: cycle.cycle,
          evidence: `Cycle: ${cycleStr}`,
          explanation: isNew
            ? `A new circular dependency was introduced between modules (${cycleStr}). Circular dependencies degrade modularity, cause fragile runtime initialization, and impede tree-shaking.`
            : `Persistent circular dependency cycle between modules (${cycleStr}).`,
          baselineComparison: baselineComp,
          suggestedRemediation: 'Extract shared contracts, interfaces, or utility types into a leaf shared module to break the cycle.',
          relatedHistoricalFindingIds: [],
          status: 'new',
          effortCategory: 'small',
          technicalDebtScore: 7.5,
          updatedAt: now
        });
      }
    }

    // 2. Module Boundary & Complexity Analysis
    for (const mod of currentModules) {
      // Large/complex modules
      if (mod.fileCount > 30) {
        findings.push({
          id: `find-comp-${projectId.slice(0, 8)}-${crypto.createHash('md5').update(mod.name).digest('hex').slice(0, 8)}`,
          projectId,
          projectPath,
          detectionTimestamp: now,
          category: 'architecture',
          severity: mod.fileCount > 60 ? 'high' : 'medium',
          confidence: 0.9,
          affectedFiles: [mod.path || mod.name],
          evidence: `Module '${mod.name}' contains ${mod.fileCount} files.`,
          explanation: `Module '${mod.name}' has grown excessively large (${mod.fileCount} files). Overly complex modules lead to high coupling and cognitive load.`,
          suggestedRemediation: `Decompose '${mod.name}' into cohesive sub-domains or smaller feature services.`,
          relatedHistoricalFindingIds: [],
          status: 'new',
          effortCategory: mod.fileCount > 60 ? 'large' : 'medium',
          technicalDebtScore: mod.fileCount > 60 ? 8.0 : 6.0,
          updatedAt: now
        });
      }

      // High coupling (depended on by many and depends on many)
      const depCount = (mod.dependencies || []).length;
      const dependedOnCount = (mod.dependedOnBy || []).length;
      if (depCount > 8 && dependedOnCount > 8) {
        findings.push({
          id: `find-coup-${projectId.slice(0, 8)}-${crypto.createHash('md5').update(mod.name).digest('hex').slice(0, 8)}`,
          projectId,
          projectPath,
          detectionTimestamp: now,
          category: 'architecture',
          severity: 'medium',
          confidence: 0.85,
          affectedFiles: [mod.path || mod.name],
          evidence: `Module '${mod.name}' depends on ${depCount} modules and is depended on by ${dependedOnCount} modules.`,
          explanation: `Excessive bidirectional coupling detected in module '${mod.name}'. High in-degree and out-degree dependencies create a structural bottleneck.`,
          suggestedRemediation: `Introduce an explicit API boundary or facade interface to isolate '${mod.name}'.`,
          relatedHistoricalFindingIds: [],
          status: 'new',
          effortCategory: 'medium',
          technicalDebtScore: 6.8,
          updatedAt: now
        });
      }
    }

    // 3. Baseline Diff Comparisons
    if (previousBaseline) {
      const prevMods: string[] = previousBaseline.modules || [];
      const removedMods = prevMods.filter((m) => !currentModuleNames.includes(m));
      const addedMods = currentModuleNames.filter((m) => !prevMods.includes(m));

      if (removedMods.length > 0) {
        findings.push({
          id: `find-modrem-${projectId.slice(0, 8)}-${now.toString(36)}`,
          projectId,
          projectPath,
          detectionTimestamp: now,
          category: 'architecture',
          severity: 'info',
          confidence: 0.9,
          affectedFiles: removedMods,
          evidence: `Removed modules: ${removedMods.join(', ')}`,
          explanation: `Architectural changes detected: ${removedMods.length} module(s) were removed from the project baseline.`,
          baselineComparison: {
            metricKey: 'modules_removed',
            previousValue: prevMods.length,
            currentValue: currentModuleNames.length,
            diffSummary: `Removed: ${removedMods.join(', ')}`
          },
          suggestedRemediation: 'Verify that all legacy references or imports to removed modules have been completely cleaned up.',
          relatedHistoricalFindingIds: [],
          status: 'new',
          effortCategory: 'trivial',
          updatedAt: now
        });
      }

      if (addedMods.length > 0) {
        findings.push({
          id: `find-modadd-${projectId.slice(0, 8)}-${now.toString(36)}`,
          projectId,
          projectPath,
          detectionTimestamp: now,
          category: 'architecture',
          severity: 'info',
          confidence: 0.9,
          affectedFiles: addedMods,
          evidence: `Added modules: ${addedMods.join(', ')}`,
          explanation: `Architectural expansion detected: ${addedMods.length} new module(s) registered in project baseline.`,
          baselineComparison: {
            metricKey: 'modules_added',
            previousValue: prevMods.length,
            currentValue: currentModuleNames.length,
            diffSummary: `Added: ${addedMods.join(', ')}`
          },
          suggestedRemediation: 'Ensure new modules follow established repository organization and architectural layer conventions.',
          relatedHistoricalFindingIds: [],
          status: 'new',
          effortCategory: 'trivial',
          updatedAt: now
        });
      }
    }

    // 4. Critical Entry Points & Missing Testing
    if (!architecture.entryPoints || architecture.entryPoints.length === 0) {
      findings.push({
        id: `find-noentry-${projectId.slice(0, 8)}`,
        projectId,
        projectPath,
        detectionTimestamp: now,
        category: 'architecture',
        severity: 'medium',
        confidence: 0.8,
        affectedFiles: [projectPath],
        evidence: 'No explicit standard entry points detected.',
        explanation: 'The project does not specify explicit application entry points (e.g. index.ts, main.ts, or main in package.json).',
        suggestedRemediation: 'Define clear top-level entry points to improve readability and dependency graph resolution.',
        relatedHistoricalFindingIds: [],
        status: 'new',
        effortCategory: 'trivial',
        technicalDebtScore: 4.0,
        updatedAt: now
      });
    }

    // 5. Unstable / High-Churn Hotspot Files (from git intelligence)
    if (git.hotspotFiles && git.hotspotFiles.length > 0) {
      for (const hotspot of git.hotspotFiles) {
        if (hotspot.changesCount >= 4) {
          findings.push({
            id: `find-churn-${projectId.slice(0, 8)}-${crypto.createHash('md5').update(hotspot.path).digest('hex').slice(0, 8)}`,
            projectId,
            projectPath,
            detectionTimestamp: now,
            category: 'architecture',
            severity: 'medium',
            confidence: 0.85,
            affectedFiles: [hotspot.path],
            evidence: `File '${hotspot.path}' has accumulated ${hotspot.changesCount} recent changes.`,
            explanation: `High churn detected on file '${hotspot.path}'. Rapidly changing files frequently indicate conflicting responsibilities or volatile design boundaries.`,
            suggestedRemediation: 'Consider refactoring this file into smaller, single-responsibility units or stabilizing its public contract.',
            relatedHistoricalFindingIds: [],
            status: 'new',
            effortCategory: 'small',
            technicalDebtScore: 5.5,
            updatedAt: now
          });
        }
      }
    }

    return { findings, baselineData: currentBaselineData };
  }
}

export const continuousCodeIntelligenceService = new ContinuousCodeIntelligenceService();
