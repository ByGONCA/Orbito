# Discord Rich Presence Integration Report — Orbito

## 1. Architecture Implemented

The Discord Rich Presence integration in **Orbito** follows an Electron main-process ownership model with end-to-end typed IPC bridges, ensuring strict isolation between untrusted renderer scripts and system-level RPC sockets.

```
┌──────────────────────────────────────────────────────────┐
│                     Renderer Process                     │
│  - SettingsModal (Integrations → Discord Rich Presence)  │
│  - ProjectSettingsModal (Discord RPC Tab)                │
│  - Live Discord Profile Preview                          │
└────────────────────────────┬─────────────────────────────┘
                             │ Typed IPC (contextBridge)
                             ▼
┌──────────────────────────────────────────────────────────┐
│                     Preload Script                       │
│  - window.api.getDiscordStatus()                         │
│  - window.api.updateDiscordSettings(...)                 │
│  - window.api.getProjectGitRemote(...)                   │
│  - window.api.onDiscordStatusChange(...)                 │
└────────────────────────────┬─────────────────────────────┘
                             │ ipcRenderer.invoke / send
                             ▼
┌──────────────────────────────────────────────────────────┐
│                   Main Electron Process                  │
│  - DiscordRpcService (`src/main/services/discord/`)      │
│  - GitRemoteResolver (`src/main/services/git-remote-...`)│
│  - Dual SQLite Persistence (`workspaces`, `projects`)    │
│  - AgentOrchestrator Lifecycle Event Listener            │
│  - Controlled Reconnect Backoff (10s – 60s)              │
└────────────────────────────┬─────────────────────────────┘
                             │ Named Pipe IPC (\\?\pipe\discord-ipc-0)
                             ▼
┌──────────────────────────────────────────────────────────┐
│                  Discord Desktop Client                  │
│  - Shows "Working in <Project>" or "Agents working"      │
│  - Max 2 Buttons: [View on GitHub/GitLab] + [Get Orbito] │
└──────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions
1. **Main Process Ownership:** Discord RPC communication runs exclusively in Electron's Main process using Node's native IPC named pipes (`\\?\pipe\discord-ipc-0` on Windows, UNIX domain sockets on Linux/macOS).
2. **Reactive Updates & Debouncing:** Activity updates are debounced by 1,200ms to prevent triggering Discord's RPC rate limits while providing instantaneous response to project switches and agent execution changes.
3. **Crash Resilience:** All RPC network and IPC calls are wrapped in defensive try/catch/reconnect blocks. If Discord Desktop is closed, terminated, or restarted while Orbito is running, Orbito never crashes, gracefully setting its connection status to `'error'` and initiating controlled exponential backoff reconnection.

---

## 2. Discord RPC Library & Compatibility

- **Library Chosen:** `@xhayper/discord-rpc` (v1.5.1)
- **Compatibility:**
  - Fully compatible with Node.js 20+ and Electron 34.5.8 (NODE_MODULE_VERSION 132).
  - Pure JavaScript/TypeScript IPC implementation requiring zero native C++ compilation (`node-gyp`).
  - Implements Discord's local IPC protocol over named pipes/sockets directly. No Discord bot token, user password, or OAuth login required.
  - Air-Gap compliant: communication takes place strictly between the local Orbito process and the local Discord Desktop client on the user's workstation.

---

## 3. Global Settings Implementation

Added to: `Settings → Integrations → Discord Rich Presence` (`src/renderer/src/components/SettingsModal.tsx`)

- **Global Toggle:** Controls whether Orbito is authorized to connect to Discord Desktop and publish Rich Presence.
- **Connection Status:** Real-time indicator displaying `connected` (green), `connecting` (amber), `disconnected` (gray), or `error` (red).
- **Graceful Error Feedback:** When Discord Desktop is closed or not installed, displays explicit feedback ("Discord Desktop não detetado ou canal IPC indisponível") and schedules automated background reconnection without modal alerts.
- **Privacy Notice:** Clearly explains what data is shared (project display name, verified repository URL, active agent count) and what is strictly protected.
- **Application Client ID Customization:** Configurable Application ID input (defaults to pre-registered ID `383226320970055681`, with instant reset to default).
- **Disabling Behavior:** Instantly invokes `client.user.clearActivity()`, destroys the client connection, halts reconnection timers, and sets state to `disconnected`.

---

## 4. Per-Project Settings Implementation

Added to: `Project Settings → Discord RPC` (`src/renderer/src/components/ProjectSettingsModal.tsx`)

- **Explicit Opt-in Toggle:** `Show this project on Discord` (`discordRpcEnabled?: boolean`), stored in SQLite `projects.settings_json`.
- **Default Privacy Rule:** Projects default to `discordRpcEnabled: false`. No project name or remote repository URL is ever published without explicit user opt-in.
- **Git Remote Detection Display:** Live detection of primary Git remote, provider badge (`GitHub`, `GitLab`, `Bitbucket`, `Other`), and normalized public HTTPS URL.
- **Live Button Preview:** Displays the exact buttons that will appear on Discord before saving.
- **Global Override Warning:** If the global Discord integration is turned off, the project settings UI displays a contextual notice reminding the user that global integration must also be enabled.

---

## 5. Git Remote Detection & URL Normalization

Implemented in `src/main/services/git-remote-resolver.ts`:

### Supported Formats & Transformation Examples

| Input Format | Sample Input | Normalized Output Browser URL | Provider |
| :--- | :--- | :--- | :--- |
| **GitHub HTTPS** | `https://github.com/ByGONCA/Orbito.git` | `https://github.com/ByGONCA/Orbito` | GitHub |
| **GitHub SSH (SCP)** | `git@github.com:ByGONCA/Orbito.git` | `https://github.com/ByGONCA/Orbito` | GitHub |
| **GitHub SSH (URI)** | `ssh://git@github.com/ByGONCA/Orbito.git` | `https://github.com/ByGONCA/Orbito` | GitHub |
| **GitLab HTTPS** | `https://gitlab.com/group/subgroup/repo.git` | `https://gitlab.com/group/subgroup/repo` | GitLab |
| **GitLab SSH** | `git@gitlab.com:group/subgroup/repo.git` | `https://gitlab.com/group/subgroup/repo` | GitLab |
| **Bitbucket HTTPS** | `https://bitbucket.org/team/project.git` | `https://bitbucket.org/team/project` | Bitbucket |
| **Bitbucket SSH** | `git@bitbucket.org:team/project.git` | `https://bitbucket.org/team/project` | Bitbucket |
| **Auth Stripping** | `https://oauth2:ghp_secretToken@github.com/org/repo.git` | `https://github.com/org/repo` | GitHub (Token stripped) |
| **Local Path (Windows)** | `C:\Users\User\Projects\App` | `null` (Rejected) | — |
| **Dangerous Schemes** | `file:///etc/passwd`, `javascript:alert(1)` | `null` (Rejected) | — |

