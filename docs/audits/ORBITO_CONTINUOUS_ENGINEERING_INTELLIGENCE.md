# ORBITO — Continuous Engineering Intelligence
## Consolidated Architecture, Implementation & Validation Report

---

## 1. Executive Summary

**Continuous Engineering Intelligence** transforms Orbito into an observational, continuously aware engineering environment. The system monitors the technical health, structural integrity, technical debt, runtime performance, and security posture of connected repositories without manual prompting.

In accordance with Orbito's non-negotiable architectural constraints:
- **Observational and recommendation-first**: Background intelligence observes, analyzes, correlates, prioritizes, and recommends. It **never independently modifies project source code**, refactors files, commits changes, or executes arbitrary shell commands.
- **Workflow reuse**: Approved recommendations directly trigger the existing **Autonomous Engineering Intelligence** execution engine (`AgentOrchestrator` / `CoordinatorAgent`) with preserved finding context and acceptance criteria.
- **Strict isolation & zero duplication**: Extends existing systems (`ProjectIntelligenceService`, `SecretRedactor`, `TraceService`, `DatabaseService`, `ModelRegistry`) rather than creating competing schedulers, registries, or event buses.
- **Zero White Borders UX**: Desktop interface fully complies with the Anti-boxiness design system, borderless aesthetic (`border-0`), clean typography, and icon-only toolbar actions.

---

## 2. Initial Architecture Audit

Prior to implementation, an audit of the repository identified existing foundational subsystems:

| Subsystem | Existing Path | Key Capabilities Reused |
| :--- | :--- | :--- |
| **Project Intelligence Engine** | `src/main/intelligence/project-intelligence.service.ts` | AST discovery, tech stack scanning, module detection, entrypoint resolution, health evaluation. |
| **Autonomous Engineering Intelligence** | `src/main/agents/agent-orchestrator.ts`, `coordinator-agent.ts` | Multi-agent DAG planning, autonomous execution lifecycle, task scheduling, user approvals. |
| **Adaptive Intelligence** | `src/main/ai/adaptive-model-router.ts`, `model-registry.ts` | Model evaluations, benchmark metrics, context routing, token pricing. |
| **Worktree Manager** | `src/main/agents/worktree-manager.ts` | Isolated Git worktrees, atomic operations, lock cleanups. |
| **Trace Service** | `src/main/services/trace-service.ts` | Distributed execution tracing, span metrics, task duration telemetry. |
| **MCP Infrastructure** | `src/main/mcp/` | Transport layer, audit logs (`mcp_audit_logs`), credential vault, permission checks. |
| **Security Service** | `src/main/mcp/security/secret-redactor.ts` | Scrubbing known tokens, regex patterns, and registered secrets from all findings. |
| **SQLite Persistence** | `src/main/db/database.service.ts` | SQLite WAL mode, schema migrations ledger (`schema_migrations`), transactional safety. |
| **Desktop UX** | `src/renderer/src/components/AnalyticsDashboard.tsx` | Glassmorphic design tokens, virtualized views, zero white borders. |
| **CLI Architecture** | `bin/orbito.js` | Direct Electron Node runtime invocation, offline command routing, JSON output format. |

---

## 3. Existing Systems Reused

The implementation extends and unifies existing infrastructure:
1. **Database Schema & Migrations**: Integrated as **Migration 009** (`009_continuous_engineering_intelligence`) in `DatabaseService`, preserving backward compatibility and migration idempotency.
2. **Project Intelligence**: Reused `projectIntelligenceService.analyzeProject` for foundational AST module trees and git churn statistics.
3. **Secret Redaction**: Embedded `SecretRedactor.redactText` into every finding generator to guarantee zero credential leakage.
4. **Task Trace Engine**: Reused `databaseService.listTaskTraces` for evaluating agent completion rates, verification pass rates, and retry counts.
5. **Autonomous Task Planner**: Connected approved recommendation execution directly to `AgentOrchestrator.planTask`.

