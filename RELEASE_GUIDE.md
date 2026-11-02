# AI Workspace — Open-Source Production Release Guide
**Target Version:** v1.0.0  
**Supported Platforms:** Windows 10/11 (x64, arm64), macOS 12+ (Apple Silicon, Intel), Linux (Ubuntu 22.04+, Debian 12+, Fedora 38+)

---

## 1. System Requirements & Prerequisites

### 1.1 Developer & Build Machine Requirements
- **Node.js:** v22.12.0 LTS or later (tested on v22.14.0)
- **Package Manager:** `npm` v10.0.0+
- **Build Tools:**
  - **Windows:** Visual Studio 2022 C++ Build Tools (`Desktop development with C++`) or `windows-build-tools`
  - **macOS:** Xcode Command Line Tools (`xcode-select --install`)
  - **Linux:** `build-essential`, `python3`, `libsqlite3-dev`
- **Git:** v2.30.0+ (required for worktree management and branch isolation)

### 1.2 Optional AI Provider Integrations
- **Anthropic Claude Code CLI:** `claude` on `PATH`
- **OpenAI Codex CLI:** `codex` on `PATH`
- **Google Gemini CLI:** `gemini` on `PATH`
- **Local Models (Ollama):** Local Ollama service running on `http://127.0.0.1:11434` (required for offline Air-Gap mode)

---

## 2. Production Build Pipeline

Execute the clean build pipeline in sequence:

```bash
# 1. Clean installation of pinned dependencies
npm ci

# 2. Recompile native C++ bindings for the target Electron version
npm run postinstall

# 3. Static type check across Main, Preload, and Renderer codebases
npm run typecheck

# 4. Execute the comprehensive automated test suite (38 test suites, 209 tests)
npm test

# 5. Compile production assets with electron-vite
npm run build
```

The compiled bundles will be output to:
- `out/main/index.js` (Main process bundle)
- `out/preload/index.js` (Preload script)
- `out/renderer/` (Vite production web assets)

---

## 3. Cross-Platform Packaging with Electron Builder

AI Workspace utilizes `electron-builder` for multi-platform distribution.

### 3.1 Windows Distribution
```bash
# Build Windows NSIS Installer (.exe) and Portable executable
npm run build:win
```
- **Targets:** NSIS Installer (`.exe`), Portable executable (`.exe`).
- **Architecture:** `x64` (default), `arm64`.

### 3.2 macOS Distribution
```bash
# Build Apple Silicon (arm64) and Intel (x64) DMG bundles
npm run build:mac
```
- **Targets:** Apple Disk Image (`.dmg`), zipped bundle (`.zip`).
- **Architectures:** Universal binary (`universal`), Apple Silicon (`arm64`), Intel (`x64`).

### 3.3 Linux Distribution
```bash
# Build Linux distribution packages
npm run build:linux
```
- **Targets:** `AppImage` (self-contained, universal distribution), `.deb` (Debian/Ubuntu).
- **Prerequisites:** Ensure `libsqlite3-dev` and standard GTK3 libraries are available on the host.

---

## 4. Code Signing & Release Security

> [!CAUTION]
> Never commit self-signed dummy certificates, private keys, or credentials into the Git repository. Release artifacts must be signed in secure, isolated CI environments using environment secret injection.

### 4.1 Windows Code Signing
Set the following environment variables in your CI release runner (e.g., GitHub Secrets):
```env
WIN_CSC_LINK=base64_encoded_pfx_certificate
WIN_CSC_KEY_PASSWORD=certificate_decryption_password
```

### 4.2 Apple Notarization & macOS Signing
Configure Apple Developer certificates and notarization credentials:
```env
CSC_LINK=base64_encoded_apple_developer_id_application_cert
CSC_KEY_PASSWORD=certificate_password
APPLE_ID=developer@example.com
APPLE_APP_SPECIFIC_PASSWORD=abcd-efgh-ijkl-mnop
APPLE_TEAM_ID=XXXXXXXXXX
```

---

## 5. GitHub Actions Continuous Integration (CI)

The repository includes a cross-platform CI matrix (`.github/workflows/test.yml`):

```yaml
name: CI Matrix (Cross-Platform)

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  native-matrix:
    name: Build & Test on ${{ matrix.os }}
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
        node-version: [22.x]

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install Linux Build Prerequisites
        if: runner.os == 'Linux'
        run: |
          sudo apt-get update
          sudo apt-get install -y build-essential python3 libsqlite3-dev

      - name: Install Dependencies
        run: npm ci

      - name: Rebuild Native Modules
        run: npm run postinstall

      - name: Run TypeScript Typecheck
        run: npm run typecheck

      - name: Run Test Suite
        run: npm test

      - name: Run Production Build
        run: npm run build
```

---

## 6. First-Run Smoke Test & Validation Checklist

Before releasing a new version binary, perform this verification checklist on a clean test machine:

1. **Launch:** Start application (`npm start` or double-click packaged executable). Ensure window opens within 2 seconds without blank screens or console errors.
2. **Workspace Creation:** Open a local Git directory. Verify file tree displays project files and indexing completes.
3. **Provider Detection:** Navigate to Settings / Providers. Verify installed CLIs (`claude`, `codex`, `gemini`, `ollama`) report accurate status (`ready`, `not_installed`, or `authentication_required`).
4. **Air-Gap Activation:** Toggle Air-Gap mode ON in Settings. Verify that cloud providers seamlessly reroute to local Ollama.
5. **Workflow Execution:** Open Flow Builder, select a template (e.g. "PR Review Pipeline"), and click "Run Workflow". Verify node execution events update in real time.
6. **Clean Exit:** Close window and verify all background processes terminate cleanly without dangling Node.js processes in task manager.
