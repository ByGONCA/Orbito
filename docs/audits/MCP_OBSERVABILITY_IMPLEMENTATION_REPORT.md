# Centralized MCP Observability & Performance Monitoring Implementation Report

**Author:** Lead Architect & Development Orchestrator  
**Date:** November 14, 2026  
**System:** Orbito (Orc AI Workspace)  
**Status:** Validated, Production-Ready & Formally Tested  

---

## 1. Executive Summary

This report documents the architectural design, implementation, and empirical verification of the **Observability, Activity Tracking, Diagnostics, and Performance Monitoring Layer** for Orbito's Centralized Model Context Protocol (MCP) Infrastructure.

In accordance with Orbito's core UX design maxim:
> **"Full observability internally. Minimal information externally."**

The system provides comprehensive internal telemetry, execution tracing, percentile performance metrics (Avg, Median/P50, P95), connection lifecycle tracking, and bounded retention management without introducing visual bloat, intrusive dividing lines, or boxy containers into the user interface.

---

## 2. Architecture & Design Principles

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AI Coding Agents                                │
│   (Claude Code, OpenAI Codex, Google Antigravity, OpenCode, System)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ JSON-RPC 2.0 Tool Invocations
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Centralized MCP Gateway                           │
│  - Boundary validation & Agent Permission Checks                       │
│  - Concurrency Tracker (Atomic start/end)                              │
│  - Non-blocking Asynchronous Telemetry & Audit Logging                 │
│  - In-flight Secret Redaction (Masks Bearer, Tokens, API Keys)         │
└───────────────────┬───────────────────────────────┬────────────────────┘
                    │                               │
                    ▼                               ▼
      ┌───────────────────────────┐   ┌───────────────────────────┐
      │   MCP Metrics Collector   │   │     SQLite Database       │
      │  (In-memory Live State)   │   │  (Persistent Event Store) │
      │  - Active connections     │   │  - mcp_audit_logs         │
      │  - Concurrent executions  │   │  - mcp_connection_events │
      │  - Reconnect / Fail counts│   │  - mcp_servers metadata   │
      │  - Per-server uptime/lag  │   │  - Bounded retention pruner│
      └─────────────┬─────────────┘   └─────────────┬─────────────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Presentation Surfaces                           │
