# Flow Builder Architecture & User Experience — AI Workspace

**Phase:** Phase 6 — Visual Automation & Flow Builder  
**Status:** Fully Implemented, Integrated & Verified in Production  
**Version:** 1.6.0  

---

## 1. Overview & Vision

The **Flow Builder** transforms AI Workspace from a conversational CLI wrapper into a visual, end-to-end automation canvas. Users can visually design, configure, execute, monitor, and reuse AI workflows that seamlessly chain together:
- LLM agents with specialized personas
- Local AST and lexical context retrieval
- Domain skills from the Skills Engine
- Real development operations (typechecking, test suites, builds, Git commits)
- Safe logic controls (branching conditions, switches, merges, bounded loops, delays)

Zero simulated or fake nodes: every node on the React Flow canvas executes real, sandboxed Node.js and CLI operations in the Electron Main process.

---

## 2. Interface Topology & Visual Components

The Flow Builder is accessible directly from the application header (`Flows` tab):

```
+----------------------------------------------------------------------------------------------------+
| TOP TOOLBAR: [Workflow Title] [Save Status] | [Run / Cancel] [AI Prompt] [Templates] [Save] | Mode |
+----------------------------------------------------------------------------------------------------+
| NODE LIBRARY (Left)   | REACT FLOW CANVAS (Center)                  | PROPERTIES INSPECTOR (Right) |
|                       |                                             |                              |
| 🔍 Search Nodes...    |      +----------------+                     | Selected: Condition          |
|                       |      | Manual Trigger |                     |                              |
| ▼ AI NODES (6)        |      +-------┬--------+                     | Label: Did Tests Pass?       |
|   • AI Agent          |              │                              | Expression: value == true    |
|   • Multi-Agent Task  |              ▼                              |                              |
|   • AI Prompt         |      +----------------+                     | ---------------------------- |
|   • AI Review         |      |   Run Tests    |                     | Required Permissions:        |
|                       |      +-------┬--------+                     | • Terminal: Exec: true       |
| ▼ CONTEXT NODES (5)   |              │                              | • Filesystem: Read: true     |
|   • Workspace Search  |       ┌──────┴──────┐                       |                              |
|   • Read File         |   [True]         [False]                    | [Delete Node]                |
|                       |       ▼              ▼                      +------------------------------+
| ▼ LOGIC NODES (6)     | +-----------+  +-------------+              | BOTTOM DRAWER: Execution Log |
|   • Condition         | | AI Review |  | Diagnostian |              | 15:30:12 [node_started] ...  |
|   • Switch / Merge    | +-----------+  +-------------+              | 15:30:14 [node_completed] ...|
+----------------------------------------------------------------------------------------------------+
```

### 2.1 Central Infinite Canvas
- Powered by `@xyflow/react` with custom themed node rendering (`CustomFlowNode.tsx`).
- Smooth zoom (0.2x to 2.5x), panning, fit-to-view, interactive mini-map, and dot background grid.
- Animated edges indicating active execution and data flow direction.
- Real-time status indicators on nodes:
  - `pending`: neutral muted dot
  - `running`: glowing sky-blue pulse ring
  - `completed`: crisp emerald checkmark
  - `failed`: rose alert badge with error tooltip
  - `skipped`: dimmed dashed boundary (conditional branching)

### 2.2 Node Library
- Filterable search across all 29 node types.
- Categorized accordions: **AI Nodes**, **Context Nodes**, **Logic Nodes**, **Input/Output Nodes**, **Development Nodes**.
- Drag or single-click insertion directly onto the canvas.

### 2.3 Dual Experience: Simple Mode vs. Advanced Mode
- **Simple Mode**: Hides raw JSON configuration, complex permission manifests, and deep port schemas. Displays clean guided property forms and plain-language summaries.
- **Advanced Mode**: Exposes raw configuration parameters, port data types (`string`, `number`, `boolean`, `file_ref`, `json`, etc.), exact required permissions, and variable binding overrides.

---

## 3. Natural Language Workflow Generation

Users can click **AI Prompt** to describe an automation in natural language (e.g., *"Whenever I start working, scan for security issues, run tests, and summarize defects"*):

1. **Intent Analysis**: Classifies requested tasks into security, testing, review, documentation, or refactoring flows.
2. **DAG Compilation**: Generates real `FlowNode` and `FlowEdge` objects with appropriate handles and positions.
3. **Permission Aggregation**: Calculates the total permission footprint (filesystem, terminal, network) required.
4. **Human Review Gate**: Displays the generated DAG preview with explanation and validation results.
5. **Interactive Insertion**: Users can inspect, edit, or customize the generated workflow on the canvas before any execution occurs.

---

## 4. Built-in Production Templates

Flow Builder includes 10 production-ready templates ready to execute immediately:
1. **Project Security Audit**: Retrieves project metadata, searches for credentials/secrets, and runs security agent analysis.
2. **Automatic Code Review**: Inspects git diff, evaluates changes, and conducts adversarial code review.
3. **Generate Project Documentation**: Compiles AST context and tasks documentation specialist to produce architecture guides.
4. **Run Tests and Analyze Failures**: Runs `npm test` and automatically invokes AI diagnostician on failures.
5. **New Project Analysis**: Crawls workspace files and synthesizes an onboarding roadmap.
6. **Dependency & Package Audit**: Reads `package.json` and assesses deprecations/vulnerabilities.
7. **AI-Assisted Refactoring**: Coordinates multi-agent refactoring with automated test suite verification.
8. **Pull Request Preparation**: Typechecks, diffs, and drafts comprehensive PR summaries.
9. **Codebase Onboarding Guide**: Identifies key entrypoints and constructs a quick-start guide.
10. **Performance Analysis**: Scans hotpath patterns and proposes latency/memory optimizations.
