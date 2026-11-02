# Centralized Prompt Engineering & Assembly Specification

## Overview

The **Prompt Assembly Service** (`src/main/prompt/prompt-assembly.service.ts`) provides a deterministic, token-budgeted pipeline for compiling complex LLM prompts from modular, prioritized sections.

Ad-hoc prompt assembly frequently leads to:
- Context overflow exceeding provider limits.
- System instructions buried under voluminous code fragments.
- Redundant and conflicting constraints.
- Inconsistent prompting formats across different CLI adapters and agents.

`PromptAssemblyService` resolves these issues by enforcing a canonical 8-section layout with hierarchical priority budgets and deterministic SHA-256 fingerprinting.

---

## Canonical 8-Section Hierarchy

Prompts are assembled strictly in order of priority (100 down to 50):

| Section # | Section Type | Priority | Mandatory | Purpose | Trimming Behavior |
|---|---|---|---|---|---|
| 1 | `system` | 100 | **Yes** | Core behavioral guidelines, agent role | Never trimmed |
| 2 | `security` | 95 | **Yes** | Security constraints, read/write limits, air-gap policy | Never trimmed |
| 3 | `objective` | 90 | **Yes** | Direct user goal or task specification | Never trimmed |
| 4 | `acceptance_criteria` | 85 | No | Numbered list of verifiable requirements | Truncated only if budget is critically starved |
| 5 | `skills` | 80 | No | Composed domain skill instructions (Level 1, 2, or 3) | Dropped/collapsed to Level 2 summary |
| 6 | `context` | 70 | No | Code fragments, symbol definitions, file snippets | Truncated line-by-line with indicator |
| 7 | `history` | 60 | No | Prior tool outputs, test failures, agent communication | Truncated head/tail |
| 8 | `format` | 50 | No | Output format specification (JSON/XML/Markdown) | Dropped if budget exceeded |

---

## Token Budgeting & Progressive Trimming Algorithm

When an assembly request specifies a `maxTokens` limit (or when computing against model limits via `TokenCounterService`):

1. **Calculate Total Section Tokens**: Computes model-aware BPE token count for each section using `TokenCounterService` (`o200k_base` / `cl100k_base` / calibrated).
2. **Mandatory Budget Validation (`MandatoryBudgetExceededError`)**:
   - Calculates the sum of mandatory sections (`system`, `security`, `objective`).
   - If mandatory sections alone exceed `totalCapacity`, the service **refuses to silently truncate core constraints** and throws `MandatoryBudgetExceededError` containing `mandatoryTokens`, `totalCapacity`, and `sectionBreakdown`.
3. **Ascending Priority Trimming**: If total tokens exceed `maxTokens`, the algorithm iterates over non-mandatory sections in ascending order of priority (Section 8 first, then 7, then 6):
   - If the section tokens are smaller than or equal to the excess, the entire section is omitted.
   - If the section can fit partially in the remaining budget, it is trimmed cleanly with a marker:
     `[... Section truncated to fit token budget ...]`.
4. **Zero Safety Regression**: Security constraints (`priority: 95`) and user tasks (`priority: 90`) are never dropped or compromised.

---

## Provider-Specific Formatting

`PromptAssemblyService` supports three formatting modes:

### 1. XML Tags (`providerFormat: 'xml_tags'`)
Optimized for Claude 3.5 / 3.7 Sonnet:
```xml
<system>
<!-- Core System Protocol -->
You are an expert software engineer.
</system>

<security>
<!-- Mandatory Security Constraints -->
- Do not execute unverified shell commands.
</security>

<objective>
<!-- Task Objective -->
Refactor database connection pool.
</objective>
```

### 2. Structured Markdown (`providerFormat: 'markdown'`)
Optimized for Codex / GPT-4o:
```markdown
### Core System Protocol
You are an expert software engineer.

### Mandatory Security Constraints
- Do not execute unverified shell commands.

### Task Objective
Refactor database connection pool.
```

---

## Semantic Whitespace Compression

Formatting whitespace is cleaned dynamically during assembly:
```typescript
public static compressWhitespace(text: string): string
```
- **Code Regions (` ``` `)**:
  - Preserves indentation, spaces, and single/double newlines.
  - Collapses 3+ consecutive newlines to 2.
- **Text & Prompt Regions**:
  - Removes trailing per-line spaces (`/[ \t]+$/gm`).
  - Limits consecutive linebreaks to at most two.
- **Savings**: Reduces token consumption on typical codebase context by 12–25%.

---

## Deterministic Fingerprinting & Caching

Every assembled prompt generates a SHA-256 fingerprint:
```typescript
const promptFingerprint = crypto
  .createHash('sha256')
  .update(`${modelTarget}|${assembledPrompt}`)
  .digest('hex');
```

This fingerprint serves as the cache key for `MultiTierCacheService.promptCache` and `modelResponseCache`, enabling instant zero-token lookups for repeat invocations.
