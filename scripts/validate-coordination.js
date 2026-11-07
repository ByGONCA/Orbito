/**
 * Orbito Central Multi-Agent Coordination Validator — Hardened Architecture
 * Validates registry integrity, worktree bindings, domain ownership,
 * shared-file protection policies, task specifications, and git safety invariants.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
console.log('--- Validating Orbito Multi-Agent Coordination System (Hardened) ---\n');

let errorCount = 0;
let warningCount = 0;

function reportPass(msg) {
  console.log(`  ✅ ${msg}`);
}

function reportWarn(msg) {
  console.warn(`  ⚠️  ${msg}`);
  warningCount++;
}

function reportFail(msg) {
  console.error(`  ❌ ${msg}`);
  errorCount++;
}

// 1. Verify Core Coordination Files in Primary Repository Hub
console.log('1. Checking Coordination Hub Files (Primary Repository):');
const coreFiles = [
  '.agents/coordination/REGISTRY.json',
  '.agents/coordination/OWNERSHIP.json',
  '.agents/coordination/INTEGRATION_QUEUE.json',
  '.agents/coordination/README.md',
  '.agents/coordination/WORKTREE_AUDIT.md',
  '.agents/coordination/tasks/README.md',
  '.agents/coordination/tasks/template.json',
  '.agents/coordination/decisions/template.md',
  '.agents/coordination/conflicts/template.md'
];

for (const relPath of coreFiles) {
  const fullPath = path.join(rootDir, relPath);
  if (fs.existsSync(fullPath)) {
    reportPass(`Found ${relPath}`);
  } else {
    reportFail(`Missing required file: ${relPath}`);
  }
}

// 2. Validate REGISTRY.json Schema & Single Writer Protocol
console.log('\n2. Validating REGISTRY.json Schema & Single Writer Protocol:');
const registryPath = path.join(rootDir, '.agents/coordination/REGISTRY.json');
let registry = null;
const registeredAgentIds = new Set();
const registeredWorktrees = new Map();

if (fs.existsSync(registryPath)) {
  try {
    const raw = fs.readFileSync(registryPath, 'utf8');
    registry = JSON.parse(raw);

    if (!registry.schema_version) reportFail('REGISTRY.json missing schema_version');
    if (!registry.baseline_commit) reportFail('REGISTRY.json missing baseline_commit');
    if (!registry.primary_repository || !registry.primary_repository.path) {
      reportFail('REGISTRY.json missing primary_repository configuration');
    }
    if (!registry.governance || registry.governance.protocol !== 'Single Writer Protocol') {
      reportFail('REGISTRY.json missing Single Writer Protocol declaration');
    }
    if (!Array.isArray(registry.worktrees)) {
      reportFail('REGISTRY.json worktrees must be an array');
    } else {
      for (const wt of registry.worktrees) {
        if (!wt.agent_id || !wt.worktree_name || !wt.path || !wt.branch || !wt.role) {
          reportFail(`Worktree entry missing required fields: ${JSON.stringify(wt)}`);
        }
        if (registeredAgentIds.has(wt.agent_id)) {
          reportFail(`Duplicate agent_id in REGISTRY.json: ${wt.agent_id}`);
        }
        registeredAgentIds.add(wt.agent_id);
        registeredWorktrees.set(wt.agent_id, wt);

        const validStatuses = ['IDLE', 'READY', 'BUSY', 'WAITING', 'BLOCKED', 'OFFLINE'];
        if (!validStatuses.includes(wt.status)) {
          reportFail(`Invalid agent status "${wt.status}" for agent ${wt.agent_id}`);
        }
      }
      reportPass(`Registry valid with ${registry.worktrees.length} registered worktrees: [${[...registeredAgentIds].join(', ')}]`);
    }
  } catch (err) {
    reportFail(`Failed to parse REGISTRY.json: ${err.message}`);
  }
}

// 3. Validate OWNERSHIP.json & Explicit Shared-File Protection
console.log('\n3. Validating OWNERSHIP.json & Explicit Protected Files:');
const ownershipPath = path.join(rootDir, '.agents/coordination/OWNERSHIP.json');
let ownership = null;

if (fs.existsSync(ownershipPath)) {
  try {
    const raw = fs.readFileSync(ownershipPath, 'utf8');
    ownership = JSON.parse(raw);

    if (!ownership.domains) {
      reportFail('OWNERSHIP.json missing "domains" section');
    } else {
      for (const [domainKey, domain] of Object.entries(ownership.domains)) {
        if (!registeredAgentIds.has(domain.agent_id)) {
          reportFail(`Domain "${domainKey}" refers to unregistered agent_id: "${domain.agent_id}"`);
        }
        if (!Array.isArray(domain.owned_patterns)) {
          reportFail(`Domain "${domainKey}" owned_patterns must be an array`);
        }
      }
      reportPass(`Ownership domains validated for: ${Object.keys(ownership.domains).join(', ')}`);
    }

    // Required protected files specification
    const mandatoryProtectedFiles = [
      'package.json',
      'package-lock.json',
      'src/shared/ipc.ts',
      'src/shared/types.ts',
      'src/shared/cli.ts',
      'src/preload/index.ts',
      'src/main/ipc/register.ts',
      'src/main/db/database.service.ts',
      'src/renderer/src/stores/workspace.store.ts',
      'AGENTS.md',
      '.agents/coordination/REGISTRY.json',
      '.agents/coordination/OWNERSHIP.json',
      '.agents/coordination/INTEGRATION_QUEUE.json'
    ];

    if (!ownership.protected_files || typeof ownership.protected_files !== 'object') {
      reportFail('OWNERSHIP.json missing structured "protected_files" dictionary');
    } else {
      let protectedCount = 0;
      for (const reqFile of mandatoryProtectedFiles) {
        const entry = ownership.protected_files[reqFile];
        if (!entry) {
          reportFail(`Missing mandatory protected file declaration: "${reqFile}"`);
        } else {
          if (!entry.responsible_owner) reportFail(`Protected file "${reqFile}" missing responsible_owner`);
          if (!Array.isArray(entry.proposers)) reportFail(`Protected file "${reqFile}" missing proposers array`);
          if (!entry.approval_requirements) reportFail(`Protected file "${reqFile}" missing approval_requirements`);
          if (!Array.isArray(entry.notification_targets)) reportFail(`Protected file "${reqFile}" missing notification_targets`);
          if (!entry.conflict_prevention) reportFail(`Protected file "${reqFile}" missing conflict_prevention`);
          protectedCount++;
        }
      }
      reportPass(`Explicit protected files verified: ${protectedCount} protected items with full governance policies`);
    }
  } catch (err) {
    reportFail(`Failed to parse OWNERSHIP.json: ${err.message}`);
  }
}

// 4. Validate INTEGRATION_QUEUE.json & Quality Gates
console.log('\n4. Validating INTEGRATION_QUEUE.json & Quality Gates:');
const queuePath = path.join(rootDir, '.agents/coordination/INTEGRATION_QUEUE.json');
if (fs.existsSync(queuePath)) {
  try {
    const raw = fs.readFileSync(queuePath, 'utf8');
    const queueData = JSON.parse(raw);

    const requiredGates = ['GATE_1_TYPECHECK', 'GATE_2_TEST_SUITE', 'GATE_3_GIT_INTEGRITY', 'GATE_4_ARCHITECT_REVIEW'];
    for (const gate of requiredGates) {
      if (!queueData.quality_gates || !queueData.quality_gates[gate]) {
        reportFail(`INTEGRATION_QUEUE.json missing quality gate: ${gate}`);
      }
    }
    if (!Array.isArray(queueData.queue)) {
      reportFail('INTEGRATION_QUEUE.json "queue" must be an array');
    } else {
      reportPass(`Integration queue valid. 4 Quality Gates verified. Current queue depth: ${queueData.queue.length}`);
    }
  } catch (err) {
    reportFail(`Failed to parse INTEGRATION_QUEUE.json: ${err.message}`);
  }
}

// 5. Validate Specialist Status & Handoff Files
console.log('\n5. Validating Specialist Agent State Files:');
if (registry && registry.worktrees) {
  for (const wt of registry.worktrees) {
    const agentDir = path.join(rootDir, '.agents/coordination/agents', wt.agent_id);
    if (!fs.existsSync(agentDir)) {
      reportFail(`Missing agent coordination directory: ${agentDir}`);
      continue;
    }

    const statusFile = path.join(agentDir, 'STATUS.json');
    const handoffFile = path.join(agentDir, 'HANDOFF.md');
    const notesFile = path.join(agentDir, 'NOTES.md');

    if (!fs.existsSync(statusFile)) {
      reportFail(`Missing STATUS.json for agent ${wt.agent_id}`);
    } else {
      try {
        const statusData = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
        if (statusData.agent_id !== wt.agent_id) {
          reportFail(`STATUS.json agent_id mismatch: expected "${wt.agent_id}", got "${statusData.agent_id}"`);
        }
        if (statusData.branch !== wt.branch) {
          reportFail(`STATUS.json branch mismatch for ${wt.agent_id}: expected "${wt.branch}", got "${statusData.branch}"`);
        }
        if (typeof statusData.progress !== 'number' || statusData.progress < 0 || statusData.progress > 100) {
          reportFail(`Invalid progress for agent ${wt.agent_id}: ${statusData.progress}`);
        }
        if (!Array.isArray(statusData.blockers)) {
          reportFail(`Agent ${wt.agent_id} blockers must be an array`);
        }
        reportPass(`Agent [${wt.agent_id}] STATUS.json verified (${statusData.status}, task: ${statusData.current_task || 'none'}, progress: ${statusData.progress}%)`);
      } catch (err) {
        reportFail(`Failed to parse STATUS.json for agent ${wt.agent_id}: ${err.message}`);
      }
    }

    if (!fs.existsSync(handoffFile)) {
      reportFail(`Missing HANDOFF.md template for agent ${wt.agent_id}`);
    } else {
      reportPass(`Agent [${wt.agent_id}] HANDOFF.md found`);
    }

    if (!fs.existsSync(notesFile)) {
      reportFail(`Missing NOTES.md for agent ${wt.agent_id}`);
    } else {
      reportPass(`Agent [${wt.agent_id}] NOTES.md found`);
    }
  }
}

// 6. Validate Governance Rules & Workflows
console.log('\n6. Checking Governance Rules & Multi-Agent Workflows:');
const requiredRules = [
  '.agents/rules/file-ownership.md',
  '.agents/rules/communication-protocol.md',
  '.agents/rules/git-safety.md',
  '.agents/rules/integration-policy.md'
];

for (const rule of requiredRules) {
  const p = path.join(rootDir, rule);
  if (fs.existsSync(p)) {
    reportPass(`Rule found: ${rule}`);
  } else {
    reportFail(`Missing governance rule: ${rule}`);
  }
}

const requiredWorkflows = [
  '.agents/workflows/task-lifecycle.md',
  '.agents/workflows/handoff.md',
  '.agents/workflows/code-review.md',
  '.agents/workflows/integration.md'
];

for (const wf of requiredWorkflows) {
  const p = path.join(rootDir, wf);
  if (fs.existsSync(p)) {
    reportPass(`Workflow found: ${wf}`);
  } else {
    reportFail(`Missing workflow: ${wf}`);
  }
}

// 7. Validate Task Specifications, Status Transitions & Dependency Integrity
console.log('\n7. Checking Task Specifications, Status Transitions & Dependencies:');
const taskDirs = [
  { dir: 'active', expectedStatuses: ['READY', 'IN_PROGRESS'] },
  { dir: 'blocked', expectedStatuses: ['BLOCKED'] },
  { dir: 'review', expectedStatuses: ['REVIEW'] },
  { dir: 'completed', expectedStatuses: ['APPROVED', 'COMPLETED'] }
];

const allTasks = new Map();
const seenTaskIds = new Set();

for (const { dir, expectedStatuses } of taskDirs) {
  const dirPath = path.join(rootDir, '.agents/coordination/tasks', dir);
  if (!fs.existsSync(dirPath)) {
    reportFail(`Missing task directory: .agents/coordination/tasks/${dir}`);
    continue;
  }
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
  for (const f of files) {
    const tPath = path.join(dirPath, f);
    try {
      const task = JSON.parse(fs.readFileSync(tPath, 'utf8'));
      if (!task.task_id || !/^ORB-[A-Z]+-\d+$/.test(task.task_id)) {
        reportFail(`Task ${f} has invalid task_id format: ${task.task_id}`);
      }
      if (seenTaskIds.has(task.task_id)) {
        reportFail(`Duplicate task ID detected: ${task.task_id}`);
      }
      seenTaskIds.add(task.task_id);
      allTasks.set(task.task_id, { task, dir });

      if (!registeredAgentIds.has(task.assigned_agent)) {
        reportFail(`Task ${task.task_id} assigned to unknown agent: ${task.assigned_agent}`);
      }

      // Check valid status transition placement
      if (!expectedStatuses.includes(task.status)) {
        reportFail(`Task ${task.task_id} has status "${task.status}" which does not match directory "${dir}" (expected: ${expectedStatuses.join(', ')})`);
      }

      // Check task scope against ownership boundaries
      if (task.scope && Array.isArray(task.scope.allowed_files) && ownership && ownership.domains) {
        const assignedDomain = ownership.domains[task.assigned_agent];
        if (assignedDomain && Array.isArray(assignedDomain.exceptions)) {
          for (const allowedFile of task.scope.allowed_files) {
            for (const exc of assignedDomain.exceptions) {
              const excPrefix = exc.replace(/\*\*$/, '');
              if (allowedFile.startsWith(excPrefix)) {
                reportFail(`Task ${task.task_id} assigns file "${allowedFile}" which is an excluded boundary exception for ${task.assigned_agent}`);
              }
            }
          }
        }
      }

      reportPass(`Task ${task.task_id} (${task.status}) validated in ${dir}`);
    } catch (err) {
      reportFail(`Failed to parse task file ${f}: ${err.message}`);
    }
  }
}

// Check task dependency consistency
for (const [taskId, { task }] of allTasks.entries()) {
  if (Array.isArray(task.dependencies)) {
    for (const depId of task.dependencies) {
      if (!allTasks.has(depId)) {
        reportFail(`Task ${taskId} has invalid dependency: "${depId}" does not exist in any task directory`);
      }
    }
  }
}
reportPass(`Task directory checks completed (total active/queued/completed tasks: ${seenTaskIds.size})`);

// 8. Verify Git Worktree Branch Mappings
console.log('\n8. Checking Live Git Worktree Mappings:');
try {
  const wtOutput = execSync('git worktree list --porcelain', { cwd: rootDir, encoding: 'utf8' });
  const lines = wtOutput.split('\n');
  const actualWorktrees = new Map();
  let currentPath = null;
  let currentBranch = null;

  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      currentPath = line.substring(9).trim().replace(/\\/g, '/');
    } else if (line.startsWith('branch ')) {
      currentBranch = line.substring(7).trim().replace(/^refs\/heads\//, '');
      if (currentPath) {
        actualWorktrees.set(currentPath.toLowerCase(), currentBranch);
      }
      currentPath = null;
      currentBranch = null;
    }
  }

  if (registry && registry.worktrees) {
    for (const wt of registry.worktrees) {
      const normalizedPath = wt.path.replace(/\\/g, '/').toLowerCase();
      if (!actualWorktrees.has(normalizedPath)) {
        reportWarn(`Worktree path not currently registered in git worktree list: ${wt.path}`);
      } else {
        const actualBranch = actualWorktrees.get(normalizedPath);
        if (actualBranch !== wt.branch) {
          reportFail(`Worktree branch mismatch for ${wt.agent_id}: expected "${wt.branch}", git reported "${actualBranch}"`);
        } else {
          reportPass(`Worktree [${wt.worktree_name}] branch matches "${wt.branch}" at ${wt.path}`);
        }
      }
    }
  }
} catch (err) {
  reportWarn(`Unable to inspect live git worktrees: ${err.message}`);
}

// 9. Coordination Path Accessibility (Primary Hub vs Worktrees)
console.log('\n9. Checking Coordination Path Accessibility & Worktree Synchronization:');
console.log(`  ℹ️  Primary Repository Hub: ${rootDir}`);
const primaryCoordExists = fs.existsSync(path.join(rootDir, '.agents', 'coordination'));
if (primaryCoordExists) {
  reportPass('Coordination Hub exists and is accessible at Primary Repository path');
} else {
  reportFail('Coordination Hub not accessible at Primary Repository path');
}

if (registry && registry.worktrees) {
  for (const wt of registry.worktrees) {
    const wtCoord = path.join(wt.path, '.agents', 'coordination');
    const existsInWt = fs.existsSync(wtCoord);
    if (existsInWt) {
      reportPass(`Worktree [${wt.worktree_name}]: Local coordination directory is present`);
    } else {
      // Differentiate filesystem presence from git tracking status:
      // Coordination files are currently uncommitted in primary repo.
      reportWarn(`Worktree [${wt.worktree_name}]: Local .agents/coordination not yet present on branch "${wt.branch}". Requires git commit on master and branch rebase before relative path access works.`);
    }
  }
}

// Summary
console.log('\n======================================================');
if (errorCount > 0) {
  console.error(`❌ Coordination validation failed: ${errorCount} error(s), ${warningCount} warning(s).`);
  process.exit(1);
} else {
  console.log(`🌟 Coordination validation passed: 0 errors, ${warningCount} warning(s).`);
  console.log('Central Multi-Agent Coordination System is hardened and compliant.');
  process.exit(0);
}