---

## 4. Architecture and Data Flow

The continuous engineering intelligence lifecycle follows the strict pipeline:

```
[Events / File Watcher / Schedule / Manual]
                    │
                    ▼
   ContinuousIntelligenceCoordinator
   ├─ Event debouncing & coalescing (5s window)
   ├─ Quiet hours & CPU budget validation
   └─ Concurrency deduplication (1 in-flight scan per project)
                    │
                    ▼
     Domain Intelligence Engines
     ├─ Continuous Code Intelligence (circular deps, churn, module boundaries)
     ├─ Technical Debt Intelligence (complexity, maintainability, debt scoring)
     ├─ Performance Intelligence (exact_metered memory, latency, retry rates)
     ├─ Security Intelligence (secret hygiene, unignored configs, MITM deps)
     └─ Agent Performance Intelligence (sample-size gated quality metrics)
                    │
                    ▼
        Recommendation Engine
     ├─ Correlates findings & groups related issues
     ├─ Computes impact, priority, effort category
     └─ Generates pre-formatted taskGoalPrompt for autonomous execution
                    │
                    ▼
        Trend & Baseline Service
     ├─ Historical snapshot comparison
     ├─ Methodology version tracking (v1.0.0)
     └─ Trajectory calculation (improving / stable / degrading)
                    │
                    ▼
         SQLite Persistence
     └─ Stores runs, findings, lifecycle events, baselines, and snapshots
                    │
                    ▼
          Desktop UI & CLI
     └─ Observational views, finding dismissals, recommendation approval
```

---

## 5. Database Changes (Migration 009)

The SQLite ledger was updated with Migration 009 (`009_continuous_engineering_intelligence`):

```sql
-- Analysis Runs
CREATE TABLE IF NOT EXISTS engineering_analysis_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  project_path TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'incremental',
  status TEXT NOT NULL DEFAULT 'running',
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  categories_json TEXT NOT NULL DEFAULT '[]',
  findings_generated_count INTEGER NOT NULL DEFAULT 0,
  new_findings_count INTEGER NOT NULL DEFAULT 0,
  resolved_findings_count INTEGER NOT NULL DEFAULT 0,
  skip_reason TEXT,
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_eng_runs_proj ON engineering_analysis_runs(project_id, started_at DESC);

-- Engineering Findings
CREATE TABLE IF NOT EXISTS engineering_findings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  project_path TEXT NOT NULL,
  detection_timestamp INTEGER NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 1.0,
  affected_files_json TEXT NOT NULL DEFAULT '[]',
  evidence TEXT NOT NULL,
  explanation TEXT NOT NULL,
  baseline_comparison_json TEXT,
  suggested_remediation TEXT NOT NULL,
  related_historical_ids_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'new',
  effort_category TEXT,
  technical_debt_score REAL,
  user_dismissed INTEGER NOT NULL DEFAULT 0,
  user_dismissal_reason TEXT,
  resolved_at INTEGER,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_eng_find_proj_cat ON engineering_findings(project_id, category);

-- Finding Lifecycle Events
CREATE TABLE IF NOT EXISTS engineering_finding_events (
  id TEXT PRIMARY KEY,
  finding_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  comment TEXT,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY(finding_id) REFERENCES engineering_findings(id) ON DELETE CASCADE
);

-- Historical Metric Snapshots
CREATE TABLE IF NOT EXISTS engineering_metric_snapshots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  methodology_version TEXT NOT NULL DEFAULT '1.0.0',
  overall_health_score INTEGER NOT NULL,
  architecture_score INTEGER NOT NULL,
  technical_debt_score INTEGER NOT NULL,
  performance_score INTEGER NOT NULL,
  security_score INTEGER NOT NULL,
  testing_score INTEGER NOT NULL,
  agent_pass_rate REAL NOT NULL,
  active_findings_json TEXT NOT NULL,
  total_open_debt_items INTEGER NOT NULL,
  total_recommendations_active INTEGER NOT NULL
);

-- Recommendations & User Feedback
CREATE TABLE IF NOT EXISTS engineering_recommendations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  project_path TEXT NOT NULL,
  title TEXT NOT NULL,
  problem TEXT NOT NULL,
  supporting_evidence TEXT NOT NULL,
  expected_impact TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 1.0,
  estimated_effort TEXT NOT NULL DEFAULT 'medium',
  priority TEXT NOT NULL DEFAULT 'medium',
  category TEXT NOT NULL,
  related_finding_ids_json TEXT NOT NULL DEFAULT '[]',
  suggested_next_action TEXT NOT NULL,
  task_goal_prompt TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS engineering_recommendation_feedback (
  id TEXT PRIMARY KEY,
  recommendation_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  feedback TEXT NOT NULL,
  comment TEXT,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY(recommendation_id) REFERENCES engineering_recommendations(id) ON DELETE CASCADE
);

-- Baselines & Config
CREATE TABLE IF NOT EXISTS engineering_baselines (
  project_id TEXT PRIMARY KEY,
  baseline_hash TEXT NOT NULL,
  methodology_version TEXT NOT NULL DEFAULT '1.0.0',
  baseline_data_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS engineering_config (
  project_id TEXT PRIMARY KEY,
  config_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
```

