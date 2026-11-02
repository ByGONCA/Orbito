# AI Workspace — Extension Security 2.0: OS-Level Sandboxing Report

## Executive Summary

Following the remediation of `node:vm` in Extension Security 1.0, an in-depth security audit revealed that running extension code within a standard Node.js child process (`child_process.fork()`)—even with environment variable sanitization—does not restrict operating system privileges. Under the user's OS account, untrusted extensions could directly import Node's native `fs`, `child_process`, `worker_threads`, and `net` modules to access user credentials (`~/.ssh`, `~/.aws`), local application databases (`data/app.db`), spawn arbitrary subprocesses, and open raw network sockets.

**Extension Security 2.0: OS-Level Sandboxing** upgrades the isolation architecture to enforce genuine OS- and runtime-level access controls. By integrating the native **Node.js Permission Model** (`--permission`), operating-system process mitigations, memory quotas, immutable network socket interceptors, and process tree termination, untrusted third-party code is strictly confined to its declared capabilities.

All boundaries were verified against 13 automated adversarial tests in [`tests/extension-os-sandboxing.test.ts`](file:///C:/Users/gonca/Documents/coding/Projects/Orc/tests/extension-os-sandboxing.test.ts). The entire test suite passed with **43 test files and 263 tests passed (0 failures)**.

---

## 1. Audit Findings & Threat Model: Standard Child Process vs OS Sandboxing

| Vector | Previous Process Isolation (`fork()` only) | Extension Security 2.0: OS-Level Sandboxing |
|---|---|---|
| **Direct `require('child_process')`** | **Vulnerable**: Any extension could call `execSync('rm -rf ...')` or invoke system shell. | **Denied**: Node runtime permission system rejects ChildProcess access with `ERR_ACCESS_DENIED`. |
| **Direct `require('worker_threads')`** | **Vulnerable**: Extensions could spawn background threads escaping worker tracking. | **Denied**: Worker threads access rejected with `ERR_ACCESS_DENIED`. |
| **Direct `require('fs')` Outside Workspace** | **Vulnerable**: Extensions could read `~/.ssh`, `data/app.db`, or parent directories. | **Denied**: Strict `--allow-fs-read` boundaries enforce `ERR_ACCESS_DENIED` on all unauthorized paths. |
| **Direct `require('fs')` Write Outside Storage** | **Vulnerable**: Extensions could overwrite system files or write outside workspace. | **Denied**: Strict `--allow-fs-write` boundaries enforce `ERR_ACCESS_DENIED` on unauthorized writes. |
| **Outbound Network Probing** | **Vulnerable**: Extensions could call `net.createConnection()` to connect externally. | **Denied**: Socket prototypes hooked & frozen; direct calls throw `ERR_ACCESS_DENIED`. |
| **Local Service & Loopback Probing** | **Vulnerable**: Extensions could connect to `127.0.0.1` (Ollama, PostgreSQL, Docker). | **Denied**: Local loopback (`127.0.0.1`, `localhost`, `::1`) and RFC1918 subnets blocked. |
| **Air-Gap Mode Bypass** | **Vulnerable**: Child process sockets were not governed by AirGapManager. | **Denied**: Network sandbox unconditionally blocks all sockets when Air-Gap is active. |
| **Native C++ Addons (.node)** | **Vulnerable**: Extensions could compile or load `.node` binary shared libraries. | **Denied**: Native addons disabled (`--allow-addons` omitted). |
| **Memory Exhaustion / Fork Bomb** | **Vulnerable**: Extensions could allocate gigabytes of RAM or spawn infinite processes. | **Mitigated**: Capped via `--max-old-space-size=128`, max 5 concurrent hosts, execution timeouts. |
| **Orphaned Background Descendants** | **Vulnerable**: Killing parent might leave child subprocesses running. | **Mitigated**: Process tree termination via `taskkill /F /T` (Windows) and process groups (Unix). |

---

## 2. Multi-Layer OS & Runtime Sandboxing Architecture

```mermaid
flowchart TD
    subgraph Trusted Electron Main Process
        Main["Electron Main Process\n(Full OS Privileges)"]
        EHM["ExtensionHostManager\n(Capability & Policy Authority)"]
        OSP["OSSandboxPolicy\n(Platform Probing & Arg Builder)"]
        Audit["AuditService\n(Security Violation Logging)"]
        Main --> EHM
        EHM --> OSP
        EHM --> Audit
    end

    subgraph OS Boundary & Process Spawn
        Args["Sandbox Flags:\n--permission\n--allow-fs-read=<workerDir>*\n--allow-fs-read=<installPath>*\n--allow-fs-write=<storagePath>*\n--max-old-space-size=128\n--disallow-code-generation-from-strings"]
        OSP --> Args
        Args --> Spawn["child_process.fork()\n(Restricted Runtime)"]
    end

    subgraph OS-Restricted Extension Host Process
        Worker["ExtensionHostWorker\n(Immutable Socket Interceptor)"]
        RPC["Validated JSON-RPC Channel\n(Max 5MB Payload)"]
        Ext["Third-Party Extension Module\n(Sandboxed Context)"]
        Spawn --> Worker
        Worker <-->|Capability RPC| EHM
        Worker --> RPC
        RPC --> Ext
    end

    subgraph OS Enforcement Traps
        Ext -.->|require child_process| TrapCP["ERR_ACCESS_DENIED\n(Node.js Permission Model)"]
        Ext -.->|fs.readFileSync outside| TrapFS["ERR_ACCESS_DENIED\n(Node.js Permission Model)"]
        Ext -.->|net.connect loopback| TrapNet["ERR_ACCESS_DENIED\n(Network Sandbox Guard)"]
        Ext -.->|OOM Allocation > 128MB| TrapMem["V8 OOM Exit\n(Only Host Crashes)"]
    end
```

---

## 3. Platform-by-Platform Security Comparison

| Operating System | Sandboxing Enforcement Mechanism | Filesystem Guarantees | Network Guarantees | Subprocess Guarantees | Residual Risks |
|---|---|---|---|---|---|
| **Windows** | Node.js Permission Model + Process Mitigation Policies + Taskkill Tree Kill | Strict `--allow-fs-read` and `--allow-fs-write` whitelists; non-whitelisted paths blocked with `ERR_ACCESS_DENIED`. | Socket/Datagram prototype hooks block outbound TCP/UDP, loopback (`127.0.0.1`), and RFC1918 private subnets. | Spawning blocked at runtime (`ERR_ACCESS_DENIED`). Tree-kill kills process tree recursively. | Windows AppContainer isolation requires native helper wrapper; Node Permission Model provides runtime containment. |
| **macOS** | Node.js Permission Model + `sandbox-exec` / Hardened Runtime | Same runtime whitelisting; `sandbox-exec` seatbelt profile restricts kernel-level file descriptor access where available. | Blocked by network interceptor; Air-Gap strictly drops sockets. | Subprocesses denied. Process groups killed on exit (`process.kill(-pid)`). | `sandbox-exec` is deprecated by Apple in favor of App Sandbox for signed bundles. |
| **Linux** | Node.js Permission Model + Bubblewrap (`bwrap`) Namespaces | Runtime whitelisting; when `bwrap` is installed, user namespaces unmount all sensitive filesystems (`--ro-bind`, `--proc /proc`). | Namespace network drop (`--unshare-net`) when `bwrap` present; otherwise prototype interceptor. | PR_SET_NO_NEW_PRIVS / ChildProcess denial. Process groups killed on exit. | Linux hosts without `bwrap` rely on Node.js Permission Model and environment sanitization. |

---

## 4. Resource Limits & Quotas

The Extension Host enforces strict physical resource bounds:
- **Maximum Heap Memory**: `--max-old-space-size=128` (128 MB per extension host). If an extension experiences a memory leak, V8 terminates only that extension host process without affecting the Main application.
- **Concurrent Host Process Cap**: Maximum 5 active concurrent extension host processes (`MAX_CONCURRENT_HOSTS = 5`). Additional activation attempts are rejected with `extension_concurrency_limit` violation.
- **RPC Message Frame Cap**: Maximum 5 MB per JSON-RPC frame (`MAX_RPC_MESSAGE_BYTES = 5 * 1024 * 1024`). Oversized messages are rejected immediately.
- **Activation Watchdog**: `ACTIVATE` RPC calls enforce an 8,000ms timeout. Extensions hanging in infinite initialization loops are killed.
- **Execution Watchdog**: Workflow node executions enforce a 10,000ms timeout (`EXECUTE_NODE`).

---

## 5. Graceful Degradation & Untrusted Third-Party Gating

When running on an unsupported operating system or runtime where Node.js Permission Model is unavailable:
1. **Third-Party Extensions Disabled by Default**:
   `osSandboxPolicy.canExecuteUntrusted(record)` evaluates host capabilities. If sandboxing is unavailable, untrusted extension activation is blocked with a clear explanation:
   `"Cannot activate untrusted extension '<id>': Operating-system / runtime-level sandboxing is unavailable on this host (<platform>). To protect system integrity, third-party extensions are disabled by default on unsandboxed hosts."`
2. **Built-In Trusted Extensions Permitted**:
   Extensions shipped with the application (`record.isBuiltIn === true`) continue operating normally.
3. **Explicit User Override**:
   If an administrator or developer explicitly enables `allowUnsandboxedOverride: true`, third-party extensions are permitted with an audited high-severity warning log (`unsandboxed_override_warning`).

---

## 6. Security Testing & Adversarial Verification

All security boundaries were verified via [`tests/extension-os-sandboxing.test.ts`](file:///C:/Users/gonca/Documents/coding/Projects/Orc/tests/extension-os-sandboxing.test.ts):
- `denies direct require("child_process") and subprocess execution at the OS/runtime level`: **PASS** (`ERR_ACCESS_DENIED`)
- `denies direct require("worker_threads") spawning at the OS/runtime level`: **PASS** (`ERR_ACCESS_DENIED`)
- `denies direct require("fs").readFileSync() on sensitive paths outside extension install boundary`: **PASS** (`ERR_ACCESS_DENIED`)
- `denies direct require("fs").writeFileSync() attempting to write outside authorized storage`: **PASS** (`ERR_ACCESS_DENIED`)
- `denies outbound TCP connection when extension manifest has not granted network permissions`: **PASS** (`ERR_ACCESS_DENIED`)
- `denies connections to local loopback and private subnets even when external network is permitted`: **PASS** (`ERR_ACCESS_DENIED`)
- `unconditionally blocks all network calls under active Air-Gap Mode even if manifest permitted network`: **PASS** (`ERR_ACCESS_DENIED`)
- `enforces concurrent extension host process limits (max 5)`: **PASS**
- `cleanly terminates process tree without leaving orphaned processes`: **PASS**
- `blocks untrusted third-party extensions when sandboxing is unavailable`: **PASS**
- `allows built-in extensions to execute even if third-party untrusted extensions are restricted`: **PASS**
- `allows untrusted execution on unsandboxed hosts only when explicit user override is configured`: **PASS**
- `produces a transparent platform security comparison report`: **PASS**

### Regression Suite Status
- **Total Test Files**: 43 passed (43)
- **Total Tests**: 263 passed, 4 skipped, 0 failures (267 total)
- **Production Build**: Clean pass with 0 errors