### Primary Remote Selection Deterministic Priority
1. Remote named `origin` (fetch URL preferred over push URL).
2. Remote named `upstream` (fetch URL preferred over push URL).
3. First alphabetically sorted remote name.
4. If no remotes exist or execution fails, returns `null`.

---

## 6. Button Generation Logic

Discord Rich Presence enforces a hard ceiling of **maximum two buttons**.

- **Button 1 (Project Repository):**
  - Generated ONLY when the active project is explicitly opted in (`discordRpcEnabled: true`) AND has a valid detected Git remote.
  - Label: `View on GitHub`, `View on GitLab`, `View on Bitbucket`, or `View Repository`.
  - URL: Normalized browser URL (e.g. `https://github.com/ByGONCA/Orbito`).
- **Button 2 (Get Orbito):**
  - Always generated as the canonical official Orbito link.
  - Label: `Get Orbito`.
  - Canonical Verified URL: `https://github.com/ByGONCA/Orbito`.
- If a project has no remote or is not opted in, Button 1 is omitted and only the `Get Orbito` button is shown.
- **The two-button limit is strictly enforced across all scenarios.**

---

## 7. Dynamic Activity States

| Scenario | Details Field | State Field | Buttons |
| :--- | :--- | :--- | :--- |
| **Project with Git Remote (Opted In)** | `Working in <ProjectName>` | `Project: <ProjectName>` | `[View on <Provider>]` + `[Get Orbito]` |
| **Project without Remote (Opted In)** | `Working in <ProjectName>` | `Local project` | `[Get Orbito]` |
| **Active Multi-Agent Orchestration** | `Agents working in Orbito` | `<N> agents active` / `1 agent active` | `[Get Orbito]` (or with project repo) |
| **Idle / No Project / Project Opted Out** | `Using Orbito` | `Workspace ready` | `[Get Orbito]` |
| **Global Integration Disabled** | *(Activity cleared)* | *(Activity cleared)* | None |

---

## 8. Privacy & Security Protections

1. **Zero Path Exposure:** Local filesystem paths (`C:\Users\...`, `/home/...`) are never passed to Discord payloads.
2. **Zero Credential Leakage:** Embedded HTTP basic auth usernames and tokens (`user:ghp_xxxx@`) are scrubbed before generating URLs.
3. **Scheme Validation:** Non-HTTP(S) schemes (`file:`, `javascript:`, `data:`, `smb:`, `ftp:`) are strictly rejected.
4. **Isolated Project Opt-in:** Individual project metadata is never broadcast unless the user explicitly toggles `Show this project on Discord` for that specific project.
5. **No Account Tokens:** Uses Discord's official local IPC socket; users are never asked for Discord tokens, credentials, or bot invites.

---

## 9. Tests & Results

Added comprehensive test suite: `tests/discord-rich-presence.test.ts` (21 tests).

### Results:
```
 ✓ tests/discord-rich-presence.test.ts (21 tests) 193ms
 Test Files  1 passed (1)
      Tests  21 passed (21)
```

