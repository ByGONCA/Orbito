# Rule: Multi-Agent Communication Protocol

## 1. Asynchronous State-Based Communication
Agents in the Orbito workspace communicate asynchronously through coordinated file state rather than volatile memory channels or unlogged chat streams.

## 2. Single Writer Protocol for Coordination State
- **Lead Architect:** Sole writer for `.agents/coordination/REGISTRY.json` and task files in `.agents/coordination/tasks/`.
- **Specialists:** Sole writers for their respective `.agents/coordination/agents/<agent-id>/` directories.
  - `STATUS.json`: Real-time operational state, task progress, and blockers.
  - `NOTES.md`: Scratchpad, implementation insights, and local state.
  - `HANDOFF.md`: Formal submission upon task completion.

## 3. Communication Channels
1. **Task Assignment:** Lead Architect -> Task Specification file (`.agents/coordination/tasks/active/<TASK_ID>.json`).
2. **Progress & Heartbeat:** Specialist -> `STATUS.json`.
3. **Impediments / Blockers:** Specialist -> `STATUS.json` (`blockers` array) + Lead Architect notification.
4. **Task Completion / Review:** Specialist -> `HANDOFF.md` + status changed to `WAITING`.
5. **Architectural Requests (RFC):** Specialist -> `.agents/coordination/decisions/` proposed ADR.

## 4. Message Format & Heartbeat Frequency
Specialists must update their `STATUS.json` timestamp (`last_activity`) at significant milestones:
- Beginning a task (`status: "BUSY"`)
- Major milestone reached (update `progress: <percentage>`)
- Encountering a blocking issue (`status: "BLOCKED"`)
- Completing local verification and requesting review (`status: "WAITING"`)
- Returning to standby (`status: "IDLE"`)