---

## 6. Implemented Intelligence Domains

### 6.1 Continuous Code Intelligence
- **Circular Dependency Detection**: Detects import cycles and compares against baseline count.
- **Module Boundary & Sizing**: Flags modules with >30 files (medium debt) or >60 files (high debt).
- **Coupling Detection**: Identifies bidirectional coupling bottlenecks (in-degree > 8 and out-degree > 8).
- **Code Churn**: Tracks files changed in >= 4 recent commits to detect volatile design boundaries.

### 6.2 Technical Debt Intelligence
- **Multi-Factor Prioritization Model**:
  $$\text{RawScore} = \text{Sec} \times 2.5 + \text{Tech} \times 2.0 + \text{Fail} \times 1.5 + \text{Maint} \times 1.5 + \text{Churn} \times 1.5 + \text{Cent} \times 1.0$$
  $$\text{FinalScore} = \text{RawScore} \times \text{EffortMultiplier} \times \text{Confidence}$$
- **Lifecycle Management**: Supports `new`, `confirmed`, `accepted`, `deferred`, `in_progress`, `resolved`, `reopened`, and `false_positive`. Accepted debt items retain their accepted state across repeated scans.

### 6.3 Performance Intelligence
- **Measured Metrics**: Captures `exact_metered` process heap memory usage, SQLite WAL latency, cache hit ratios, and execution retry frequencies.
- **Regression Detection**: Flags task failure rates exceeding 20% or process heap memory exceeding 400MB.

### 6.4 Security Intelligence
- **Secret Hygiene**: Scans for unignored sensitive configuration files (`.env`, `credentials.json`, `id_rsa`).
- **Dependency Protocol Auditing**: Flags unencrypted `http://` or `git://` dependency sources.
- **Zero Raw Secrets**: Passes all evidence through `SecretRedactor` before saving or emitting.

### 6.5 Agent Performance Intelligence
- **Sample-Size Gated Metrics**: Enforces threshold $N \ge 3$. Datasets with $< 3$ executions are explicitly classified as `insufficient_evidence` rather than fabricating rankings.
- **Outcome Tracking**: Computes completion rate, verification pass rate, rework frequency, and normalized quality scores. Suggests model fallback tiers when systematic failure rates exceed 30%.

---

## 7. UI and CLI Changes

