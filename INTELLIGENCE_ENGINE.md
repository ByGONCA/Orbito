# Intelligence Engine Architecture — AI Workspace

## System Overview

The **Intelligence Engine** is the orchestration and decision-making nervous system of AI Workspace. It bridges user requests, workflows, and multi-agent operations with optimal model selection, context preparation, skill synthesis, and cost-effective execution.

Rather than treating LLM interactions as black-box string prompts, the Intelligence Engine operates a multi-stage cognitive pipeline:
1. **Task Categorization**: Evaluates user intent, complexity, reasoning depth, and required capabilities.
2. **Dynamic Routing**: Determines the best-fit model, provider, and execution tier based on cost policies and privacy mode.
3. **Progressive Skill Synthesis**: Selects and compiles only the relevant skill capabilities at the lowest necessary granularity.
4. **Context Distillation**: Slices and deduplicates codebase context to provide the minimum sufficient information.
5. **Deterministic Caching**: Prevents redundant model invocations through cryptographically fingerprinted LRU tiers.

---

## Architecture Diagram

```mermaid
flowchart TD
    subgraph Inputs
        Req["User Request / Agent Goal"]
        Env["Workspace Files & Symbols"]
        Skills["Domain Skill Registry"]
    end

    subgraph Intelligence Core
        Router["IntelligenceRouter\n• Categorization (Classification, Refactoring, Architecture)\n• Capability Matching\n• Cost Estimation ($/1M tokens)\n• Air-Gap Mode Isolation"]
        Composition["SkillCompositionService\n• Progressive Levels (Metadata, Summary, Full)\n• Conflict Resolution\n• Deduplication of Boilerplate"]
        PromptAssembler["PromptAssemblyService\n• Canonical 8-Section Layout\n• Strict Priority Ordering\n• Whitespace Compression\n• Token Budget Enforcement"]
    end

    subgraph Execution & Caching
        Normalizer["ToolOutputNormalizer\n• Error Hoisting\n• ANSI Stripping\n• Head/Tail Preservation"]
        Cache["MultiTierCacheService\n• Context AST Cache (30m)\n• Skill Cache (60m)\n• Prompt Cache (15m)\n• Model Response Cache (60m)"]
        CLI["CLI Execution Engine\n(Claude / Codex / Gemini / Ollama)"]
    end

    Req --> Router
    Skills --> Composition
    Env --> PromptAssembler
    Router --> PromptAssembler
    Composition --> PromptAssembler
    PromptAssembler --> Cache
    Normalizer --> PromptAssembler
    Cache -->|Cache Miss| CLI
    Cache -->|Cache Hit (0 Tokens)| Req
```

---

## Intelligence Routing & Model Selection

`IntelligenceRouter` acts as the single authority for selecting which provider and model execute each operation:

### 1. Task Classification Matrix

| Task Category | Dominant Requirements | Recommended Tier | Models |
|---|---|---|---|
| `classification` | Fast, deterministic parsing, low latency | High-throughput, low cost | `gpt-4o-mini`, `gemini-2.0-flash`, `claude-3-haiku` |
| `summarization` | High compression, concise synthesis | Fast, low-to-mid cost | `gpt-4o-mini`, `gemini-2.0-flash`, `claude-3-haiku` |
| `code_generation` | Type safety, idiomatic patterns, precision | Frontier coding | `claude-3-7-sonnet`, `gpt-4o` |
| `deep_reasoning` | Multi-step causality, root cause analysis | Extended thinking / reasoning | `claude-3-7-sonnet` (Thinking mode) |
| `architecture` | Systems design, broad structural decomposition | Frontier reasoning | `claude-3-7-sonnet`, `gpt-4o` |
| `security_review` | Adversarial modeling, taint analysis | Deep verification | `claude-3-7-sonnet` |
| `large_context` | Monorepo index, repository-wide audits (>100k) | Ultra-large context window | `gemini-1.5-pro` (1M+ window) |

### 2. Optimization Modes

1. **`cost_efficient`**: Prefers lightweight models, applies aggressive context trimming, uses Level 1 or 2 skill summaries, and enforces tight token caps.
2. **`balanced` (Default)**: Balances quality and expenditure, routing complex generation to Sonnet/GPT-4o while routing auxiliary tasks (classification, search, summary) to Flash/Haiku.
3. **`max_quality`**: Maximizes reasoning depth, preserves complete context fragments, loads Level 3 skill instructions, and enables extended reasoning budgets.

### 3. Strict Air-Gap Isolation Override
If **Air-Gap Mode** is enabled (`airGapManager.isAirGapEnabled() === true`):
- All cloud provider routes (Anthropic Claude, OpenAI Codex, Google Gemini) are strictly prohibited.
- `IntelligenceRouter` unconditionally overrides the routing destination to the local **Ollama** daemon.
- Zero outbound network packets are dispatched; cost is set to $0.00.

---

## Progressive Skill Composition & Conflict Resolution

When multiple skills are activated for an agent (e.g., `code-review`, `refactoring`, `test-generation`), instructions often overlap or conflict.

`SkillCompositionService` solves this through:
- **Primary vs. Supporting Designation**: The leading skill serves as the primary protocol; secondary skills serve as supporting constraints.
- **Instruction Deduplication**: Universal coding advice (clean code, avoiding unrelated changes) is extracted and consolidated into a unified header.
- **Conflict Resolution**: Contradictory output requirements are reconciled by prioritizing the primary skill's schema.
- **Telemetry-Guided Ranking**: Records success rate and token consumption per skill, boosting resolver confidence for reliable skills.

---

## Security Boundaries & Safety Guarantees

1. **Non-Tampering of Mandatory Protocols**: Core system rules and security constraints (`priority: 100` and `95`) can never be trimmed or omitted by budget limits.
2. **Secret Leakage Prevention**: Caches inspect prompt contents using regex filters; any request containing passwords, API keys, or private tokens is rejected from caching.
3. **Local-First Boundary**: Telemetry and cache storage remain 100% on the local workstation inside encrypted SQLite and memory.
