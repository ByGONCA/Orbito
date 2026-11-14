import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import type {
  EngineeringFinding,
  FindingSeverity
} from '../../shared/continuous-intelligence';
import type { ProjectIntelligenceData } from '../../shared/project-intelligence';
import { SecretRedactor } from '../mcp/security/secret-redactor';
import { databaseService } from '../db/database.service';

export class SecurityIntelligenceService {
  /**
   * Evaluates security posture, credentials, permissions, and dependency manifests.
   */
  public analyzeSecurity(
    projectData: ProjectIntelligenceData
  ): EngineeringFinding[] {
    const findings: EngineeringFinding[] = [];
    const now = Date.now();
    const { projectId, projectPath } = projectData;

    // 1. Scan for uncommitted secrets or sensitive files (.env, credentials.json, id_rsa)
    const sensitiveFileNames = [
      '.env',
      '.env.local',
      '.env.production',
      'credentials.json',
      'id_rsa',
      'id_ed25519',
      'service-account.json'
    ];

    for (const name of sensitiveFileNames) {
      const fullPath = path.join(projectPath, name);
      if (fs.existsSync(fullPath)) {
        try {
          const stats = fs.statSync(fullPath);
          if (stats.isFile()) {
            // Check if gitignored
            const gitignorePath = path.join(projectPath, '.gitignore');
            let isIgnored = false;
            if (fs.existsSync(gitignorePath)) {
              const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
              if (gitignoreContent.includes(name) || gitignoreContent.includes('.env*')) {
                isIgnored = true;
              }
            }

            if (!isIgnored) {
              const redactedEvidence = SecretRedactor.redactText(`Detected unignored sensitive configuration file: ${name}`);
              findings.push({
                id: `sec-env-${projectId.slice(0, 8)}-${crypto.createHash('md5').update(name).digest('hex').slice(0, 6)}`,
                projectId,
                projectPath,
                detectionTimestamp: now,
                category: 'security',
                severity: 'critical',
                confidence: 0.95,
                affectedFiles: [name],
                evidence: redactedEvidence,
                explanation: `Sensitive environment/credential file '${name}' exists in the repository root but is NOT explicitly listed in .gitignore. This risks accidental credential exposure to remote repositories.`,
                suggestedRemediation: `Add '${name}' to .gitignore immediately and rotate any API keys or credentials contained within.`,
                relatedHistoricalFindingIds: [],
                status: 'new',
                effortCategory: 'trivial',
                technicalDebtScore: 9.5,
                updatedAt: now
              });
            }
          }
        } catch {}
      }
    }

    // 2. Check for known insecure or vulnerable dependency patterns in package.json
    const pkgJsonPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      try {
        const raw = fs.readFileSync(pkgJsonPath, 'utf-8');
        const pkg = JSON.parse(raw);
        const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

        for (const [depName, version] of Object.entries(allDeps)) {
          // Check for http:// or git:// plaintext links
          if (typeof version === 'string' && (version.startsWith('http://') || version.startsWith('git://'))) {
            const redactedVersion = SecretRedactor.redactText(version);
            findings.push({
              id: `sec-dep-insecure-${projectId.slice(0, 8)}-${crypto.createHash('md5').update(depName).digest('hex').slice(0, 6)}`,
              projectId,
              projectPath,
              detectionTimestamp: now,
              category: 'security',
              severity: 'high',
              confidence: 0.9,
              affectedFiles: ['package.json'],
              evidence: `Insecure dependency protocol: "${depName}": "${redactedVersion}"`,
              explanation: `Dependency '${depName}' is fetched over an unencrypted transport protocol (${redactedVersion.slice(0, 7)}), vulnerable to man-in-the-middle attacks.`,
              suggestedRemediation: 'Switch the dependency reference to HTTPS or official registry versioning.',
              relatedHistoricalFindingIds: [],
              status: 'new',
              effortCategory: 'trivial',
              technicalDebtScore: 8.0,
              updatedAt: now
            });
          }
        }
      } catch {}
    }

    // 3. Check MCP Audit Logs for repeated permission or tool execution failures
    try {
      const logs = databaseService.listMCPAuditLogs ? databaseService.listMCPAuditLogs(undefined, 100) : [];
      let failureCount = 0;
      for (const log of logs) {
        if (log.status === 'error' || log.status === 'denied') {
          failureCount++;
        }
      }

      if (failureCount >= 5) {
        findings.push({
          id: `sec-mcp-denied-${projectId.slice(0, 8)}`,
          projectId,
          projectPath,
          detectionTimestamp: now,
          category: 'security',
          severity: 'medium',
          confidence: 0.85,
          affectedFiles: [projectPath],
          evidence: `Detected ${failureCount} failed or denied MCP tool invocations in recent audit log entries.`,
          explanation: 'Frequent tool execution denials or failures indicate potential privilege boundary mismatches or unauthorized tool usage attempts.',
          suggestedRemediation: 'Review MCP server permissions and agent authorization policies in settings.',
          relatedHistoricalFindingIds: [],
          status: 'new',
          effortCategory: 'small',
          technicalDebtScore: 6.0,
          updatedAt: now
        });
      }
    } catch {}

    return findings;
  }
}

export const securityIntelligenceService = new SecurityIntelligenceService();