├───────────────────────────────────┬────────────────────────────────────┤
│  Settings → Integrations → MCP    │  Developer Mode Diagnostics        │
│  - Minimal typographic latency ms │  - Performance percentiles (P50/95)│
│  - Relative "Last Active" time    │  - Top slowest tools breakdown     │
│  - Open, borderless card layout   │  - Agent & server execution charts │
│  - Expandable minimal status strip│  - Multi-dimensional filterable log│
└───────────────────────────────────┴────────────────────────────────────┘
```

### Key Engineering Decisions
1. **Real Mathematical Metrics (Zero Synthetic Data):** All latency metrics (Average, Median/P50, P95) and slowest tools are calculated directly from physical records in SQLite using deterministic ordering and percentile slice indexes.
2. **Fail-Safe & Non-Blocking Logging:** Telemetry recording, connection event saving, and audit logging catch internal errors asynchronously so that a logging or telemetry fault never degrades or blocks an agent tool execution.
3. **Defense-in-Depth Secret Redaction:** All tool parameters, responses, and error messages are passed through `SecretRedactor` prior to logging and UI presentation, masking Bearer tokens, GitHub personal tokens, and proprietary keys.
4. **Bounded Retention Policy:** Automatic and on-demand pruning (`pruneOldLogs`) purges logs older than 30 days and enforces a maximum table ceiling (default 10,000 records) to preserve disk space and query performance.

---

## 3. Data Structures & Shared Contracts

The contracts defined in `src/shared/mcp.ts` and `src/shared/ipc.ts` establish strict TypeScript interfaces and Zod validation schemas across all Electron boundaries:

### Core Schemas (`src/shared/mcp.ts`)
- **`MCPConnectionEvent`**: Captures connection lifecycle transitions (`connected`, `disconnected`, `reconnecting`, `failed`), handshake duration in milliseconds, error messages, and timestamps.
- **`MCPServerConnectionMetrics`**: Exposes real-time server connection state, cumulative uptime in milliseconds, reconnect count, failure count, last latency, and last activity time.
- **`MCPSlowToolMetric`**: Ranks tools by average execution latency and frequency.
- **`MCPObservabilitySummary`**: Aggregates total calls, success/error/denied counts, average latency, median (P50), P95 tail latency, active server sessions, in-memory concurrency, and breakdown maps by agent and server.
- **`MCPAuditLogFilterSchema`**: Zod schema validating multi-dimensional queries (by server ID, agent ID, tool name, status, and time range).

---

## 4. Subsystem Implementations

### 4.1 Persistence Layer (`src/main/db/database.service.ts`)
Extended the existing WAL-mode SQLite database with:
- **`mcp_connection_events` Table**: Indexed by `server_id` and `timestamp` for high-throughput lifecycle tracing.
- **Schema Migration**: Added `last_activity_at` and `last_latency_ms` columns to `mcp_servers`.
- **`computeMCPObservabilityMetrics(fromTimestamp?)`**: Computes mathematical percentiles (Avg, P50, P95), tool latency aggregations, and execution distributions.
- **`queryMCPAuditLogs(filter)`**: Parametric SQL query engine supporting status, agent, server, and tool search with offset-based pagination.
- **`pruneMCPAuditLogs(retentionDays, maxRows)`**: Cleanly eliminates stale logs past retention thresholds and caps table volume.

### 4.2 Core Observability Engine (`src/main/mcp/observability/mcp-metrics-collector.ts`)
- Atomic concurrency tracking via `trackExecutionStart()` and `trackExecutionEnd()`.
- Server uptime accounting combining historical total uptime and live connected session elapsed time.
- Lifecycle event recorder that notifies the database and updates server activity in a single, non-blocking call.

### 4.3 Runtime & Gateway Integration (`mcp-runtime.ts` & `mcp-gateway.ts`)
- **Handshake Benchmarking**: Measures handshake and tool discovery latency during `connectServer()` and records `connected` events.
- **Exit Tracing**: Emits `reconnecting` events with backoff notifications during unexpected process exits.
- **Execution Tracking**: Wraps tool executions in `mcpGateway.executeTool()` with start/end concurrency counters and records exact execution durations.

### 4.4 Presentation Layer

#### Settings UI (`src/renderer/src/components/settings/mcp/MCPServersPage.tsx`)
- Displays minimal, borderless typographic latency indicators (e.g. `12ms`) and relative activity timestamps (`Active 2m ago`) on server cards.
- Expandable drawer displays minimal server health strip (Status, Latency, Last Active, Auto-Reconnect) without card borders or visual noise.

#### Developer Mode Diagnostics (`src/renderer/src/components/MCPDiagnosticsView.tsx` & `AnalyticsDashboard.tsx`)
- Seamlessly accessible under Developer Analytics / Diagnostics via the new **"MCP Diagnostics"** tab.
- Key KPI Strip: Total Invocations, Average Latency, P95 Tail Latency, Active Servers, Concurrent Calls.
- Detailed Diagnostics:
  - Top Slowest Tools table.
  - Invocations distribution by Agent (Claude Code, Codex, Antigravity, OpenCode, System).
  - Server Connection Uptime and stability overview.
  - Multi-dimensional filterable execution log (search, status filter, server filter, agent filter).
  - One-click retention pruning action (`Prune > 30d`).

---

## 5. Automated Verification & Quality Assurance

### 5.1 Test Suite Results
All test suites were executed using Electron Node mode (`scripts/run-electron-tests.js`) against native `better-sqlite3` storage:

| Test Suite File | Tests | Status | Duration |
|-----------------|-------|--------|----------|
| `tests/mcp-observability.test.ts` | 6 | **PASSED** | 269ms |
| `tests/mcp-core-runtime.test.ts` | 3 | **PASSED** | 646ms |
| `tests/mcp-security-vault.test.ts` | 4 | **PASSED** | 172ms |
| `tests/mcp-agent-adapters.test.ts` | 4 | **PASSED** | 1032ms |
| `tests/mcp-e2e-runtime.test.ts` | 3 | **PASSED** | 683ms |
| `tests/mcp-multiagent-concurrency.test.ts` | 2 | **PASSED** | 543ms |
| `tests/mcp-persistence-lifecycle.test.ts` | 1 | **PASSED** | 515ms |
| **Total** | **23** | **PASSED (100%)** | **3.86s** |

### 5.2 Verification Scope Covered
1. **Mathematical Accuracy**: Verified P50 (median) and P95 percentile calculation formulas against deterministic datasets.
2. **Lifecycle Events**: Verified logging and chronological retrieval of `connected`, `disconnected`, `reconnecting`, and `failed` events.
3. **Filtering & Pagination**: Verified multi-parameter filtering across statuses, tools, agents, and server identifiers.
4. **Bounded Retention**: Verified pruning of records older than 30 days and table truncation when exceeding max row limits.
5. **Concurrency Safety**: Verified atomic start/end concurrency counter increments and decrements.
6. **Secret Redaction**: Verified that Bearer tokens and sensitive credentials in tool outputs are redacted prior to audit logging and UI emission.

### 5.3 Static Analysis & Governance Verification
- **TypeScript Typecheck**: `npm run typecheck` passed with 0 errors across Node and Web configurations.
- **Repository Organization**: `npm run validate:structure` passed with 0 errors and 0 warnings.
- **Multi-Agent Coordination Hub**: `npm run validate:coordination` verified all 4 worktree branches and quality gates.

---

## 6. Conclusion

The Centralized MCP Observability & Performance Monitoring Layer provides full internal diagnostic visibility into MCP servers, tools, and agent connections, while maintaining a clean, borderless, and anti-boxiness UI experience.
