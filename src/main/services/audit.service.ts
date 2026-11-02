import type { AuditLogEntry, AuditLogFilter, AuditSeverity } from '../../shared/analytics';
import { databaseService } from '../db/database.service';

export class AuditService {
  /**
   * Log an audit event to SQLite.
   */
  public log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): AuditLogEntry {
    if (!databaseService.isInitialized()) {
      return {
        id: entry.id || `fallback_${Date.now()}`,
        timestamp: entry.timestamp || Date.now(),
        eventType: entry.eventType,
        severity: entry.severity,
        actor: entry.actor,
        action: entry.action,
        target: entry.target,
        details: entry.details || {},
        projectPath: entry.projectPath
      };
    }
    try {
      return databaseService.insertAuditLog(entry);
    } catch {
      return {
        id: entry.id || `fallback_${Date.now()}`,
        timestamp: entry.timestamp || Date.now(),
        eventType: entry.eventType,
        severity: entry.severity,
        actor: entry.actor,
        action: entry.action,
        target: entry.target,
        details: entry.details || {},
        projectPath: entry.projectPath
      };
    }
  }

  /**
   * Specifically logs a security violation with 'critical' or 'error' severity.
   */
  public logSecurityViolation(
    actor: string,
    action: string,
    error: string,
    target?: string,
    projectPath?: string,
    details: Record<string, unknown> = {}
  ): AuditLogEntry {
    return this.log({
      eventType: 'security_violation',
      severity: 'critical',
      actor,
      action,
      target,
      projectPath,
      details: {
        error,
        ...details
      }
    });
  }

  /**
   * Logs an authorized access or file/command operation.
   */
  public logAccess(
    actor: string,
    action: string,
    target?: string,
    projectPath?: string,
    severity: AuditSeverity = 'info',
    details: Record<string, unknown> = {}
  ): AuditLogEntry {
    return this.log({
      eventType: 'system_access',
      severity,
      actor,
      action,
      target,
      projectPath,
      details
    });
  }

  /**
   * Query filtered audit logs.
   */
  public query(filter?: AuditLogFilter): AuditLogEntry[] {
    return databaseService.queryAuditLogs(filter);
  }

  /**
   * Export audit log report as JSON or CSV.
   */
  public export(format: 'json' | 'csv'): string {
    return databaseService.exportAuditLogs(format);
  }

  /**
   * Clear local audit logs.
   */
  public clear(): void {
    if (databaseService.isInitialized()) {
      databaseService.clearAuditLogs();
    }
  }
}

export const auditService = new AuditService();
