# Orbito — Editor Architecture & Integration Specification

## 1. Executive Summary

The code editing surface in **Orbito** provides a high-performance, responsive code editing environment tailored for AI-assisted software development, diff inspection, and rapid file modification.

This document outlines the current architecture of the lightweight editing surface, its performance characteristics, and the roadmap for Monaco / Language Server Protocol (LSP) / IntelliSense integration.

---

## 2. Current Architecture: Lightweight Editing Surface

### 2.1 Component Overview
The primary editor component resides at [`src/renderer/src/components/CodeEditor.tsx`](file:///C:/Users/gonca/OneDrive/Documents/Projects/Orbito/Orbito/src/renderer/src/components/CodeEditor.tsx).

It employs a synchronized dual-layer surface:
- **Foreground Interaction Layer:** Transparent HTML `<textarea>` handling native text input, IME composition, caret navigation, clipboard events, and selection.
- **Background Syntax Layer:** Monospace tokenized syntax highlight container (`<pre><code>`) synchronizing scroll positions (`scrollTop`, `scrollLeft`) with the input layer in sub-millisecond time.

### 2.2 Syntax Highlighting & Tokenization
- **Token Engine:** Regex-based tokenizer with keyword recognition for TypeScript, JavaScript, Python, Rust, Go, HTML, CSS, JSON, Markdown, and YAML.
- **Line Numbering:** Synchronized line numbers with dirty-line indicators and jump-to-line support.
- **Caret & Position Tracker:** Real-time line and column readout in the status bar.

### 2.3 Search & Replace
- In-editor search bar (triggered via `Ctrl+F` / `Cmd+F`).
- Exact substring and regular expression matching.
- Real-time match count badge and previous/next match navigation.

### 2.4 Dirty State & Tab Lifecycle
- Tracks modified state against the filesystem baseline.
- Warns before unsaved tab closure.
- Supports keyboard save shortcut (`Ctrl+S` / `Cmd+S`) invoking typed IPC `file:write`.

---

## 3. Performance & Resource Boundaries

| Metric | Boundary / Threshold | Enforcement Mechanism |
| :--- | :--- | :--- |
| **Maximum File Size** | 5 MB | IPC boundary rejection in `src/main/services/filesystem` |
| **Highlight Debounce** | 16ms (1 frame at 60fps) | Input debouncing to maintain smooth typing responsiveness |
| **Memory Footprint** | < 15 MB per tab | Strict DOM recycling and lightweight state in Zustand |
| **Startup Latency** | < 20ms | Zero heavy web worker bundle initialization at startup |

---

## 4. Integration Roadmap: Monaco & Language Server Protocol (LSP)

Orbito's architecture is prepared for a progressive hybrid editor strategy:

### Phase 1: High-Performance Lightweight Default (Current)
- Fast-launch, ultra-low memory usage for lightweight edits, config files, and quick reviews.

### Phase 2: Monaco Editor Optional Mode
- Monaco Editor (`@monaco-editor/react` / `monaco-editor-core`) dynamic import on demand for projects requiring deep multi-cursor, code folding, and rich minimaps.
- Lazy-loaded bundle to avoid impacting desktop startup time.

### Phase 3: Language Server Protocol (LSP) via Electron Process
- Node-based LSP client manager running in the Electron main process.
- Stdio and IPC transport communicating with language servers (`typescript-language-server`, `pyright`, `rust-analyzer`).
- Monaco LSP client bridge providing IntelliSense, parameter hints, auto-imports, and diagnostics.