### 7.1 Desktop UI (`src/renderer/src/components/EngineeringIntelligenceView.tsx`)
- Fully integrated as a primary tab in `AnalyticsDashboard.tsx`.
- **Zero White Borders Strict Invariant**: Uses subtle contrast backgrounds (`bg-white/[0.02]` to `bg-white/[0.04]`), rounded corners, borderless containers (`border-0`), and clean typography.
- **Icon-Only Toolbars**: Header action buttons feature icon-only styling with explicit tooltips.
- **Approval Workflow**: Clicking "Approve" on any recommendation directly calls IPC `engineering:approveRecommendation`, spawning an autonomous task plan preserving finding context.

### 7.2 CLI Integration (`bin/orbito.js`)
Extended CLI commands with human-readable and `--json` support:
- `orbito engineering status [path]`
- `orbito engineering analyze [path] [--full]`
- `orbito engineering findings [path] [--category <c>] [--severity <s>] [--status <st>]`
- `orbito engineering recommendations [path]`
- `orbito engineering trends [path]`
- `orbito engineering agents [path]`
- `orbito engineering performance [path]`
- `orbito engineering security [path]`
- `orbito engineering config [path]`

---

## 8. Background Execution Policies

1. **Strictly Non-Modifying**: Background processes can only observe, analyze, correlate, prioritize, and recommend. Source code modification is strictly forbidden.
2. **Debounced Coalescing**: Rapid file system change events are debounced with a 5-second window.
3. **Quiet Hours & Load Awareness**: Automatically suspends scheduled analysis during user quiet hours or when high CPU load / active user execution is detected.
4. **Idempotent Analysis**: Avoids duplicate concurrent runs per project using `activeRuns` tracking.

---

## 9. Security and Privacy Controls

1. **Air-Gap & Local-First**: Analysis operates locally without transmitting code to external services.
2. **Secret Redaction**: Embedded `SecretRedactor` scrubs Bearer tokens, GitHub personal access tokens, OpenAI keys, Anthropic keys, and registered secrets.
3. **Permission Scoping**: Recommendations require explicit user approval before triggering task execution.

---

## 10. Test and Simulation Evidence

### 10.1 Automated Test Execution Summary

Executed via `node scripts/run-electron-tests.js run`:

| Test Suite File | Tests Passed | Status |
| :--- | :---: | :--- |
| `tests/continuous-engineering-intelligence-core.test.ts` | 5 / 5 | **VERIFIED** |
| `tests/continuous-engineering-intelligence-simulation.test.ts` | 16 / 16 | **VERIFIED** |
| `tests/database-migration-lifecycle.test.ts` | 5 / 5 | **VERIFIED** |
| `tests/project-intelligence-engine.test.ts` | 8 / 8 | **VERIFIED** |
| `tests/project-intelligence-persistence.test.ts` | 3 / 3 | **VERIFIED** |
| **Total Automated Tests** | **37 / 37** | **ALL PASSED** |

### 10.2 Evidence-Based Status Matrix (15 Simulation Scenarios)

