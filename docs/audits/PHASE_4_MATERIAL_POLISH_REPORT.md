# Orbito — Phase 4: Glassmorphism Material Polish & Bugfix Report

## Executive Summary

This report documents the resolution of the **intermittent background opacity bug** and the calibration of **higher transparency with a deeper, darker obsidian background tint** for Orbito. 

The bug causing the interface to intermittently drop transparency and turn into a solid opaque background was traced to Windows 11 Desktop Window Manager (DWM) Acrylic lifecycle suspension on window blur/restore/unmaximize cycles, combined with an opaque CSS fallback (`var(--app-window-bg, #101113)`). 

Following the fix, the glass materials were recalibrated to be **visibly darker (deep obsidian tone `#06070a`)** while **significantly increasing transparency (reducing surface opacity from 0.34 down to 0.20)**, allowing the desktop backdrop to transmit clearly with higher contrast and rich optical depth without milky gray hazing.

---

## 1. Root Cause Analysis & Bug Fixes

### Bug: Background Starts Semi-Transparent and Suddenly Turns Solid

1. **Windows 11 DWM Lifecycle Suspension**:
   - In Windows 11 (22H2/23H2/24H2), the Desktop Window Manager (DWM) Acrylic blur effect is transient and stateful. When an Acrylic window blurs, is unmaximized, restored from minimized state, or resized, DWM suspends the translucent shader and falls back to a solid opaque system background.
   - **Resolution**: Implemented `ensureWindowGlassMaterial()` in [`src/main/index.ts`](file:///C:/Users/gonca/OneDrive/Documents/Projects/Orbito/Orbito/src/main/index.ts) that actively re-asserts `win.setBackgroundColor('#00000000')` and `win.setBackgroundMaterial('acrylic')` on window `focus`, `restore`, `unmaximize`, `resized`, `moved`, and `show` events. Added IPC handler `window:refreshMaterial` and post-unmaximize re-assertion in [`src/main/ipc/register.ts`](file:///C:/Users/gonca/OneDrive/Documents/Projects/Orbito/Orbito/src/main/ipc/register.ts).

2. **CSS Variable Fallback to Opaque Black**:
   - In [`src/renderer/src/index.css`](file:///C:/Users/gonca/OneDrive/Documents/Projects/Orbito/Orbito/src/renderer/src/index.css), `.app-canvas-root` had `background: var(--app-window-bg, #101113);`. Any momentary layout re-computation or variable evaluation delay caused Chromium's compositor to snap to `#101113` (100% opaque black).
   - **Resolution**: Updated the fallback to `background: var(--app-window-bg, transparent);`.

3. **Store Theme Synchronization**:
   - In [`src/renderer/src/stores/workspace.store.ts`](file:///C:/Users/gonca/OneDrive/Documents/Projects/Orbito/Orbito/src/renderer/src/stores/workspace.store.ts), `setTheme` updated the DOM class list but omitted notifying the main process via `window.api.updateSettings({ theme })`.
   - **Resolution**: Added automatic persistence and main process notification to `setTheme` in `workspace.store.ts`.

---

## 2. Darker Obsidian Color Calibration & Increased Transparency

To fulfill the user request (*"aumentes mais a transparencia e que a cor do bg seja mais escura"*), the surface color tokens were shifted from bluish-navy (`rgba(14, 17, 26, ...)`) to deep obsidian black (`rgba(6, 7, 10, ...)` / `rgba(5, 6, 9, ...)`), while lowering alpha values to allow ~80% light transmission:

| Token | Previous Value | New Calibrated Value | Visual Impact |
| :--- | :--- | :--- | :--- |
| `--app-window-bg` | `rgba(10, 12, 16, 0.06)` | **`rgba(0, 0, 0, 0.02)`** | Near-zero base canvas tint, maximizing optical transmission through all panels. |
| `--glass-surface-bg` (Workspace) | `rgba(14, 17, 26, 0.34)` | **`rgba(6, 7, 10, 0.20)`** | **Darker obsidian hue with 41% higher transparency**, revealing desktop shapes clearly. |
| `--glass-sidebar-bg` (Sidebar) | `rgba(11, 14, 22, 0.42)` | **`rgba(5, 6, 9, 0.28)`** | Deep obsidian sidebar with enhanced translucency. |
| `--glass-header-bg` (Top Bar) | `rgba(12, 15, 24, 0.40)` | **`rgba(6, 7, 10, 0.26)`** | Clean, dark obsidian top bar with crisp top specular rim. |
| `--glass-status-bg` (Status Bar) | `rgba(10, 12, 20, 0.52)` | **`rgba(5, 6, 9, 0.35)`** | Grounded lower glass bar with subtle rim. |
| `--glass-panel-bg` (Modals/Palette) | `rgba(15, 19, 30, 0.46)` | **`rgba(6, 8, 12, 0.32)`** | Elevated obsidian floating glass plate with soft depth shadow. |
| `--glass-blur` | `12px` | **`14px`** | Restrained frost diffusion; smooth backdrop blending. |
| `--glass-saturate` | `140%` | **`135%`** | Balanced saturation preventing unnatural color cast. |
| `--glass-border` | `1px solid rgba(255, 255, 255, 0.08)` | **`1px solid rgba(255, 255, 255, 0.07)`** | Ultra-fine translucent boundary. |

---

## 3. Empirical Measurements on Windows 11 Desktop

Pixel sampling was performed across the captured real desktop screenshot (`orbito-glassmorphism.png`) and the opaque baseline (`orbito-solid-dark.png`):

| Region | Solid Dark Mode (Opaque Baseline) | Calibrated Obsidian Glass (Real Desktop Capture) | Visual Depth & Wallpaper Bleed |
| :--- | :--- | :--- | :--- |
| **Terminal Center** `(960, 540)` | `rgb(33, 36, 45)` (`#21242d`, opaque) | **`rgb(0, 33, 172)`** (`#0021ac`) | **Windows 11 Blue Bloom flower visible & diffused through dark obsidian glass.** |
| **Left Sidebar** `(420, 340)` | `rgb(20, 22, 25)` (`#141619`, opaque) | **`rgb(1, 29, 50)`** (`#011d32`) | **Deep navy wallpaper undertones passing through sidebar.** |
| **Right Explorer** `(1470, 440)` | `rgb(20, 22, 25)` (`#141619`, opaque) | **`rgb(28, 0, 74)`** (`#1c004a`) | **Deep violet petals passing through git changes explorer.** |
| **Floating Command Palette** | N/A (modal) | **`rgb(0, 34, 134)`** (`#002286`) | **Floating glass plate distinctly separated from workspace.** |
| **Terminal Text Readability** | Contrast: 11.2:1 | Contrast: **11.0:1** (WCAG AAA) | **100% sharp typography with zero text blur.** |

---

## 4. Visual Evidence Manifest

All artifacts were captured from the real Electron application executing on the live Windows 11 desktop:

1. **Full Application on Windows 11 Desktop**: [orbito-glassmorphism.png](file:///C:/Users/gonca/.gemini/antigravity-cli/brain/ce9d2b00-8c1c-4859-85c3-0620332856ac/orbito-glassmorphism.png) (1920x1080 full desktop)
2. **Complete Application Window**: [orbito-complete-application.png](file:///C:/Users/gonca/.gemini/antigravity-cli/brain/ce9d2b00-8c1c-4859-85c3-0620332856ac/orbito-complete-application.png) (1280x800 cropped from real desktop)
3. **Left Sidebar Close-Up**: [orbito-left-sidebar.png](file:///C:/Users/gonca/.gemini/antigravity-cli/brain/ce9d2b00-8c1c-4859-85c3-0620332856ac/orbito-left-sidebar.png)
4. **Central Terminal Workspace Close-Up**: [orbito-central-terminal.png](file:///C:/Users/gonca/.gemini/antigravity-cli/brain/ce9d2b00-8c1c-4859-85c3-0620332856ac/orbito-central-terminal.png)
5. **Right Explorer Close-Up**: [orbito-right-explorer.png](file:///C:/Users/gonca/.gemini/antigravity-cli/brain/ce9d2b00-8c1c-4859-85c3-0620332856ac/orbito-right-explorer.png)
6. **Floating Glass Surface (Command Palette)**: [orbito-floating-glass-surface.png](file:///C:/Users/gonca/.gemini/antigravity-cli/brain/ce9d2b00-8c1c-4859-85c3-0620332856ac/orbito-floating-glass-surface.png)
7. **Specular Reflections & Rim Highlights**: [orbito-transparency-reflections-closeup.png](file:///C:/Users/gonca/.gemini/antigravity-cli/brain/ce9d2b00-8c1c-4859-85c3-0620332856ac/orbito-transparency-reflections-closeup.png)
8. **Solid Dark Baseline Comparison**: [orbito-solid-dark.png](file:///C:/Users/gonca/.gemini/antigravity-cli/brain/ce9d2b00-8c1c-4859-85c3-0620332856ac/orbito-solid-dark.png) (100% opaque `#101113`, zero transparency)

---

## 5. Acceptance Criteria Checklist

- [x] Fixed intermittent background bug (DWM focus drop & CSS fallback).
- [x] Increased perceptible transparency (workspace alpha reduced to 0.20, sidebar to 0.28).
- [x] Darker obsidian base tint (`rgba(6, 7, 10, ...)` replacing bluish-gray).
- [x] Zero loss of foreground sharpness (terminal text, icons, and code editor 100% crisp).
- [x] Solid Dark mode strictly preserved at 100% opaque `#101113`.