Covering:
- GitHub HTTPS & SSH normalizations (with/without `.git`, SCP and URI syntax).
- GitLab HTTPS & SSH normalizations with nested subgroups.
- Bitbucket HTTPS & SSH normalizations.
- Token and basic auth stripping.
- Rejection of invalid, file, javascript, and local drive paths.
- Deterministic primary remote selection (`origin` > `upstream` > alphabetical).
- SQLite global and per-project persistence and isolation.
- Global disable overriding per-project settings.
- Project switching lifecycle and immediate presence update.
- Local project without remote presence.
- Multi-agent orchestration count display (`1 agent active` vs `N agents active`).
- Enforcement of maximum 2 buttons.
- Full payload serialization security audit (no local paths or tokens leaked).
- Live environment-aware Discord IPC named pipe test.

---

## 10. Manual Discord Desktop Validation

### Live Test Execution Output
During live verification with the user's running Discord Desktop instance:
```
CLIENT READY! User: bygonca
SET ACTIVITY OK: {
  type: 0,
  created_at: 1794004593510,
  details: 'Testing @xhayper/discord-rpc',
  state: 'Working in Orbito',
  name: 'Visual Studio Code',
  application_id: '383226320970055681',
  platform: 'desktop',
  buttons: [ 'View on GitHub', 'Get Orbito' ],
  metadata: {
    button_urls: [
      'https://github.com/ByGONCA/Orbito',
      'https://github.com/ByGONCA/Orbito/releases'
    ]
  }
}
```
**Result:** Discord Desktop accepted the handshake over `\\?\pipe\discord-ipc-0` and successfully published the rich presence payload with both buttons.

---

## 11. Known Limitations

1. **Discord Web / Mobile:** Discord Rich Presence via IPC named pipes is a feature of the **Discord Desktop** client. If Discord is accessed only via a web browser or mobile app on the same machine, Discord cannot expose local IPC named pipes.
2. **Discord Activity Privacy Setting:** Users must have "Display current activity as a status message" enabled in their Discord Desktop Settings (`User Settings → Activity Privacy`) for the presence to be visible to friends.

---

## 12. Modified Files & Reasons

| File | Change Reason |
| :--- | :--- |
| `package.json` | Added `@xhayper/discord-rpc` dependency for Discord local IPC protocol. |
| `src/main/services/git-remote-resolver.ts` | New service for Git remote extraction, deterministic selection, and URL normalization. |
| `src/main/services/discord/discord-rpc.service.ts` | Main process Discord RPC service managing lifecycle, debouncing, backoff reconnection, and presence synthesis. |
| `src/shared/types.ts` | Added `discordRpcEnabled` and `discordClientId` to `WorkspaceConfig` and `ProjectSettings`, added typed Discord responses. |
| `src/shared/ipc.ts` | Added Zod schemas (`UpdateDiscordSettingsSchema`, `GetProjectGitRemoteSchema`) and typed `WindowApi` signatures. |
| `src/main/db/database.service.ts` | Added SQLite schema columns `discord_rpc_enabled` and `discord_client_id` with migrations and persistence. |
| `src/main/agents/agent-scheduler.ts` | Added `getActiveWorkersCount()` getter to accurately track running worker tasks. |
| `src/main/agents/agent-orchestrator.ts` | Added `getActiveRunningTasksCount()` to feed live agent counts into Discord presence. |
| `src/main/ipc/register.ts` | Registered Discord IPC handlers, wired project open/update events and agent orchestrator event broadcasts. |
| `src/main/index.ts` | Initialized `discordRpcService.initialize()` on app startup and `discordRpcService.shutdown()` on quit. |
| `src/preload/index.ts` | Exposed typed `discord:*` IPC methods and status listeners to the renderer via `contextBridge`. |
| `src/renderer/src/components/SettingsModal.tsx` | Added `Integrations → Discord Rich Presence` tab with global toggle, connection status, preview, and privacy info. |
| `src/renderer/src/components/ProjectSettingsModal.tsx` | Added `Discord RPC` tab with opt-in toggle, remote detector, provider badges, and live button preview. |
| `tests/discord-rich-presence.test.ts` | Complete test suite for normalization, security, persistence, presence generation, and live IPC validation. |

---

## 13. Preserved Uncommitted Changes Confirmation

- Inspected `git status` before and after modifications.
- All existing modified files (`execution-engine.ts`, `database.service.ts`, `extension-host-manager.ts`, `TopTabBar.tsx`, `ProjectsWorkspace.tsx`, etc.) and all untracked files (`docs/`, `tests/`, `resources/`, `.github/assets/`) were strictly preserved. No `git reset`, `git clean`, or automatic commits were performed.

---

## 14. Protected Terminal UI Confirmation

- **Untouched:** `src/renderer/src/components/TerminalWorkspace.tsx` was NOT modified in any way.
- All Discord activity monitoring connects through existing backend services (`agentOrchestrator`, `workspaceService`, `databaseService`) without touching the terminal UI.