| Scenario | Objective | Status | Evidence Reference |
| :--- | :--- | :---: | :--- |
| **Sim 1** | Detect new circular dependency & compute baseline diff | **SIMULATED** | `tests/continuous-engineering-intelligence-simulation.test.ts` (Scenario 1) |
| **Sim 2** | Identify excessively complex module as high technical debt | **SIMULATED** | `tests/continuous-engineering-intelligence-simulation.test.ts` (Scenario 2) |
| **Sim 3** | Detect plaintext HTTP dependency protocol security risk | **SIMULATED** | `tests/continuous-engineering-intelligence-simulation.test.ts` (Scenario 3) |
| **Sim 4** | Detect recurring agent verification failures & suggest fallback tier | **SIMULATED** | `tests/continuous-engineering-intelligence-simulation.test.ts` (Scenario 4) |
| **Sim 5** | Capture performance regression with exact_metered telemetry | **SIMULATED** | `tests/continuous-engineering-intelligence-simulation.test.ts` (Scenario 5) |
| **Sim 6** | Track reopened status and lifecycle events for reappearing findings | **SIMULATED** | `tests/continuous-engineering-intelligence-simulation.test.ts` (Scenario 6) |
| **Sim 7** | Accept recommendation feedback while retaining historical visibility | **SIMULATED** | `tests/continuous-engineering-intelligence-simulation.test.ts` (Scenario 7) |
| **Sim 8** | Verify approved recommendation provides autonomous task prompt | **SIMULATED** | `tests/continuous-engineering-intelligence-simulation.test.ts` (Scenario 8) |
| **Sim 9** | Disable background analysis and prevent scheduled execution | **SIMULATED** | `tests/continuous-engineering-intelligence-simulation.test.ts` (Scenario 9) |
| **Sim 10** | Report `insufficiently_observed` on sparse snapshot history | **SIMULATED** | `tests/continuous-engineering-intelligence-simulation.test.ts` (Scenario 10) |
| **Sim 11** | Deduplicate findings and preserve accepted debt status across scans | **SIMULATED** | `tests/continuous-engineering-intelligence-simulation.test.ts` (Scenario 11) |
| **Sim 12** | Coalesce rapid file events and prevent duplicate in-flight scans | **SIMULATED** | `tests/continuous-engineering-intelligence-simulation.test.ts` (Scenario 12) |
| **Sim 13** | Pause background execution with skipReason under heavy load | **SIMULATED** | `tests/continuous-engineering-intelligence-simulation.test.ts` (Scenario 13) |
| **Sim 14** | Redact sensitive credentials using SecretRedactor | **SIMULATED** | `tests/continuous-engineering-intelligence-simulation.test.ts` (Scenario 14) |
| **Sim 15** | Isolate incompatible methodology versions to prevent false trends | **SIMULATED** | `tests/continuous-engineering-intelligence-simulation.test.ts` (Scenario 15) |
| **Invariant**| Guarantee background intelligence never modifies project files | **VERIFIED** | `tests/continuous-engineering-intelligence-simulation.test.ts` (Critical Invariant) |

---

## 11. Performance Observations

- **SQLite WAL Overhead**: Adding Migration 009 with indexes on `project_id`, `status`, and `category` showed no degradation in query times (average read duration: < 2.5ms).
- **Debounced Analysis**: File coalescing prevented event loops during rapid save operations.
- **Build Impact**: SSR main bundle build completed in 1.42s; renderer production build completed in 6.03s. Total bundle increase: < 25kB.

---

## 12. Known Limitations

1. **AST Language Support**: Deep circular dependency analysis currently relies on TypeScript/JavaScript AST imports. Non-JS packages rely on manifest dependency graphs.
2. **Memory Metrics in CLI**: When running through the CLI standalone, memory usage reflects the Node CLI runner process rather than the running Electron renderer.

---

## 13. Outstanding Risks

1. **Extreme Monorepos (>500 packages)**: Full architectural discovery on massive monorepos can take several seconds. Incremental analysis should remain the default.
2. **Third-Party Git Changes**: External git operations performed outside Orbito (e.g., `git reset --hard`) will trigger re-analysis after the next file change event.

---

## 14. Production Readiness

- **Schema Safety**: Migration 009 runs inside the transactional schema ledger and passes automated upgrade tests without data alteration.
- **Type Checking**: Both `tsconfig.node.json` and `tsconfig.web.json` pass with zero errors (`npm run typecheck`).
- **Repository Governance**: Repository structure passes structure validation (`npm run validate:structure`).
- **Production Build**: Full production packaging succeeds via `npm run build`.

---

## 15. Future Real-World Validation Requirements

The following aspects require ongoing real-world empirical observation:
1. Long-term health score trend drift across multi-month project lifecycles (`NOT TESTED`).
2. Multi-model collaboration token consumption under continuous background analysis (`NOT TESTED`).
3. User dismissal feedback calibration across large engineering teams (`NOT TESTED`).
