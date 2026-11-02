import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { ReviewerAgent } from '../src/main/agents/reviewer-agent';
import type { OrchestrationTask } from '../src/shared/agents';

const TEST_DIR = path.join(process.cwd(), '.test-reviewer-workspace');

describe('Reviewer Agent (Quality Gates, Independent Audit & Remediation Trigger)', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('rejects modifying task when zero files were changed and no result summary provided', async () => {
    const task: OrchestrationTask = {
      id: 'task-rev-1',
      orchestrationId: 'orch-rev',
      title: 'Modify Database Schema',
      description: 'Add column to user table',
      acceptanceCriteria: ['Must create migration file'],
      role: 'backend',
      assignedProvider: 'claude',
      dependencies: [],
      requiredSkills: [],
      requiredPermissions: { filesystem: { read: true, write: true }, terminal: { execute: false }, network: { allowed: false } },
      isModifying: true,
      status: 'reviewing',
      retryCount: 0,
      maxRetries: 1,
      timeoutSeconds: 30,
      createdAt: Date.now(),
      changedFiles: [] // Empty!
    };

    const review = await ReviewerAgent.reviewTask(task, TEST_DIR);
    expect(review.passed).toBe(false);
    expect(review.needsRemediation).toBe(true);
    expect(review.feedback).toContain('zero files were modified');
  });

  it('approves task when clean changes exist', async () => {
    const task: OrchestrationTask = {
      id: 'task-rev-2',
      orchestrationId: 'orch-rev',
      title: 'Add Readme',
      description: 'Add README.md documentation',
      acceptanceCriteria: ['Create markdown documentation'],
      role: 'documentation',
      assignedProvider: 'claude',
      dependencies: [],
      requiredSkills: [],
      requiredPermissions: { filesystem: { read: true, write: true }, terminal: { execute: false }, network: { allowed: false } },
      isModifying: true,
      status: 'reviewing',
      retryCount: 0,
      maxRetries: 1,
      timeoutSeconds: 30,
      createdAt: Date.now(),
      changedFiles: ['README.md'],
      resultSummary: 'Created README.md'
    };

    const review = await ReviewerAgent.reviewTask(task, TEST_DIR);
    expect(review.passed).toBe(true);
    expect(review.needsRemediation).toBe(false);
    expect(review.feedback).toContain('Review passed');
  });

  it('prevents self-reviewing by automatically verifying reviewer role metadata', async () => {
    const reviewerTask: OrchestrationTask = {
      id: 'task-rev-self',
      orchestrationId: 'orch-rev',
      title: 'Review Audit',
      description: 'Audit tasks',
      acceptanceCriteria: [],
      role: 'reviewer', // Reviewer role!
      assignedProvider: 'claude',
      dependencies: [],
      requiredSkills: [],
      requiredPermissions: { filesystem: { read: true, write: false }, terminal: { execute: false }, network: { allowed: false } },
      isModifying: false,
      status: 'reviewing',
      retryCount: 0,
      maxRetries: 0,
      timeoutSeconds: 30,
      createdAt: Date.now(),
      changedFiles: []
    };

    const review = await ReviewerAgent.reviewTask(reviewerTask, TEST_DIR);
    expect(review.passed).toBe(true);
    expect(review.feedback).toContain('Reviewer metadata task automatically verified');
  });
});
